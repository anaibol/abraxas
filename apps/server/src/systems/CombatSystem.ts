import {
  calcMeleeDamage,
  calcRangedDamage,
  calcSpellDamage,
  calcHealAmount,
  MathUtils,
  ServerMessages,
  BroadcastFn,
  ServerMessageType,
} from "@abraxas/shared";
import type {
  SpellDef,
  WindupAction,
  EntityCombatState,
} from "@abraxas/shared";
import type { BuffSystem } from "./BuffSystem";
import { SpatialLookup, Entity } from "../utils/SpatialLookup";
import { Player } from "../schema/Player";

type SendToClientFn = <T extends ServerMessageType>(
  type: T,
  message?: ServerMessages[T],
) => void;

export class CombatSystem {
  private activeWindups = new Map<string, WindupAction>();
  private entityStates = new Map<string, EntityCombatState>();

  constructor(
    private spatial: SpatialLookup,
    private buffSystem: BuffSystem,
  ) {}

  getEntityState(sessionId: string): EntityCombatState {
    if (!this.entityStates.has(sessionId)) {
      this.entityStates.set(sessionId, {
        lastMeleeMs: 0,
        lastGcdMs: 0,
        spellCooldowns: new Map(),
        bufferedAction: null,
        windupAction: null,
      });
    }
    return this.entityStates.get(sessionId)!;
  }

  removeEntity(sessionId: string) {
    this.entityStates.delete(sessionId);
    this.activeWindups.delete(sessionId);
  }

  // Compatible with ArenaRoom's expectation
  processWindups(
    now: number,
    broadcast: BroadcastFn,
    onDeath: (entity: Entity, killerSessionId?: string) => void,
    onSummon?: (caster: Entity, spellId: string, x: number, y: number) => void,
  ) {
    for (const [sessionId, windup] of this.activeWindups.entries()) {
      if (now >= windup.completeAtMs) {
        this.activeWindups.delete(sessionId);
        this.resolveWindup(windup, broadcast, onDeath, now, onSummon);
      }
    }
  }

  // Placeholder for compatible ArenaRoom call
  processBufferedActions(
    _now: number, 
    _broadcast: BroadcastFn, 
    _getSendToClient?: (sessionId: string) => SendToClientFn | undefined
  ) {}

  tryAttack(
    attacker: Entity,
    targetTileX: number,
    targetTileY: number,
    broadcast: BroadcastFn,
    now: number,
    sendToClient?: SendToClientFn,
  ): boolean {
    const cs = this.getEntityState(attacker.sessionId);
    const stats = attacker.getStats()!;

    if (now < cs.lastGcdMs + 500) return false;
    if (this.activeWindups.has(attacker.sessionId)) return false;

    if (stats.meleeRange > 1) {
      const target = this.spatial.findEntityAtTile(targetTileX, targetTileY);
      if (!target || !target.alive || target.sessionId === attacker.sessionId) {
        sendToClient?.(ServerMessageType.InvalidTarget);
        return false;
      }
      const dist = MathUtils.manhattanDist(attacker.getPosition(), {
        x: target.tileX,
        y: target.tileY,
      });
      if (dist > stats.meleeRange) {
        sendToClient?.(ServerMessageType.InvalidTarget);
        return false;
      }
    }

    const windup: WindupAction = {
      type: "melee",
      completeAtMs: now + 300,
      attackerSessionId: attacker.sessionId,
      targetTileX,
      targetTileY,
    };

    this.activeWindups.set(attacker.sessionId, windup);
    broadcast(ServerMessageType.AttackStart, {
      sessionId: attacker.sessionId,
      targetTileX,
      targetTileY,
      windupMs: 300,
    });

    return true;
  }

  tryCast(
    caster: Entity,
    spellId: string,
    targetTileX: number,
    targetTileY: number,
    broadcast: BroadcastFn,
    now: number,
    sendToClient?: SendToClientFn,
  ): boolean {
    const cs = this.getEntityState(caster.sessionId);
    const spell = caster.getSpell?.(spellId);
    if (!spell) return false;

    if (now < cs.lastGcdMs + 500) return false;
    const cd = cs.spellCooldowns.get(spellId) || 0;
    if (now < cd) return false;
    if (this.activeWindups.has(caster.sessionId)) return false;

    if (caster instanceof Player && caster.mana < spell.manaCost) {
      sendToClient?.(ServerMessageType.Notification, { message: "Not enough mana" });
      return false;
    }

    const dist = MathUtils.manhattanDist(caster.getPosition(), {
      x: targetTileX,
      y: targetTileY,
    });
    if (dist > spell.rangeTiles) {
      sendToClient?.(ServerMessageType.InvalidTarget);
      return false;
    }

    if (caster instanceof Player) {
      caster.mana -= spell.manaCost;
    }

    cs.lastGcdMs = now;
    cs.spellCooldowns.set(spellId, now + (spell.cooldownMs || 0));

    const windup: WindupAction = {
      type: "spell",
      spellId,
      completeAtMs: now + spell.windupMs,
      attackerSessionId: caster.sessionId,
      targetTileX,
      targetTileY,
    };

    this.activeWindups.set(caster.sessionId, windup);
    broadcast(ServerMessageType.AttackStart, {
      sessionId: caster.sessionId,
      targetTileX,
      targetTileY,
      windupMs: spell.windupMs,
      spellId,
    });

    return true;
  }

  private resolveWindup(
    windup: WindupAction,
    broadcast: BroadcastFn,
    onDeath: (entity: Entity, killerSessionId?: string) => void,
    now: number,
    onSummon?: (caster: Entity, spellId: string, x: number, y: number) => void,
  ) {
    const attacker = this.spatial.findEntityBySessionId(windup.attackerSessionId);
    if (!attacker || !attacker.alive) return;

    if (windup.type === "melee") {
      this.resolveMelee(attacker, windup, broadcast, onDeath, now);
    } else {
      this.resolveSpell(attacker, windup, broadcast, onDeath, now, onSummon);
    }
  }

  private resolveMelee(
    attacker: Entity,
    windup: WindupAction,
    broadcast: BroadcastFn,
    onDeath: (entity: Entity, killerSessionId?: string) => void,
    now: number,
  ): void {
    const target = this.spatial.findEntityAtTile(
      windup.targetTileX,
      windup.targetTileY,
    );

    if (target && target.alive && target.sessionId !== attacker.sessionId) {
      const stats = attacker.getStats()!;
      const dist = MathUtils.manhattanDist(attacker.getPosition(), {
        x: target.tileX,
        y: target.tileY,
      });
      if (dist > stats.meleeRange + 1) {
        broadcast(ServerMessageType.AttackHit, {
          sessionId: attacker.sessionId,
          targetSessionId: null,
        });
        return;
      }

      if (this.buffSystem.isInvulnerable(target.sessionId, now)) {
        broadcast(ServerMessageType.AttackHit, {
          sessionId: attacker.sessionId,
          targetSessionId: target.sessionId,
          dodged: true,
        });
        return;
      }

      const attackerStr = this.boosted(attacker, "str", now);
      const attackerAgi = this.boosted(attacker, "agi", now);
      const defenderStr = this.boosted(target, "str", now);
      const defenderAgi = this.boosted(target, "agi", now);

      const result =
        stats.meleeRange > 1
          ? calcRangedDamage(attackerAgi, defenderStr, defenderAgi)
          : calcMeleeDamage(attackerStr, defenderStr, defenderAgi);

      if (result.dodged) {
        broadcast(ServerMessageType.AttackHit, {
          sessionId: attacker.sessionId,
          targetSessionId: target.sessionId,
          dodged: true,
        });
      } else {
        target.hp -= result.damage;
        broadcast(ServerMessageType.AttackHit, {
          sessionId: attacker.sessionId,
          targetSessionId: target.sessionId,
          damage: result.damage,
        });

        if (target.hp <= 0) {
          onDeath(target, attacker.sessionId);
        }
      }
    } else {
      broadcast(ServerMessageType.AttackHit, {
        sessionId: attacker.sessionId,
        targetSessionId: null,
      });
    }
  }

  private resolveSpell(
    attacker: Entity,
    windup: WindupAction,
    broadcast: BroadcastFn,
    onDeath: (entity: Entity, killerSessionId?: string) => void,
    now: number,
    onSummon?: (caster: Entity, spellId: string, x: number, y: number) => void,
  ): void {
    const spell = attacker.getSpell?.(windup.spellId!);
    if (!spell) return;

    // Handle summon spells
    if (spell.id.startsWith("summon_") && onSummon) {
      onSummon(attacker, spell.id, windup.targetTileX, windup.targetTileY);
      return;
    }

    if ((spell as any).aoeTiles > 0) {
      const victims = this.spatial.findEntitiesInRadius(
        windup.targetTileX,
        windup.targetTileY,
        (spell as any).aoeTiles,
      );
      for (const victim of victims) {
        if (victim.sessionId === attacker.sessionId) continue;
        this.applySpellToTarget(
          attacker,
          victim,
          spell,
          broadcast,
          onDeath,
          now,
        );
      }
    } else {
      const target = this.spatial.findEntityAtTile(
        windup.targetTileX,
        windup.targetTileY,
      );
      if (target && target.alive && target.sessionId !== attacker.sessionId) {
        const dist = MathUtils.manhattanDist(attacker.getPosition(), {
          x: target.tileX,
          y: target.tileY,
        });
        if (dist > spell.rangeTiles + 2) {
          return;
        }

        this.applySpellToTarget(
          attacker,
          target,
          spell,
          broadcast,
          onDeath,
          now,
        );
      }
    }
  }

  private applySpellToTarget(
    attacker: Entity,
    target: Entity,
    spell: SpellDef,
    broadcast: BroadcastFn,
    onDeath: (entity: Entity, killerSessionId?: string) => void,
    now: number,
  ) {
    if (this.buffSystem.isInvulnerable(target.sessionId, now)) return;

    const scalingStatName = (spell as any).scalingStat || "intStat";
    const scalingStatValue = this.boosted(attacker, scalingStatName, now);

    if ((spell as any).effect === "damage" || (spell as any).baseDamage > 0) {
      const defenderInt = this.boosted(target, "intStat", now);
      const damage = calcSpellDamage(
          (spell as any).baseDamage || 0, 
          scalingStatValue, 
          (spell as any).scalingRatio || 1, 
          defenderInt
      );
      target.hp -= damage;
      broadcast(ServerMessageType.AttackHit, {
        sessionId: attacker.sessionId,
        targetSessionId: target.sessionId,
        damage,
        spellId: spell.id,
      });

      if (target.hp <= 0) {
        onDeath(target, attacker.sessionId);
      }
    } else if ((spell as any).effect === "heal") {
      const heal = calcHealAmount(
          (spell as any).baseDamage || 0, 
          scalingStatValue, 
          (spell as any).scalingRatio || 1
      );
      target.hp = Math.min(target.maxHp, target.hp + heal);
    }

    if ((spell as any).effect === "stun" || (spell as any).buffStat === "stun") {
        this.buffSystem.applyStun(target.sessionId, (spell as any).durationMs || 1000, now);
    } else if ((spell as any).effect === "buff" || (spell as any).buffStat) {
        this.buffSystem.addBuff(
            target.sessionId, 
            spell.id, 
            (spell as any).buffStat || "armor", 
            (spell as any).buffAmount || 10, 
            (spell as any).durationMs || 5000, 
            now
        );
    }
  }

  private boosted(entity: Entity, stat: string, now: number): number {
    const base = (entity as any)[stat] || 0;
    const bonus = this.buffSystem.getBuffBonus(entity.sessionId, stat, now);
    return base + bonus;
  }

  cancelWindup(sessionId: string) {
    this.activeWindups.delete(sessionId);
  }
}

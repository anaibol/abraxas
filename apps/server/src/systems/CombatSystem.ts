import {
  calcMeleeDamage,
  calcRangedDamage,
  calcSpellDamage,
  calcHealAmount,
  MathUtils,
  SPELLS,
  GCD_MS,
  ServerMessageType,
} from "@abraxas/shared";
import type {
  ServerMessages,
  BroadcastFn,
  Spell,
  WindupAction,
  EntityCombatState,
  TileMap,
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
    private map: TileMap,
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

  hasLineOfSight(p1: { x: number; y: number }, p2: { x: number; y: number }): boolean {
    const line = MathUtils.getLine(p1, p2);
    // Skip first and last tiles (attacker and target)
    for (let i = 1; i < line.length - 1; i++) {
        const tile = line[i];
        if (this.map.collision[tile.y]?.[tile.x] === 1) {
            return false;
        }
    }
    return true;
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
    _getSendToClient?: (sessionId: string) => SendToClientFn | undefined,
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

    if (now < cs.lastGcdMs + GCD_MS) return false;
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
      
      if (!this.hasLineOfSight(attacker.getPosition(), { x: targetTileX, y: targetTileY })) {
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
      facing: attacker.facing,
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
    const spell = SPELLS[spellId];
    if (!spell) return false;

    if (now < cs.lastGcdMs + GCD_MS) return false;
    const cd = cs.spellCooldowns.get(spellId) || 0;
    if (now < cd) return false;
    if (this.activeWindups.has(caster.sessionId)) return false;

    if (caster instanceof Player && caster.mana < spell.manaCost) {
      sendToClient?.(ServerMessageType.Notification, {
        message: "Not enough mana",
      });
      return false;
    }

    if (spell.rangeTiles > 0) {
      const dist = MathUtils.manhattanDist(caster.getPosition(), {
        x: targetTileX,
        y: targetTileY,
      });
      if (dist > spell.rangeTiles) {
        sendToClient?.(ServerMessageType.InvalidTarget);
        return false;
      }
      if (!this.hasLineOfSight(caster.getPosition(), { x: targetTileX, y: targetTileY })) {
        sendToClient?.(ServerMessageType.InvalidTarget);
        return false;
      }
    }

    if (caster instanceof Player) {
      caster.mana -= spell.manaCost;
    }

    cs.lastGcdMs = now;
    cs.spellCooldowns.set(spellId, now + spell.cooldownMs);

    const windup: WindupAction = {
      type: "spell",
      spellId,
      completeAtMs: now + spell.windupMs,
      attackerSessionId: caster.sessionId,
      targetTileX,
      targetTileY,
    };

    this.activeWindups.set(caster.sessionId, windup);
    broadcast(ServerMessageType.CastStart, {
      sessionId: caster.sessionId,
      spellId,
      targetTileX,
      targetTileY,
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
    const attacker = this.spatial.findEntityBySessionId(
      windup.attackerSessionId,
    );
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
      if (dist > stats.meleeRange) {
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
    const spell = SPELLS[windup.spellId!];
    if (!spell) return;

    // Handle summon spells
    if (spell.id.startsWith("summon_") && onSummon) {
      onSummon(attacker, spell.id, windup.targetTileX, windup.targetTileY);
      return;
    }

    // Self-target spells (rangeTiles === 0) always target the caster
    if (spell.rangeTiles === 0) {
      this.applySpellToTarget(attacker, attacker, spell, broadcast, onDeath, now);
      return;
    }

    const aoeRadius = spell.aoeRadius ?? 0;
    if (aoeRadius > 0) {
      const victims = this.spatial.findEntitiesInRadius(
        windup.targetTileX,
        windup.targetTileY,
        aoeRadius,
      );
      for (const victim of victims) {
        if (victim.sessionId === attacker.sessionId) continue;
        // Skip same-faction targets (player vs player AOE ok, but NPC won't hit NPC)
        if (this.sameFaction(attacker, victim)) continue;
        this.applySpellToTarget(attacker, victim, spell, broadcast, onDeath, now);
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
        if (dist > spell.rangeTiles) return;
        this.applySpellToTarget(attacker, target, spell, broadcast, onDeath, now);
      }
    }
  }

  private sameFaction(a: Entity, b: Entity): boolean {
    // Both Player instances or both non-Player (NPC) instances
    return (a instanceof Player) === (b instanceof Player);
  }

  private applySpellToTarget(
    attacker: Entity,
    target: Entity,
    spell: Spell,
    broadcast: BroadcastFn,
    onDeath: (entity: Entity, killerSessionId?: string) => void,
    now: number,
  ) {
    // Merchants are invulnerable
    if ("type" in target && (target as { type: string }).type === "merchant") return;

    const isSelfCast = attacker.sessionId === target.sessionId;
    if (!isSelfCast && this.buffSystem.isInvulnerable(target.sessionId, now)) return;

    const scalingStatName = spell.scalingStat || "int";
    const scalingStatValue = this.boosted(attacker, scalingStatName, now);

    if (spell.effect === "stealth") {
      this.buffSystem.applyStealth(target.sessionId, spell.durationMs ?? 5000, now);
      broadcast(ServerMessageType.StealthApplied, {
        sessionId: target.sessionId,
        durationMs: spell.durationMs ?? 5000,
      });
    } else if (spell.effect === "dot") {
      this.buffSystem.addDoT(
        target.sessionId,
        attacker.sessionId,
        spell.id,
        spell.dotDamage ?? spell.baseDamage,
        spell.dotIntervalMs ?? 1000,
        spell.dotDurationMs ?? spell.durationMs ?? 5000,
        now,
      );
    } else if (spell.effect === "damage" || spell.baseDamage > 0) {
      const defenderInt = this.boosted(target, "int", now);
      const damage = calcSpellDamage(
        spell.baseDamage,
        scalingStatValue,
        spell.scalingRatio,
        defenderInt,
      );
      target.hp -= damage;
      broadcast(ServerMessageType.Damage, {
        targetSessionId: target.sessionId,
        amount: damage,
        hpAfter: target.hp,
        type: "magic",
      });
      if (target.hp <= 0) {
        onDeath(target, attacker.sessionId);
      }
    } else if (spell.effect === "heal") {
      const heal = calcHealAmount(spell.baseDamage, scalingStatValue, spell.scalingRatio);
      target.hp = Math.min(target.maxHp, target.hp + heal);
      broadcast(ServerMessageType.Heal, {
        sessionId: target.sessionId,
        amount: heal,
        hpAfter: target.hp,
      });
    } else if (spell.effect === "stun" || spell.buffStat === "stun") {
      this.buffSystem.applyStun(target.sessionId, spell.durationMs ?? 1000, now);
    } else if (spell.effect === "buff" || spell.buffStat) {
      this.buffSystem.addBuff(
        target.sessionId,
        spell.id,
        spell.buffStat ?? "armor",
        spell.buffAmount ?? 10,
        spell.durationMs ?? 5000,
        now,
      );
      broadcast(ServerMessageType.BuffApplied, {
        sessionId: target.sessionId,
        spellId: spell.id,
        durationMs: spell.durationMs ?? 5000,
      });
    }

    // Broadcast CastHit so clients play the spell visual effect
    broadcast(ServerMessageType.CastHit, {
      sessionId: attacker.sessionId,
      spellId: spell.id,
      targetTileX: target.tileX,
      targetTileY: target.tileY,
      fxId: spell.fxId,
    });
  }

  private boosted(entity: Entity, stat: string, now: number): number {
    let base = 0;
    if (stat === "str") base = entity.str;
    else if (stat === "agi") base = entity.agi;
    else if (stat === "int" || stat === "intStat") base = entity.intStat;

    const bonus = this.buffSystem.getBuffBonus(entity.sessionId, stat, now);
    return base + bonus;
  }

  cancelWindup(sessionId: string) {
    this.activeWindups.delete(sessionId);
  }
}

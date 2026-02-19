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

  constructor(
    private spatial: SpatialLookup,
    private buffSystem: BuffSystem,
    private map: TileMap,
  ) {}


  removeEntity(sessionId: string) {
    this.activeWindups.delete(sessionId);
  }

  hasLineOfSight(p1: { x: number; y: number }, p2: { x: number; y: number }): boolean {
    const line = MathUtils.getLine(p1, p2);
    // Skip first tile (attacker). We check the target tile and everything in between.
    for (let i = 1; i < line.length; i++) {
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

  processBufferedActions(
    now: number,
    broadcast: BroadcastFn,
    getSendToClient: (sessionId: string) => SendToClientFn | undefined,
    onDeath: (entity: Entity, killerSessionId?: string) => void,
    onSummon?: (caster: Entity, spellId: string, x: number, y: number) => void,
  ) {
    for (const sessionId of this.activeWindups.keys()) {
      const entity = this.spatial.findEntityBySessionId(sessionId);
      if (!entity || !entity.alive || !entity.bufferedAction) {
        if (entity) entity.bufferedAction = null;
        continue;
      }

      // Buffer expires if too old
      if (now - entity.bufferedAction.bufferedAt > 500) {
        entity.bufferedAction = null;
        continue;
      }

      const sendToClient = getSendToClient(sessionId);

      if (entity.bufferedAction.type === "attack") {
        if (
          this.tryAttack(
            entity,
            entity.bufferedAction.targetTileX ?? entity.tileX,
            entity.bufferedAction.targetTileY ?? entity.tileY,
            broadcast,
            now,
            sendToClient,
          )
        ) {
          entity.bufferedAction = null;
        }
      } else if (entity.bufferedAction.type === "cast" && entity.bufferedAction.spellId) {
        if (
          this.tryCast(
            entity,
            entity.bufferedAction.spellId,
            entity.bufferedAction.targetTileX ?? entity.tileX,
            entity.bufferedAction.targetTileY ?? entity.tileY,
            broadcast,
            now,
            sendToClient,
          )
        ) {
          entity.bufferedAction = null;
        }
      }
    }
  }

  tryAttack(
    attacker: Entity,
    targetTileX: number,
    targetTileY: number,
    broadcast: BroadcastFn,
    now: number,
    sendToClient?: SendToClientFn,
  ): boolean {
    if (this.buffSystem.isStunned(attacker.sessionId, now)) return false;

    const stats = attacker.getStats()!;

    if (now < attacker.lastGcdMs + GCD_MS || this.activeWindups.has(attacker.sessionId)) {
      attacker.bufferedAction = {
        type: "attack",
        targetTileX,
        targetTileY,
        bufferedAt: now,
      };
      return false;
    }

    // Facing check
    const targetFacing = MathUtils.getDirection(attacker.getPosition(), { x: targetTileX, y: targetTileY });
    if (attacker.tileX !== targetTileX || attacker.tileY !== targetTileY) {
      if (attacker.facing !== targetFacing) {
        attacker.facing = targetFacing;
      }
    }

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
      completeAtMs: now + stats.meleeWindupMs,
      attackerSessionId: attacker.sessionId,
      targetTileX,
      targetTileY,
    };

    attacker.lastGcdMs = now;
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
    if (this.buffSystem.isStunned(caster.sessionId, now)) return false;

    const spell = SPELLS[spellId];
    if (!spell) return false;

    // Class restriction: players may only cast spells assigned to their class
    if (caster instanceof Player) {
      const classStats = caster.getStats();
      if (classStats && !classStats.spells.includes(spellId)) {
        sendToClient?.(ServerMessageType.Notification, { message: "Your class cannot use that spell" });
        return false;
      }
    }

    if (now < caster.lastGcdMs + GCD_MS || this.activeWindups.has(caster.sessionId)) {
      caster.bufferedAction = {
        type: "cast",
        spellId,
        targetTileX,
        targetTileY,
        bufferedAt: now,
      };
      return false;
    }

    const cd = caster.spellCooldowns.get(spellId) || 0;
    if (now < cd) return false;

    // Facing check for targeted spells
    if (spell.rangeTiles > 0 && (caster.tileX !== targetTileX || caster.tileY !== targetTileY)) {
      const targetFacing = MathUtils.getDirection(caster.getPosition(), { x: targetTileX, y: targetTileY });
      if (caster.facing !== targetFacing) {
        caster.facing = targetFacing;
      }
    }

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

    caster.lastGcdMs = now;
    caster.spellCooldowns.set(spellId, now + spell.cooldownMs);

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
      broadcast(ServerMessageType.CastHit, {
        sessionId: attacker.sessionId,
        spellId: spell.id,
        targetTileX: windup.targetTileX,
        targetTileY: windup.targetTileY,
        fxId: spell.fxId,
      });
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
    if ((a instanceof Player) && (b instanceof Player)) {
      // Party members are same faction (prevent friendly fire)
      if (a.partyId && a.partyId === b.partyId) return true;
      return false; // Players can hit other players not in their party
    }
    // NPCs of same type are same faction
    if (!(a instanceof Player) && !(b instanceof Player)) {
      return a.type === b.type;
    }
    return false; // Player vs NPC always ok
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
      broadcast(ServerMessageType.StunApplied, {
        targetSessionId: target.sessionId,
        durationMs: spell.durationMs ?? 1000,
      });
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
}

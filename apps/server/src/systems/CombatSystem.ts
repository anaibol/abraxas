import {
  SPELLS,
  GCD_MS,
  BUFFER_WINDOW_MS,
  DIRECTION_DELTA,
  calcMeleeDamage,
  calcRangedDamage,
  calcSpellDamage,
  calcHealAmount,
  MathUtils,
} from "@abraxas/shared";
import type {
  SpellDef,
  BufferedAction,
  WindupAction,
  EntityCombatState,
} from "@abraxas/shared";
import type { BuffSystem } from "./BuffSystem";
import { EntityUtils, Entity } from "../utils/EntityUtils";
import { SpatialLookup } from "../utils/SpatialLookup";

import {
  ServerMessages,
  BroadcastFn,
  ServerMessageType,
} from "@abraxas/shared";

type SendToClientFn = <T extends ServerMessageType>(
  type: T,
  data?: ServerMessages[T],
) => void;

export class CombatSystem {
  private state = new Map<string, EntityCombatState>();
  private activeWindups: WindupAction[] = [];

  constructor(
    private buffSystem: BuffSystem,
    private spatial: SpatialLookup,
  ) {}

  private getCombatState(sessionId: string): EntityCombatState {
    let cs = this.state.get(sessionId);
    if (!cs) {
      cs = {
        lastGcdMs: 0,
        lastMeleeMs: 0,
        spellCooldowns: new Map(),
        bufferedAction: null,
        windupAction: null,
      };
      this.state.set(sessionId, cs);
    }
    return cs;
  }

  removeEntity(sessionId: string): void {
    this.state.delete(sessionId);
    this.activeWindups = this.activeWindups.filter(
      (w) => w.attackerSessionId !== sessionId,
    );
  }

  tryAttack(
    attacker: Entity,
    now: number,
    broadcast: BroadcastFn,
    targetTileX?: number,
    targetTileY?: number,
    sendToClient?: SendToClientFn,
  ): boolean {
    const cs = this.getCombatState(attacker.sessionId);
    const stats = EntityUtils.getStats(attacker);
    if (!stats) return false;

    // Can't attack while stunned
    if (this.buffSystem.isStunned(attacker.sessionId, now)) return false;

    // Check if in windup
    if (cs.windupAction) {
      this.tryBuffer(cs, {
        type: "attack",
        targetTileX,
        targetTileY,
        bufferedAt: now,
      });
      return false;
    }

    // Check GCD
    if (now - cs.lastGcdMs < GCD_MS) {
      this.tryBuffer(cs, {
        type: "attack",
        targetTileX,
        targetTileY,
        bufferedAt: now,
      });
      sendToClient?.(ServerMessageType.Error, { message: "Global cooldown" });
      return false;
    }

    // Check melee cooldown
    if (now - cs.lastMeleeMs < stats.meleeCooldownMs) {
      this.tryBuffer(cs, {
        type: "attack",
        targetTileX,
        targetTileY,
        bufferedAt: now,
      });
      sendToClient?.(ServerMessageType.Error, {
        message: "Attack on cooldown",
      });
      return false;
    }

    // Determine target entity and position
    let target = this.spatial.findEntityAtTile(
      targetTileX ?? -1,
      targetTileY ?? -1,
    );

    // Target validation for ranged
    if (stats.meleeRange > 1) {
      if (!target || !target.alive || target.sessionId === attacker.sessionId) {
        sendToClient?.(ServerMessageType.InvalidTarget);
        return false;
      }
      const dist = MathUtils.manhattanDist(EntityUtils.getPosition(attacker), {
        x: target.tileX,
        y: target.tileY,
      });
      if (dist > stats.meleeRange) {
        sendToClient?.(ServerMessageType.InvalidTarget);
        return false;
      }
    } else {
      // Melee logic: use facing if no target tile specified or if specified tile is too far
      const delta = DIRECTION_DELTA[attacker.facing];
      targetTileX = attacker.tileX + delta.dx;
      targetTileY = attacker.tileY + delta.dy;
    }

    const finalTargetX = targetTileX!;
    const finalTargetY = targetTileY!;

    cs.lastGcdMs = now;
    cs.lastMeleeMs = now;
    cs.bufferedAction = null;

    // Attacking breaks stealth
    this.buffSystem.breakStealth(attacker.sessionId);

    const windup: WindupAction = {
      type: "melee",
      completeAtMs: now + stats.meleeWindupMs,
      attackerSessionId: attacker.sessionId,
      targetTileX: finalTargetX,
      targetTileY: finalTargetY,
    };

    cs.windupAction = windup;
    this.activeWindups.push(windup);
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
    now: number,
    broadcast: BroadcastFn,
    sendToClient?: SendToClientFn,
  ): boolean {
    const cs = this.getCombatState(caster.sessionId);
    const stats = EntityUtils.getStats(caster);
    if (!stats) return false;

    const spell = SPELLS[spellId];
    if (!spell) return false;

    // Check that this entity actually has this spell
    if (!stats.spells.includes(spellId)) return false;

    // Can't cast while stunned
    if (this.buffSystem.isStunned(caster.sessionId, now)) return false;

    // Check if in windup
    if (cs.windupAction) {
      this.tryBuffer(cs, {
        type: "cast",
        spellId,
        targetTileX,
        targetTileY,
        bufferedAt: now,
      });
      return false;
    }

    // Check GCD
    if (now - cs.lastGcdMs < GCD_MS) {
      this.tryBuffer(cs, {
        type: "cast",
        spellId,
        targetTileX,
        targetTileY,
        bufferedAt: now,
      });
      sendToClient?.(ServerMessageType.Error, { message: "Global cooldown" });
      return false;
    }

    // Per-spell cooldown
    const lastCast = cs.spellCooldowns.get(spellId) ?? 0;
    if (now - lastCast < spell.cooldownMs) {
      this.tryBuffer(cs, {
        type: "cast",
        spellId,
        targetTileX,
        targetTileY,
        bufferedAt: now,
      });
      sendToClient?.(ServerMessageType.Error, { message: "Spell on cooldown" });
      return false;
    }

    // Check mana
    if (caster.mana < spell.manaCost) {
      sendToClient?.(ServerMessageType.Error, { message: "Not enough mana" });
      return false;
    }

    // Self-target spells (range 0) don't need range check
    if (spell.rangeTiles > 0) {
      const dist = MathUtils.manhattanDist(EntityUtils.getPosition(caster), {
        x: targetTileX,
        y: targetTileY,
      });
      if (dist > spell.rangeTiles) return false;
    }

    // For single-target offensive spells (rangeTiles > 0, not AoE), validate target exists before mana deduction
    if (spell.rangeTiles > 0 && spell.effect !== "aoe") {
      const target = this.spatial.findEntityAtTile(targetTileX, targetTileY);
      if (!target || !target.alive || target.sessionId === caster.sessionId) {
        sendToClient?.(ServerMessageType.InvalidTarget);
        return false;
      }
    }

    // Deduct mana at cast start
    caster.mana -= spell.manaCost;

    cs.lastGcdMs = now;
    cs.spellCooldowns.set(spellId, now);
    cs.bufferedAction = null;

    // Casting breaks stealth
    this.buffSystem.breakStealth(caster.sessionId);

    // Self-target spells target caster's tile
    const finalTargetX = spell.rangeTiles === 0 ? caster.tileX : targetTileX;
    const finalTargetY = spell.rangeTiles === 0 ? caster.tileY : targetTileY;

    const windup: WindupAction = {
      type: "spell",
      completeAtMs: now + spell.windupMs,
      attackerSessionId: caster.sessionId,
      targetTileX: finalTargetX,
      targetTileY: finalTargetY,
      spellId,
    };

    cs.windupAction = windup;
    this.activeWindups.push(windup);
    broadcast(ServerMessageType.CastStart, {
      sessionId: caster.sessionId,
      spellId,
      targetTileX: finalTargetX,
      targetTileY: finalTargetY,
    });

    return true;
  }

  processWindups(
    now: number,
    broadcast: BroadcastFn,
    onDeath: (entity: Entity, killerSessionId: string) => void,
    onSummon?: (caster: Entity, spellId: string, x: number, y: number) => void,
  ): void {
    const remaining: WindupAction[] = [];

    for (const windup of this.activeWindups) {
      if (now < windup.completeAtMs) {
        remaining.push(windup);
        continue;
      }

      const attacker = this.spatial.findEntityBySessionId(
        windup.attackerSessionId,
      );
      if (!attacker || !attacker.alive) {
        const cs = this.state.get(windup.attackerSessionId);
        if (cs) cs.windupAction = null;
        continue;
      }

      const cs = this.state.get(windup.attackerSessionId);
      if (cs) cs.windupAction = null;

      if (windup.type === "melee") {
        this.resolveMelee(attacker, windup, broadcast, onDeath, now);
      } else {
        this.resolveSpell(attacker, windup, broadcast, onDeath, now, onSummon);
      }
    }

    this.activeWindups = remaining;
  }

  processBufferedActions(
    now: number,
    broadcast: BroadcastFn,
    sendToClientFor?: (sessionId: string) => SendToClientFn,
  ): void {
    for (const [sessionId, cs] of this.state.entries()) {
      if (!cs.bufferedAction) continue;

      if (now - cs.bufferedAction.bufferedAt > BUFFER_WINDOW_MS) {
        cs.bufferedAction = null;
        continue;
      }

      const entity = this.spatial.findEntityBySessionId(sessionId);
      if (!entity || !entity.alive) {
        cs.bufferedAction = null;
        continue;
      }

      const action = cs.bufferedAction;
      const sendToClient = sendToClientFor?.(sessionId);
      if (action.type === "attack") {
        this.tryAttack(
          entity,
          now,
          broadcast,
          action.targetTileX,
          action.targetTileY,
          sendToClient,
        );
      } else if (action.type === "cast") {
        this.tryCast(
          entity,
          action.spellId!,
          action.targetTileX!,
          action.targetTileY!,
          now,
          broadcast,
          sendToClient,
        );
      }
    }
  }

  private tryBuffer(cs: EntityCombatState, action: BufferedAction): void {
    if (!cs.bufferedAction) {
      cs.bufferedAction = action;
    }
  }

  private killTarget(
    target: Entity,
    killerSessionId: string,
    broadcast: BroadcastFn,
    onDeath: (entity: Entity, killerSessionId: string) => void,
  ): void {
    target.hp = 0;
    target.alive = false;
    broadcast(ServerMessageType.Death, {
      sessionId: target.sessionId,
      killerSessionId,
    });
    onDeath(target, killerSessionId);
  }

  private resolveMelee(
    attacker: Entity,
    windup: WindupAction,
    broadcast: BroadcastFn,
    onDeath: (entity: Entity, killerSessionId: string) => void,
    now: number,
  ): void {
    const stats = EntityUtils.getStats(attacker)!;
    const target = this.spatial.findEntityAtTile(
      windup.targetTileX,
      windup.targetTileY,
    );

    if (target && target.alive && target.sessionId !== attacker.sessionId) {
      // Check invulnerability
      if (this.buffSystem.isInvulnerable(target.sessionId, now)) {
        broadcast(ServerMessageType.AttackHit, {
          sessionId: attacker.sessionId,
          targetSessionId: target.sessionId,
          dodged: true,
        });
        return;
      }

      // Use ranged formula for archer, melee for others
      const attackerStr =
        attacker.str +
        this.buffSystem.getBuffBonus(attacker.sessionId, "str", now);
      const attackerAgi =
        attacker.agi +
        this.buffSystem.getBuffBonus(attacker.sessionId, "agi", now);
      const defenderStr =
        target.str + this.buffSystem.getBuffBonus(target.sessionId, "str", now);
      const defenderAgi =
        target.agi + this.buffSystem.getBuffBonus(target.sessionId, "agi", now);

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
        return;
      }

      target.hp -= result.damage;

      broadcast(ServerMessageType.AttackHit, {
        sessionId: attacker.sessionId,
        targetSessionId: target.sessionId,
        dodged: false,
      });
      broadcast(ServerMessageType.Damage, {
        targetSessionId: target.sessionId,
        amount: result.damage,
        hpAfter: target.hp,
        type: "physical",
      });

      if (target.hp <= 0) {
        this.killTarget(target, attacker.sessionId, broadcast, onDeath);
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
    onDeath: (entity: Entity, killerSessionId: string) => void,
    now: number,
    onSummon?: (caster: Entity, spellId: string, x: number, y: number) => void,
  ): void {
    const spell = SPELLS[windup.spellId!];
    if (!spell) return;

    broadcast(ServerMessageType.CastHit, {
      sessionId: attacker.sessionId,
      spellId: windup.spellId ?? "",
      targetTileX: windup.targetTileX,
      targetTileY: windup.targetTileY,
      fxId: spell.fxId,
    });

    const casterInt =
      attacker.intStat +
      this.buffSystem.getBuffBonus(attacker.sessionId, "int", now);
    const casterStr =
      attacker.str +
      this.buffSystem.getBuffBonus(attacker.sessionId, "str", now);
    const casterAgi =
      attacker.agi +
      this.buffSystem.getBuffBonus(attacker.sessionId, "agi", now);
    const scalingValue =
      spell.scalingStat === "str"
        ? casterStr
        : spell.scalingStat === "agi"
          ? casterAgi
          : casterInt;

    // Self-target effects
    if (spell.effect === "buff") {
      // ... existing buff logic ...
      if (spell.buffStat && spell.buffAmount && spell.durationMs) {
        this.buffSystem.addBuff(
          attacker.sessionId,
          spell.id,
          spell.buffStat,
          spell.buffAmount,
          spell.durationMs,
          now,
        );
        broadcast(ServerMessageType.BuffApplied, {
          sessionId: attacker.sessionId,
          spellId: spell.id,
          durationMs: spell.durationMs,
        });
      }
      return;
    }

    if (spell.effect === "stealth") {
      if (spell.durationMs) {
        this.buffSystem.applyStealth(attacker.sessionId, spell.durationMs, now);
        broadcast(ServerMessageType.StealthApplied, {
          sessionId: attacker.sessionId,
          durationMs: spell.durationMs,
        });
      }
      return;
    }

    if (spell.effect === "heal") {
      const healAmount = calcHealAmount(
        spell.baseDamage,
        casterInt,
        spell.scalingRatio,
      );
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
      broadcast(ServerMessageType.Heal, {
        sessionId: attacker.sessionId,
        amount: healAmount,
        hpAfter: attacker.hp,
      });
      return;
    }

    if (spell.effect === "summon") {
      onSummon?.(attacker, spell.id, windup.targetTileX, windup.targetTileY);
      return;
    }

    // AoE spells hit multiple targets
    if (spell.effect === "aoe" && spell.aoeRadius) {
      const targets = this.spatial.findEntitiesInRadius(
        windup.targetTileX,
        windup.targetTileY,
        spell.aoeRadius,
        attacker.sessionId,
      );
      for (const target of targets) {
        this.applySpellToTarget(
          attacker,
          target,
          spell,
          scalingValue,
          broadcast,
          onDeath,
          now,
        );
      }
      return;
    }

    // Single-target damage/dot/stun
    const target = this.spatial.findEntityAtTile(
      windup.targetTileX,
      windup.targetTileY,
    );
    if (target && target.alive && target.sessionId !== attacker.sessionId) {
      this.applySpellToTarget(
        attacker,
        target,
        spell,
        scalingValue,
        broadcast,
        onDeath,
        now,
      );
    }
  }

  private applySpellToTarget(
    attacker: Entity,
    target: Entity,
    spell: SpellDef,
    scalingValue: number,
    broadcast: BroadcastFn,
    onDeath: (entity: Entity, killerSessionId: string) => void,
    now: number,
  ): void {
    // Check invulnerability
    if (this.buffSystem.isInvulnerable(target.sessionId, now)) return;

    const defenderInt =
      target.intStat +
      this.buffSystem.getBuffBonus(target.sessionId, "int", now);
    const damage = calcSpellDamage(
      spell.baseDamage,
      scalingValue,
      spell.scalingRatio,
      defenderInt,
    );

    if (damage > 0) {
      target.hp -= damage;

      broadcast(ServerMessageType.Damage, {
        targetSessionId: target.sessionId,
        amount: damage,
        hpAfter: target.hp,
        type: "magic",
      });

      if (target.hp <= 0) {
        this.killTarget(target, attacker.sessionId, broadcast, onDeath);
        return;
      }
    }

    // Apply DoT
    if (
      spell.effect === "dot" &&
      spell.dotDamage &&
      spell.dotIntervalMs &&
      spell.dotDurationMs
    ) {
      this.buffSystem.addDoT(
        target.sessionId,
        attacker.sessionId,
        spell.id,
        spell.dotDamage,
        spell.dotIntervalMs,
        spell.dotDurationMs,
        now,
      );
    }

    // Apply stun
    if (spell.effect === "stun" && spell.durationMs) {
      this.buffSystem.applyStun(target.sessionId, spell.durationMs, now);
      broadcast(ServerMessageType.StunApplied, {
        targetSessionId: target.sessionId,
        durationMs: spell.durationMs,
      });
    }
  }
}

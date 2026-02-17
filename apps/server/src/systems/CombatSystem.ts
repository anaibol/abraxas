import {
  CLASS_STATS,
  SPELLS,
  GCD_MS,
  BUFFER_WINDOW_MS,
  DIRECTION_DELTA,
  calcMeleeDamage,
  calcRangedDamage,
  calcSpellDamage,
  calcHealAmount,
} from "@ao5/shared";
import type { Direction, SpellDef } from "@ao5/shared";
import type { Player } from "../schema/Player";
import type { BuffSystem } from "./BuffSystem";
import { logger } from "../logger";

interface BufferedAction {
  type: "attack" | "cast";
  spellId?: string;
  targetTileX?: number;
  targetTileY?: number;
  bufferedAt: number;
}

interface WindupAction {
  type: "melee" | "spell";
  completeAtMs: number;
  attackerSessionId: string;
  targetTileX: number;
  targetTileY: number;
  spellId?: string;
}

interface PlayerCombatState {
  lastGcdMs: number;
  lastMeleeMs: number;
  spellCooldowns: Map<string, number>;
  bufferedAction: BufferedAction | null;
  windupAction: WindupAction | null;
}

interface BroadcastFn {
  (type: string, data: Record<string, unknown>): void;
}

type FindPlayerAtTileFn = (x: number, y: number) => Player | undefined;
type SendToClientFn = (type: string, data?: Record<string, unknown>) => void;

export class CombatSystem {
  private state = new Map<string, PlayerCombatState>();
  private activeWindups: WindupAction[] = [];
  private buffSystem: BuffSystem;

  constructor(buffSystem: BuffSystem) {
    this.buffSystem = buffSystem;
  }

  private getCombatState(sessionId: string): PlayerCombatState {
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

  removePlayer(sessionId: string) {
    this.state.delete(sessionId);
    this.activeWindups = this.activeWindups.filter(
      (w) => w.attackerSessionId !== sessionId
    );
  }

  tryAttack(
    attacker: Player,
    now: number,
    broadcast: BroadcastFn,
    tick: number,
    roomId: string,
    targetTileX?: number,
    targetTileY?: number,
    findPlayerAtTile?: FindPlayerAtTileFn,
    sendToClient?: SendToClientFn,
  ): boolean {
    const cs = this.getCombatState(attacker.sessionId);
    const stats = CLASS_STATS[attacker.classType];

    // Can't attack while stunned
    if (this.buffSystem.isStunned(attacker.sessionId, now)) return false;

    // Check if in windup
    if (cs.windupAction) {
      this.tryBuffer(cs, { type: "attack", targetTileX, targetTileY, bufferedAt: now });
      return false;
    }

    // Check GCD
    if (now - cs.lastGcdMs < GCD_MS) {
      this.tryBuffer(cs, { type: "attack", targetTileX, targetTileY, bufferedAt: now });
      return false;
    }

    // Check melee cooldown
    if (now - cs.lastMeleeMs < stats.meleeCooldownMs) {
      this.tryBuffer(cs, { type: "attack", targetTileX, targetTileY, bufferedAt: now });
      return false;
    }

    // Determine target tile
    let finalTargetX: number;
    let finalTargetY: number;

    if (targetTileX != null && targetTileY != null && stats.meleeRange > 1) {
      // Ranged attack with explicit target tile — validate before committing
      const dx = Math.abs(targetTileX - attacker.tileX);
      const dy = Math.abs(targetTileY - attacker.tileY);
      if (dx + dy > stats.meleeRange) {
        sendToClient?.("invalid_target");
        return false;
      }

      // Validate a living enemy exists at the target tile
      if (findPlayerAtTile) {
        const target = findPlayerAtTile(targetTileX, targetTileY);
        if (!target || !target.alive || target.sessionId === attacker.sessionId) {
          sendToClient?.("invalid_target");
          return false;
        }
      }

      finalTargetX = targetTileX;
      finalTargetY = targetTileY;
    } else {
      // Melee attack: target tile at meleeRange in facing direction
      const delta = DIRECTION_DELTA[attacker.facing as Direction];
      const range = stats.meleeRange;
      finalTargetX = attacker.tileX + delta.dx * range;
      finalTargetY = attacker.tileY + delta.dy * range;
    }

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

    broadcast("attack_start", {
      sessionId: attacker.sessionId,
      facing: attacker.facing,
    });

    return true;
  }

  tryCast(
    caster: Player,
    spellId: string,
    targetTileX: number,
    targetTileY: number,
    now: number,
    broadcast: BroadcastFn,
    tick: number,
    roomId: string,
    findPlayerAtTile?: FindPlayerAtTileFn,
    sendToClient?: SendToClientFn,
  ): boolean {
    const cs = this.getCombatState(caster.sessionId);
    const stats = CLASS_STATS[caster.classType];
    const spell = SPELLS[spellId];

    if (!spell) return false;

    // Check that this class actually has this spell
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
      return false;
    }

    // Check mana (check before target validation — don't reveal "invalid target" if you can't cast anyway)
    if (caster.mana < spell.manaCost) return false;

    // Self-target spells (range 0) don't need range check
    if (spell.rangeTiles > 0) {
      const dx = Math.abs(targetTileX - caster.tileX);
      const dy = Math.abs(targetTileY - caster.tileY);
      if (dx + dy > spell.rangeTiles) return false;
    }

    // For single-target offensive spells (rangeTiles > 0, not AoE), validate target exists before mana deduction
    if (spell.rangeTiles > 0 && spell.effect !== "aoe" && findPlayerAtTile) {
      const target = findPlayerAtTile(targetTileX, targetTileY);
      if (!target || !target.alive || target.sessionId === caster.sessionId) {
        sendToClient?.("invalid_target");
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

    broadcast("cast_start", {
      sessionId: caster.sessionId,
      spellId,
      targetTileX: finalTargetX,
      targetTileY: finalTargetY,
    });

    return true;
  }

  processWindups(
    now: number,
    findPlayerAtTile: (x: number, y: number) => Player | undefined,
    findPlayersInRadius: (cx: number, cy: number, radius: number, excludeId: string) => Player[],
    getPlayer: (sessionId: string) => Player | undefined,
    broadcast: BroadcastFn,
    tick: number,
    roomId: string,
    onDeath: (player: Player, killerSessionId: string) => void
  ) {
    const remaining: WindupAction[] = [];

    for (const windup of this.activeWindups) {
      if (now < windup.completeAtMs) {
        remaining.push(windup);
        continue;
      }

      const attacker = getPlayer(windup.attackerSessionId);
      if (!attacker || !attacker.alive) {
        const cs = this.state.get(windup.attackerSessionId);
        if (cs) cs.windupAction = null;
        continue;
      }

      const cs = this.state.get(windup.attackerSessionId);
      if (cs) cs.windupAction = null;

      if (windup.type === "melee") {
        this.resolveMelee(
          attacker,
          windup,
          findPlayerAtTile,
          broadcast,
          tick,
          roomId,
          onDeath,
          now
        );
      } else {
        this.resolveSpell(
          attacker,
          windup,
          findPlayerAtTile,
          findPlayersInRadius,
          broadcast,
          tick,
          roomId,
          onDeath,
          now
        );
      }
    }

    this.activeWindups = remaining;
  }

  processBufferedActions(
    now: number,
    getPlayer: (sessionId: string) => Player | undefined,
    broadcast: BroadcastFn,
    tick: number,
    roomId: string,
    findPlayerAtTile?: FindPlayerAtTileFn,
    sendToClientFor?: (sessionId: string) => SendToClientFn,
  ) {
    for (const [sessionId, cs] of this.state.entries()) {
      if (!cs.bufferedAction) continue;

      if (now - cs.bufferedAction.bufferedAt > BUFFER_WINDOW_MS) {
        cs.bufferedAction = null;
        continue;
      }

      const player = getPlayer(sessionId);
      if (!player || !player.alive) {
        cs.bufferedAction = null;
        continue;
      }

      const action = cs.bufferedAction;
      const sendToClient = sendToClientFor?.(sessionId);
      if (action.type === "attack") {
        this.tryAttack(player, now, broadcast, tick, roomId, action.targetTileX, action.targetTileY, findPlayerAtTile, sendToClient);
      } else if (action.type === "cast") {
        this.tryCast(
          player,
          action.spellId!,
          action.targetTileX!,
          action.targetTileY!,
          now,
          broadcast,
          tick,
          roomId,
          findPlayerAtTile,
          sendToClient,
        );
      }
    }
  }

  private tryBuffer(cs: PlayerCombatState, action: BufferedAction) {
    if (!cs.bufferedAction) {
      cs.bufferedAction = action;
    }
  }

  private resolveMelee(
    attacker: Player,
    windup: WindupAction,
    findPlayerAtTile: (x: number, y: number) => Player | undefined,
    broadcast: BroadcastFn,
    tick: number,
    roomId: string,
    onDeath: (player: Player, killerSessionId: string) => void,
    now: number
  ) {
    const stats = CLASS_STATS[attacker.classType];
    const target = findPlayerAtTile(windup.targetTileX, windup.targetTileY);

    if (target && target.alive && target.sessionId !== attacker.sessionId) {
      // Check invulnerability
      if (this.buffSystem.isInvulnerable(target.sessionId, now)) {
        broadcast("attack_hit", {
          sessionId: attacker.sessionId,
          targetSessionId: target.sessionId,
          dodged: true,
        });
        return;
      }

      // Use ranged formula for archer, melee for others
      const attackerStr = attacker.str + this.buffSystem.getBuffBonus(attacker.sessionId, "str", now);
      const attackerAgi = attacker.agi + this.buffSystem.getBuffBonus(attacker.sessionId, "agi", now);
      const defenderStr = target.str + this.buffSystem.getBuffBonus(target.sessionId, "str", now);
      const defenderAgi = target.agi + this.buffSystem.getBuffBonus(target.sessionId, "agi", now);

      const result = stats.meleeRange > 1
        ? calcRangedDamage(attackerAgi, defenderStr, defenderAgi)
        : calcMeleeDamage(attackerStr, defenderStr, defenderAgi);

      if (result.dodged) {
        broadcast("attack_hit", {
          sessionId: attacker.sessionId,
          targetSessionId: target.sessionId,
          dodged: true,
        });
        return;
      }

      target.hp -= result.damage;

      broadcast("attack_hit", {
        sessionId: attacker.sessionId,
        targetSessionId: target.sessionId,
      });

      broadcast("damage", {
        targetSessionId: target.sessionId,
        amount: result.damage,
        hpAfter: target.hp,
        type: "physical",
      });

      if (target.hp <= 0) {
        target.hp = 0;
        target.alive = false;
        broadcast("death", { sessionId: target.sessionId, killerSessionId: attacker.sessionId });
        onDeath(target, attacker.sessionId);
      }
    } else {
      broadcast("attack_hit", {
        sessionId: attacker.sessionId,
        targetSessionId: null,
      });
    }
  }

  private resolveSpell(
    attacker: Player,
    windup: WindupAction,
    findPlayerAtTile: (x: number, y: number) => Player | undefined,
    findPlayersInRadius: (cx: number, cy: number, radius: number, excludeId: string) => Player[],
    broadcast: BroadcastFn,
    tick: number,
    roomId: string,
    onDeath: (player: Player, killerSessionId: string) => void,
    now: number
  ) {
    const spell = SPELLS[windup.spellId!];
    if (!spell) return;

    broadcast("cast_hit", {
      sessionId: attacker.sessionId,
      spellId: windup.spellId,
      targetTileX: windup.targetTileX,
      targetTileY: windup.targetTileY,
    });

    const casterInt = attacker.intStat + this.buffSystem.getBuffBonus(attacker.sessionId, "int", now);
    const casterStr = attacker.str + this.buffSystem.getBuffBonus(attacker.sessionId, "str", now);
    const casterAgi = attacker.agi + this.buffSystem.getBuffBonus(attacker.sessionId, "agi", now);
    const scalingValue = spell.scalingStat === "str" ? casterStr
      : spell.scalingStat === "agi" ? casterAgi
      : casterInt;

    // Self-target effects
    if (spell.effect === "buff") {
      if (spell.buffStat && spell.buffAmount && spell.durationMs) {
        this.buffSystem.addBuff(
          attacker.sessionId,
          spell.id,
          spell.buffStat,
          spell.buffAmount,
          spell.durationMs,
          now
        );
        broadcast("buff_applied", {
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
        broadcast("stealth_applied", {
          sessionId: attacker.sessionId,
          durationMs: spell.durationMs,
        });
      }
      return;
    }

    if (spell.effect === "heal") {
      const healAmount = calcHealAmount(spell.baseDamage, casterInt, spell.scalingRatio);
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
      broadcast("heal", {
        sessionId: attacker.sessionId,
        amount: healAmount,
        hpAfter: attacker.hp,
      });
      return;
    }

    // AoE spells hit multiple targets
    if (spell.effect === "aoe" && spell.aoeRadius) {
      const targets = findPlayersInRadius(
        windup.targetTileX,
        windup.targetTileY,
        spell.aoeRadius,
        attacker.sessionId
      );
      for (const target of targets) {
        this.applySpellToTarget(attacker, target, spell, scalingValue, broadcast, onDeath, now);
      }
      return;
    }

    // Single-target damage/dot/stun
    const target = findPlayerAtTile(windup.targetTileX, windup.targetTileY);
    if (target && target.alive && target.sessionId !== attacker.sessionId) {
      this.applySpellToTarget(attacker, target, spell, scalingValue, broadcast, onDeath, now);
    }
  }

  private applySpellToTarget(
    attacker: Player,
    target: Player,
    spell: SpellDef,
    scalingValue: number,
    broadcast: BroadcastFn,
    onDeath: (player: Player, killerSessionId: string) => void,
    now: number
  ) {
    // Check invulnerability
    if (this.buffSystem.isInvulnerable(target.sessionId, now)) return;

    const defenderInt = target.intStat + this.buffSystem.getBuffBonus(target.sessionId, "int", now);
    const damage = calcSpellDamage(spell.baseDamage, scalingValue, spell.scalingRatio, defenderInt);

    if (damage > 0) {
      target.hp -= damage;

      broadcast("damage", {
        targetSessionId: target.sessionId,
        amount: damage,
        hpAfter: target.hp,
        type: "magic",
      });

      if (target.hp <= 0) {
        target.hp = 0;
        target.alive = false;
        broadcast("death", { sessionId: target.sessionId, killerSessionId: attacker.sessionId });
        onDeath(target, attacker.sessionId);
        return;
      }
    }

    // Apply DoT
    if (spell.effect === "dot" && spell.dotDamage && spell.dotIntervalMs && spell.dotDurationMs) {
      this.buffSystem.addDoT(
        target.sessionId,
        attacker.sessionId,
        spell.id,
        spell.dotDamage,
        spell.dotIntervalMs,
        spell.dotDurationMs,
        now
      );
    }

    // Apply stun
    if (spell.effect === "stun" && spell.durationMs) {
      this.buffSystem.applyStun(target.sessionId, spell.durationMs, now);
      broadcast("stun_applied", {
        targetSessionId: target.sessionId,
        durationMs: spell.durationMs,
      });
    }
  }
}

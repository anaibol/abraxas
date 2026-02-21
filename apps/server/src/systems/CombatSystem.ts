import type { Ability, BroadcastFn, ServerMessages, TileMap, WindupAction } from "@abraxas/shared";
import {
  ABILITIES,
  BUFFER_WINDOW_MS,
  calcHealAmount,
  calcMeleeDamage,
  calcRangedDamage,
  DamageSchool,
  GCD_MS,
  MathUtils,
  ServerMessageType,
  StatType,
} from "@abraxas/shared";
import { logger } from "../logger";
import type { GameState } from "../schema/GameState";
import type { Player } from "../schema/Player";
import type { Entity, SpatialLookup } from "../utils/SpatialLookup";
import type { BuffSystem } from "./BuffSystem";
import type { DamageCalculator } from "./DamageCalculator";
import type { EffectResolver } from "./EffectResolver";

/** Player fields that correspond to resource costs. */
type PlayerResourceField = "mana" | "souls" | "rage" | "energy" | "focus" | "holyPower";
type AbilityCostKey =
  | "manaCost"
  | "soulCost"
  | "rageCost"
  | "energyCost"
  | "focusCost"
  | "holyPowerCost";

/** Maps ability cost keys → Player field, log reason, and i18n key. */
const RESOURCE_COSTS: readonly {
  costKey: AbilityCostKey;
  field: PlayerResourceField;
  reason: string;
  msg: string;
}[] = [
  { costKey: "manaCost", field: "mana", reason: "no_mana", msg: "game.not_enough_mana" },
  { costKey: "soulCost", field: "souls", reason: "no_souls", msg: "game.not_enough_souls" },
  { costKey: "rageCost", field: "rage", reason: "no_rage", msg: "game.not_enough_rage" },
  { costKey: "energyCost", field: "energy", reason: "no_energy", msg: "game.not_enough_energy" },
  { costKey: "focusCost", field: "focus", reason: "no_focus", msg: "game.not_enough_focus" },
  {
    costKey: "holyPowerCost",
    field: "holyPower",
    reason: "no_holy_power",
    msg: "game.not_enough_holy_power",
  },
];

type SendToClientFn = <T extends ServerMessageType>(type: T, message?: ServerMessages[T]) => void;

export class CombatSystem {
  private activeWindups = new Map<string, WindupAction>();
  /** Tracks when each entity last started an auto-attack, for attackCooldownMs enforcement. */
  private lastMeleeMs = new Map<string, number>();
  private entitiesWithBufferedAction = new Set<string>();

  /** Helper to interrupt an entity's cast if they take damage. */
  private interruptCast(sessionId: string, broadcast: BroadcastFn) {
    const windup = this.activeWindups.get(sessionId);
    if (windup && windup.type === "ability") {
      if (windup.resourceCosts) {
        const entity = this.spatial.findEntityBySessionId(sessionId);
        if (entity?.isPlayer()) {
          for (const rc of windup.resourceCosts) {
            entity[rc.field as PlayerResourceField] += rc.amount;
          }
        }
      }
      this.activeWindups.delete(sessionId);
      broadcast(ServerMessageType.Notification, {
        message: "game.cast_interrupted",
        templateData: { targetSessionId: sessionId },
      });
    }
  }

  constructor(
    private state: GameState,
    private spatial: SpatialLookup,
    private buffSystem: BuffSystem,
    private map: TileMap,
    private roomMapName: string,
    public readonly dmg: DamageCalculator,
    public readonly effects: EffectResolver,
  ) {}

  removeEntity(sessionId: string) {
    this.activeWindups.delete(sessionId);
    this.lastMeleeMs.delete(sessionId);
    this.entitiesWithBufferedAction.delete(sessionId);
  }

  /** Turns an entity to face a target tile (no-op when attacker is on the target tile). */
  private faceToward(entity: Entity, tx: number, ty: number): void {
    if (entity.tileX === tx && entity.tileY === ty) return;
    const facing = MathUtils.getDirection(entity.getPosition(), { x: tx, y: ty });
    if (entity.facing !== facing) entity.facing = facing;
  }

  /** Stores a buffered action and returns false (caller should propagate). */
  private bufferAction(entity: Entity, action: Entity["bufferedAction"]): false {
    entity.bufferedAction = action;
    this.entitiesWithBufferedAction.add(entity.sessionId);
    return false;
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

  processWindups(
    now: number,
    broadcast: BroadcastFn,
    onDeath: (entity: Entity, killerSessionId?: string) => void,
    onSummon?: (caster: Entity, abilityId: string, x: number, y: number) => void,
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
    _onDeath: (entity: Entity, killerSessionId?: string) => void,
    _onSummon?: (caster: Entity, abilityId: string, x: number, y: number) => void,
  ) {
    for (const sessionId of this.entitiesWithBufferedAction) {
      const entity = this.spatial.findEntityBySessionId(sessionId);
      if (!entity || !entity.alive || !entity.bufferedAction) {
        this.entitiesWithBufferedAction.delete(sessionId);
        continue;
      }

      // Skip if still in windup (unless we want to allow overwriting, but current logic is wait)
      if (this.activeWindups.has(sessionId)) continue;

      if (now - entity.bufferedAction.bufferedAt > BUFFER_WINDOW_MS) {
        entity.bufferedAction = null;
        this.entitiesWithBufferedAction.delete(sessionId);
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
          this.entitiesWithBufferedAction.delete(sessionId);
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
          this.entitiesWithBufferedAction.delete(sessionId);
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
    logger.debug({
      intent: "try_attack",
      attacker: attacker.sessionId,
      target: `${targetTileX},${targetTileY}`,
    });
    if (this.buffSystem.isStunned(attacker.sessionId, now)) return false;

    const stats = attacker.getStats();
    if (!stats) return false;

    const lastMelee = this.lastMeleeMs.get(attacker.sessionId) ?? 0;
    const meleeReady = now >= lastMelee + stats.attackCooldownMs;
    const gcdReady = now >= attacker.lastGcdMs + GCD_MS;
    const hasWindup = this.activeWindups.has(attacker.sessionId);
    if (!meleeReady || !gcdReady || hasWindup) {
      logger.debug({ intent: "try_attack", result: "buffered", meleeReady, gcdReady, hasWindup });
      return this.bufferAction(attacker, {
        type: "attack",
        targetTileX,
        targetTileY,
        bufferedAt: now,
      });
    }

    this.faceToward(attacker, targetTileX, targetTileY);

    if (
      !this.hasLineOfSight(attacker.getPosition(), {
        x: targetTileX,
        y: targetTileY,
      })
    ) {
      sendToClient?.(ServerMessageType.InvalidTarget);
      return false;
    }

    const isRanged = stats.attackRange > 1;

    if (isRanged) {
      const target = this.spatial.findEntityAtTile(targetTileX, targetTileY);
      if (!target || !target.alive || !this.canAttack(attacker, target)) {
        sendToClient?.(ServerMessageType.InvalidTarget);
        return false;
      }
      const dist = MathUtils.manhattanDist(attacker.getPosition(), {
        x: target.tileX,
        y: target.tileY,
      });
      if (dist > stats.attackRange) {
        sendToClient?.(ServerMessageType.InvalidTarget);
        return false;
      }
    }

    const windup: WindupAction = {
      type: isRanged ? "ranged" : "melee",
      completeAtMs: now + stats.attackWindupMs,
      attackerSessionId: attacker.sessionId,
      targetTileX,
      targetTileY,
    };

    attacker.lastGcdMs = now;
    this.lastMeleeMs.set(attacker.sessionId, now);
    this.activeWindups.set(attacker.sessionId, windup);
    logger.debug({ intent: "try_attack", result: "success", attacker: attacker.sessionId });
    broadcast(ServerMessageType.AttackStart, {
      sessionId: attacker.sessionId,
      facing: attacker.facing,
      ...(isRanged ? { targetTileX, targetTileY } : {}),
    });

    return true;
  }

  tryCast(
    caster: Entity,
    abilityId: string,
    targetTileX: number,
    targetTileY: number,
    broadcast: BroadcastFn,
    now: number,
    sendToClient?: SendToClientFn,
  ): boolean {
    logger.debug({
      intent: "try_cast",
      caster: caster.sessionId,
      ability: abilityId,
      target: `${targetTileX},${targetTileY}`,
    });
    if (this.buffSystem.isStunned(caster.sessionId, now)) {
      logger.debug({ intent: "try_cast", result: "fail", reason: "stunned" });
      return false;
    }

    const ability = ABILITIES[abilityId];
    if (!ability) {
      logger.debug({ intent: "try_cast", result: "fail", reason: "no_ability", abilityId });
      return false;
    }

    // Class restriction: players may only use abilities assigned to their class
    if (caster.isPlayer()) {

      const classStats = caster.getStats();
      if (classStats && !classStats.abilities.includes(abilityId)) {
        logger.debug({ intent: "try_cast", result: "fail", reason: "class_restricted", abilityId });
        sendToClient?.(ServerMessageType.Notification, {
          message: "game.class_restricted",
        });
        return false;
      }

      if (ability.requiredLevel && caster.level < ability.requiredLevel) {
        logger.debug({
          intent: "try_cast",
          result: "fail",
          reason: "level_req",
          level: caster.level,
          required: ability.requiredLevel,
        });
        sendToClient?.(ServerMessageType.Notification, {
          message: "game.skill_locked",
        });
        return false;
      }
    }

    if (now < caster.lastGcdMs + GCD_MS || this.activeWindups.has(caster.sessionId)) {
      logger.debug({
        intent: "try_cast",
        result: "buffered",
        gcdReady: now >= caster.lastGcdMs + GCD_MS,
        hasWindup: this.activeWindups.has(caster.sessionId),
      });
      return this.bufferAction(caster, {
        type: "cast",
        spellId: abilityId,
        targetTileX,
        targetTileY,
        bufferedAt: now,
      });
    }

    const cd = caster.spellCooldowns.get(abilityId) || 0;
    if (now < cd) {
      logger.debug({ intent: "try_cast", result: "fail", reason: "cooldown", abilityId, now, cd });
      return false;
    }

    if (ability.rangeTiles > 0) this.faceToward(caster, targetTileX, targetTileY);

    if (caster.isPlayer()) {
      for (const rc of RESOURCE_COSTS) {
        const cost = ability[rc.costKey];
        if (cost && caster[rc.field] < cost) {
          logger.debug({
            intent: "try_cast",
            result: "fail",
            reason: rc.reason,
            has: caster[rc.field],
            needs: cost,
          });
          sendToClient?.(ServerMessageType.Notification, { message: rc.msg });
          return false;
        }
      }
    }

    if (ability.rangeTiles > 0) {
      const dist = MathUtils.manhattanDist(caster.getPosition(), {
        x: targetTileX,
        y: targetTileY,
      });
      if (dist > ability.rangeTiles) {
        logger.debug({
          intent: "try_cast",
          result: "fail",
          reason: "range",
          dist,
          max: ability.rangeTiles,
        });
        sendToClient?.(ServerMessageType.InvalidTarget);
        return false;
      }
      if (
        !this.hasLineOfSight(caster.getPosition(), {
          x: targetTileX,
          y: targetTileY,
        })
      ) {
        logger.debug({ intent: "try_cast", result: "fail", reason: "los" });
        sendToClient?.(ServerMessageType.InvalidTarget);
        return false;
      }
    }

    let comboPointsSpent = 0;
    const resourceCosts: { field: string; amount: number }[] = [];
    if (caster.isPlayer()) {
      // Deduct all resource costs (stored for refund on interrupt)
      for (const rc of RESOURCE_COSTS) {
        const cost = ability[rc.costKey];
        if (cost) {
          caster[rc.field] -= cost;
          resourceCosts.push({ field: rc.field, amount: cost });
        }
      }

      // Handle Combo Points
      if (ability.comboPointsGain) {
        caster.comboPoints = Math.min(caster.maxComboPoints, caster.comboPoints + ability.comboPointsGain);
      }
      if (ability.comboPointsCost) {
        comboPointsSpent = Math.min(caster.comboPoints, ability.comboPointsCost);
        if (ability.comboDamageMultiplier) {
          comboPointsSpent = caster.comboPoints; // Spend ALL for finishing moves
        }
        caster.comboPoints = Math.max(0, caster.comboPoints - comboPointsSpent);
      }
    }

    caster.lastGcdMs = now;
    // Bug #7: Melee timer intentionally set on ability cast to prevent ability→melee weaving
    this.lastMeleeMs.set(caster.sessionId, now);

    const windup: WindupAction = {
      type: "ability",
      abilityId,
      completeAtMs: now + ability.windupMs,
      attackerSessionId: caster.sessionId,
      targetTileX,
      targetTileY,
      comboPointsSpent,
      resourceCosts: resourceCosts.length > 0 ? resourceCosts : undefined,
      cooldownAbilityId: abilityId,
      cooldownMs: ability.cooldownMs,
    };

    this.activeWindups.set(caster.sessionId, windup);
    logger.debug({ intent: "try_cast", result: "success", abilityId });
    broadcast(ServerMessageType.CastStart, {
      sessionId: caster.sessionId,
      abilityId,
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
    onSummon?: (caster: Entity, abilityId: string, x: number, y: number) => void,
  ) {
    const attacker = this.spatial.findEntityBySessionId(windup.attackerSessionId);
    if (!attacker || !attacker.alive) return;

    if (windup.type === "melee" || windup.type === "ranged") {
      this.resolveAutoAttack(attacker, windup, broadcast, onDeath, now);
    } else {
      if (windup.cooldownAbilityId && windup.cooldownMs) {
        attacker.spellCooldowns.set(windup.cooldownAbilityId, now + windup.cooldownMs);
      }

      // Spell Echo: Next spell casts twice
      if (
        attacker.isPlayer() &&
        this.buffSystem.hasBuff(attacker.sessionId, "spell_echo", now)
      ) {
        this.buffSystem.removeBuff(attacker.sessionId, "spell_echo");
        // Resolve once
        this.resolveAbility(attacker, windup, broadcast, onDeath, now, onSummon);
        // Resolve again (recursive call, but buff is gone so it won't loop)
        this.resolveAbility(attacker, windup, broadcast, onDeath, now, onSummon);
        return;
      }
      this.resolveAbility(attacker, windup, broadcast, onDeath, now, onSummon);
    }
  }

  private resolveAutoAttack(
    attacker: Entity,
    windup: WindupAction,
    broadcast: BroadcastFn,
    onDeath: (entity: Entity, killerSessionId?: string) => void,
    now: number,
  ): void {
    const target = this.spatial.findEntityAtTile(windup.targetTileX, windup.targetTileY);

    if (target && target.alive && this.canAttack(attacker, target)) {
      const stats = attacker.getStats();
      if (!stats) return;
      const dist = MathUtils.manhattanDist(attacker.getPosition(), {
        x: target.tileX,
        y: target.tileY,
      });
      if (dist > stats.attackRange) {
        broadcast(ServerMessageType.AttackHit, {
          sessionId: attacker.sessionId,
          targetSessionId: null,
        });
        return;
      }

      if (
        dist > 1 &&
        !this.hasLineOfSight(attacker.getPosition(), { x: target.tileX, y: target.tileY })
      ) {
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

      const attackerStr = this.dmg.boosted(attacker, StatType.STR, now);
      const attackerAgi = this.dmg.boosted(attacker, StatType.AGI, now);
      const defenderArmor = this.dmg.boosted(target, StatType.ARMOR, now);
      const defenderAgi = this.dmg.boosted(target, StatType.AGI, now);
      const aSec = this.dmg.getSecondaryStats(attacker, now);
      const dSec = this.dmg.getSecondaryStats(target, now);

      const aLvl = attacker.level;
      const dLvl = target.level;

      const result =
        windup.type === "ranged"
          ? calcRangedDamage(
              attackerAgi,
              defenderArmor,
              defenderAgi,
              aLvl,
              dLvl,
              aSec.hitRating,
              aSec.critChance,
              aSec.critMultiplier,
              aSec.armorPen,
              dSec.blockChance,
            )
          : calcMeleeDamage(
              attackerStr,
              defenderArmor,
              defenderAgi,
              aLvl,
              dLvl,
              aSec.hitRating,
              aSec.critChance,
              aSec.critMultiplier,
              aSec.armorPen,
              dSec.parryChance,
              dSec.blockChance,
            );

      attacker.lastCombatMs = now;
      target.lastCombatMs = now;

      if (result.dodged || result.parried) {
        logger.debug({
          intent: "auto_attack",
          result: result.dodged ? "dodge" : "parry",
          attackerId: attacker.sessionId,
          targetId: target.sessionId,
        });
        broadcast(ServerMessageType.AttackHit, {
          sessionId: attacker.sessionId,
          targetSessionId: target.sessionId,
          dodged: result.dodged,
          parried: result.parried,
        });
      } else {
        logger.debug({
          intent: "auto_attack",
          result: "hit",
          damage: result.damage,
          hpAfter: target.hp - result.damage,
        });
        target.hp -= result.damage;
        this.interruptCast(target.sessionId, broadcast);
        this.buffSystem.breakStealth(target.sessionId);
        broadcast(ServerMessageType.AttackHit, {
          sessionId: attacker.sessionId,
          targetSessionId: target.sessionId,
        });
        broadcast(ServerMessageType.Damage, {
          targetSessionId: target.sessionId,
          amount: result.damage,
          hpAfter: target.hp,
          type: DamageSchool.PHYSICAL,
          crit: result.crit,
          blocked: result.blocked,
          glancing: result.glancing,
        });

        // Rage Generation
        this.effects.applyRageOnHit(attacker, target);

        // Bug #4: Death check moved AFTER rage — but only for the attacker.
        // Target death must come after damage broadcast but before any further target logic.
        if (target.hp <= 0) {
          onDeath(target, attacker.sessionId);
        }
      }
    } else {
      logger.debug({ intent: "auto_attack", result: "miss", attackerId: attacker.sessionId });
      broadcast(ServerMessageType.AttackHit, {
        sessionId: attacker.sessionId,
        targetSessionId: null,
      });
    }
  }

  private resolveAbility(
    attacker: Entity,
    windup: WindupAction,
    broadcast: BroadcastFn,
    onDeath: (entity: Entity, killerSessionId?: string) => void,
    now: number,
    onSummon?: (caster: Entity, abilityId: string, x: number, y: number) => void,
  ): void {
    const ability = ABILITIES[windup.abilityId!];
    if (!ability) return;

    // Handle summon abilities
    if (ability.id.startsWith("summon_") && onSummon) {
      onSummon(attacker, ability.id, windup.targetTileX, windup.targetTileY);
      broadcast(ServerMessageType.CastHit, {
        sessionId: attacker.sessionId,
        abilityId: ability.id,
        targetTileX: windup.targetTileX,
        targetTileY: windup.targetTileY,
        fxId: ability.fxId,
      });
      return;
    }

    // AoE heal — heals all same-faction entities (including caster) in radius.
    // Handled before the rangeTiles === 0 check so aoeRadius is respected.
    if (ability.effect === "aoe_heal") {
      const radius = ability.aoeRadius ?? 3;
      const candidates = this.spatial.findEntitiesInRadius(
        windup.targetTileX,
        windup.targetTileY,
        radius,
      );
      const aSec = this.dmg.getSecondaryStats(attacker, now);
      const scalingStat = this.dmg.boosted(attacker, ability.scalingStat, now);
      for (const candidate of candidates) {
        const isAlly =
          candidate.sessionId === attacker.sessionId || this.sameFaction(attacker, candidate);
        if (!isAlly || !candidate.alive) continue;
        const healRes = calcHealAmount(
          ability.baseDamage,
          scalingStat,
          ability.scalingRatio,
          aSec.critChance,
          aSec.critMultiplier,
        );
        const maxHp = this.dmg.boosted(candidate, StatType.HP, now);
        candidate.hp = Math.min(maxHp, candidate.hp + healRes.heal);
        broadcast(ServerMessageType.Heal, {
          sessionId: candidate.sessionId,
          amount: healRes.heal,
          hpAfter: candidate.hp,
        });
      }
      broadcast(ServerMessageType.CastHit, {
        sessionId: attacker.sessionId,
        abilityId: ability.id,
        targetTileX: windup.targetTileX,
        targetTileY: windup.targetTileY,
        fxId: ability.fxId,
      });
      return;
    }

    // Self-target abilities (rangeTiles === 0) always target the caster.
    // AoE abilities with rangeTiles === 0 target a radius around the caster.
    if (ability.rangeTiles === 0) {
      const aoeRadius = ability.aoeRadius;
      if (aoeRadius != null && aoeRadius > 0) {
        // Play the main AoE effect once at the caster tile — not once per victim.
        broadcast(ServerMessageType.CastHit, {
          sessionId: attacker.sessionId,
          abilityId: ability.id,
          targetTileX: attacker.tileX,
          targetTileY: attacker.tileY,
          fxId: ability.fxId,
        });
        const victims = this.spatial.findEntitiesInRadius(
          attacker.tileX,
          attacker.tileY,
          aoeRadius,
        );
        for (const victim of victims) {
          if (!this.isValidTarget(attacker, victim, ability)) continue;
          // Suppress per-victim CastHit; the main one was already broadcast above.
          this.effects.applyAbilityToTarget(
            attacker,
            victim,
            ability,
            windup,
            broadcast,
            onDeath,
            now,
            this.interruptCast.bind(this),
            true,
          );
        }
      } else {
        if (this.isValidTarget(attacker, attacker, ability)) {
          this.effects.applyAbilityToTarget(attacker, attacker, ability, windup, broadcast, onDeath, now, this.interruptCast.bind(this));
        }
      }
      return;
    }

    const aoeRadius = ability.aoeRadius;
    if (aoeRadius != null && aoeRadius > 0) {
      // Play the main AoE effect once at the intended target tile regardless of hits.
      broadcast(ServerMessageType.CastHit, {
        sessionId: attacker.sessionId,
        abilityId: ability.id,
        targetTileX: windup.targetTileX,
        targetTileY: windup.targetTileY,
        fxId: ability.fxId,
      });
      const victims = this.spatial.findEntitiesInRadius(
        windup.targetTileX,
        windup.targetTileY,
        aoeRadius,
      );
      for (const victim of victims) {
        if (!this.isValidTarget(attacker, victim, ability)) continue;

        // LOS check for AOE
        if (
          !this.hasLineOfSight(
            { x: windup.targetTileX, y: windup.targetTileY },
            { x: victim.tileX, y: victim.tileY },
          )
        ) {
          continue;
        }

        // Suppress per-victim CastHit; the main one was already broadcast above.
        this.effects.applyAbilityToTarget(
          attacker,
          victim,
          ability,
          windup,
          broadcast,
          onDeath,
          now,
          this.interruptCast.bind(this),
          true, // suppress per-victim CastHit
          onSummon,
        );
      }
    } else {
      const target = this.spatial.findEntityAtTile(windup.targetTileX, windup.targetTileY);
      if (target && target.alive) {
        const valid = this.isValidTarget(attacker, target, ability);
        if (valid) {
          const dist = MathUtils.manhattanDist(attacker.getPosition(), {
            x: target.tileX,
            y: target.tileY,
          });
          if (dist > ability.rangeTiles) return;

          // LOS check at resolution time to prevent wall-piercing curve
          if (
            !this.hasLineOfSight(attacker.getPosition(), {
              x: target.tileX,
              y: target.tileY,
            })
          ) {
            return;
          }

          this.effects.applyAbilityToTarget(
            attacker,
            target,
            ability,
            windup,
            broadcast,
            onDeath,
            now,
            this.interruptCast.bind(this),
            false,
            onSummon,
          );
        }
      }
    }
  }

  private sameFaction(a: Entity, b: Entity): boolean {
    // Check for owner-pet or pet-pet relation
    const aOwnerId = a.isNpc() ? a.ownerId : undefined;
    const bOwnerId = b.isNpc() ? b.ownerId : undefined;

    if (aOwnerId && aOwnerId === b.sessionId) return true;
    if (bOwnerId && bOwnerId === a.sessionId) return true;
    if (aOwnerId && bOwnerId && aOwnerId === bOwnerId) return true;

    if (a.isPlayer() && b.isPlayer()) {
      if (a.groupId && a.groupId === b.groupId) return true;
      if (a.guildId && a.guildId === b.guildId) return true;
      return false;
    }
    if (a.isNpc() && b.isNpc()) {
      return a.npcType === b.npcType;
    }
    return false;
  }

  private canAttack(attacker: Entity, target: Entity): boolean {
    if (attacker.sessionId === target.sessionId) return false;
    // GMs/admins are fully invulnerable — nobody can attack them
    if (target.isPlayer() && (target.role === "ADMIN" || target.role === "GM")) return false;
    if (this.sameFaction(attacker, target)) return false;
    if (
      MathUtils.isInSafeZone(attacker.tileX, attacker.tileY, this.map.safeZones) ||
      MathUtils.isInSafeZone(target.tileX, target.tileY, this.map.safeZones)
    )
      return false;
    // GMs/admins can attack anyone — skip PvP flag requirements
    const attackerIsGM = attacker.isPlayer() && (attacker.role === "ADMIN" || attacker.role === "GM");
    if (!attackerIsGM && attacker.isPlayer() && target.isPlayer()) {
      if (!attacker.pvpEnabled || !target.pvpEnabled) return false;
    }
    return true;
  }

  private isValidTarget(attacker: Entity, target: Entity, ability: Ability): boolean {
    // Bug #5: Include pickpocket in the harmful list
    const harmful =
      ["damage", "dot", "stun", "debuff", "leech", "reveal", "pickpocket"].includes(ability.effect) ||
      ability.baseDamage > 0 ||
      ability.buffStat === StatType.STUN;

    if (harmful) {
      return this.canAttack(attacker, target);
    } else {
      if (attacker.sessionId === target.sessionId) return true;
      return this.sameFaction(attacker, target);
    }
  }

}

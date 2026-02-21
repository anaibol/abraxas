import type { Ability, BroadcastFn, TileMap, WindupAction } from "@abraxas/shared";
import {
  calcHealAmount,
  CLASS_APPEARANCE,
  DamageSchool,
  NPC_APPEARANCE,
  ServerMessageType,
  StatType,
} from "@abraxas/shared";


import type { Entity, SpatialLookup } from "../utils/SpatialLookup";
import type { BuffSystem } from "./BuffSystem";
import type { DamageCalculator } from "./DamageCalculator";

// ── EffectResolver ─────────────────────────────────────────────────────

export class EffectResolver {
  constructor(
    private dmg: DamageCalculator,
    private buffSystem: BuffSystem,
    private spatial: SpatialLookup,
    private map: TileMap,
    private roomMapName: string,
  ) {}

  /** Shared Rage generation logic applied to both attacker and defender on any hit. */
  applyRageOnHit(attacker: Entity, target: Entity): void {
    if (attacker.isPlayer() && attacker.classType === "WARRIOR") {
      attacker.rage = Math.min(attacker.maxRage, attacker.rage + 5);
    }
    if (target.isPlayer() && target.classType === "WARRIOR") {
      target.rage = Math.min(target.maxRage, target.rage + 3);
    }
  }

  /**
   * Applies an ability's effect to a single target entity.
   * Dispatches based on `ability.effect` to the appropriate handler.
   */
  applyAbilityToTarget(
    attacker: Entity,
    target: Entity,
    ability: Ability,
    windup: WindupAction,
    broadcast: BroadcastFn,
    onDeath: (entity: Entity, killerSessionId?: string) => void,
    now: number,
    interruptCast: (sessionId: string, broadcast: BroadcastFn) => void,
    /** When true, skips the CastHit broadcast (AoE callers broadcast it once themselves). */
    suppressCastHit = false,
    onSummon?: (caster: Entity, abilityId: string, x: number, y: number) => void,
  ) {
    if (target.isNpc() && target.npcType === "merchant") return;

    const isSelfCast = attacker.sessionId === target.sessionId;
    if (!isSelfCast && this.buffSystem.isInvulnerable(target.sessionId, now)) return;

    attacker.lastCombatMs = now;
    if (!isSelfCast) target.lastCombatMs = now;

    const scalingStatName = ability.scalingStat || StatType.INT;
    const scalingStatValue = this.dmg.boosted(attacker, scalingStatName, now);

    if (ability.effect === "stealth") {
      this.buffSystem.applyStealth(target.sessionId, ability.durationMs ?? 5000, now);
      broadcast(ServerMessageType.StealthApplied, {
        sessionId: target.sessionId,
        durationMs: ability.durationMs ?? 5000,
      });
    } else if (ability.effect === "cleanse") {
      this.buffSystem.clearStun(target.sessionId);
    } else if (ability.effect === "reveal") {
      this.buffSystem.breakStealth(target.sessionId);
    } else if (ability.effect === "dot") {
      const dotDuration = ability.dotDurationMs ?? ability.durationMs ?? 5000;
      this.buffSystem.addDoT(
        target.sessionId,
        attacker.sessionId,
        ability.id,
        ability.dotDamage ?? ability.baseDamage,
        ability.dotIntervalMs ?? 1000,
        dotDuration,
        now,
      );
      broadcast(ServerMessageType.BuffApplied, {
        sessionId: target.sessionId,
        abilityId: ability.id,
        durationMs: dotDuration,
      });
    } else if (ability.effect === "leech") {
      const damageRes = this.dmg.calcAbilityDamage(
        attacker,
        target,
        ability,
        windup,
        scalingStatValue,
        now,
      );
      if (damageRes.dodged || damageRes.parried) return;
      target.hp -= damageRes.damage;
      interruptCast(target.sessionId, broadcast);
      this.buffSystem.breakStealth(target.sessionId);
      broadcast(ServerMessageType.Damage, {
        targetSessionId: target.sessionId,
        amount: damageRes.damage,
        hpAfter: target.hp,
        type: ability.damageSchool === DamageSchool.PHYSICAL ? DamageSchool.PHYSICAL : "magic",
        crit: damageRes.crit,
        blocked: damageRes.blocked,
        dodged: damageRes.dodged,
        parried: damageRes.parried,
        glancing: damageRes.glancing,
      });

      // B19: Apply rage + leech heal BEFORE death check — onDeath cleans up the entity
      this.applyRageOnHit(attacker, target);
      // Bug #10: Only leech if attacker is still alive (could be dead from reflect/thorns)
      if (attacker.alive && (ability.leechRatio ?? 0) > 0) {
        const healBack = Math.max(1, Math.round(damageRes.damage * (ability.leechRatio ?? 0)));
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + healBack);
        broadcast(ServerMessageType.Heal, {
          sessionId: attacker.sessionId,
          amount: healBack,
          hpAfter: attacker.hp,
        });
      }

      if (target.hp <= 0) {
        onDeath(target, attacker.sessionId);
      }
    } else if (ability.effect === "damage") {
      const damageRes = this.dmg.calcAbilityDamage(
        attacker,
        target,
        ability,
        windup,
        scalingStatValue,
        now,
      );
      if (!damageRes.dodged && !damageRes.parried) {
        target.hp -= damageRes.damage;
        interruptCast(target.sessionId, broadcast);
        this.buffSystem.breakStealth(target.sessionId);
        broadcast(ServerMessageType.Damage, {
          targetSessionId: target.sessionId,
          amount: damageRes.damage,
          hpAfter: target.hp,
          type: ability.damageSchool === DamageSchool.PHYSICAL ? DamageSchool.PHYSICAL : "magic",
          crit: damageRes.crit,
          blocked: damageRes.blocked,
          glancing: damageRes.glancing,
        });
        // Bug #9: Apply rage BEFORE death check so we don't touch a cleaned-up entity
        this.applyRageOnHit(attacker, target);
        if (target.hp <= 0) {
          onDeath(target, attacker.sessionId);
        }
      }

      // Apply secondary stat modifier (e.g. ice_bolt AGI slow) if defined alongside damage
      if (
        !isSelfCast &&
        ability.buffStat &&
        ability.buffAmount !== undefined &&
        ability.durationMs
      ) {
        this.buffSystem.addBuff(
          target.sessionId,
          `${ability.id}_slow`,
          ability.buffStat,
          ability.buffAmount,
          ability.durationMs,
          now,
        );
        broadcast(ServerMessageType.BuffApplied, {
          sessionId: target.sessionId,
          abilityId: ability.id,
          durationMs: ability.durationMs,
        });
      }
    } else if (ability.effect === "heal") {
      const aSec = this.dmg.getSecondaryStats(attacker, now);
      const healRes = calcHealAmount(
        ability.baseDamage,
        scalingStatValue,
        ability.scalingRatio,
        aSec.critChance,
        aSec.critMultiplier,
      );
      const maxHp = this.dmg.boosted(target, StatType.HP, now);
      target.hp = Math.min(maxHp, target.hp + healRes.heal);
      broadcast(ServerMessageType.Heal, {
        sessionId: target.sessionId,
        amount: healRes.heal,
        hpAfter: target.hp,
      });
    } else if (ability.effect === "stun" || ability.buffStat === "stun") {
      this.buffSystem.applyStun(target.sessionId, ability.durationMs ?? 1000, now);
      broadcast(ServerMessageType.StunApplied, {
        targetSessionId: target.sessionId,
        durationMs: ability.durationMs ?? 1000,
      });
    } else if (ability.effect === "debuff") {
      this.buffSystem.addBuff(
        target.sessionId,
        ability.id,
        ability.buffStat ?? StatType.ARMOR,
        -(ability.buffAmount ?? 10),
        ability.durationMs ?? 5000,
        now,
      );
      broadcast(ServerMessageType.BuffApplied, {
        sessionId: target.sessionId,
        abilityId: ability.id,
        durationMs: ability.durationMs ?? 5000,
      });
    } else if (ability.effect === "buff" || ability.buffStat) {
      const buffStat = ability.buffStat ?? StatType.ARMOR;
      const buffAmount = ability.buffAmount ?? 10;

      // Special Case: Resource Buffs (e.g. Berserker Rage gives 30 Rage)
      if (
        [StatType.RAGE, StatType.ENERGY, StatType.FOCUS, StatType.HOLY_POWER].includes(buffStat) &&
        target.isPlayer()
      ) {
        if (buffStat === StatType.RAGE) target.rage = Math.min(target.maxRage, target.rage + buffAmount);
        if (buffStat === StatType.ENERGY)
          target.energy = Math.min(target.maxEnergy, target.energy + buffAmount);
        if (buffStat === StatType.FOCUS) target.focus = Math.min(target.maxFocus, target.focus + buffAmount);
        if (buffStat === StatType.HOLY_POWER)
          target.holyPower = Math.min(target.maxHolyPower, target.holyPower + buffAmount);
      } else {
        this.buffSystem.addBuff(
          target.sessionId,
          ability.id,
          buffStat,
          buffAmount,
          ability.durationMs ?? 5000,
          now,
          ability.appearanceOverride?.bodyId,
          ability.appearanceOverride?.headId,
        );
      }

      broadcast(ServerMessageType.BuffApplied, {
        sessionId: target.sessionId,
        abilityId: ability.id,
        durationMs: ability.durationMs ?? 5000,
      });
    } else if (ability.effect === "mirror_shape") {
      let bodyId = 0;
      let headId = 0;

      if (target.isPlayer()) {
        const appearance = CLASS_APPEARANCE[target.classType];
        bodyId = appearance?.bodyId || 0;
        headId = appearance?.headId || 0;
      } else if (target.isNpc()) {
        const appearance = NPC_APPEARANCE[target.npcType];
        bodyId = appearance?.bodyId || 0;
        headId = appearance?.headId || 0;
      }

      this.buffSystem.addBuff(
        attacker.sessionId,
        ability.id,
        StatType.HP,
        0,
        ability.durationMs ?? 30000,
        now,
        bodyId,
        headId,
      );

      broadcast(ServerMessageType.BuffApplied, {
        sessionId: attacker.sessionId,
        abilityId: ability.id,
        durationMs: ability.durationMs ?? 30000,
      });
    } else if (ability.effect === "teleport") {
      // B15: Validate target tile is walkable before teleporting
      const tx = windup.targetTileX;
      const ty = windup.targetTileY;
      if (
        tx < 0 ||
        tx >= this.map.width ||
        ty < 0 ||
        ty >= this.map.height ||
        this.map.collision[ty]?.[tx] === 1 ||
        this.spatial.isTileOccupied(tx, ty)  // Bug #11: prevent teleporting onto occupied tiles
      ) {
        return;
      }

      this.spatial.removeFromGrid(attacker);
      attacker.tileX = tx;
      attacker.tileY = ty;
      this.spatial.addToGrid(attacker);

      broadcast(ServerMessageType.Warp, {
        targetMap: this.roomMapName,
        targetX: attacker.tileX,
        targetY: attacker.tileY,
      });
    } else if (ability.effect === "pickpocket") {
      if (
        attacker.isPlayer() &&
        target.isNpc() &&
        target.alive
      ) {
        // Bug #12: Per-target cooldown to prevent infinite gold farming
        const ppKey = `pp_${target.sessionId}`;
        const lastPp = (attacker as unknown as Record<string, number>)[ppKey] ?? 0;
        if (now - lastPp < 10_000) return; // 10s cooldown per target
        (attacker as unknown as Record<string, number>)[ppKey] = now;

        const goldGain = Math.floor(Math.random() * 40) + 10;
        attacker.gold += goldGain;
        broadcast(ServerMessageType.Notification, {
          message: "game.pickpocket_success",
          templateData: { amount: goldGain, target: target.name },
        });
      }
    } else if (ability.effect === "summon" && ability.summonType && onSummon) {
      onSummon(attacker, ability.id, target.tileX, target.tileY);
    }

    // Broadcast CastHit so clients play the ability visual effect.
    // AoE callers already broadcast this once at the target tile; skip per-victim duplicates.
    if (!suppressCastHit) {
      broadcast(ServerMessageType.CastHit, {
        sessionId: attacker.sessionId,
        abilityId: ability.id,
        targetTileX: target.tileX,
        targetTileY: target.tileY,
        fxId: ability.fxId,
      });
    }
  }
}

import type { Ability, WindupAction } from "@abraxas/shared";
import {
  calcMeleeDamage,
  calcRangedDamage,
  calcSpellDamage,
  DamageSchool,
  StatType,
} from "@abraxas/shared";
import type { Entity } from "../utils/SpatialLookup";
import type { BuffSystem } from "./BuffSystem";

// ── Secondary stats derived from base stats + buff bonuses ─────────────

export interface SecondaryStats {
  hitRating: number;
  critChance: number;
  critMultiplier: number;
  armorPen: number;
  dodgeChance: number;
  parryChance: number;
  blockChance: number;
}

export interface DamageResult {
  damage: number;
  crit: boolean;
  glancing: boolean;
  blocked: boolean;
  parried: boolean;
  dodged: boolean;
}

// ── DamageCalculator ───────────────────────────────────────────────────

export class DamageCalculator {
  constructor(private buffSystem: BuffSystem) {}

  /** Returns a stat's base value + active buff bonus. */
  boosted(entity: Entity, stat: StatType, now: number): number {
    const bases: Partial<Record<StatType, number>> = {
      [StatType.STR]: entity.str,
      [StatType.AGI]: entity.agi,
      [StatType.INT]: entity.intStat,
      [StatType.ARMOR]: entity.armor,
      [StatType.HP]: entity.maxHp,
      [StatType.MANA]: entity.isPlayer() ? entity.maxMana : 0,
      [StatType.ENERGY]: entity.isPlayer() ? entity.energy : 0,
      [StatType.RAGE]: entity.isPlayer() ? entity.rage : 0,
    };
    return (bases[stat] ?? 0) + this.buffSystem.getBuffBonus(entity.sessionId, stat, now);
  }

  /** Derives secondary combat stats (crit, dodge, parry, etc.) from base stats + buffs.
   *  Bug #18: Buff bonuses are stored as whole-number percentages (e.g., 10 = 10%).
   *  They are divided by 100 here to convert to decimal form (0.10).
   *  Base stats are already stored as decimals (e.g., 0.05 = 5%).
   */
  getSecondaryStats(entity: Entity, now: number): SecondaryStats {
    const stats = entity.getStats();
    if (!stats) {
      return { hitRating: 0.95, critChance: 0.05, critMultiplier: 1.5, armorPen: 0, dodgeChance: 0.05, parryChance: 0.05, blockChance: 0 };
    }
    return {
      hitRating:
        stats.hitRating +
        this.buffSystem.getBuffBonus(entity.sessionId, StatType.HIT_RATING, now) / 100,
      critChance:
        stats.critChance +
        this.buffSystem.getBuffBonus(entity.sessionId, StatType.CRIT_CHANCE, now) / 100,
      critMultiplier:
        stats.critMultiplier +
        this.buffSystem.getBuffBonus(entity.sessionId, StatType.CRIT_MULTIPLIER, now) / 100,
      armorPen:
        stats.armorPen +
        this.buffSystem.getBuffBonus(entity.sessionId, StatType.ARMOR_PEN, now) / 100,
      dodgeChance:
        stats.dodgeChance +
        this.buffSystem.getBuffBonus(entity.sessionId, StatType.DODGE_CHANCE, now) / 100,
      parryChance:
        stats.parryChance +
        this.buffSystem.getBuffBonus(entity.sessionId, StatType.PARRY_CHANCE, now) / 100,
      blockChance:
        stats.blockChance +
        this.buffSystem.getBuffBonus(entity.sessionId, StatType.BLOCK_CHANCE, now) / 100,
    };
  }

  /**
   * Routes ability damage to the correct formula based on damageSchool.
   * Physical abilities use armor reduction (and dodge for melee-range).
   * Magical abilities use INT-based magic resistance.
   */
  calcAbilityDamage(
    attacker: Entity,
    target: Entity,
    ability: Ability,
    windup: WindupAction,
    scalingStatValue: number,
    now: number,
  ): DamageResult {
    let result: DamageResult = {
      damage: 0,
      crit: false,
      glancing: false,
      blocked: false,
      parried: false,
      dodged: false,
    };
    const aSec = this.getSecondaryStats(attacker, now);
    const dSec = this.getSecondaryStats(target, now);
    const aLvl = attacker.level;
    const dLvl = target.level;

    if (ability.damageSchool === DamageSchool.PHYSICAL) {
      const defenderArmor = this.boosted(target, StatType.ARMOR, now);
      const defenderAgi = this.boosted(target, StatType.AGI, now);

      if (ability.scalingStat === StatType.AGI) {
        result = calcRangedDamage(
          scalingStatValue,
          defenderArmor,
          defenderAgi,
          aLvl,
          dLvl,
          aSec.hitRating,
          aSec.critChance,
          aSec.critMultiplier,
          aSec.armorPen,
          dSec.blockChance,
        );
      } else {
        result = calcMeleeDamage(
          scalingStatValue,
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
      }
    } else {
      const defenderInt = this.boosted(target, StatType.INT, now);
      const spellRes = calcSpellDamage(
        ability.baseDamage,
        scalingStatValue,
        ability.scalingRatio,
        defenderInt,
        aLvl,
        dLvl,
        aSec.critChance,
        aSec.critMultiplier,
      );
      console.log(`[Combat] Magical Damage Calc: base ${ability.baseDamage}, scaling ${scalingStatValue}, ratio ${ability.scalingRatio}, defenderInt ${defenderInt} -> Damage: ${spellRes.damage}`);
      result = {
        damage: spellRes.damage,
        crit: spellRes.crit,
        glancing: spellRes.glancing,
        blocked: false,
        parried: false,
        dodged: false,
      };
    }

    let damage = result.damage;

    // Special Case: Combo Points Multiplier
    if (ability.comboDamageMultiplier && windup.comboPointsSpent) {
      damage *= 1 + ability.comboDamageMultiplier * windup.comboPointsSpent;
    }

    // Special Case: Execute
    if (ability.executeThreshold) {
      const hpRatio = target.hp / this.boosted(target, StatType.HP, now);
      if (hpRatio <= ability.executeThreshold) {
        damage *= ability.executeMultiplier ?? 2.0;
      }
    }

    // Bug #20: Minimum 1 damage floor is intentional — prevents total immunity
    // and ensures all attacks give visual feedback. Extreme level differences
    // are gated by miss/dodge mechanics instead.
    result.damage = Math.max(1, Math.round(damage));
    return result;
  }
}

/** Stat-based combat damage formulas for Abraxas Arena */

export interface BufferedAction {
  type: "attack" | "cast";
  spellId?: string;
  targetTileX?: number;
  targetTileY?: number;
  bufferedAt: number;
}

export interface WindupAction {
  type: "melee" | "ranged" | "ability";
  completeAtMs: number;
  attackerSessionId: string;
  targetTileX: number;
  targetTileY: number;
  abilityId?: string;
  comboPointsSpent?: number;
  /** Resources spent at cast start — refunded on interrupt/cancel. */
  resourceCosts?: { field: string; amount: number }[];
  /** Ability ID + cooldown length — applied on successful resolution only. */
  cooldownAbilityId?: string;
  cooldownMs?: number;
  targetSessionId?: string;
}

export interface DamageResult {
  damage: number;
  dodged: boolean;
  parried: boolean;
  blocked: boolean;
  crit: boolean;
  glancing: boolean;
}

// Helpers for secondary stats mapping from 0-100 values to percentages if needed.
// Assuming the stats passed to formulas are percentages (e.g. 5 = 5%, 0.05 = 5%).
// Let's assume all these arguments are passed as decimals (0.05 = 5%).

function checkHit(attackerHit: number, targetAgi: number, baseDodge: number): boolean {
  // Base hit starts around 0.95
  // Defender dodge chance reduces hit chance.
  let dodgeVal = baseDodge;
  const bonusAgi = Math.max(0, targetAgi - 10);
  dodgeVal += bonusAgi / (bonusAgi + 100);

  // Total chance to hit is Hit Rating minus Target Dodge
  const hitChance = attackerHit - dodgeVal;
  return Math.random() <= hitChance;
}

/** Melee physical damage: STR scaling, armor reduction, AGI dodge chance, parry, block */
export function calcMeleeDamage(
  attackerStr: number,
  defenderArmor: number,
  defenderAgi: number,
  attackerLvl: number = 1,
  defenderLvl: number = 1,
  attackerHitChance: number = 0.95,
  attackerCritChance: number = 0.05,
  attackerCritMult: number = 1.5,
  attackerArmorPen: number = 0,
  defenderParryChance: number = 0.05,
  defenderBlockChance: number = 0,
): DamageResult {
  // 1. Check Hit & Dodge
  if (!checkHit(attackerHitChance, defenderAgi, 0)) {
    // 0 base dodge aside from agi
    return {
      damage: 0,
      dodged: true,
      parried: false,
      blocked: false,
      crit: false,
      glancing: false,
    };
  }

  // 2. Check Parry
  if (Math.random() < defenderParryChance) {
    return {
      damage: 0,
      dodged: false,
      parried: true,
      blocked: false,
      crit: false,
      glancing: false,
    };
  }

  // Base damage scales with attacker STR
  let raw = attackerStr * 1.0;

  // 3. Glancing blows
  let glancing = false;
  if (defenderLvl > attackerLvl + 2) {
    const levelDiff = defenderLvl - attackerLvl;
    const glancingChance = Math.min(0.4, levelDiff * 0.1);
    if (Math.random() < glancingChance) {
      raw *= 0.7; // 30% reduction
      glancing = true;
    }
  }

  // 4. Crit
  let crit = false;
  if (!glancing && Math.random() < attackerCritChance) {
    raw *= attackerCritMult;
    crit = true;
  }

  // 5. Armor reduction & Armor Pen
  const effectiveArmor = Math.max(0, defenderArmor * (1 - attackerArmorPen));
  const reductionMult = 1 - effectiveArmor / (effectiveArmor + 100);
  let damage = raw * reductionMult;

  // 6. Block (Flat damage reduction or %)
  let blocked = false;
  if (Math.random() < defenderBlockChance) {
    damage *= 0.5; // Block mitigates 50%
    blocked = true;
  }

  return {
    damage: Math.max(1, Math.round(damage)),
    dodged: false,
    parried: false,
    blocked,
    crit,
    glancing,
  };
}

/** Ranged physical damage: AGI scaling for archer class */
export function calcRangedDamage(
  attackerAgi: number,
  defenderArmor: number,
  defenderAgi: number,
  attackerLvl: number = 1,
  defenderLvl: number = 1,
  attackerHitChance: number = 0.95,
  attackerCritChance: number = 0.05,
  attackerCritMult: number = 1.5,
  attackerArmorPen: number = 0,
  defenderBlockChance: number = 0,
): DamageResult {
  // Reduced dodge chance vs ranged
  const bonusAgi = Math.max(0, defenderAgi - 10);
  const dodgeVal = (bonusAgi / (bonusAgi + 100)) * 0.6;
  const hitChance = attackerHitChance - dodgeVal;

  if (Math.random() > hitChance) {
    return {
      damage: 0,
      dodged: true,
      parried: false,
      blocked: false,
      crit: false,
      glancing: false,
    };
  }

  let raw = attackerAgi * 0.9;

  let glancing = false;
  if (defenderLvl > attackerLvl + 2) {
    const levelDiff = defenderLvl - attackerLvl;
    const glancingChance = Math.min(0.4, levelDiff * 0.1);
    if (Math.random() < glancingChance) {
      raw *= 0.7;
      glancing = true;
    }
  }

  let crit = false;
  if (!glancing && Math.random() < attackerCritChance) {
    raw *= attackerCritMult;
    crit = true;
  }

  const effectiveArmor = Math.max(0, defenderArmor * (1 - attackerArmorPen));
  const reductionMult = 1 - effectiveArmor / (effectiveArmor + 100);
  let damage = raw * reductionMult;

  let blocked = false;
  if (Math.random() < defenderBlockChance) {
    damage *= 0.5;
    blocked = true;
  }

  return {
    damage: Math.max(1, Math.round(damage)),
    dodged: false,
    parried: false,
    blocked,
    crit,
    glancing,
  };
}

/** Spell damage: base + scaling stat * ratio, minus magic resist from INT */
export function calcSpellDamage(
  baseDamage: number,
  scalingStat: number,
  scalingRatio: number,
  defenderInt: number,
  attackerLvl: number = 1,
  defenderLvl: number = 1,
  attackerCritChance: number = 0.05,
  attackerCritMult: number = 1.5,
): { damage: number; crit: boolean; glancing: boolean } {
  let raw = baseDamage + scalingStat * scalingRatio;

  let glancing = false;
  if (defenderLvl > attackerLvl + 2) {
    const levelDiff = defenderLvl - attackerLvl;
    const glancingChance = Math.min(0.4, levelDiff * 0.1);
    if (Math.random() < glancingChance) {
      raw *= 0.7;
      glancing = true;
    }
  }

  let crit = false;
  // Spells can crit too
  if (!glancing && Math.random() < attackerCritChance) {
    raw *= attackerCritMult;
    crit = true;
  }

  const resistMult = Math.max(0.3, 1 - defenderInt * 0.01);
  const damage = Math.max(1, Math.round(raw * resistMult));

  return { damage, crit, glancing };
}

/** Heal amount: base + caster INT * ratio */
export function calcHealAmount(
  baseAmount: number,
  casterInt: number,
  scalingRatio: number,
  attackerCritChance: number = 0.05,
  attackerCritMult: number = 1.5,
): { heal: number; crit: boolean } {
  let raw = baseAmount + casterInt * scalingRatio;
  let crit = false;

  if (Math.random() < attackerCritChance) {
    raw *= attackerCritMult;
    crit = true;
  }

  return { heal: Math.max(1, Math.round(raw)), crit };
}

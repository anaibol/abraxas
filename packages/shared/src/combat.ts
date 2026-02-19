/** Stat-based combat damage formulas for Abraxas Arena */

export interface BufferedAction {
  type: "attack" | "cast";
  spellId?: string;
  targetTileX?: number;
  targetTileY?: number;
  bufferedAt: number;
}

export interface WindupAction {
  type: "melee" | "spell";
  completeAtMs: number;
  attackerSessionId: string;
  targetTileX: number;
  targetTileY: number;
  spellId?: string;
}

export interface EntityCombatState {
  lastGcdMs: number;
  lastMeleeMs: number;
  spellCooldowns: Map<string, number>;
  bufferedAction: BufferedAction | null;
  windupAction: WindupAction | null;
}

/** Melee physical damage: STR scaling, armor reduction, AGI dodge chance */
export function calcMeleeDamage(
  attackerStr: number,
  defenderArmor: number,
  defenderAgi: number
): { damage: number; dodged: boolean } {
  // Dodge: ~1% per AGI point above 10
  const dodgeChance = Math.max(0, (defenderAgi - 10) * 0.01);
  if (Math.random() < dodgeChance) {
    return { damage: 0, dodged: true };
  }

  // Base damage scales with attacker STR
  const raw = attackerStr * 1.5;
  // Armor reduction: armor / (armor + 50) formula for diminishing returns
  const reductionMult = 1 - (defenderArmor / (defenderArmor + 50));
  const damage = Math.max(1, Math.round(raw * reductionMult));
  return { damage, dodged: false };
}

/** Ranged physical damage: AGI scaling for archer class */
export function calcRangedDamage(
  attackerAgi: number,
  defenderArmor: number,
  defenderAgi: number
): { damage: number; dodged: boolean } {
  // Reduced dodge chance vs ranged
  const dodgeChance = Math.max(0, (defenderAgi - 10) * 0.005);
  if (Math.random() < dodgeChance) {
    return { damage: 0, dodged: true };
  }

  const raw = attackerAgi * 1.3;
  const reductionMult = 1 - (defenderArmor / (defenderArmor + 60)); // Ranged penetrates slightly more
  const damage = Math.max(1, Math.round(raw * reductionMult));
  return { damage, dodged: false };
}

/** Spell damage: base + scaling stat * ratio, minus magic resist from INT */
export function calcSpellDamage(
  baseDamage: number,
  scalingStat: number,
  scalingRatio: number,
  defenderInt: number
): number {
  const raw = baseDamage + scalingStat * scalingRatio;
  // Magic resist: ~0.5% per INT point
  const resistMult = Math.max(0.3, 1 - defenderInt * 0.005);
  return Math.max(1, Math.round(raw * resistMult));
}

/** Heal amount: base + caster INT * ratio */
export function calcHealAmount(
  baseAmount: number,
  casterInt: number,
  scalingRatio: number
): number {
  return Math.max(1, Math.round(baseAmount + casterInt * scalingRatio));
}

import { AFFIXES, type AffixDef, type ItemAffix, ItemRarity } from "@abraxas/shared";

export interface GeneratedItem {
  rarity: ItemRarity;
  nameOverride?: string;
  affixes: ItemAffix[];
}

export class ItemGenerator {
  static generate(level: number): GeneratedItem {
    const rarity = ItemGenerator.rollRarity();
    const affixes: ItemAffix[] = [];

    let affixCount = 0;
    if (rarity === ItemRarity.UNCOMMON) affixCount = 1;
    else if (rarity === ItemRarity.RARE) affixCount = 2;
    else if (rarity === ItemRarity.EPIC) affixCount = 3;
    else if (rarity === ItemRarity.LEGENDARY) affixCount = 4;

    if (affixCount > 0) {
      const availableAffixes = AFFIXES.filter((a: AffixDef) => a.minLevel <= level);
      const chosen = new Set<string>();

      for (let i = 0; i < affixCount && chosen.size < availableAffixes.length; i++) {
        let affix: AffixDef;
        do {
          affix = availableAffixes[Math.floor(Math.random() * availableAffixes.length)];
        } while (chosen.has(affix.id));

        chosen.add(affix.id);
        const value =
          Math.floor(Math.random() * (affix.maxValue - affix.minValue + 1)) + affix.minValue;
        affixes.push({
          type: affix.id,
          stat: affix.stat,
          value: value,
        });
      }
    }

    return {
      rarity,
      affixes,
      nameOverride: ItemGenerator.generateName(rarity, affixes),
    };
  }

  private static rollRarity(): ItemRarity {
    const roll = Math.random();
    if (roll < 0.01) return ItemRarity.LEGENDARY;
    if (roll < 0.05) return ItemRarity.EPIC;
    if (roll < 0.15) return ItemRarity.RARE;
    if (roll < 0.4) return ItemRarity.UNCOMMON;
    return ItemRarity.COMMON;
  }

  private static generateName(rarity: ItemRarity, affixes: ItemAffix[]): string | undefined {
    if (rarity === ItemRarity.COMMON) return undefined;

    const prefix = affixes.find(
      (a: ItemAffix) => AFFIXES.find((d: AffixDef) => d.id === a.type)?.type === "prefix",
    );
    const suffix = affixes.find(
      (a: ItemAffix) => AFFIXES.find((d: AffixDef) => d.id === a.type)?.type === "suffix",
    );

    const prefixName = prefix ? AFFIXES.find((d: AffixDef) => d.id === prefix.type)?.name : "";
    const suffixName = suffix ? AFFIXES.find((d: AffixDef) => d.id === suffix.type)?.name : "";

    if (prefixName && suffixName) {
      return `${prefixName} %ITEM% ${suffixName}`;
    } else if (prefixName) {
      return `${prefixName} %ITEM%`;
    } else if (suffixName) {
      return `%ITEM% ${suffixName}`;
    }

    return undefined;
  }
}

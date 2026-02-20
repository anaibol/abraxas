import { type ItemAffix, type ItemRarity } from "@abraxas/shared";
import { AFFIXES, type AffixDef } from "@abraxas/shared/src/config/affixes";

export interface GeneratedItem {
  rarity: ItemRarity;
  nameOverride?: string;
  affixes: ItemAffix[];
}

export class ItemGenerator {
  static generate(level: number): GeneratedItem {
    const rarity = this.rollRarity();
    const affixes: ItemAffix[] = [];
    
    let affixCount = 0;
    if (rarity === "uncommon") affixCount = 1;
    else if (rarity === "rare") affixCount = 2;
    else if (rarity === "epic") affixCount = 3;
    else if (rarity === "legendary") affixCount = 4;

    if (affixCount > 0) {
      const availableAffixes = AFFIXES.filter(a => a.minLevel <= level);
      const chosen = new Set<string>();

      for (let i = 0; i < affixCount && chosen.size < availableAffixes.length; i++) {
        let affix: AffixDef;
        do {
          affix = availableAffixes[Math.floor(Math.random() * availableAffixes.length)];
        } while (chosen.has(affix.id));

        chosen.add(affix.id);
        const value = Math.floor(Math.random() * (affix.maxValue - affix.minValue + 1)) + affix.minValue;
        affixes.push({
          type: affix.id,
          stat: affix.stat,
          value: value
        });
      }
    }

    return {
      rarity,
      affixes,
      nameOverride: this.generateName(rarity, affixes)
    };
  }

  private static rollRarity(): ItemRarity {
    const roll = Math.random();
    if (roll < 0.01) return "legendary";
    if (roll < 0.05) return "epic";
    if (roll < 0.15) return "rare";
    if (roll < 0.40) return "uncommon";
    return "common";
  }

  private static generateName(rarity: ItemRarity, affixes: ItemAffix[]): string | undefined {
    if (rarity === "common") return undefined;

    const prefix = affixes.find(a => AFFIXES.find(d => d.id === a.type)?.type === "prefix");
    const suffix = affixes.find(a => AFFIXES.find(d => d.id === a.type)?.type === "suffix");

    const prefixName = prefix ? AFFIXES.find(d => d.id === prefix.type)?.name : "";
    const suffixName = suffix ? AFFIXES.find(d => d.id === suffix.type)?.name : "";

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

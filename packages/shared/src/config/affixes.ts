import { StatType } from "../types";

export interface AffixDef {
  id: string;
  name: string;
  type: "prefix" | "suffix";
  stat: StatType;
  minLevel: number;
  minValue: number;
  maxValue: number;
}

export const AFFIXES: AffixDef[] = [
  // --- PREFIXES ---
  { id: "sturdy", name: "Sturdy", type: "prefix", stat: StatType.ARMOR, minLevel: 1, minValue: 1, maxValue: 5 },
  { id: "rugged", name: "Rugged", type: "prefix", stat: StatType.ARMOR, minLevel: 10, minValue: 5, maxValue: 15 },
  { id: "gory", name: "Gory", type: "prefix", stat: StatType.STR, minLevel: 5, minValue: 2, maxValue: 8 },
  { id: "sharp", name: "Sharp", type: "prefix", stat: StatType.AGI, minLevel: 5, minValue: 2, maxValue: 8 },
  { id: "brilliant", name: "Brilliant", type: "prefix", stat: StatType.INT, minLevel: 5, minValue: 2, maxValue: 8 },
  
  // --- SUFFIXES ---
  { id: "of_strength", name: "of Strength", type: "suffix", stat: StatType.STR, minLevel: 1, minValue: 1, maxValue: 5 },
  { id: "of_agility", name: "of Agility", type: "suffix", stat: StatType.AGI, minLevel: 1, minValue: 1, maxValue: 5 },
  { id: "of_intellect", name: "of Intellect", type: "suffix", stat: StatType.INT, minLevel: 1, minValue: 1, maxValue: 5 },
  { id: "of_vitality", name: "of Vitality", type: "suffix", stat: StatType.HP, minLevel: 1, minValue: 10, maxValue: 50 },
  { id: "of_power", name: "of Power", type: "suffix", stat: StatType.STR, minLevel: 15, minValue: 10, maxValue: 25 },
];

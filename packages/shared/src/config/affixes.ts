import { type ItemAffix } from "../types";

export interface AffixDef {
  id: string;
  name: string;
  type: "prefix" | "suffix";
  stat: string;
  minLevel: number;
  minValue: number;
  maxValue: number;
}

export const AFFIXES: AffixDef[] = [
  // --- PREFIXES ---
  { id: "sturdy", name: "Sturdy", type: "prefix", stat: "armor", minLevel: 1, minValue: 1, maxValue: 5 },
  { id: "rugged", name: "Rugged", type: "prefix", stat: "armor", minLevel: 10, minValue: 5, maxValue: 15 },
  { id: "gory", name: "Gory", type: "prefix", stat: "str", minLevel: 5, minValue: 2, maxValue: 8 },
  { id: "sharp", name: "Sharp", type: "prefix", stat: "agi", minLevel: 5, minValue: 2, maxValue: 8 },
  { id: "brilliant", name: "Brilliant", type: "prefix", stat: "int", minLevel: 5, minValue: 2, maxValue: 8 },
  
  // --- SUFFIXES ---
  { id: "of_strength", name: "of Strength", type: "suffix", stat: "str", minLevel: 1, minValue: 1, maxValue: 5 },
  { id: "of_agility", name: "of Agility", type: "suffix", stat: "agi", minLevel: 1, minValue: 1, maxValue: 5 },
  { id: "of_intellect", name: "of Intellect", type: "suffix", stat: "int", minLevel: 1, minValue: 1, maxValue: 5 },
  { id: "of_vitality", name: "of Vitality", type: "suffix", stat: "hp", minLevel: 1, minValue: 10, maxValue: 50 },
  { id: "of_power", name: "of Power", type: "suffix", stat: "str", minLevel: 15, minValue: 10, maxValue: 25 },
];

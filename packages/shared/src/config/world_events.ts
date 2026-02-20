import type { WorldEvent } from "../types";

/**
 * Catalogue of recurring world events.
 * Each event spawns waves of NPCs and runs on a fixed interval.
 *
 * Add new events here — WorldEventSystem will pick them up automatically.
 */
export const WORLD_EVENTS: WorldEvent[] = [
  {
    id: "goblin_raid",
    name: "Goblin Raid",
    description: "A horde of goblins is attacking the settlement!",
    spawns: [
      { npcType: "goblin", count: 5 },
      { npcType: "orc", count: 2 },
    ],
    durationMs: 5 * 60_000,  // 5 minutes
    intervalMs: 30 * 60_000, // every 30 minutes
  },
  {
    id: "undead_surge",
    name: "Undead Surge",
    description: "The dead rise from their graves — defend the living!",
    spawns: [
      { npcType: "zombie", count: 4 },
      { npcType: "skeleton", count: 3 },
      { npcType: "ghost", count: 2 },
    ],
    durationMs: 7 * 60_000,  // 7 minutes
    intervalMs: 45 * 60_000, // every 45 minutes
  },
  {
    id: "dragon_sighting",
    name: "Dragon Sighting",
    description: "A fearsome dragon has been spotted circling the skies!",
    spawns: [
      { npcType: "dragon", count: 1 },
    ],
    durationMs: 10 * 60_000, // 10 minutes
    intervalMs: 90 * 60_000, // every 90 minutes
  },
];

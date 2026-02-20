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
  {
    id: "troll_invasion",
    name: "Troll Invasion",
    description: "A war party of trolls is storming the settlement!",
    spawns: [
      { npcType: "troll", count: 3 },
      { npcType: "orc", count: 2 },
    ],
    durationMs: 6 * 60_000,  // 6 minutes
    intervalMs: 40 * 60_000, // every 40 minutes
  },
  {
    id: "spider_swarm",
    name: "Spider Swarm",
    description: "Thousands of giant spiders are emerging from hidden lairs!",
    spawns: [
      { npcType: "spider", count: 6 },
      { npcType: "vampire", count: 1 },
    ],
    durationMs: 4 * 60_000,  // 4 minutes
    intervalMs: 25 * 60_000, // every 25 minutes
  },
  {
    id: "vampire_hunt",
    name: "Vampire Hunt",
    description: "Ancient vampires have risen — protect the living before dawn!",
    spawns: [
      { npcType: "vampire", count: 2 },
      { npcType: "lich", count: 1 },
    ],
    durationMs: 8 * 60_000,  // 8 minutes
    intervalMs: 60 * 60_000, // every 60 minutes
  },
];

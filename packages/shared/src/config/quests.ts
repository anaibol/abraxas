import type { Quest } from "../types";

export const QUESTS: Record<string, Quest> = {
  slime_slayer: {
    id: "slime_slayer",
    title: "quest.slime_slayer.title",
    description: "quest.slime_slayer.description",
    npcId: "merchant",
    requirements: [{ type: "kill", target: "goblin", count: 5 }],
    rewards: {
      exp: 200,
      gold: 50,
      items: [{ itemId: "health_potion", quantity: 2 }],
    },
  },
  tutorial_talk: {
    id: "tutorial_talk",
    title: "quest.tutorial_talk.title",
    description: "quest.tutorial_talk.description",
    npcId: "merchant",
    requirements: [{ type: "talk", target: "merchant", count: 1 }],
    rewards: {
      exp: 100,
      gold: 10,
    },
  },
};

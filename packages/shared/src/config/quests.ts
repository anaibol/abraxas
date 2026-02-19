import type { Quest } from "../types";

export const QUESTS: Record<string, Quest> = {
  slime_slayer: {
    id: "slime_slayer",
    title: "Slime Slayer",
    description: "The village is being overrun by goblins! Kill 5 of them to help us out.",
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
    title: "A New Arrival",
    description: "Welcome to Abraxas! Go talk to the Merchant to learn about trading.",
    npcId: "merchant",
    requirements: [{ type: "talk", target: "merchant", count: 1 }],
    rewards: {
      exp: 100,
      gold: 10,
    },
  },
};

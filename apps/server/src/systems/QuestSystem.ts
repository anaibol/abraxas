import { type PlayerQuestState, QUESTS, type Quest, type QuestType } from "@abraxas/shared";
import { prisma } from "../database/db";

export class QuestSystem {
  /** charId → questId → state */
  private charQuests = new Map<string, Map<string, PlayerQuestState>>();

  async loadCharQuests(charId: string): Promise<PlayerQuestState[]> {
    const dbQuests = await prisma.characterQuest.findMany({
      where: { characterId: charId },
      include: { quest: true },
    });

    const questStates = new Map<string, PlayerQuestState>();
    for (const dbQuest of dbQuests) {
      const code = dbQuest.quest.code;
      questStates.set(code, {
        questId: code,
        status: dbQuest.status,
        progress: dbQuest.progressJson ?? {},
      });
    }
    this.charQuests.set(charId, questStates);
    return Array.from(questStates.values());
  }

  getQuestState(charId: string, questId: string): PlayerQuestState | undefined {
    return this.charQuests.get(charId)?.get(questId);
  }

  getCharQuestStates(charId: string): PlayerQuestState[] {
    return Array.from(this.charQuests.get(charId)?.values() ?? []);
  }

  removeChar(charId: string): void {
    this.charQuests.delete(charId);
  }

  async acceptQuest(charId: string, questId: string): Promise<PlayerQuestState | null> {
    const questDef = QUESTS[questId];
    if (!questDef) return null;

    let quests = this.charQuests.get(charId);
    if (!quests) {
      quests = new Map();
      this.charQuests.set(charId, quests);
    }

    if (quests.has(questId)) return null;

    const initialState: PlayerQuestState = {
      questId,
      status: "IN_PROGRESS",
      progress: Object.fromEntries(questDef.requirements.map((r) => [r.target, 0])),
    };

    await prisma.characterQuest.create({
      data: {
        character: { connect: { id: charId } },
        quest: { connect: { code: questId } },
        status: "IN_PROGRESS",
        progressJson: initialState.progress,
        startedAt: new Date(),
      },
    });

    quests.set(questId, initialState);
    return initialState;
  }

  async updateProgress(
    charId: string,
    type: QuestType,
    target: string,
    amount: number = 1,
  ): Promise<PlayerQuestState[]> {
    const quests = this.charQuests.get(charId);
    if (!quests) return [];

    const updatedQuests: PlayerQuestState[] = [];

    for (const state of quests.values()) {
      if (state.status !== "IN_PROGRESS") continue;

      const questDef = QUESTS[state.questId];
      if (!questDef) continue;

      const relevantReq = questDef.requirements.find((r) => r.type === type && r.target === target);
      if (!relevantReq) continue;

      const current = state.progress[target] || 0;
      if (current >= relevantReq.count) continue;

      const reachedCount = (state.progress[relevantReq.target] || 0) >= relevantReq.count;
      state.progress[target] = Math.min(relevantReq.count, current + amount);
      const nowReachedCount = (state.progress[relevantReq.target] || 0) >= relevantReq.count;

      if (questDef.requirements.every((req) => (state.progress[req.target] || 0) >= req.count)) {
        state.status = "COMPLETED";
      }

      // Only sync to DB if quest completed or if we hit a target goal
      if (state.status === "COMPLETED" || nowReachedCount !== reachedCount) {
        await prisma.characterQuest.updateMany({
          where: { characterId: charId, quest: { code: state.questId } },
          data: { status: state.status, progressJson: state.progress },
        });
      }

      updatedQuests.push(state);
    }

    return updatedQuests;
  }

  async completeQuest(charId: string, questId: string): Promise<Quest | null> {
    const state = this.getQuestState(charId, questId);
    if (!state || state.status !== "COMPLETED") return null;

    const questDef = QUESTS[questId];
    if (!questDef) return null;

    state.status = "TURNED_IN";

    await prisma.characterQuest.updateMany({
      where: { characterId: charId, quest: { code: questId } },
      data: { status: "TURNED_IN", completedAt: new Date() },
    });

    return questDef;
  }

  getAvailableQuests(charId: string, npcId: string): string[] {
    const quests = this.charQuests.get(charId) ?? new Map();
    return Object.values(QUESTS)
      .filter((q) => q.npcId === npcId && !quests.has(q.id))
      .map((q) => q.id);
  }

  /**
   * Returns the dialogue payload for a player interacting with an NPC.
   * Priority: offer a new quest → turn in a completed quest → generic greeting.
   */
  getDialogueOptions(
    charId: string,
    _npcSessionId: string,
    npcType: string,
  ): { text: string; options: { text: string; action: string; data?: unknown }[] } {
    const availableQuests = this.getAvailableQuests(charId, npcType);
    if (availableQuests.length > 0) {
      const questId = availableQuests[0];
      return {
        text: "dialogue.accept_prompt",
        options: [
          { text: "dialogue.accept_quest", action: "quest_accept", data: { questId } },
          { text: "dialogue.maybe_later", action: "close" },
        ],
      };
    }

    for (const state of this.getCharQuestStates(charId)) {
      if (state.status !== "COMPLETED") continue;
      const questDef = QUESTS[state.questId];
      if (questDef?.npcId === npcType) {
        return {
          text: "dialogue.reward_prompt",
          options: [
            {
              text: "dialogue.complete_quest",
              action: "quest_complete",
              data: { questId: state.questId },
            },
          ],
        };
      }
    }

    return {
      text: "dialogue.hello_traveler",
      options: [{ text: "dialogue.goodbye", action: "close" }],
    };
  }
}

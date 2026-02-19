import {
  QUESTS,
  Quest,
  PlayerQuestState,
  QuestType,
} from "@abraxas/shared";
import { prisma } from "../database/db";

export class QuestSystem {
  /** userId → questId → state */
  private charQuests = new Map<string, Map<string, PlayerQuestState>>();

  async loadCharQuests(
    userId: string,
    charId: string,
  ): Promise<PlayerQuestState[]> {
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
        progress: dbQuest.progressJson as Record<string, number> ?? {},
      });
    }
    this.charQuests.set(userId, questStates);
    return Array.from(questStates.values());
  }

  getQuestState(userId: string, questId: string): PlayerQuestState | undefined {
    return this.charQuests.get(userId)?.get(questId);
  }

  getCharQuestStates(userId: string): PlayerQuestState[] {
    return Array.from(this.charQuests.get(userId)?.values() ?? []);
  }

  async acceptQuest(
    userId: string,
    charId: string,
    questId: string,
  ): Promise<PlayerQuestState | null> {
    const questDef = QUESTS[questId];
    if (!questDef) return null;

    let userQuests = this.charQuests.get(userId);
    if (!userQuests) {
      userQuests = new Map();
      this.charQuests.set(userId, userQuests);
    }

    if (userQuests.has(questId)) return null;

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
      },
    });

    userQuests.set(questId, initialState);
    return initialState;
  }

  async updateProgress(
    userId: string,
    charId: string,
    type: QuestType,
    target: string,
    amount: number = 1,
  ): Promise<PlayerQuestState[]> {
    const userQuests = this.charQuests.get(userId);
    if (!userQuests) return [];

    const updatedQuests: PlayerQuestState[] = [];

    for (const state of userQuests.values()) {
      if (state.status !== "IN_PROGRESS") continue;

      const questDef = QUESTS[state.questId];
      if (!questDef) continue;

      const relevantReq = questDef.requirements.find(
        (r) => r.type === type && r.target === target,
      );
      if (!relevantReq) continue;

      const current = state.progress[target] || 0;
      if (current >= relevantReq.count) continue;

      state.progress[target] = Math.min(relevantReq.count, current + amount);

      if (questDef.requirements.every((req) => (state.progress[req.target] || 0) >= req.count)) {
        state.status = "COMPLETED";
      }

      await prisma.characterQuest.updateMany({
        where: { characterId: charId, quest: { code: state.questId } },
        data: { status: state.status, progressJson: state.progress },
      });

      updatedQuests.push(state);
    }

    return updatedQuests;
  }

  async completeQuest(
    userId: string,
    charId: string,
    questId: string,
  ): Promise<Quest | null> {
    const state = this.getQuestState(userId, questId);
    if (!state || state.status !== "COMPLETED") return null;

    const questDef = QUESTS[questId];
    if (!questDef) return null;

    state.status = "TURNED_IN";

    await prisma.characterQuest.updateMany({
      where: { characterId: charId, quest: { code: questId } },
      data: { status: "TURNED_IN" },
    });

    return questDef;
  }

  getAvailableQuests(userId: string, npcId: string): string[] {
    const userQuests = this.charQuests.get(userId) ?? new Map();
    return Object.values(QUESTS)
      .filter((q) => q.npcId === npcId && !userQuests.has(q.id))
      .map((q) => q.id);
  }
}

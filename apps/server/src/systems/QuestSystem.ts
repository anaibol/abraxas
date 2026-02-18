import {
  QUESTS,
  QuestDef,
  QuestStatus,
  PlayerQuestState,
  QuestType,
} from "@abraxas/shared";
import { prisma } from "../database/db";

export class QuestSystem {
  private playerQuests = new Map<string, Map<string, PlayerQuestState>>(); // userId -> questId -> state

  async loadPlayerQuests(
    userId: string,
    characterId: string,
  ): Promise<PlayerQuestState[]> {
    const dbQuests = await prisma.characterQuest.findMany({
      where: { characterId },
      include: { questDef: true },
    });

    const questStates = new Map<string, PlayerQuestState>();
    for (const dbQuest of dbQuests) {
      questStates.set(dbQuest.questDef.code, {
        questId: dbQuest.questDef.code,
        status: dbQuest.status.toLowerCase() as QuestStatus,
        progress: (dbQuest.progressJson as Record<string, number>) || {},
      });
    }
    this.playerQuests.set(userId, questStates);
    return Array.from(questStates.values());
  }

  getQuestState(userId: string, questId: string): PlayerQuestState | undefined {
    return this.playerQuests.get(userId)?.get(questId);
  }

  async acceptQuest(
    userId: string,
    characterId: string,
    questId: string,
  ): Promise<PlayerQuestState | null> {
    const questDef = QUESTS[questId];
    if (!questDef) return null;

    let userQuests = this.playerQuests.get(userId);
    if (!userQuests) {
      userQuests = new Map();
      this.playerQuests.set(userId, userQuests);
    }

    if (userQuests.has(questId)) return null;

    // Find QuestDef in DB
    const dbQuestDef = await prisma.questDef.findUnique({
      where: { code: questId },
    });
    if (!dbQuestDef) return null;

    const initialState: PlayerQuestState = {
      questId,
      status: "active",
      progress: {},
    };

    // Initialize progress for all requirements
    for (const req of questDef.requirements) {
      initialState.progress[req.target] = 0;
    }

    await prisma.characterQuest.create({
      data: {
        characterId,
        questDefId: dbQuestDef.id,
        status: "IN_PROGRESS",
        progressJson: initialState.progress,
      },
    });

    userQuests.set(questId, initialState);
    return initialState;
  }

  async updateProgress(
    userId: string,
    characterId: string,
    type: QuestType,
    target: string,
    amount: number = 1,
  ): Promise<PlayerQuestState[]> {
    const userQuests = this.playerQuests.get(userId);
    if (!userQuests) return [];

    const updatedQuests: PlayerQuestState[] = [];

    for (const state of userQuests.values()) {
      if (state.status !== "active") continue;

      const questDef = QUESTS[state.questId];
      if (!questDef) continue;
      
      // Check if this quest even cares about this type/target
      const relevantReq = questDef.requirements.find(r => r.type === type && r.target === target);
      if (!relevantReq) continue;

      let changed = false;
      const current = state.progress[target] || 0;
      if (current < relevantReq.count) {
        state.progress[target] = Math.min(relevantReq.count, current + amount);
        changed = true;
      }

      if (changed) {
        // Check if all requirements met
        const allMet = questDef.requirements.every(
          (req) => (state.progress[req.target] || 0) >= req.count,
        );
        if (allMet) {
          state.status = "completed";
        }

        const dbQuestDefId = (questDef as any).dbId; // Assuming we might want to cache this
        // For now, keep findUnique or optimize it
        const dbQuestDef = await prisma.questDef.findUnique({
          where: { code: state.questId },
        });

        if (dbQuestDef) {
          await prisma.characterQuest.update({
            where: { characterId_questDefId: { characterId, questDefId: dbQuestDef.id } },
            data: {
              status: state.status === "completed" ? "COMPLETED" : "IN_PROGRESS",
              progressJson: state.progress,
            },
          });
        }

        updatedQuests.push(state);
      }
    }

    return updatedQuests;
  }

  async completeQuest(
    userId: string,
    characterId: string,
    questId: string,
  ): Promise<QuestDef | null> {
    const state = this.getQuestState(userId, questId);
    if (!state || state.status !== "completed") return null;

    const questDef = QUESTS[questId];
    if (!questDef) return null;

    state.status = "rewarded";

    const dbQuestDef = await prisma.questDef.findUnique({
      where: { code: questId },
    });

    if (dbQuestDef) {
      await prisma.characterQuest.update({
        where: { characterId_questDefId: { characterId, questDefId: dbQuestDef.id } },
        data: { status: "TURNED_IN" },
      });
    }

    return questDef;
  }

  getAvailableQuests(userId: string, npcId: string): string[] {
    const userQuests = this.playerQuests.get(userId) || new Map();

    return Object.values(QUESTS)
      .filter((q) => q.npcId === npcId && !userQuests.has(q.id))
      .map((q) => q.id);
  }
}

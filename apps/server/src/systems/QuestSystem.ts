import { MapSchema } from "@colyseus/schema";
import { Player } from "../schema/Player";
import { 
    QUESTS, 
    QuestDef, 
    QuestStatus, 
    PlayerQuestState, 
    QuestType,
    BroadcastFn
} from "@abraxas/shared";
import { prisma } from "../database/db";
import { logger } from "../logger";

export class QuestSystem {
    private playerQuests = new Map<string, Map<string, PlayerQuestState>>(); // userId -> questId -> state

    async loadPlayerQuests(userId: string, playerId: string): Promise<PlayerQuestState[]> {
        const dbQuests = await prisma.playerQuest.findMany({
            where: { playerId }
        });

        const questStates = new Map<string, PlayerQuestState>();
        for (const dbQuest of dbQuests) {
            questStates.set(dbQuest.questId, {
                questId: dbQuest.questId,
                status: dbQuest.status as QuestStatus,
                progress: JSON.parse(dbQuest.progress)
            });
        }
        this.playerQuests.set(userId, questStates);
        return Array.from(questStates.values());
    }

    getQuestState(userId: string, questId: string): PlayerQuestState | undefined {
        return this.playerQuests.get(userId)?.get(questId);
    }

    async acceptQuest(userId: string, playerId: string, questId: string): Promise<PlayerQuestState | null> {
        const questDef = QUESTS[questId];
        if (!questDef) return null;

        let userQuests = this.playerQuests.get(userId);
        if (!userQuests) {
            userQuests = new Map();
            this.playerQuests.set(userId, userQuests);
        }

        if (userQuests.has(questId)) return null;

        const initialState: PlayerQuestState = {
            questId,
            status: "active",
            progress: {}
        };

        // Initialize progress for all requirements
        for (const req of questDef.requirements) {
            initialState.progress[req.target] = 0;
        }

        await prisma.playerQuest.create({
            data: {
                playerId,
                questId,
                status: "active",
                progress: JSON.stringify(initialState.progress)
            }
        });

        userQuests.set(questId, initialState);
        return initialState;
    }

    async updateProgress(
        userId: string, 
        playerId: string, 
        type: QuestType, 
        target: string, 
        amount: number = 1
    ): Promise<PlayerQuestState[]> {
        const userQuests = this.playerQuests.get(userId);
        if (!userQuests) return [];

        const updatedQuests: PlayerQuestState[] = [];

        for (const [questId, state] of userQuests.entries()) {
            if (state.status !== "active") continue;

            const questDef = QUESTS[questId];
            let changed = false;

            for (const req of questDef.requirements) {
                if (req.type === type && req.target === target) {
                    const current = state.progress[target] || 0;
                    if (current < req.count) {
                        state.progress[target] = Math.min(req.count, current + amount);
                        changed = true;
                    }
                }
            }

            if (changed) {
                // Check if all requirements met
                const allMet = questDef.requirements.every(req => (state.progress[req.target] || 0) >= req.count);
                if (allMet) {
                    state.status = "completed";
                }

                await prisma.playerQuest.update({
                    where: { playerId_questId: { playerId, questId } },
                    data: {
                        status: state.status,
                        progress: JSON.stringify(state.progress)
                    }
                });

                updatedQuests.push(state);
            }
        }

        return updatedQuests;
    }

    async completeQuest(userId: string, playerId: string, questId: string): Promise<QuestDef | null> {
        const state = this.getQuestState(userId, questId);
        if (!state || state.status !== "completed") return null;

        const questDef = QUESTS[questId];
        if (!questDef) return null;

        state.status = "rewarded";

        await prisma.playerQuest.update({
            where: { playerId_questId: { playerId, questId } },
            data: { status: "rewarded" }
        });

        return questDef;
    }

    getAvailableQuests(userId: string, npcId: string): string[] {
        const userQuests = this.playerQuests.get(userId) || new Map();
        
        return Object.values(QUESTS)
            .filter(q => q.npcId === npcId && !userQuests.has(q.id))
            .map(q => q.id);
    }
}

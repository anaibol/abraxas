import { Box, Flex, Text, VStack, Progress } from "@chakra-ui/react";
import { QUESTS, type PlayerQuestState } from "@abraxas/shared";
import { T, HEX } from "./tokens";
import { useTranslation } from "react-i18next";

interface QuestLogProps {
    quests: PlayerQuestState[];
}


export function QuestLog({ quests }: QuestLogProps) {
    const { t } = useTranslation();
    const activeQuests = quests.filter(q => q.status === "IN_PROGRESS" || q.status === "COMPLETED");

    return (
        <Box flex="1" overflow="auto" p="2.5" fontFamily={T.display}>
            {activeQuests.length === 0 ? (
                <Text textAlign="center" color={T.goldMuted} fontSize="11px" py="8" fontStyle="italic">
                    {t("ui.quests.no_active")}
                </Text>
            ) : (
                <VStack align="stretch" gap="3">
                    {activeQuests.map((q) => {
                        const def = QUESTS[q.questId];
                        if (!def) return null;

                        return (
                            <Box
                                key={q.questId}
                                p="3"
                                bg={T.surface}
                                border="1px solid"
                                borderColor={q.status === "COMPLETED" ? T.gold : T.border}
                                borderRadius="2px"
                                position="relative"
                            >
                                <Flex justify="space-between" align="center" mb="1">
                                    <Text fontSize="13px" fontWeight="bold" color={T.gold}>
                                        {t(def.title)}
                                    </Text>
                                    <Text fontSize="11px" color={q.status === "COMPLETED" ? "#00ff00" : T.goldMuted} fontWeight="bold" textTransform="uppercase">
                                        {q.status}
                                    </Text>
                                </Flex>
                                
                                <Text fontSize="12px" color="whiteAlpha.800" mb="2" fontStyle="italic">
                                    {t(def.description)}
                                </Text>

                                <VStack align="stretch" gap="1.5">
                                    {def.requirements.map((req, i) => {
                                        const current = q.progress[req.target] ?? 0;
                                        const pct = Math.min(100, (current / req.count) * 100);
                                        
                                        return (
                                            <Box key={`${q.questId}-req-${i}`}>
                                                <Flex justify="space-between" fontSize="11px" color={T.goldMuted} mb="0.5">
                                                    <Text>
                                                        {req.type === "kill" 
                                                            ? t("ui.quests.kill_target", { target: t(`npcs.${req.target}`) }) 
                                                            : t("ui.quests.talk_to_target", { target: t(`npcs.${req.target}`) })}
                                                    </Text>
                                                    <Text fontFamily={T.mono}>{current} / {req.count}</Text>
                                                </Flex>
                                                <Box h="4px" bg={T.bg} borderRadius="full" overflow="hidden">
                                                    <Box h="100%" w={`${pct}%`} bg={pct === 100 ? "#00ff00" : T.goldDark} transition="width 0.3s" />
                                                </Box>
                                            </Box>
                                        );
                                    })}
                                </VStack>

                                {q.status === "COMPLETED" && (
                                    <Text fontSize="11px" color="#00ff00" mt="2" textAlign="center" fontWeight="bold">
                                        {t("ui.quests.turn_in_hint", { name: t(`npcs.${def.npcId}`) })}
                                    </Text>
                                )}
                            </Box>
                        );
                    })}
                </VStack>
            )}
        </Box>
    );
}

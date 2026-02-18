import { Box, Flex, Text, VStack, Progress } from "@chakra-ui/react";
import { QUESTS, type PlayerQuestState } from "@abraxas/shared";

interface QuestLogProps {
    quests: PlayerQuestState[];
}

const P = {
  bg: "#0e0c14",
  surface: "#14111e",
  border: "#2e2840",
  gold: "#d4a843",
  goldDark: "#6e5a18",
  goldMuted: "#8a7a60",
  font: "'Friz Quadrata', Georgia, serif",
  mono: "'Consolas', monospace",
};

export function QuestLog({ quests }: QuestLogProps) {
    const activeQuests = quests.filter(q => q.status === "active" || q.status === "completed");

    return (
        <Box flex="1" overflow="auto" p="2.5" fontFamily={P.font}>
            {activeQuests.length === 0 ? (
                <Text textAlign="center" color={P.goldMuted} fontSize="11px" py="8" fontStyle="italic">
                    No active quests
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
                                bg={P.surface}
                                border="1px solid"
                                borderColor={q.status === "completed" ? P.gold : P.border}
                                borderRadius="2px"
                                position="relative"
                            >
                                <Flex justify="space-between" align="center" mb="1">
                                    <Text fontSize="12px" fontWeight="bold" color={P.gold}>
                                        {def.title}
                                    </Text>
                                    <Text fontSize="9px" color={q.status === "completed" ? "#00ff00" : P.goldMuted} fontWeight="bold" textTransform="uppercase">
                                        {q.status}
                                    </Text>
                                </Flex>
                                
                                <Text fontSize="10px" color="whiteAlpha.800" mb="2" fontStyle="italic">
                                    {def.description}
                                </Text>

                                <VStack align="stretch" gap="1.5">
                                    {def.requirements.map((req, i) => {
                                        const current = q.progress[req.target] ?? 0;
                                        const pct = Math.min(100, (current / req.count) * 100);
                                        
                                        return (
                                            <Box key={`${q.questId}-req-${i}`}>
                                                <Flex justify="space-between" fontSize="9px" color={P.goldMuted} mb="0.5">
                                                    <Text>
                                                        {req.type === "kill" ? `Kill ${req.target}s` : `Talk to ${req.target}`}
                                                    </Text>
                                                    <Text fontFamily={P.mono}>{current} / {req.count}</Text>
                                                </Flex>
                                                <Box h="4px" bg={P.bg} borderRadius="full" overflow="hidden">
                                                    <Box h="100%" w={`${pct}%`} bg={pct === 100 ? "#00ff00" : P.goldDark} transition="width 0.3s" />
                                                </Box>
                                            </Box>
                                        );
                                    })}
                                </VStack>

                                {q.status === "completed" && (
                                    <Text fontSize="9px" color="#00ff00" mt="2" textAlign="center" fontWeight="bold">
                                        Talk to {def.npcId.replace(/_/g, " ")} to turn in
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

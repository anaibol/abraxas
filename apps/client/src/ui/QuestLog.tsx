import { type PlayerQuestState, QUESTS } from "@abraxas/shared";
import { Box, Flex, Text, VStack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { HEX, T } from "./tokens";

type QuestLogProps = {
  quests: PlayerQuestState[];
};

export function QuestLog({ quests }: QuestLogProps) {
  const { t } = useTranslation();
  const activeQuests = quests.filter((q) => q.status === "IN_PROGRESS" || q.status === "COMPLETED");
  const startedIds = new Set(quests.map((q) => q.questId));
  const availableQuests = Object.values(QUESTS).filter((q) => !startedIds.has(q.id));

  return (
    <Box flex="1" overflow="auto" p="2.5" fontFamily={T.display}>
      {/* Active / Completed quests */}
      {activeQuests.length > 0 && (
        <VStack align="stretch" gap="3" mb={availableQuests.length > 0 ? "4" : "0"}>
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
              >
                <Flex justify="space-between" align="center" mb="1">
                  <Text textStyle={T.bodyText} fontWeight="700" color={T.gold}>
                    {t(def.title)}
                  </Text>
                  <Text
                    textStyle={T.statLabel}
                    color={q.status === "COMPLETED" ? "#00ff00" : T.goldMuted}
                    fontWeight="700"
                  >
                    {t(`quest_status.${q.status}`, { defaultValue: q.status })}
                  </Text>
                </Flex>
                <Text textStyle={T.bodyMuted} color="whiteAlpha.800" mb="2" fontStyle="italic">
                  {t(def.description)}
                </Text>
                <VStack align="stretch" gap="1.5">
                  {def.requirements.map((req, i) => {
                    const current = q.progress[req.target] ?? 0;
                    const pct = Math.min(100, (current / req.count) * 100);
                    return (
                      <Box key={`${q.questId}-req-${i}`}>
                        <Flex justify="space-between" textStyle={T.statLabel} color={T.goldMuted} mb="0.5">
                          <Text>
                            {req.type === "kill"
                              ? t("ui.quests.kill_target", { target: t(`npcs.${req.target}`) })
                              : t("ui.quests.talk_to_target", { target: t(`npcs.${req.target}`) })}
                          </Text>
                          <Text fontFamily={T.mono}>
                            {current} / {req.count}
                          </Text>
                        </Flex>
                        <Box h="4px" bg={T.bg} borderRadius="full" overflow="hidden">
                          <Box
                            h="100%"
                            w={`${pct}%`}
                            bg={pct === 100 ? "#00ff00" : T.goldDark}
                            transition="width 0.3s"
                          />
                        </Box>
                      </Box>
                    );
                  })}
                </VStack>
                {q.status === "COMPLETED" && (
                  <Text textStyle={T.statLabel} color="#00ff00" mt="2" textAlign="center" fontWeight="700">
                    {t("ui.quests.turn_in_hint", { name: t(`npcs.${def.npcId}`) })}
                  </Text>
                )}
              </Box>
            );
          })}
        </VStack>
      )}

      {/* Available quests */}
      {availableQuests.length > 0 && (
        <Box>
          <Text
            textStyle={T.badgeText}
            letterSpacing="3px"
            textTransform="uppercase"
            color={T.goldDark}
            pb="1"
            mb="2"
            borderBottom={`1px solid ${HEX.border}`}
          >
            {t("ui.quests.available")}
          </Text>
          <VStack align="stretch" gap="2">
            {availableQuests.map((def) => (
              <Box
                key={def.id}
                p="3"
                bg={T.darkest}
                border="1px solid"
                borderColor={T.border}
                borderRadius="2px"
                opacity="0.75"
              >
                <Flex justify="space-between" align="center" mb="1">
                  <Text textStyle={T.bodyText} fontWeight="700" color={T.goldMuted}>
                    {t(def.title)}
                  </Text>
                  <Text
                    textStyle={T.badgeText}
                    color={T.goldDark}
                    fontWeight="600"
                    letterSpacing="1px"
                  >
                    {t("ui.quests.see_npc", { name: t(`npcs.${def.npcId}`) })}
                  </Text>
                </Flex>
                <Text textStyle={T.bodyMuted} color="whiteAlpha.600" fontStyle="italic">
                  {t(def.description)}
                </Text>
                <Flex gap="2" mt="1.5" flexWrap="wrap">
                  {def.requirements.map((req) => (
                    <Text
                      key={`${def.id}-avail-${req.target}`}
                      textStyle={T.badgeText}
                      color={T.goldDark}
                      fontFamily={T.mono}
                    >
                      {req.type === "kill"
                        ? t("ui.quests.kill_target", { target: t(`npcs.${req.target}`) })
                        : t("ui.quests.talk_to_target", { target: t(`npcs.${req.target}`) })}{" "}
                      ×{req.count}
                    </Text>
                  ))}
                </Flex>
              </Box>
            ))}
          </VStack>
        </Box>
      )}

      {activeQuests.length === 0 && availableQuests.length === 0 && (
        <Text textAlign="center" color={T.goldMuted} textStyle={T.statLabel} py="8" fontStyle="italic">
          {t("ui.quests.no_active")}
        </Text>
      )}
    </Box>
  );
}

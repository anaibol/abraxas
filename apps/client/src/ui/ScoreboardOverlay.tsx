import { Box, Flex, Grid, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { HEX, T } from "./tokens";

export type KillStats = {
  npcKills: number;
  pvpKills: number;
};

type OnlinePlayer = {
  name: string;
  classType: string;
  alive: boolean;
};

type ScoreboardOverlayProps = {
  visible: boolean;
  killStats: Record<string, KillStats>;
  onlinePlayers: OnlinePlayer[];
  myName: string;
  myLevel: number;
  onOpenLeaderboard?: () => void;
};

const FONT = T.display;
// Aliases for values that were local to this file
const SC = {
  text: T.goldText,
  textDim: T.goldMuted,
  textMuted: "#4a3e2a",
  red: T.bloodBright,
  green: "#44cc88",
  surface: T.surface,
  raised: T.raised,
} as const;

const CLASS_COLOR: Record<string, string> = {
  WARRIOR: "#e87c3e",
  MAGE: "#6a9de8",
  ROGUE: "#a8d060",
  CLERIC: "#f0d870",
  RANGER: "#78c8a0",
  NECROMANCER: "#8a2be2",
  DRUID: "#2e8b57",
};

const KEYBINDS: { key: string; labelKey: string; categoryKey: string }[] = [
  { categoryKey: "movement", key: "↑↓←→", labelKey: "move" },
  { categoryKey: "combat", key: "Ctrl", labelKey: "melee_attack" },
  { categoryKey: "combat", key: "Ctrl + Click", labelKey: "ranged_attack" },
  { categoryKey: "combat", key: "Q / W / E / R", labelKey: "cast_spell" },
  { categoryKey: "combat", key: "Click", labelKey: "select_tile" },
  { categoryKey: "items", key: "A", labelKey: "pickup" },
  { categoryKey: "items", key: "T", labelKey: "drop" },
  { categoryKey: "social", key: "Enter", labelKey: "open_chat" },
  { categoryKey: "social", key: "Esc", labelKey: "close_chat" },
  { categoryKey: "social", key: "V (hold)", labelKey: "push_to_talk" },
  { categoryKey: "ui", key: "Tab", labelKey: "scoreboard" },
  { categoryKey: "ui", key: "M", labelKey: "meditate" },
  { categoryKey: "ui", key: "`", labelKey: "toggle_music" },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Box
      fontSize="11px"
      letterSpacing="3px"
      textTransform="uppercase"
      color={T.gold}
      fontWeight="700"
      fontFamily={FONT}
      pb="1"
      mb="2"
      borderBottom={`1px solid ${HEX.border}`}
    >
      {children}
    </Box>
  );
}

function LeaderboardRow({
  rank,
  name,
  value,
  isMe,
  valueColor,
}: {
  rank: number;
  name: string;
  value: number;
  isMe: boolean;
  valueColor?: string;
}) {
  const { t } = useTranslation();
  const rankColor =
    rank === 1 ? T.gold : rank === 2 ? "#c0c0c0" : rank === 3 ? "#cd7f32" : SC.textDim;
  return (
    <Flex
      align="center"
      gap="2"
      px="2"
      py="1"
      mb="0.5"
      bg={isMe ? "rgba(212,168,67,0.1)" : "transparent"}
      borderRadius="2px"
      border={isMe ? `1px solid rgba(212,168,67,0.25)` : "1px solid transparent"}
    >
      <Box
        w="16px"
        textAlign="center"
        fontSize="12px"
        fontWeight="700"
        color={rankColor}
        fontFamily={FONT}
        flexShrink={0}
      >
        {rank}
      </Box>
      <Box
        flex="1"
        fontSize="13px"
        color={isMe ? T.gold : SC.text}
        fontFamily={FONT}
        overflow="hidden"
        whiteSpace="nowrap"
        textOverflow="ellipsis"
      >
        {name}
        {isMe && (
          <Text as="span" color={T.goldDim} fontSize="11px" ml="1">
            {t("scoreboard.you")}
          </Text>
        )}
      </Box>
      <Box
        fontSize="13px"
        fontWeight="700"
        color={valueColor ?? SC.text}
        fontFamily={T.mono}
        flexShrink={0}
      >
        {value}
      </Box>
    </Flex>
  );
}

export function ScoreboardOverlay({
  visible,
  killStats,
  onlinePlayers,
  myName,
  myLevel,
  onOpenLeaderboard,
}: ScoreboardOverlayProps) {
  const { t } = useTranslation();
  if (!visible) return null;

  const npcRanking = Object.entries(killStats)
    .map(([name, s]) => ({ name, kills: s.npcKills }))
    .filter((e) => e.kills > 0)
    .sort((a, b) => b.kills - a.kills)
    .slice(0, 8);

  const pvpRanking = Object.entries(killStats)
    .map(([name, s]) => ({ name, kills: s.pvpKills }))
    .filter((e) => e.kills > 0)
    .sort((a, b) => b.kills - a.kills)
    .slice(0, 8);

  const keybindsByCategory = KEYBINDS.reduce<Record<string, typeof KEYBINDS>>((acc, kb) => {
    if (!acc[kb.categoryKey]) acc[kb.categoryKey] = [];
    acc[kb.categoryKey].push(kb);
    return acc;
  }, {});

  return (
    <Flex pos="fixed" inset="0" align="center" justify="center" zIndex={80} pointerEvents="none">
      <Box
        bg={T.bg}
        border={`2px solid ${HEX.border}`}
        borderRadius="4px"
        w={{ base: "95vw", md: "860px" }}
        maxH="85dvh"
        overflow="hidden"
        boxShadow="0 8px 48px rgba(0,0,0,0.85)"
      >
        {/* Header */}
        <Flex
          align="center"
          justify="center"
          px="6"
          py="3"
          bg={SC.surface}
          borderBottom={`1px solid ${HEX.border}`}
          pos="relative"
        >
          <Box
            fontSize="14px"
            letterSpacing="6px"
            textTransform="uppercase"
            color={T.gold}
            fontWeight="700"
            fontFamily={FONT}
          >
            {t("scoreboard.title")}
          </Box>
          <Box
            pos="absolute"
            right="4"
            fontSize="11px"
            color={SC.textMuted}
            letterSpacing="2px"
            fontFamily={FONT}
            display={{ base: "none", md: "block" }}
          >
            {t("scoreboard.hold_tab_hint")}
          </Box>
          {onOpenLeaderboard && (
            <Box
              pos="absolute"
              left="4"
              fontSize="10px"
              color={T.goldDim}
              letterSpacing="1px"
              fontFamily={FONT}
              cursor="pointer"
              _hover={{ color: T.gold }}
              pointerEvents="all"
              onClick={onOpenLeaderboard}
            >
              🏆 {t("leaderboard.title")} →
            </Box>
          )}
        </Flex>

        {/* Body */}
        <Grid
          templateColumns={{ base: "1fr", md: "1fr 1fr 200px" }}
          gap="0"
          maxH="calc(85dvh - 52px)"
          overflowY={{ base: "auto", md: "hidden" }}
        >
          {/* NPC Kills */}
          <Box
            px="4"
            py="4"
            borderRight={{ base: "none", md: `1px solid ${HEX.border}` }}
            borderBottom={{ base: `1px solid ${HEX.border}`, md: "none" }}
            overflowY="auto"
          >
            <SectionTitle>{t("scoreboard.top_npc_hunters")}</SectionTitle>
            {npcRanking.length === 0 ? (
              <Box fontSize="12px" color={SC.textMuted} fontFamily={FONT} textAlign="center" mt="4">
                {t("scoreboard.no_kills")}
              </Box>
            ) : (
              npcRanking.map((entry, i) => (
                <LeaderboardRow
                  key={entry.name}
                  rank={i + 1}
                  name={entry.name}
                  value={entry.kills}
                  isMe={entry.name === myName}
                  valueColor="#78c8a0"
                />
              ))
            )}

            {/* My level section */}
            <Box mt="5">
              <SectionTitle>{t("scoreboard.top_levels")}</SectionTitle>
              <Flex
                align="center"
                gap="2"
                px="2"
                py="1"
                bg="rgba(212,168,67,0.1)"
                borderRadius="2px"
                border={`1px solid rgba(212,168,67,0.25)`}
              >
                <Box
                  w="16px"
                  textAlign="center"
                  fontSize="12px"
                  fontWeight="700"
                  color={T.gold}
                  fontFamily={FONT}
                >
                  —
                </Box>
                <Box
                  flex="1"
                  fontSize="13px"
                  color={T.gold}
                  fontFamily={FONT}
                  overflow="hidden"
                  whiteSpace="nowrap"
                  textOverflow="ellipsis"
                >
                  {myName}
                  <Text as="span" color={T.goldDim} fontSize="11px" ml="1">
                    {t("scoreboard.you")}
                  </Text>
                </Box>
                <Box fontSize="13px" fontWeight="700" color={T.gold} fontFamily={T.mono}>
                  {t("scoreboard.lv_prefix")}
                  {myLevel}
                </Box>
              </Flex>
              <Box fontSize="11px" color={SC.textMuted} textAlign="center" mt="2" fontFamily={FONT}>
                {t("scoreboard.level_private")}
              </Box>
            </Box>
          </Box>

          {/* PVP Kills + Online Players */}
          <Box
            px="4"
            py="4"
            borderRight={{ base: "none", md: `1px solid ${HEX.border}` }}
            borderBottom={{ base: `1px solid ${HEX.border}`, md: "none" }}
            overflowY="auto"
          >
            <SectionTitle>{t("scoreboard.top_pvp")}</SectionTitle>
            {pvpRanking.length === 0 ? (
              <Box fontSize="12px" color={SC.textMuted} fontFamily={FONT} textAlign="center" mt="4">
                {t("scoreboard.no_pvp_kills")}
              </Box>
            ) : (
              pvpRanking.map((entry, i) => (
                <LeaderboardRow
                  key={entry.name}
                  rank={i + 1}
                  name={entry.name}
                  value={entry.kills}
                  isMe={entry.name === myName}
                  valueColor={SC.red}
                />
              ))
            )}

            {/* Online Players */}
            <Box mt="5">
              <SectionTitle>
                {t("scoreboard.online_players")}
                <Text as="span" color={SC.textDim} fontSize="11px" ml="2">
                  ({onlinePlayers.length})
                </Text>
              </SectionTitle>
              {onlinePlayers.map((p) => (
                <Flex
                  key={p.name}
                  align="center"
                  gap="2"
                  px="2"
                  py="1"
                  mb="0.5"
                  bg={p.name === myName ? "rgba(212,168,67,0.1)" : "transparent"}
                  borderRadius="2px"
                  border={
                    p.name === myName ? `1px solid rgba(212,168,67,0.2)` : "1px solid transparent"
                  }
                >
                  <Box
                    w="6px"
                    h="6px"
                    borderRadius="full"
                    bg={p.alive ? SC.green : SC.red}
                    flexShrink={0}
                  />
                  <Box
                    flex="1"
                    fontSize="13px"
                    color={p.name === myName ? T.gold : SC.text}
                    fontFamily={FONT}
                    overflow="hidden"
                    whiteSpace="nowrap"
                    textOverflow="ellipsis"
                  >
                    {p.name}
                  </Box>
                  <Box
                    fontSize="11px"
                    color={CLASS_COLOR[p.classType.toUpperCase()] ?? SC.textDim}
                    fontFamily={FONT}
                    letterSpacing="1px"
                    flexShrink={0}
                  >
                    {t(`classes.${p.classType}.name`)}
                  </Box>
                </Flex>
              ))}
            </Box>
          </Box>

          {/* Key Bindings */}
          <Box px="4" py="4" overflowY="auto">
            <SectionTitle>{t("scoreboard.key_bindings")}</SectionTitle>
            {Object.entries(keybindsByCategory).map(([categoryKey, binds]) => (
              <Box key={categoryKey} mb="4">
                <Box
                  fontSize="10px"
                  letterSpacing="2px"
                  textTransform="uppercase"
                  color={SC.textDim}
                  fontFamily={FONT}
                  mb="1.5"
                >
                  {t(`scoreboard.keybind_categories.${categoryKey}`)}
                </Box>
                {binds.map((kb) => (
                  <Flex key={kb.key} align="center" gap="2" mb="1.5">
                    <Box
                      px="1.5"
                      py="0.5"
                      bg={SC.raised}
                      border={`1px solid ${HEX.borderLight}`}
                      borderRadius="3px"
                      fontSize="11px"
                      color={T.gold}
                      fontFamily={T.mono}
                      whiteSpace="nowrap"
                      flexShrink={0}
                      minW="fit-content"
                    >
                      {kb.key}
                    </Box>
                    <Box fontSize="12px" color={SC.textDim} fontFamily={FONT}>
                      {t(`scoreboard.keybind_labels.${kb.labelKey}`)}
                    </Box>
                  </Flex>
                ))}
              </Box>
            ))}
          </Box>
        </Grid>
      </Box>
    </Flex>
  );
}

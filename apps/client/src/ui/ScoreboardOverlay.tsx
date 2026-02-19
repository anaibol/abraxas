import { Box, Flex, Text, Grid } from "@chakra-ui/react";
import { P } from "./palette";

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
};


const FONT = P.font;
// Aliases for values that were local to this file
const SC = {
  text: P.goldText,
  textDim: P.goldMuted,
  textMuted: "#4a3e2a",
  red: P.bloodBright,
  green: "#44cc88",
  surface: P.surface,
  raised: P.raised,
} as const;

const CLASS_COLOR: Record<string, string> = {
  WARRIOR: "#e87c3e",
  MAGE: "#6a9de8",
  ROGUE: "#a8d060",
  CLERIC: "#f0d870",
  RANGER: "#78c8a0",
};

const KEYBINDS: { key: string; label: string; category: string }[] = [
  { category: "Movement", key: "↑↓←→", label: "Move" },
  { category: "Combat", key: "Ctrl", label: "Melee attack" },
  { category: "Combat", key: "Ctrl + Click", label: "Ranged attack" },
  { category: "Combat", key: "Q / W / E / R", label: "Cast spell" },
  { category: "Combat", key: "Click", label: "Select target tile" },
  { category: "Items", key: "A", label: "Pick up item" },
  { category: "Items", key: "T", label: "Drop selected item" },
  { category: "Social", key: "Enter", label: "Open chat" },
  { category: "Social", key: "Esc", label: "Close chat / Cancel" },
  { category: "Social", key: "V (hold)", label: "Push to talk (voice)" },
  { category: "UI", key: "Tab", label: "Scoreboard" },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Box
      fontSize="11px"
      letterSpacing="3px"
      textTransform="uppercase"
      color={P.gold}
      fontWeight="700"
      fontFamily={FONT}
      pb="1"
      mb="2"
      borderBottom={`1px solid ${P.border}`}
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
  const rankColor = rank === 1 ? P.gold : rank === 2 ? "#c0c0c0" : rank === 3 ? "#cd7f32" : SC.textDim;
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
      <Box w="16px" textAlign="center" fontSize="12px" fontWeight="700" color={rankColor} fontFamily={FONT} flexShrink={0}>
        {rank}
      </Box>
      <Box flex="1" fontSize="13px" color={isMe ? P.gold : SC.text} fontFamily={FONT} overflow="hidden" whiteSpace="nowrap" textOverflow="ellipsis">
        {name}
        {isMe && <Text as="span" color={P.goldDim} fontSize="11px" ml="1">(you)</Text>}
      </Box>
      <Box fontSize="13px" fontWeight="700" color={valueColor ?? SC.text} fontFamily={P.mono} flexShrink={0}>
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
}: ScoreboardOverlayProps) {
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
    if (!acc[kb.category]) acc[kb.category] = [];
    acc[kb.category].push(kb);
    return acc;
  }, {});

  return (
    <Flex
      pos="fixed"
      inset="0"
      align="center"
      justify="center"
      zIndex={80}
      pointerEvents="none"
    >
      <Box
        bg={P.bg}
        border={`2px solid ${P.border}`}
        borderRadius="4px"
        w="860px"
        maxW="95vw"
        maxH="85vh"
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
          borderBottom={`1px solid ${P.border}`}
          pos="relative"
        >
          <Box
            fontSize="14px"
            letterSpacing="6px"
            textTransform="uppercase"
            color={P.gold}
            fontWeight="700"
            fontFamily={FONT}
          >
            Scoreboard
          </Box>
          <Box
            pos="absolute"
            right="4"
            fontSize="11px"
            color={SC.textMuted}
            letterSpacing="2px"
            fontFamily={FONT}
          >
            Hold TAB to view
          </Box>
        </Flex>

        {/* Body */}
        <Grid templateColumns="1fr 1fr 200px" gap="0" h="calc(85vh - 52px)" overflow="hidden">
          {/* NPC Kills */}
          <Box px="4" py="4" borderRight={`1px solid ${P.border}`} overflowY="auto">
            <SectionTitle>Top NPC Hunters</SectionTitle>
            {npcRanking.length === 0 ? (
              <Box fontSize="12px" color={SC.textMuted} fontFamily={FONT} textAlign="center" mt="4">
                No kills recorded yet
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
              <SectionTitle>Top Levels</SectionTitle>
              <Flex
                align="center"
                gap="2"
                px="2"
                py="1"
                bg="rgba(212,168,67,0.1)"
                borderRadius="2px"
                border={`1px solid rgba(212,168,67,0.25)`}
              >
                <Box w="16px" textAlign="center" fontSize="12px" fontWeight="700" color={P.gold} fontFamily={FONT}>
                  —
                </Box>
                <Box flex="1" fontSize="13px" color={P.gold} fontFamily={FONT} overflow="hidden" whiteSpace="nowrap" textOverflow="ellipsis">
                  {myName}
                  <Text as="span" color={P.goldDim} fontSize="11px" ml="1">(you)</Text>
                </Box>
                <Box fontSize="13px" fontWeight="700" color={P.gold} fontFamily="'Consolas', monospace">
                  Lv.{myLevel}
                </Box>
              </Flex>
              <Box fontSize="11px" color={SC.textMuted} textAlign="center" mt="2" fontFamily={FONT}>
                Level is private — only you can see yours
              </Box>
            </Box>
          </Box>

          {/* PVP Kills + Online Players */}
          <Box px="4" py="4" borderRight={`1px solid ${P.border}`} overflowY="auto">
            <SectionTitle>Top PvP Warriors</SectionTitle>
            {pvpRanking.length === 0 ? (
              <Box fontSize="12px" color={SC.textMuted} fontFamily={FONT} textAlign="center" mt="4">
                No PvP kills recorded yet
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
                Online Players
                <Text as="span" color={SC.textDim} fontSize="11px" ml="2">({onlinePlayers.length})</Text>
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
                  border={p.name === myName ? `1px solid rgba(212,168,67,0.2)` : "1px solid transparent"}
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
                    color={p.name === myName ? P.gold : SC.text}
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
                    {p.classType}
                  </Box>
                </Flex>
              ))}
            </Box>
          </Box>

          {/* Key Bindings */}
          <Box px="4" py="4" overflowY="auto">
            <SectionTitle>Key Bindings</SectionTitle>
            {Object.entries(keybindsByCategory).map(([category, binds]) => (
              <Box key={category} mb="4">
                <Box
                  fontSize="10px"
                  letterSpacing="2px"
                  textTransform="uppercase"
                  color={SC.textDim}
                  fontFamily={FONT}
                  mb="1.5"
                >
                  {category}
                </Box>
                {binds.map((kb) => (
                  <Flex key={kb.key} align="center" gap="2" mb="1.5">
                    <Box
                      px="1.5"
                      py="0.5"
                      bg={SC.raised}
                      border={`1px solid ${P.borderLight}`}
                      borderRadius="3px"
                      fontSize="11px"
                      color={P.gold}
                      fontFamily="'Consolas', monospace"
                      whiteSpace="nowrap"
                      flexShrink={0}
                      minW="fit-content"
                    >
                      {kb.key}
                    </Box>
                    <Box fontSize="12px" color={SC.textDim} fontFamily={FONT}>
                      {kb.label}
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

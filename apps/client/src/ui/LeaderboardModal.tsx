import { Box, Flex, Grid, Spinner, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ModalOverlay } from "./components/ModalOverlay";
import { PanelHeader } from "./components/PanelHeader";
import { HEX, T } from "./tokens";

const FONT = T.display;

const CLASS_COLOR: Record<string, string> = {
  WARRIOR: "#e87c3e",
  MAGE: "#6a9de8",
  ROGUE: "#a8d060",
  CLERIC: "#f0d870",
  RANGER: "#78c8a0",
  NECROMANCER: "#8a2be2",
  DRUID: "#2e8b57",
  PALADIN: "#f0c060",
};

const RANK_COLORS = ["#ffd700", "#c0c0c0", "#cd7f32"];
const RANK_MEDALS = ["🥇", "🥈", "🥉"];

type LeaderboardEntry = {
  name: string;
  class: string;
  level: number;
  pvpKills: number;
  npcKills: number;
  gold: number;
};

type LeaderboardData = {
  byLevel: LeaderboardEntry[];
  byNpcKills: LeaderboardEntry[];
  byPvpKills: LeaderboardEntry[];
  byGold: LeaderboardEntry[];
};

type Tab = "level" | "npcKills" | "pvpKills" | "gold";

const TABS: { key: Tab; labelKey: string; icon: string }[] = [
  { key: "level", labelKey: "tab_level", icon: "⭐" },
  { key: "npcKills", labelKey: "tab_npc_kills", icon: "⚔️" },
  { key: "pvpKills", labelKey: "tab_pvp_kills", icon: "💀" },
  { key: "gold", labelKey: "tab_gold", icon: "💰" },
];

function formatValue(tab: Tab, entry: LeaderboardEntry): string {
  switch (tab) {
    case "level":
      return `Lv. ${entry.level}`;
    case "npcKills":
      return `${entry.npcKills}`;
    case "pvpKills":
      return `${entry.pvpKills}`;
    case "gold":
      return `${entry.gold.toLocaleString()}g`;
  }
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <Box
        w="24px"
        textAlign="center"
        fontSize="16px"
        lineHeight="1"
        flexShrink={0}
      >
        {RANK_MEDALS[rank - 1]}
      </Box>
    );
  }
  return (
    <Box
      w="24px"
      textAlign="center"
      fontSize="12px"
      fontWeight="700"
      color="#4a3e2a"
      fontFamily={FONT}
      flexShrink={0}
    >
      {rank}
    </Box>
  );
}

function LeaderRow({
  rank,
  entry,
  tab,
  isMe,
}: {
  rank: number;
  entry: LeaderboardEntry;
  tab: Tab;
  isMe: boolean;
}) {
  const { t } = useTranslation();
  const valueColor = rank <= 3 ? RANK_COLORS[rank - 1] : "#c8b68a";

  return (
    <Flex
      align="center"
      gap="2"
      px="2.5"
      py="1.5"
      mb="0.5"
      bg={isMe ? "rgba(212,168,67,0.12)" : "transparent"}
      borderRadius="3px"
      border={isMe ? "1px solid rgba(212,168,67,0.3)" : "1px solid transparent"}
      transition="background 0.15s"
      _hover={{ bg: isMe ? "rgba(212,168,67,0.16)" : "rgba(255,255,255,0.03)" }}
    >
      <RankBadge rank={rank} />

      {/* Class color dot */}
      <Box
        w="6px"
        h="6px"
        borderRadius="full"
        bg={CLASS_COLOR[entry.class?.toUpperCase()] ?? "#6a6060"}
        flexShrink={0}
      />

      <Flex flex="1" align="baseline" gap="1.5" minW="0">
        <Box
          fontSize="13px"
          color={isMe ? T.gold : "#c8b68a"}
          fontFamily={FONT}
          overflow="hidden"
          whiteSpace="nowrap"
          textOverflow="ellipsis"
          fontWeight={isMe ? "700" : "400"}
        >
          {entry.name}
        </Box>
        {isMe && (
          <Text as="span" color="#8a7a60" fontSize="10px" flexShrink={0}>
            {t("scoreboard.you")}
          </Text>
        )}
      </Flex>

      <Box
        fontSize="13px"
        fontWeight="700"
        color={valueColor}
        fontFamily={T.mono}
        flexShrink={0}
        letterSpacing="0.5px"
      >
        {formatValue(tab, entry)}
      </Box>
    </Flex>
  );
}

type LeaderboardModalProps = {
  myName: string;
  onClose: () => void;
};

export function LeaderboardModal({ myName, onClose }: LeaderboardModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("level");
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const isMounted = useRef(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const origin = window.location.origin;
      const res = await fetch(`${origin}/api/leaderboard`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      if (isMounted.current) setData(json);
    } catch {
      if (isMounted.current) setError(true);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchData();
    return () => {
      isMounted.current = false;
    };
  }, [fetchData]);

  const entries: LeaderboardEntry[] = data
    ? activeTab === "level"
      ? data.byLevel
      : activeTab === "npcKills"
        ? data.byNpcKills
        : activeTab === "pvpKills"
          ? data.byPvpKills
          : data.byGold
    : [];

  return (
    <ModalOverlay
      zIndex={90}
      onClose={onClose}
      panelProps={{
        bg: T.bg,
        border: `1px solid ${HEX.border}`,
        borderRadius: "4px",
        w: { base: "95vw", md: "520px" },
        maxH: "80dvh",
        overflow: "hidden",
        boxShadow: "0 12px 64px rgba(0,0,0,0.9)",
        display: "flex",
        flexDirection: "column",
        layerStyle: undefined,
      }}
    >
        {/* Header */}
        <PanelHeader title={t("leaderboard.title")} onClose={onClose} />

        {/* Tabs */}
        <Grid
          templateColumns="repeat(4, 1fr)"
          borderBottom={`1px solid ${HEX.border}`}
          bg={T.darkest}
          flexShrink={0}
        >
          {TABS.map(({ key, labelKey, icon }) => (
            <Flex
              key={key}
              direction="column"
              align="center"
              justify="center"
              py="2"
              gap="0.5"
              cursor="pointer"
              bg={activeTab === key ? T.surface : "transparent"}
              color={activeTab === key ? T.gold : "#4a3e2a"}
              borderBottom="2px solid"
              borderBottomColor={activeTab === key ? T.gold : "transparent"}
              mb="-2px"
              transition="all 0.15s"
              _hover={{ color: "#c8b68a", bg: T.surface }}
              onClick={() => setActiveTab(key)}
            >
              <Box fontSize="14px" lineHeight="1">{icon}</Box>
              <Box
                fontFamily={FONT}
                fontSize="9px"
                fontWeight="700"
                letterSpacing="0.5px"
                textTransform="uppercase"
              >
                {t(`leaderboard.${labelKey}`)}
              </Box>
            </Flex>
          ))}
        </Grid>

        {/* Content */}
        <Box flex="1" overflowY="auto" px="4" py="4">
          {loading ? (
            <Flex align="center" justify="center" py="10" direction="column" gap="3">
              <Spinner size="md" color={HEX.gold} />
              <Box fontSize="12px" color="#4a3e2a" fontFamily={FONT} letterSpacing="2px">
                {t("leaderboard.loading")}
              </Box>
            </Flex>
          ) : error ? (
            <Flex align="center" justify="center" py="10" direction="column" gap="3">
              <Box fontSize="12px" color="#c41e3a" fontFamily={FONT} textAlign="center">
                {t("leaderboard.error")}
              </Box>
              <Box
                fontSize="11px"
                color={T.goldDim}
                fontFamily={FONT}
                cursor="pointer"
                _hover={{ color: T.gold }}
                onClick={fetchData}
              >
                {t("leaderboard.try_again")}
              </Box>
            </Flex>
          ) : entries.length === 0 ? (
            <Flex align="center" justify="center" py="10">
              <Box fontSize="12px" color="#4a3e2a" fontFamily={FONT} textAlign="center">
                {t("leaderboard.empty")}
              </Box>
            </Flex>
          ) : (
            entries.map((entry, i) => (
              <LeaderRow
                key={entry.name}
                rank={i + 1}
                entry={entry}
                tab={activeTab}
                isMe={entry.name === myName}
              />
            ))
          )}
        </Box>

        {/* Footer hint */}
        <Box
          px="4"
          py="2"
          borderTop={`1px solid ${HEX.border}`}
          bg={T.darkest}
          flexShrink={0}
        >
          <Box fontSize="10px" color="#4a3e2a" fontFamily={FONT} letterSpacing="1px" textAlign="center">
            {t("leaderboard.hint")}
          </Box>
        </Box>
    </ModalOverlay>
  );
}

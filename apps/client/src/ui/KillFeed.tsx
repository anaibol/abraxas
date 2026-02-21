import { Box, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { T } from "./tokens";

export interface KillFeedEntry {
  id: number;
  killerName: string;
  victimName: string;
  timestamp: number;
}

interface KillFeedProps {
  entries: KillFeedEntry[];
}

export function KillFeed({ entries }: KillFeedProps) {
  const { t } = useTranslation();
  // Show last 5 kills, newest first
  const visible = entries.slice(-5).reverse();

  if (visible.length === 0) return null;

  return (
    <Box
      pos="fixed"
      top="12px"
      right={{ base: "62px", md: "296px" }}
      zIndex="40"
      pointerEvents="none"
    >
      {visible.map((entry) => (
        <Box
          key={entry.id}
          mb="1"
          px="3"
          py="1"
          bg="rgba(14,12,20,0.85)"
          border="1px solid"
          borderColor="rgba(46,40,64,0.6)"
          borderRadius="2px"
          fontFamily={T.display}
        >
          <Text textStyle={T.bodyMuted} color={T.goldText}>
            <Text as="span" color={T.bloodBright} fontWeight="700">
              {entry.killerName}
            </Text>{" "}
            {t("kill_feed.killed")}{" "}
            <Text as="span" color={T.goldMuted} fontWeight="700">
              {entry.victimName}
            </Text>
          </Text>
        </Box>
      ))}
    </Box>
  );
}

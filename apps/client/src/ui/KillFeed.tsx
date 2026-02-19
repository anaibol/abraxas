import { Box, Text } from "@chakra-ui/react";
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
  // Show last 5 kills, newest first
  const visible = entries.slice(-5).reverse();

  if (visible.length === 0) return null;

  return (
    <Box pos="fixed" top="12px" right="296px" zIndex="40" pointerEvents="none">
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
          <Text fontSize="12px" color={T.goldText}>
            <Text as="span" color={T.bloodBright} fontWeight="700">{entry.killerName}</Text>
            {" killed "}
            <Text as="span" color={T.goldMuted} fontWeight="700">{entry.victimName}</Text>
          </Text>
        </Box>
      ))}
    </Box>
  );
}

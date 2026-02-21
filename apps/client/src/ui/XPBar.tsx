import { Box, Flex, Text } from "@chakra-ui/react";
import { HEX, T } from "./tokens";

interface XPBarProps {
  xp: number;
  maxXp: number;
  level: number;
}

export function XPBar({ xp, maxXp, level }: XPBarProps) {
  const pct = maxXp > 0 ? Math.max(0, Math.min(100, (xp / maxXp) * 100)) : 0;

  return (
    <Box
      position="fixed"
      bottom="0"
      left="0"
      right="0"
      h="5px"
      bg="rgba(10, 8, 6, 0.85)"
      borderTop="1px solid rgba(180, 140, 50, 0.2)"
      zIndex={50}
      pointerEvents="auto"
      cursor="default"
      role="group"
    >
      {/* Fill */}
      <Box
        position="absolute"
        left="0"
        top="0"
        bottom="0"
        w={`${pct}%`}
        bg={`linear-gradient(90deg, ${HEX.goldDark}, ${HEX.gold})`}
        transition="width 0.5s ease-out"
        boxShadow={`0 0 6px ${HEX.gold}44`}
      />
      {/* Hover label */}
      <Flex
        position="absolute"
        bottom="6px"
        left="50%"
        transform="translateX(-50%)"
        bg="rgba(10, 8, 6, 0.95)"
        border="1px solid"
        borderColor={HEX.border}
        borderRadius="3px"
        px="3"
        py="1"
        gap="2"
        opacity="0"
        transition="opacity 0.15s"
        _groupHover={{ opacity: 1 }}
        pointerEvents="none"
        whiteSpace="nowrap"
      >
        <Text fontFamily={T.display} fontSize="11px" fontWeight="700" color={HEX.gold}>
          Lv {level}
        </Text>
        <Text fontFamily={T.mono} fontSize="11px" color={HEX.goldMuted}>
          {xp} / {maxXp} XP ({pct.toFixed(1)}%)
        </Text>
      </Flex>
    </Box>
  );
}

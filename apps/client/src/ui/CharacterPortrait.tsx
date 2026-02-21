import { Box, Flex, Text } from "@chakra-ui/react";
import type { ClassType } from "@abraxas/shared";
import { T } from "./tokens";

interface CharacterPortraitProps {
  classType: ClassType;
  hp: number;
  maxHp: number;
  alive: boolean;
  stunned?: boolean;
  stealthed?: boolean;
  meditating?: boolean;
  level: number;
  pvpEnabled?: boolean;
  onTogglePvP?: () => void;
}

const CLASS_PORTRAITS: Record<string, string> = {
  warrior: "⚔️",
  mage: "🔮",
  ranger: "🏹",
  rogue: "🗡️",
  cleric: "✝️",
  paladin: "🛡️",
};

const STATUS_ICONS: { key: string; icon: string; color: string }[] = [
  { key: "stunned", icon: "💫", color: "#cccc33" },
  { key: "stealthed", icon: "👻", color: "#9944cc" },
  { key: "meditating", icon: "🧘", color: "#44aacc" },
];

export function CharacterPortrait({
  classType,
  hp,
  maxHp,
  alive,
  stunned,
  stealthed,
  meditating,
  level,
  pvpEnabled,
  onTogglePvP,
}: CharacterPortraitProps) {
  const hpPct = maxHp > 0 ? hp / maxHp : 0;
  const isLowHp = hpPct < 0.25 && alive;

  const activeStatuses = STATUS_ICONS.filter(
    (s) =>
      (s.key === "stunned" && stunned) ||
      (s.key === "stealthed" && stealthed) ||
      (s.key === "meditating" && meditating),
  );

  return (
    <Box
      position="fixed"
      top="16px"
      left="16px"
      zIndex={50}
      pointerEvents="none"
    >
      {/* Portrait Circle */}
      <Box
        w="52px"
        h="52px"
        borderRadius="50%"
        border="2px solid"
        borderColor={!alive ? "#444" : isLowHp ? "#cc2222" : "rgba(180, 140, 50, 0.6)"}
        bg={!alive ? "#1a1a1a" : "rgba(15, 12, 8, 0.9)"}
        display="flex"
        alignItems="center"
        justifyContent="center"
        position="relative"
        overflow="hidden"
        boxShadow={
          !alive
            ? "0 0 8px rgba(0,0,0,0.5)"
            : isLowHp
              ? "0 0 12px rgba(204,34,34,0.5), inset 0 0 8px rgba(204,34,34,0.2)"
              : "0 0 8px rgba(0,0,0,0.5), inset 0 0 8px rgba(0,0,0,0.3)"
        }
        filter={!alive ? "grayscale(100%) brightness(0.5)" : "none"}
        animation={isLowHp ? "portraitPulse 1.2s ease-in-out infinite" : undefined}
        css={{
          "@keyframes portraitPulse": {
            "0%, 100%": { borderColor: "rgba(204, 34, 34, 0.4)" },
            "50%": { borderColor: "rgba(255, 68, 68, 0.9)" },
          },
        }}
      >
        <Text fontSize="24px" lineHeight="1">
          {CLASS_PORTRAITS[classType] || "⚔️"}
        </Text>
      </Box>

      {/* Level Badge */}
      <Flex
        position="absolute"
        bottom="-2px"
        right="-2px"
        w="20px"
        h="20px"
        borderRadius="50%"
        bg="rgba(10, 8, 6, 0.95)"
        border="1px solid rgba(180, 140, 50, 0.5)"
        alignItems="center"
        justifyContent="center"
      >
        <Text fontFamily={T.mono} fontSize="10px" fontWeight="800" color="#d4a843" lineHeight="1">
          {level}
        </Text>
      </Flex>

      {/* Active status effect icons */}
      {activeStatuses.length > 0 && (
        <Flex
          position="absolute"
          top="0"
          left="56px"
          gap="2px"
          direction="column"
        >
          {activeStatuses.map((s) => (
            <Box
              key={s.key}
              w="20px"
              h="20px"
              borderRadius="3px"
              bg="rgba(10, 8, 6, 0.9)"
              border="1px solid"
              borderColor={`${s.color}66`}
              display="flex"
              alignItems="center"
              justifyContent="center"
              fontSize="12px"
            >
              {s.icon}
            </Box>
          ))}
        </Flex>
      )}

      {/* PvP Toggle Button */}
      <Flex
        position="absolute"
        bottom="-18px"
        left="0"
        w="100%"
        justifyContent="center"
        pointerEvents="auto"
      >
        <Flex
          alignItems="center"
          justifyContent="center"
          gap="1"
          bg={pvpEnabled ? "rgba(140,20,20,0.85)" : "rgba(10, 8, 6, 0.85)"}
          border="1px solid"
          borderColor={pvpEnabled ? "rgba(180,30,30,0.6)" : "rgba(180, 140, 50, 0.4)"}
          borderRadius="10px"
          px="2"
          py="2px"
          cursor="pointer"
          transition="all 0.15s"
          _hover={{
            bg: pvpEnabled ? "rgba(160,30,30,0.95)" : "rgba(20, 16, 12, 0.95)",
            borderColor: pvpEnabled ? "rgba(200,40,40,0.8)" : "rgba(180, 140, 50, 0.8)",
          }}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePvP?.();
          }}
          title="Toggle PvP"
        >
          <Box w="6px" h="6px" borderRadius="50%" bg={pvpEnabled ? "#ff4444" : "#666"} />
          <Text fontFamily={T.display} fontSize="8px" fontWeight="800" color={pvpEnabled ? "#ffcccc" : T.goldMuted} letterSpacing="0.5px">
            PVP
          </Text>
        </Flex>
      </Flex>
    </Box>
  );
}

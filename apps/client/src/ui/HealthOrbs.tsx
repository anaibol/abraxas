import { Box, Flex, Text } from "@chakra-ui/react";
import { T } from "./tokens";

interface HealthOrbsProps {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  alive: boolean;
}

const ORB_SIZE = 64;

export function HealthOrbs({ hp, maxHp, mana, maxMana, alive }: HealthOrbsProps) {
  const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const manaPct = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;
  const isLowHp = hpPct < 0.25 && alive;

  return (
    <Flex
      position="fixed"
      bottom="28px"
      left="20px"
      gap="10px"
      zIndex={50}
      pointerEvents="none"
      alignItems="flex-end"
    >
      {/* HP Orb */}
      <Orb
        fillPct={alive ? hpPct : 0}
        fillColor="linear-gradient(to top, #8b0000, #cc2222, #ff4444)"
        emptyColor="#1a0505"
        borderColor={isLowHp ? "#ff2222" : "#4a1010"}
        label={`${hp}`}
        pulse={isLowHp}
        greyed={!alive}
      />
      {/* Mana Orb */}
      <Orb
        fillPct={alive ? manaPct : 0}
        fillColor="linear-gradient(to top, #001066, #1133aa, #3366ff)"
        emptyColor="#050a1a"
        borderColor="#101a4a"
        label={`${mana}`}
        greyed={!alive}
      />
    </Flex>
  );
}

interface OrbProps {
  fillPct: number;
  fillColor: string;
  emptyColor: string;
  borderColor: string;
  label: string;
  pulse?: boolean;
  greyed?: boolean;
}

function Orb({ fillPct, fillColor, emptyColor, borderColor, label, pulse, greyed }: OrbProps) {
  return (
    <Box
      position="relative"
      w={`${ORB_SIZE}px`}
      h={`${ORB_SIZE}px`}
      borderRadius="50%"
      border="2px solid"
      borderColor={borderColor}
      bg={emptyColor}
      overflow="hidden"
      boxShadow={`inset 0 0 12px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.5)${pulse ? `, 0 0 12px #ff222288, 0 0 24px #ff222244` : ""}`}
      filter={greyed ? "grayscale(100%) brightness(0.4)" : "none"}
      animation={pulse ? "orbPulse 1s ease-in-out infinite" : undefined}
      css={{
        "@keyframes orbPulse": {
          "0%, 100%": { boxShadow: `inset 0 0 12px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.5), 0 0 12px #ff222266` },
          "50%": { boxShadow: `inset 0 0 12px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.5), 0 0 20px #ff2222aa, 0 0 30px #ff222255` },
        },
      }}
    >
      {/* Liquid fill */}
      <Box
        position="absolute"
        bottom="0"
        left="0"
        right="0"
        h={`${fillPct * 100}%`}
        background={fillColor}
        transition="height 0.3s ease-out"
        borderRadius="0 0 50% 50%"
      />
      {/* Glass highlight */}
      <Box
        position="absolute"
        top="6px"
        left="10px"
        w="16px"
        h="10px"
        borderRadius="50%"
        bg="rgba(255,255,255,0.15)"
        transform="rotate(-30deg)"
      />
      {/* Numeric label */}
      <Flex
        position="absolute"
        inset="0"
        alignItems="center"
        justifyContent="center"
      >
        <Text
          fontSize="13px"
          fontWeight="800"
          color="white"
          fontFamily={T.mono}
          style={{ textShadow: "0 0 4px rgba(0,0,0,1), 0 1px 2px rgba(0,0,0,0.9)" }}
          lineHeight="1"
        >
          {label}
        </Text>
      </Flex>
    </Box>
  );
}

import { Box, Flex, HStack, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { HEX, T } from "../tokens";
import type { PlayerState } from "./types";

interface CharacterHeaderProps {
  state: PlayerState;
  isRecording?: boolean;
}

export function CharacterHeader({ state, isRecording }: CharacterHeaderProps) {
  const { t } = useTranslation();
  return (
    <Box
      px="4"
      pt="3.5"
      pb="2.5"
      bg={T.surface}
      borderBottom="1px solid"
      borderBottomColor={T.border}
      textAlign="center"
    >
      <Text
        fontSize="16px"
        fontWeight="700"
        color={T.gold}
        letterSpacing="2px"
        textShadow="0 0 12px rgba(180,140,50,0.25)"
      >
        {state.name}
      </Text>
      <Text textStyle={T.statLabel} color={T.goldDark} letterSpacing="4px" mt="0.5">
        {t(`classes.${state.classType}.name`)}
      </Text>
      <HStack gap="2" justify="center" mt="1" flexWrap="wrap">
        {!state.alive && (
          <Text textStyle={T.bodyMuted} color={T.bloodBright} fontWeight="700" letterSpacing="3px">
            {t("status.dead")}
          </Text>
        )}
        {state.stunned && (
          <Text textStyle={T.bodyMuted} color="#cccc33" fontWeight="700" letterSpacing="2px">
            {t("status.stunned")}
          </Text>
        )}
        {state.stealthed && (
          <Text textStyle={T.bodyMuted} color="#9944cc" fontWeight="700" letterSpacing="2px">
            {t("status.stealthed")}
          </Text>
        )}
        {state.meditating && (
          <Text textStyle={T.bodyMuted} color="#44aacc" fontWeight="700" letterSpacing="2px">
            {t("status.meditating")}
          </Text>
        )}
      </HStack>

      {/* Attackability indicator */}
      {state.alive && (() => {
        if (state.spawnProtection) {
          return (
            <Box
              mt="1.5"
              px="3"
              py="0.5"
              bg="rgba(20, 15, 35, 0.85)"
              border="1px solid rgba(180, 140, 255, 0.6)"
              borderRadius="full"
              display="inline-block"
            >
              <Text textStyle={T.statLabel} color="#c8a0ff" fontWeight="700" letterSpacing="2px" fontSize="10px">
                🛡 {t("status.spawn_protected", { defaultValue: "PROTECTED" })}
              </Text>
            </Box>
          );
        }
        if (state.inSafeZone) {
          return (
            <Box
              mt="1.5"
              px="3"
              py="0.5"
              bg="rgba(10, 30, 10, 0.85)"
              border="1px solid rgba(40, 160, 40, 0.6)"
              borderRadius="full"
              display="inline-block"
            >
              <Text textStyle={T.statLabel} color="#4edb6e" fontWeight="700" letterSpacing="2px" fontSize="10px">
                🏠 {t("status.safe_zone", { defaultValue: "SAFE ZONE" })}
              </Text>
            </Box>
          );
        }
        if (!state.pvpEnabled) {
          return (
            <Box
              mt="1.5"
              px="3"
              py="0.5"
              bg="rgba(10, 20, 40, 0.85)"
              border="1px solid rgba(60, 120, 220, 0.6)"
              borderRadius="full"
              display="inline-block"
            >
              <Text textStyle={T.statLabel} color="#6aabff" fontWeight="700" letterSpacing="2px" fontSize="10px">
                🔵 {t("status.pvp_off", { defaultValue: "PvP OFF" })}
              </Text>
            </Box>
          );
        }
        return (
          <Box
            mt="1.5"
            px="3"
            py="0.5"
            bg="rgba(40, 5, 5, 0.85)"
            border="1px solid rgba(220, 50, 50, 0.7)"
            borderRadius="full"
            display="inline-block"
          >
            <Text textStyle={T.statLabel} color="#ff6b6b" fontWeight="700" letterSpacing="2px" fontSize="10px">
              ⚔ {t("status.pvp_on", { defaultValue: "PvP ON" })}
            </Text>
          </Box>
        );
      })()}
      {isRecording && (
        <Flex align="center" justify="center" gap="2" mt="1.5">
          <Box w="8px" h="8px" bg="#ff0000" borderRadius="full" animation="pulse 1s infinite" />
          <Text textStyle={T.bodyMuted} color="#ff4444" fontWeight="700" letterSpacing="2px">
            {t("status.transmitting")}
          </Text>
        </Flex>
      )}
      {/* Level + XP bar */}
      <Flex align="center" justify="space-between" mt="2" px="0.5">
        <Text textStyle={T.statLabel} color={T.goldDark} letterSpacing="2px">
          {t("sidebar.inventory.level")} {state.level}
        </Text>
        <Text textStyle={T.codeText} color={T.goldDark}>
          {state.xp} / {state.maxXp} {t("sidebar.inventory.xp")}
        </Text>
      </Flex>
      <Box
        pos="relative"
        h="6px"
        bg={T.darkest}
        border="1px solid"
        borderColor={T.border}
        borderRadius="full"
        overflow="hidden"
        mt="0.5"
      >
        <Box
          h="100%"
          w={`${state.maxXp > 0 ? Math.min(100, (state.xp / state.maxXp) * 100) : 0}%`}
          bg={`linear-gradient(90deg, ${HEX.goldDark}, ${HEX.gold})`}
          transition="width 0.3s"
        />
      </Box>
    </Box>
  );
}

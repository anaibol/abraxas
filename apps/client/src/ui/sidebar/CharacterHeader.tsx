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
      position="relative"
      px="4"
      pt="3.5"
      pb="2.5"
      bg={T.surface}
      borderBottom="1px solid"
      borderBottomColor={T.border}
      textAlign="center"
    >
      <Text
        textStyle={T.heading}
        color={T.gold}
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

      {/* Status Badges */}
      <Flex
        position="absolute"
        top="2"
        right="2"
        direction="column"
        align="flex-end"
        gap="1"
        pointerEvents="none"
      >
        {!state.alive && (
          <Flex layerStyle="fantasyBadge" borderColor={HEX.bloodBright}>
             <Text textStyle={T.badgeText} color={T.bloodBright} fontSize="9px">
               💀 {t("status.dead").toUpperCase()}
             </Text>
          </Flex>
        )}
        {state.alive && (() => {
          let config;
          if (state.spawnProtection) {
            config = {
              borderColor: "#c8a0ff",
              color: "#c8a0ff",
              icon: "🛡",
              text: t("status.spawn_protected", { defaultValue: "PROTECTED" }),
            };
          } else if (state.inSafeZone) {
            config = {
              borderColor: "#4edb6e",
              color: "#4edb6e",
              icon: "🏠",
              text: t("status.safe_zone", { defaultValue: "SAFE ZONE" }),
            };
          } else {
            config = {
              borderColor: "#ff6b6b",
              color: "#ff6b6b",
              icon: "⚔",
              text: t("status.pvp_on", { defaultValue: "ATTACKABLE" }),
            };
          }

          return (
            <Flex
              layerStyle="fantasyBadge"
              borderColor={config.borderColor}
              gap="1"
              align="center"
            >
              <Text fontSize="10px" lineHeight="1">
                {config.icon}
              </Text>
              <Text
                textStyle={T.badgeText}
                fontSize="9px"
                lineHeight="1"
                color={config.color}
                fontWeight="bold"
                letterSpacing="1px"
              >
                {config.text.toUpperCase()}
              </Text>
            </Flex>
          );
        })()}
      </Flex>
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

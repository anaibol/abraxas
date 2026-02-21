import type { Ability } from "@abraxas/shared";
import { Box, Flex, Text, Divider } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { HEX, T } from "../tokens";

interface SpellTooltipProps {
  spell: Ability;
  playerLevel: number;
  currentMana: number;
  x: number;
  y: number;
}

export function SpellTooltip({ spell, playerLevel, currentMana, x, y }: SpellTooltipProps) {
  const { t } = useTranslation();

  const isLevelLocked = !!spell.requiredLevel && playerLevel < spell.requiredLevel;
  const isManaLocked = currentMana < spell.manaCost;
  
  const borderColor = isLevelLocked ? "#ff4444" : isManaLocked ? "#4488ff" : T.gold;
  const bgGlow = isLevelLocked ? "#ff444422" : isManaLocked ? "#4488ff22" : `${HEX.gold}22`;

  return (
    <Box
      position="fixed"
      left={`${x + 14}px`}
      top={`${y - 8}px`}
      zIndex={9999}
      pointerEvents="none"
      minW="200px"
      maxW="260px"
      bg={HEX.bg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="4px"
      boxShadow={`0 0 16px ${bgGlow}, 0 4px 20px rgba(0,0,0,0.8)`}
      overflow="hidden"
    >
      {/* Header */}
      <Flex
        px="3"
        py="2"
        bg={isLevelLocked ? "#ff444411" : isManaLocked ? "#4488ff11" : `${HEX.gold}11`}
        borderBottom="1px solid"
        borderBottomColor={`${borderColor}44`}
        align="center"
        gap="2.5"
      >
        <Box fontSize="24px" lineHeight="1">
          {spell.id === "fireball" ? "🔥" : spell.id === "blink" ? "✨" : "⚛️"} {/* Handled by icon set in Tab, but for simplicity here */}
        </Box>
        <Box flex="1" minW="0">
          <Text
            color={isLevelLocked ? "#ff4444" : T.goldText}
            fontFamily={T.display}
            fontWeight="700"
            fontSize="15px"
            lineHeight="1.2"
          >
            {t(`spells.${spell.id}.name`)}
          </Text>
          <Text color={T.goldDark} fontSize="10px" fontWeight="700" textTransform="uppercase" letterSpacing="1px">
            {t(`sidebar.inventory.spell`)}
          </Text>
        </Box>
      </Flex>

      {/* Restrictions */}
      {(isLevelLocked || isManaLocked) && (
        <Box px="3" py="2" bg="#00000044" borderBottom="1px solid" borderBottomColor={`${borderColor}22`}>
          {isLevelLocked && (
            <Text color="#ff4444" fontSize="11px" fontWeight="700">
              ⚠️ {t("ui.spells.requires_level", { level: spell.requiredLevel })}
            </Text>
          )}
          {isManaLocked && (
            <Text color="#4488ff" fontSize="11px" fontWeight="700">
              💧 {t("ui.spells.not_enough_mana_meditate", "Not enough mana. Meditate to recover mana!")}
            </Text>
          )}
        </Box>
      )}

      {/* Description */}
      <Box px="3" py="2.5">
        <Text
          textStyle={T.bodyMuted}
          color={isLevelLocked ? "#888" : T.goldDark}
          fontSize="12px"
          lineHeight="1.4"
          mb="2"
        >
          {t(`spells.${spell.id}.desc`)}
        </Text>

        <Divider borderColor={`${HEX.border}44`} mb="2" />

        {/* Stats Grid */}
        <Flex direction="column" gap="1">
          <Flex justify="space-between">
            <Text color={T.goldMuted} fontSize="11px">{t("sidebar.inventory.mana_cost")}</Text>
            <Text color={isManaLocked ? "#4488ff" : T.arcane} fontSize="11px" fontWeight="700">
              {spell.manaCost}{t("ui.spells.mana_unit")}
            </Text>
          </Flex>
          <Flex justify="space-between">
            <Text color={T.goldMuted} fontSize="11px">{t("sidebar.inventory.range")}</Text>
            <Text color={T.goldText} fontSize="11px" fontWeight="700">
              {spell.rangeTiles > 0 ? `${spell.rangeTiles} ${t("sidebar.inventory.range_unit")}` : t("sidebar.inventory.self")}
            </Text>
          </Flex>
          {spell.cooldownMs > 0 && (
            <Flex justify="space-between">
              <Text color={T.goldMuted} fontSize="11px">{t("sidebar.inventory.cooldown")}</Text>
              <Text color={T.goldText} fontSize="11px" fontWeight="700">
                {spell.cooldownMs / 1000}{t("ui.spells.cooldown_unit")}
              </Text>
            </Flex>
          )}
        </Flex>
      </Box>

      {/* Footer hint */}
      {!isLevelLocked && !isManaLocked && (
        <Box px="3" py="1.5" bg="#ffffff04" borderTop="1px solid" borderTopColor={`${HEX.border}22`}>
          <Text color={T.goldMuted} fontSize="10px" fontStyle="italic">
            {t("sidebar.inventory.spell_click_hint")}
          </Text>
        </Box>
      )}
    </Box>
  );
}

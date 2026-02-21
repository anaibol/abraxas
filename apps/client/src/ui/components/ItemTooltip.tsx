import type { Item } from "@abraxas/shared";
import { getItemEmoji } from "@abraxas/shared";
import { Box, Flex, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { HEX, T } from "../tokens";

const RARITY_COLORS: Record<string, string> = {
  COMMON: "#aaa",
  UNCOMMON: "#33dd55",
  RARE: "#4488ff",
  EPIC: "#bb44ff",
  LEGENDARY: "#ff8800",
};

const RARITY_BG: Record<string, string> = {
  COMMON: `${HEX.border}88`,
  UNCOMMON: "#33dd5518",
  RARE: "#4488ff18",
  EPIC: "#bb44ff18",
  LEGENDARY: "#ff880018",
};

const STAT_LABELS: Record<string, { label: string; color: string }> = {
  str: { label: "STR", color: "#ff6655" },
  agi: { label: "AGI", color: "#55dd55" },
  int: { label: "INT", color: "#6699ff" },
  hp: { label: "HP", color: "#ff4444" },
  mana: { label: "Mana", color: "#4488ff" },
  armor: { label: "Armor", color: "#ccaa44" },
  speedBonus: { label: "Speed", color: "#44ddaa" },
};

interface ItemTooltipProps {
  item: Item;
  /** Quantity if stacked */
  quantity?: number;
  /** Screen position */
  x: number;
  y: number;
}

export function ItemTooltip({ item, quantity, x, y }: ItemTooltipProps) {
  const { t } = useTranslation();
  const rarityColor = RARITY_COLORS[item.rarity] || "#aaa";
  const rarityBg = RARITY_BG[item.rarity] || "transparent";
  const emoji = getItemEmoji(item.id);

  // Collect non-zero stats
  const stats = Object.entries(item.stats).filter(
    ([, v]) => v !== 0 && v !== undefined,
  ) as [string, number][];

  const hasConsume = item.consumeEffect && Object.keys(item.consumeEffect).length > 0;

  return (
    <Box
      position="fixed"
      left={`${x + 14}px`}
      top={`${y - 8}px`}
      zIndex={9999}
      pointerEvents="none"
      minW="180px"
      maxW="240px"
      bg={HEX.bg}
      border="1px solid"
      borderColor={rarityColor}
      borderRadius="4px"
      boxShadow={`0 0 16px ${rarityColor}33, 0 4px 20px rgba(0,0,0,0.8)`}
      overflow="hidden"
    >
      {/* Header — name + emoji */}
      <Flex
        px="3"
        py="2"
        bg={rarityBg}
        borderBottom="1px solid"
        borderBottomColor={`${rarityColor}44`}
        align="center"
        gap="2"
      >
        <Text fontSize="20px" lineHeight="1">
          {emoji}
        </Text>
        <Box flex="1" minW="0">
          <Text
            color={rarityColor}
            fontFamily={T.display}
            fontWeight="700"
            fontSize="13px"
            lineHeight="1.2"
            lineClamp={2}
          >
            {t(item.name)}
          </Text>
          {quantity && quantity > 1 && (
            <Text color={T.goldDark} fontSize="10px" fontFamily={T.mono}>
              ×{quantity}
            </Text>
          )}
        </Box>
      </Flex>

      {/* Slot + Rarity badge */}
      <Flex px="3" py="1.5" gap="2" align="center" borderBottom="1px solid" borderBottomColor={HEX.border}>
        <Text
          fontSize="9px"
          fontWeight="700"
          letterSpacing="1.5px"
          color={HEX.goldMuted}
          textTransform="uppercase"
        >
          {t(`item_slot.${item.slot}`)}
        </Text>
        <Box w="1px" h="10px" bg={HEX.border} />
        <Text
          fontSize="9px"
          fontWeight="700"
          letterSpacing="1.5px"
          color={rarityColor}
          textTransform="uppercase"
        >
          {t(`item_rarity.${item.rarity}`)}
        </Text>
      </Flex>

      {/* Stats */}
      {stats.length > 0 && (
        <Box px="3" py="2" borderBottom="1px solid" borderBottomColor={HEX.border}>
          {stats.map(([key, value]) => {
            const info = STAT_LABELS[key];
            if (!info) return null;
            const sign = value > 0 ? "+" : "";
            return (
              <Flex key={key} justify="space-between" align="center" py="0.5">
                <Text fontSize="11px" color={HEX.goldText}>
                  {info.label}
                </Text>
                <Text
                  fontSize="11px"
                  fontWeight="700"
                  fontFamily={T.mono}
                  color={value > 0 ? info.color : "#ff4444"}
                >
                  {sign}
                  {value}
                </Text>
              </Flex>
            );
          })}
        </Box>
      )}

      {/* Consumable effects */}
      {hasConsume && (
        <Box px="3" py="2" borderBottom="1px solid" borderBottomColor={HEX.border}>
          <Text fontSize="9px" fontWeight="700" letterSpacing="1px" color={HEX.goldMuted} mb="1" textTransform="uppercase">
            {t("tooltip.use_effect", "Use Effect")}
          </Text>
          {item.consumeEffect?.healHp && (
            <Text fontSize="11px" color="#55ff55">
              ❤️ +{item.consumeEffect.healHp} HP
            </Text>
          )}
          {item.consumeEffect?.healMana && (
            <Text fontSize="11px" color="#6699ff">
              💧 +{item.consumeEffect.healMana} Mana
            </Text>
          )}
          {item.consumeEffect?.cureDebuff && (
            <Text fontSize="11px" color="#aaffaa">
              ✨ {t("tooltip.cures_debuffs", "Cures debuffs")}
            </Text>
          )}
          {item.consumeEffect?.buffStat && (
            <Text fontSize="11px" color="#ffcc44">
              ⬆️ +{item.consumeEffect.buffAmount} {item.consumeEffect.buffStat}{" "}
              ({Math.round((item.consumeEffect.buffDurationMs ?? 0) / 1000)}s)
            </Text>
          )}
        </Box>
      )}

      {/* Class restriction */}
      {item.requiredClass && item.requiredClass.length > 0 && (
        <Box px="3" py="1.5" borderBottom="1px solid" borderBottomColor={HEX.border}>
          <Text fontSize="9px" fontWeight="700" letterSpacing="1px" color={HEX.goldMuted} mb="0.5" textTransform="uppercase">
            {t("tooltip.class_required", "Class")}
          </Text>
          <Text fontSize="10px" color={HEX.goldText}>
            {item.requiredClass.map((c) => t(`class.${c}`)).join(", ")}
          </Text>
        </Box>
      )}

      {/* Gold value */}
      <Flex px="3" py="1.5" align="center" gap="1.5">
        <Text fontSize="11px">🪙</Text>
        <Text fontSize="11px" color={HEX.gold} fontFamily={T.mono} fontWeight="700">
          {item.goldValue}
        </Text>
      </Flex>
    </Box>
  );
}

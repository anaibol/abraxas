import type { Ability } from "@abraxas/shared";
import { Box, Flex, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useAudio } from "../../contexts/AudioContext";
import { T } from "../tokens";

const SPELL_ICONS: Record<string, string> = {
  // Warrior
  war_cry: "📣",
  shield_bash: "🛡️",
  whirlwind: "🌀",
  battle_shout: "📯",
  // Mage
  fireball: "🔥",
  ice_bolt: "❄️",
  thunderstorm: "⚡",
  mana_shield: "🔵",
  frost_nova: "🌨️",
  arcane_surge: "✨",
  // Ranger
  multi_shot: "🏹",
  poison_arrow: "☠️",
  evasion: "💨",
  aimed_shot: "🎯",
  mark_target: "🔍",
  // Rogue
  backstab: "🗡️",
  stealth: "👻",
  envenom: "🧪",
  smoke_bomb: "🌫️",
  hemorrhage: "🩸",
  // Cleric
  holy_strike: "✨",
  heal: "💚",
  divine_shield: "🔮",
  holy_nova: "🌟",
  curse: "💀",
  smite: "☀️",
  // Paladin
  judgment: "⚖️",
  lay_on_hands: "🤲",
  consecration: "🔆",
  aura_of_protection: "💠",
  holy_bolt: "✴️",
};

const EFFECT_LABELS: Record<string, { label: string; color: string }> = {
  damage: { label: "DMG", color: "#cc4444" },
  aoe: { label: "AOE", color: "#cc6622" },
  dot: { label: "DoT", color: "#44aa44" },
  heal: { label: "HEAL", color: "#33cc66" },
  aoe_heal: { label: "HEAL✦", color: "#33cc88" },
  buff: { label: "BUFF", color: "#4488cc" },
  debuff: { label: "DEBUFF", color: "#9944bb" },
  stun: { label: "STUN", color: "#ccaa22" },
  stealth: { label: "INVIS", color: "#8844cc" },
  leech: { label: "LEECH", color: "#cc2277" },
  summon: { label: "SUMMON", color: "#888844" },
};

interface SpellsTabProps {
  classSpells: Ability[];
  currentMana: number;
  playerLevel: number;
  pendingSpellId?: string | null;
  onSpellClick?: (id: string, range: number) => void;
}

export function SpellsTab({
  classSpells,
  currentMana,
  playerLevel,
  pendingSpellId,
  onSpellClick,
}: SpellsTabProps) {
  const { t } = useTranslation();
  const { playUIClick, playUIHover } = useAudio();
  return (
    <Box p="2.5">
      {classSpells.length === 0 ? (
        <Text
          textAlign="center"
          color={T.borderLight}
          textStyle={T.bodyMuted}
          py="8"
          fontStyle="italic"
        >
          {t("sidebar.inventory.empty_spells")}
        </Text>
      ) : (
        <Flex direction="column" gap="1.5">
          {classSpells.map((spell) => {
            const isLocked = !!spell.requiredLevel && playerLevel < spell.requiredLevel;
            const isPending = pendingSpellId === spell.id;
            const noMana = currentMana < spell.manaCost;
            const isDisabled = isLocked || noMana;
            const effectMeta = EFFECT_LABELS[spell.effect];
            const rangeTiles = spell.rangeTiles;
            const rangeLabel =
              rangeTiles > 0
                ? `${t("sidebar.inventory.range")}: ${rangeTiles}`
                : t("sidebar.inventory.self");

            return (
              <Flex
                key={spell.id}
                align="center"
                gap="2.5"
                p="2"
                bg={isPending ? T.surface : T.darkest}
                border="1px solid"
                borderColor={isPending ? T.gold : isDisabled ? "#2a1a1a" : T.border}
                borderRadius="3px"
                cursor={isDisabled ? "not-allowed" : "pointer"}
                transition="all 0.12s"
                opacity={isLocked ? 0.3 : isDisabled ? 0.45 : 1}
                filter={isLocked ? "grayscale(100%)" : "none"}
                _hover={isDisabled ? {} : { bg: T.surface, borderColor: T.gold }}
                onMouseEnter={() => {
                  if (!isDisabled) playUIHover?.();
                }}
                onClick={() => {
                  if (!isDisabled) {
                    playUIClick?.();
                    onSpellClick?.(spell.id, rangeTiles);
                  }
                }}
                title={
                  isLocked
                    ? `Unlocks at level ${spell.requiredLevel}`
                    : isDisabled
                      ? t("game.not_enough_mana_cost", { cost: spell.manaCost })
                      : rangeTiles > 0
                        ? t("sidebar.inventory.spell_click_hint")
                        : undefined
                }
                position="relative"
              >
                {/* Icon */}
                <Flex
                  w="40px"
                  h="40px"
                  align="center"
                  justify="center"
                  bg={isPending ? T.raised : "#12100e"}
                  border="1px solid"
                  borderColor={isPending ? T.gold : isDisabled ? "#2a1a1a" : T.raised}
                  borderRadius="3px"
                  fontSize="22px"
                  flexShrink={0}
                  position="relative"
                >
                  {SPELL_ICONS[spell.id] || "✨"}
                  {/* Keybind badge */}
                  {spell.key && !isLocked && (
                    <Box
                      position="absolute"
                      bottom="-1px"
                      right="-1px"
                      layerStyle={T.goldBadge}
                      bg={isPending ? T.gold : "#1a1510"}
                      borderColor={isPending ? T.gold : T.raised}
                      color={isPending ? T.bg : T.goldMuted}
                      textStyle={T.badgeText}
                      lineHeight="1.4"
                    >
                      {spell.key}
                    </Box>
                  )}
                </Flex>

                {/* Text block */}
                <Box flex="1" minW="0">
                  <Flex align="center" gap="1.5" mb="0.5">
                    <Text
                      textStyle={T.bodyText}
                      fontWeight="700"
                      color={isPending ? T.gold : isDisabled ? T.goldDark : T.goldText}
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                    >
                      {t(`spells.${spell.id}.name`)}
                    </Text>
                    {/* Effect type badge */}
                    {effectMeta && (
                      <Box
                        layerStyle={T.goldBadge}
                        borderColor={effectMeta.color}
                        textStyle={T.badgeText}
                        color={effectMeta.color}
                        flexShrink={0}
                      >
                        {effectMeta.label}
                      </Box>
                    )}
                  </Flex>
                  {/* Description */}
                  <Text
                    textStyle={T.bodyMuted}
                    color={T.goldDark}
                    lineHeight="1.3"
                    overflow="hidden"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {t(`spells.${spell.id}.desc`, { defaultValue: "" })}
                  </Text>
                  {/* Stats row */}
                  <Flex align="center" gap="2" mt="1">
                    <Text
                      textStyle={T.badgeText}
                      color={noMana ? "#882222" : T.arcane}
                      fontWeight="700"
                    >
                      {spell.manaCost}{t("ui.spells.mana_unit")}
                    </Text>
                    <Text textStyle={T.badgeText} color={T.goldDark}>
                      ·
                    </Text>
                    <Text textStyle={T.badgeText} color={T.goldDark}>
                      {rangeLabel}
                    </Text>
                    {spell.cooldownMs >= 1000 && (
                      <>
                        <Text textStyle={T.badgeText} color={T.goldDark}>
                          ·
                        </Text>
                        <Text textStyle={T.badgeText} color={T.goldDark}>
                          {spell.cooldownMs / 1000}{t("ui.spells.cooldown_unit")}
                        </Text>
                      </>
                    )}
                  </Flex>
                </Box>

                {/* Right badge */}
                {isPending && (
                  <Text
                    textStyle={T.badgeText}
                    color={T.gold}
                    fontWeight="700"
                    letterSpacing="1px"
                    textTransform="uppercase"
                    position="absolute"
                    top="2"
                    right="2"
                  >
                    {t("sidebar.inventory.pending")}
                  </Text>
                )}
              </Flex>
            );
          })}
        </Flex>
      )}
    </Box>
  );
}

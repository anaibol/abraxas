import type { Ability } from "@abraxas/shared";
import { Box, Flex, Grid, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useAudio } from "../../contexts/AudioContext";
import { T } from "../tokens";
import { useCooldown } from "../../contexts/CooldownContext";
import { useState, useEffect, useRef, useCallback } from "react";
import { SpellTooltip } from "../components/SpellTooltip";

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
  blink: "✨",
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

interface SpellsTabProps {
  classSpells: Ability[];
  currentMana: number;
  playerLevel: number;
  pendingSpellId?: string | null;
  onSpellClick?: (id: string, range: number) => void;
  onHoverSpell?: (id: string | null, range: number) => void;
}

export function SpellsTab({
  classSpells,
  currentMana,
  playerLevel,
  pendingSpellId,
  onSpellClick,
  onHoverSpell,
}: SpellsTabProps) {
  const { t } = useTranslation();
  const { playUIClick, playUIHover } = useAudio();
  const { getCooldownProgress } = useCooldown();

  // Force re-renders every frame to smoothly animate cooldowns
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let af: number;
    const loop = () => {
      setNow(Date.now());
      af = requestAnimationFrame(loop);
    };
    af = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(af);
  }, []);

  // Hover delay logic
  const [hoveredSpell, setHoveredSpell] = useState<Ability | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback((spell: Ability, e: React.MouseEvent) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    
    // Position for tooltip
    setMousePos({ x: e.clientX, y: e.clientY });

    const isLocked = !!spell.requiredLevel && playerLevel < spell.requiredLevel;
    const noMana = currentMana < spell.manaCost;
    const isDisabled = isLocked || noMana;
    if (!isDisabled) playUIHover?.();

    // 3 second delay for details and range indicator
    hoverTimerRef.current = setTimeout(() => {
      setHoveredSpell(spell);
      onHoverSpell?.(spell.id, spell.rangeTiles);
    }, 3000);
  }, [playerLevel, currentMana, playUIHover, onHoverSpell]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveredSpell(null);
    onHoverSpell?.(null, 0);
  }, [onHoverSpell]);

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
        <Grid templateColumns="repeat(5, 1fr)" gap="1">
          {classSpells.map((spell) => {
            const isLocked = !!spell.requiredLevel && playerLevel < spell.requiredLevel;
            const isPending = pendingSpellId === spell.id;
            const noMana = currentMana < spell.manaCost;
            const isDisabled = isLocked || noMana;
            const rangeTiles = spell.rangeTiles;

            return (
              <Box
                key={spell.id}
                aspectRatio="1"
                bg={isPending ? T.surface : T.darkest}
                border="1px solid"
                borderColor={isPending ? T.gold : isDisabled ? "#2a1a1a" : T.border}
                borderRadius="2px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                cursor={isDisabled ? "not-allowed" : "pointer"}
                transition="all 0.12s"
                opacity={isLocked ? 0.3 : isDisabled ? 0.6 : 1}
                filter={isLocked ? "grayscale(100%)" : "none"}
                _hover={isDisabled ? {} : { bg: T.surface, borderColor: T.gold, boxShadow: `0 0 8px ${T.gold}44` }}
                onMouseEnter={(e) => handleMouseEnter(spell, e)}
                onMouseLeave={handleMouseLeave}
                onClick={() => {
                  if (!isDisabled) {
                    playUIClick?.();
                    onSpellClick?.(spell.id, rangeTiles);
                  }
                }}
                position="relative"
                overflow="hidden"
              >
                <Text fontSize="22px">{SPELL_ICONS[spell.id] || "✨"}</Text>

                {/* Cooldown Clock Sweep */}
                {(() => {
                  const progress = getCooldownProgress(spell.id);
                  if (progress <= 0) return null;
                  const revealedDeg = (1 - progress) * 360;
                  return (
                    <Box
                      position="absolute"
                      inset="0"
                      borderRadius="2px"
                      style={{
                        background: `conic-gradient(from 0deg, transparent ${revealedDeg}deg, rgba(0,0,0,0.7) ${revealedDeg}deg)`,
                      }}
                    />
                  );
                })()}

                {/* Keybind badge */}
                {spell.key && !isLocked && (
                  <Box
                    position="absolute"
                    bottom="1px"
                    right="1px"
                    layerStyle={T.goldBadge}
                    bg={isPending ? T.gold : "#1a1510"}
                    borderColor={isPending ? T.gold : T.raised}
                    color={isPending ? T.bg : T.goldMuted}
                    textStyle={T.badgeText}
                    fontSize="9px"
                    lineHeight="1"
                    px="0.5"
                  >
                    {spell.key}
                  </Box>
                )}

                {/* Active Indicator */}
                {isPending && (
                  <Box
                    position="absolute"
                    bottom="0"
                    left="0"
                    right="0"
                    h="2px"
                    bg={T.gold}
                  />
                )}
              </Box>
            );
          })}
        </Grid>
      )}

      {/* Delayed Tooltip */}
      {hoveredSpell && (
        <SpellTooltip
          spell={hoveredSpell}
          playerLevel={playerLevel}
          currentMana={currentMana}
          x={mousePos.x}
          y={mousePos.y}
        />
      )}
    </Box>
  );
}

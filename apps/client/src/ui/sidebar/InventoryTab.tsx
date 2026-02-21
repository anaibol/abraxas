import { EQUIPMENT_SLOTS, type EquipmentSlot, ITEMS, getItemEmoji } from "@abraxas/shared";
import { Box, Flex, Grid, Text } from "@chakra-ui/react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAudio } from "../../contexts/AudioContext";
import { ItemTooltip } from "../components/ItemTooltip";
import { HEX, T } from "../tokens";
import type { PlayerState } from "./types";

const RARITY_COLORS: Record<string, string> = {
  COMMON: HEX.goldMuted,
  UNCOMMON: "#33aa44",
  RARE: "#3355cc",
  EPIC: "#bb44ff",
  LEGENDARY: "#ff8800",
};

interface InventoryTabProps {
  state: PlayerState;
  selectedItemId?: string | null;
  onSelectItem?: (id: string | null) => void;
  onEquip?: (id: string) => void;
  onUnequip?: (slot: EquipmentSlot) => void;
  onUseItem?: (id: string) => void;
}

export function InventoryTab({
  state,
  selectedItemId,
  onSelectItem,
  onEquip,
  onUnequip,
  onUseItem,
}: InventoryTabProps) {
  const { t } = useTranslation();
  const { playUIClick, playUIHover } = useAudio();

  // Tooltip hover state
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [hoveredQty, setHoveredQty] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTooltipActive = useRef(false);

  const handleMouseEnter = useCallback(
    (itemId: string, qty: number, e: React.MouseEvent) => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (graceTimerRef.current) clearTimeout(graceTimerRef.current);

      // Immediate audio feedback
      playUIHover?.();

      if (isTooltipActive.current) {
        // If tooltip was already active (we are moving between items), show immediately
        setHoveredItemId(itemId);
        setHoveredQty(qty);
      } else {
        // Otherwise apply the 1-second delay
        hoverTimerRef.current = setTimeout(() => {
          isTooltipActive.current = true;
          setHoveredItemId(itemId);
          setHoveredQty(qty);
        }, 1000);
      }
    },
    [playUIHover],
  );

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
    
    setHoveredItemId(null);
    
    // Give a 150ms grace period before we "forget" that a tooltip was active
    graceTimerRef.current = setTimeout(() => {
      isTooltipActive.current = false;
    }, 150);
  }, []);

  const hoveredItem = hoveredItemId ? ITEMS[hoveredItemId] : null;

  return (
    <Box p="2.5" ref={containerRef}>
      {/* Equipment slots */}
      {state.equipment && (
        <Grid templateColumns={`repeat(${EQUIPMENT_SLOTS.length}, 1fr)`} gap="1" mb="2">
          {EQUIPMENT_SLOTS.map((slot) => {
            const equipped = state.equipment?.[slot];
            const def = equipped ? ITEMS[equipped] : null;
            return (
              <Box
                key={slot}
                aspectRatio="1"
                bg={T.darkest}
                border="1px solid"
                borderColor={def ? RARITY_COLORS[def.rarity] || T.border : T.border}
                borderRadius="2px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                cursor={def ? "pointer" : "default"}
                onClick={() => def && onUnequip?.(slot)}
                _hover={def ? { borderColor: T.gold, boxShadow: `0 0 8px ${RARITY_COLORS[def.rarity] || HEX.gold}66, 0 0 16px ${RARITY_COLORS[def.rarity] || HEX.gold}22` } : {}}
                position="relative"
                onMouseEnter={(e) => {
                  if (def && equipped) {
                    handleMouseEnter(equipped, 1, e);
                  }
                }}
                onMouseLeave={handleMouseLeave}
              >
                <Text fontSize="24px">{def ? getItemEmoji(equipped!) : ""}</Text>
                {!def && (
                  <Text fontSize="24px" opacity={0.25} lineHeight="1" userSelect="none">
                    {slot === "helmet" ? "🪖" : slot === "armor" ? "👕" : slot === "weapon" ? "⚔️" : slot === "shield" ? "🛡️" : slot === "ring" ? "💍" : slot === "mount" ? "🐎" : "•"}
                  </Text>
                )}
              </Box>
            );
          })}
        </Grid>
      )}
      <Grid templateColumns="repeat(5, 1fr)" gap="1">
        {Array.from({ length: 20 }, (_, i) => {
          const invItem = state.inventory?.find((it) => it.slotIndex === i);
          const def = invItem ? ITEMS[invItem.itemId] : null;
          const isSelected = !!invItem && invItem.itemId === selectedItemId;
          return (
            <Box
              key={i}
              aspectRatio="1"
              bg={isSelected ? T.surface : T.darkest}
              border="2px solid"
              borderColor={
                isSelected ? T.gold : def ? RARITY_COLORS[def.rarity] || T.border : T.border
              }
              borderRadius="2px"
              transition="all 0.1s"
              cursor={def ? "pointer" : "default"}
              _hover={def ? { borderColor: T.gold, bg: T.surface, boxShadow: `0 0 10px ${RARITY_COLORS[def.rarity] || HEX.gold}55, 0 0 20px ${RARITY_COLORS[def.rarity] || HEX.gold}22` } : {}}
              display="flex"
              alignItems="center"
              justifyContent="center"
              position="relative"
              onMouseEnter={(e) => {
                if (def && invItem) {
                  handleMouseEnter(invItem.itemId, invItem.quantity, e);
                }
              }}
              onMouseLeave={handleMouseLeave}
              onClick={() => {
                if (!def || !invItem) return;
                playUIClick?.();
                onSelectItem?.(isSelected ? null : invItem.itemId);
              }}
              onDoubleClick={() => {
                if (!def || !invItem) return;
                playUIClick?.();
                if (def.consumeEffect) {
                  onUseItem?.(invItem.itemId);
                } else if (def.slot !== "consumable") {
                  onEquip?.(invItem.itemId);
                }
              }}
            >
              {def && <Text fontSize="16px">{getItemEmoji(invItem!.itemId)}</Text>}
              {invItem && invItem.quantity > 1 && (
                <Text
                  textStyle={T.badgeText}
                  color="#fff"
                  position="absolute"
                  bottom="2px"
                  right="4px"
                >
                  {invItem.quantity}
                </Text>
              )}
              {isSelected && (
                <Box
                  position="absolute"
                  bottom="0"
                  left="0"
                  right="0"
                  h="2px"
                  bg={T.gold}
                  borderRadius="0 0 2px 2px"
                />
              )}
            </Box>
          );
        })}
      </Grid>

      {/* Hover tooltip */}
      {hoveredItem && (() => {
        // Find the equipped item in the same slot for stat comparison
        const equippedId = hoveredItem.slot !== "consumable" && state.equipment
          ? state.equipment[hoveredItem.slot as keyof typeof state.equipment]
          : undefined;
        const equippedItem = equippedId && equippedId !== hoveredItemId ? ITEMS[equippedId] : null;

        return (
          <ItemTooltip
            item={hoveredItem}
            quantity={hoveredQty}
            equippedItem={equippedItem}
          />
        );
      })()}
    </Box>
  );
}

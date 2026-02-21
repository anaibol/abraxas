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
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const hoveredItem = hoveredItemId ? ITEMS[hoveredItemId] : null;

  return (
    <Box p="2.5" ref={containerRef} onMouseMove={handleMouseMove}>
      {/* Equipment slots */}
      {state.equipment && (
        <Flex gap="1" mb="2" justify="center">
          {EQUIPMENT_SLOTS.map((slot) => {
            const equipped = state.equipment?.[slot];
            const def = equipped ? ITEMS[equipped] : null;
            return (
              <Box
                key={slot}
                w="42px"
                h="42px"
                bg={T.darkest}
                border="1px solid"
                borderColor={def ? RARITY_COLORS[def.rarity] || T.border : T.border}
                borderRadius="2px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                cursor={def ? "pointer" : "default"}
                onClick={() => def && onUnequip?.(slot)}
                _hover={def ? { borderColor: T.gold } : {}}
                position="relative"
                onMouseEnter={() => {
                  if (def && equipped) {
                    setHoveredItemId(equipped);
                    setHoveredQty(1);
                  }
                }}
                onMouseLeave={() => setHoveredItemId(null)}
              >
                <Text fontSize="16px">{def ? getItemEmoji(equipped!) : ""}</Text>
                {!def && (
                  <Text textStyle={T.badgeText} color={T.goldDark} position="absolute" bottom="1px">
                    {slot.slice(0, 3).toUpperCase()}
                  </Text>
                )}
              </Box>
            );
          })}
        </Flex>
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
              _hover={def ? { borderColor: T.gold, bg: T.surface } : {}}
              display="flex"
              alignItems="center"
              justifyContent="center"
              position="relative"
              onMouseEnter={() => {
                if (def && invItem) {
                  playUIHover?.();
                  setHoveredItemId(invItem.itemId);
                  setHoveredQty(invItem.quantity);
                }
              }}
              onMouseLeave={() => setHoveredItemId(null)}
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
                  bottom="0"
                  right="1px"
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
      {hoveredItem && (
        <ItemTooltip
          item={hoveredItem}
          quantity={hoveredQty}
          x={mousePos.x}
          y={mousePos.y}
        />
      )}
    </Box>
  );
}

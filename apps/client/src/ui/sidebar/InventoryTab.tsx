import { EQUIPMENT_SLOTS, type EquipmentSlot, ITEMS } from "@abraxas/shared";
import { Box, Flex, Grid, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useAudio } from "../../contexts/AudioContext";
import { HEX, T } from "../tokens";
import type { PlayerState } from "./types";

const RARITY_COLORS: Record<string, string> = {
  COMMON: HEX.goldMuted,
  UNCOMMON: "#33aa44",
  RARE: "#3355cc",
};

const ITEM_ICONS: Record<string, string> = {
  weapon: "\u2694\uFE0F",
  armor: "\uD83D\uDEE1\uFE0F",
  shield: "\uD83D\uDEE1\uFE0F",
  helmet: "\u26D1\uFE0F",
  ring: "\uD83D\uDC8D",
  mount: "🐎",
  consumable: "\uD83E\uDDEA",
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
  return (
    <Box p="2.5">
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
                title={
                  def
                    ? t("sidebar.inventory.unequip_hint", { name: t(def.name) })
                    : t("controls.unequip")
                }
                onClick={() => def && onUnequip?.(slot)}
                _hover={def ? { borderColor: T.gold } : {}}
                position="relative"
              >
                <Text fontSize="16px">{def ? ITEM_ICONS[def.slot] || "\u2728" : ""}</Text>
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
              title={
                def
                  ? t("sidebar.inventory.interactions_hint", {
                      name: t(def.name),
                      qty: invItem && invItem.quantity > 1 ? ` x${invItem.quantity}` : "",
                      action: def.consumeEffect ? t("controls.use") : t("controls.equip"),
                    })
                  : ""
              }
              _hover={def ? { borderColor: T.gold, bg: T.surface } : {}}
              display="flex"
              alignItems="center"
              justifyContent="center"
              position="relative"
              onMouseEnter={() => {
                if (def) playUIHover?.();
              }}
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
              {def && <Text fontSize="16px">{ITEM_ICONS[def.slot] || "\u2728"}</Text>}
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
    </Box>
  );
}

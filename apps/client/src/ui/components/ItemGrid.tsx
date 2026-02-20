import { ITEMS } from "@abraxas/shared";
import { Box, Grid, Text } from "@chakra-ui/react";
import { useAudio } from "../../contexts/AudioContext";
import { T } from "../tokens";

export type SlotItem = {
  itemId: string;
  quantity: number;
  slotIndex: number;
};

export type ItemGridProps = {
  slots: { itemId: string; quantity: number; slotIndex: number }[];
  selectedSlotIndex: number | null;
  onSelect: (slot: SlotItem) => void;
  maxSlots?: number;
};

export function ItemGrid({ slots, selectedSlotIndex, onSelect, maxSlots = 24 }: ItemGridProps) {
  const { playUIClick, playUIHover } = useAudio();
  return (
    <Grid
      templateColumns={{ base: "repeat(4, 1fr)", md: "repeat(6, 1fr)" }}
      gap="2"
      bg="blackAlpha.400"
      p="3"
      borderRadius="8px"
      border="1px solid"
      borderColor={T.border}
    >
      {Array.from({ length: maxSlots }).map((_, i) => {
        const slot = slots.find((it) => it.slotIndex === i);
        const def = slot ? ITEMS[slot.itemId] : null;
        const isSelected = selectedSlotIndex === i && !!slot;

        return (
          <Box
            key={i}
            aspectRatio="1"
            bg={isSelected ? "whiteAlpha.200" : "blackAlpha.600"}
            border="1px solid"
            borderColor={isSelected ? T.gold : T.border}
            borderRadius="4px"
            cursor={def ? "pointer" : "default"}
            transition="all 0.15s"
            _hover={def ? { borderColor: T.goldDim, transform: "scale(1.05)" } : {}}
            display="flex"
            alignItems="center"
            justifyContent="center"
            position="relative"
            onMouseEnter={() => {
              if (def && !isSelected) playUIHover?.();
            }}
            onClick={() => {
              if (slot && !isSelected) {
                playUIClick?.();
                onSelect(slot);
              }
            }}
          >
            {def && <Text fontSize="24px">✨</Text>}
            {slot && slot.quantity > 1 && (
              <Text
                position="absolute"
                bottom="1px"
                right="2px"
                fontSize="10px"
                color="#fff"
                fontWeight="bold"
              >
                {slot.quantity}
              </Text>
            )}
          </Box>
        );
      })}
    </Grid>
  );
}

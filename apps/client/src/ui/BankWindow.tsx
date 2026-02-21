import { ITEMS, getItemEmoji } from "@abraxas/shared";
import { Box, Flex, Grid, Input, Text } from "@chakra-ui/react";
import { type ChangeEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAudio } from "../contexts/AudioContext";
import { Button } from "./components/Button";
import { ModalOverlay } from "./components/ModalOverlay";
import { PanelHeader } from "./components/PanelHeader";
import { HEX, T } from "./tokens";

type BankSlot = {
  itemId: string;
  quantity: number;
  slotIndex: number;
};

type BankWindowProps = {
  bankItems: BankSlot[];
  playerInventory: BankSlot[];
  onDeposit: (itemId: string, quantity: number, slotIndex: number) => void;
  onWithdraw: (itemId: string, quantity: number, slotIndex: number) => void;
  onClose: () => void;
};

type ItemGridProps = {
  slots: BankSlot[];
  selectedSlotIndex: number | null;
  onSelect: (slot: BankSlot) => void;
};

function ItemGrid({ slots, selectedSlotIndex, onSelect }: ItemGridProps) {
  const { playUIClick, playUIHover } = useAudio();
  return (
    <Grid
      templateColumns={{ base: "repeat(4, 1fr)", md: "repeat(6, 1fr)" }}
      gap="2"
      bg="blackAlpha.400"
      p="3"
      borderRadius="4px"
      border="1px solid"
      borderColor={T.border}
    >
      {[...Array(24).keys()].map((slotIndex) => {
        const slot = slots.find((it) => it.slotIndex === slotIndex);
        const def = slot ? ITEMS[slot.itemId] : null;
        const isSelected = selectedSlotIndex === slotIndex && !!slot;

        return (
          <Box
            key={slotIndex}
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
            {def && <Text fontSize="24px">{getItemEmoji(slot!.itemId)}</Text>}
            {slot && slot.quantity > 1 && (
              <Text
                position="absolute"
                bottom="2px"
                right="4px"
                fontSize="10px"
                color="#fff"
                fontWeight="700"
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

export function BankWindow({
  bankItems,
  playerInventory,
  onDeposit,
  onWithdraw,
  onClose,
}: BankWindowProps) {
  const { t } = useTranslation();
  const [selectedItem, setSelectedItem] = useState<
    (BankSlot & { source: "inventory" | "bank" }) | null
  >(null);
  const [quantity, setQuantity] = useState<number>(1);

  const handleQtyChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.valueAsNumber;
    if (!Number.isNaN(val)) setQuantity(Math.max(1, Math.min(999, val)));
  };

  const selectedDef = selectedItem ? ITEMS[selectedItem.itemId] : null;
  const invSelectedSlot = selectedItem?.source === "inventory" ? selectedItem.slotIndex : null;
  const bankSelectedSlot = selectedItem?.source === "bank" ? selectedItem.slotIndex : null;

  const selectSlot = (slot: BankSlot, source: "inventory" | "bank") => {
    setSelectedItem({ ...slot, source });
    setQuantity(1);
  };

  return (
    <ModalOverlay
      onClose={onClose}
      panelProps={{
        p: { base: "4", md: "8" },
        w: { base: "calc(100vw - 24px)", md: "700px" },
        maxH: "90dvh",
        overflowY: "auto",
      }}
    >
      <PanelHeader title={t("ui.bank.title")} subtitle={t("ui.bank.subtitle")} onClose={onClose} />

      <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={{ base: "4", md: "8" }}>
        <Box>
          <Text color={T.goldMuted} textStyle={T.formLabel} mb="4">
            {t("ui.bank.inventory_label")}
          </Text>
          <ItemGrid
            slots={playerInventory}
            selectedSlotIndex={invSelectedSlot}
            onSelect={(slot) => selectSlot(slot, "inventory")}
          />
        </Box>

        <Box>
          <Text color={T.goldMuted} textStyle={T.formLabel} mb="4">
            {t("ui.bank.vault_label")} {bankItems.length} / 24
          </Text>
          <ItemGrid
            slots={bankItems}
            selectedSlotIndex={bankSelectedSlot}
            onSelect={(slot) => selectSlot(slot, "bank")}
          />
        </Box>
      </Grid>

      {/* Control Panel */}
      <Box mt="8" minH="120px" borderTop="1px solid" borderColor={T.border} pt="6">
        {selectedItem ? (
          <Flex
            gap={{ base: "3", md: "6" }}
            align={{ base: "flex-start", md: "center" }}
            direction={{ base: "column", md: "row" }}
          >
            <Box
              w="60px"
              h="60px"
              bg="blackAlpha.600"
              border="1px solid"
              borderColor={T.gold}
              borderRadius="4px"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize="32px">{getItemEmoji(selectedItem!.itemId)}</Text>
            </Box>
            <Box flex="1">
              <Text color={T.gold} textStyle={T.headingLg} mb="1">
                {selectedDef ? t(selectedDef.name) : ""}
              </Text>
              <Text
                color="whiteAlpha.600"
                textStyle={T.bodyMuted}
                textTransform="uppercase"
                letterSpacing="1px"
              >
                {selectedItem.source === "inventory"
                  ? t("ui.bank.held_in_bags")
                  : t("ui.bank.stored_in_vault")}
              </Text>
            </Box>

            <Flex align="center" gap="4">
              <Box>
                <Text color={T.goldDark} textStyle={T.badgeText} mb="1" fontWeight="700">
                  {t("ui.bank.quantity")}
                </Text>
                <Flex align="center">
                  <Button
                    size="xs"
                    variant="outline"
                    color={T.gold}
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={handleQtyChange}
                    w="50px"
                    h="24px"
                    mx="2"
                    textAlign="center"
                    bg="transparent"
                    border="1px solid"
                    borderColor={T.border}
                    color="#fff"
                    fontSize="12px"
                  />
                  <Button
                    size="xs"
                    variant="outline"
                    color={T.gold}
                    onClick={() => setQuantity(Math.min(selectedItem.quantity, quantity + 1))}
                  >
                    +
                  </Button>
                </Flex>
              </Box>

              <Button
                h="40px"
                px="8"
                bg={T.goldDim}
                color="#000"
                fontWeight="700"
                letterSpacing="2px"
                _hover={{ bg: T.gold, transform: "translateY(-2px)" }}
                onClick={() => {
                  if (selectedItem.source === "inventory") {
                    onDeposit(selectedItem.itemId, quantity, selectedItem.slotIndex);
                  } else {
                    onWithdraw(selectedItem.itemId, quantity, selectedItem.slotIndex);
                  }
                  setSelectedItem(null);
                }}
              >
                {selectedItem.source === "inventory" ? t("ui.bank.deposit") : t("ui.bank.withdraw")}
              </Button>
            </Flex>
          </Flex>
        ) : (
          <Flex h="60px" align="center" justify="center">
            <Text color={T.goldDark} fontStyle="italic" letterSpacing="2px">
              {t("ui.bank.empty_selection")}
            </Text>
          </Flex>
        )}
      </Box>
    </ModalOverlay>
  );
}

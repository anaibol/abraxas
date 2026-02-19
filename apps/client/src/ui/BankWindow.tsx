import React, { useState } from "react";
import { Box, Flex, Text, Button, Grid, Input, Tooltip } from "@chakra-ui/react";
import { ITEMS, type Item } from "@abraxas/shared";
import { T, HEX } from "./tokens";
import { useTranslation } from "react-i18next";

interface BankSlot {
  itemId: string;
  quantity: number;
  slotIndex: number;
}

interface BankWindowProps {
  bankItems: BankSlot[];
  playerInventory: { itemId: string; quantity: number; slotIndex: number }[];
  onDeposit: (itemId: string, quantity: number, slotIndex: number) => void;
  onWithdraw: (itemId: string, quantity: number, slotIndex: number) => void;
  onClose: () => void;
}


export function BankWindow({
  bankItems,
  playerInventory,
  onDeposit,
  onWithdraw,
  onClose,
}: BankWindowProps) {
  const { t } = useTranslation();
  const [selectedItem, setSelectedItem] = useState<{
    itemId: string;
    quantity: number;
    slotIndex: number;
    source: "inventory" | "bank";
  } | null>(null);
  const [quantity, setQuantity] = useState<number>(1);

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!Number.isNaN(val)) {
      setQuantity(Math.max(1, Math.min(999, val)));
    }
  };

  const selectedDef = selectedItem ? ITEMS[selectedItem.itemId] : null;

  return (
    <Box
      pos="fixed"
      top="50%"
      left="50%"
      transform="translate(-50%, -50%)"
      bg={T.bg}
      backdropFilter="blur(20px)"
      border="1px solid"
      borderColor={T.gold}
      borderRadius="12px"
      p="8"
      minW="700px"
      maxH="90vh"
      boxShadow="0 20px 80px rgba(0,0,0,0.9), inset 0 0 40px rgba(212, 168, 67, 0.05)"
      fontFamily={T.display}
      zIndex="200"
    >
      <Flex justify="space-between" align="center" mb="8">
        <Box>
          <Text
            color={T.gold}
            fontSize="28px"
            fontWeight="900"
            letterSpacing="6px"
            textShadow={`0 0 15px ${HEX.goldDark}`}
            textTransform="uppercase"
          >
            {t("ui.bank.title")}
          </Text>
          <Text color={T.goldDark} fontSize="12px" letterSpacing="4px" textTransform="uppercase">
            {t("ui.bank.subtitle")}
          </Text>
        </Box>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          color={T.gold}
          fontSize="20px"
          _hover={{ bg: "whiteAlpha.100", transform: "scale(1.2)" }}
        >
          ✕
        </Button>
      </Flex>

      <Grid templateColumns="1fr 1fr" gap="8">
        {/* Inventory Section */}
        <Box>
          <Text color={T.goldMuted} fontSize="12px" mb="4" fontWeight="bold" letterSpacing="2px">
            {t("ui.bank.inventory_label")}
          </Text>
          <Grid templateColumns="repeat(6, 1fr)" gap="2" bg="blackAlpha.400" p="3" borderRadius="8px" border="1px solid" borderColor={T.border}>
            {Array.from({ length: 24 }).map((_, i) => {
              const invItem = playerInventory.find((it) => it.slotIndex === i);
              const def = invItem ? ITEMS[invItem.itemId] : null;
              const isSelected = selectedItem?.source === "inventory" && selectedItem?.slotIndex === i;

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
                  onClick={() => {
                    if (invItem) {
                      setSelectedItem({ ...invItem, source: "inventory" });
                      setQuantity(1);
                    }
                  }}
                >
                  {def && <Text fontSize="24px">{"\u2728"}</Text>}
                  {invItem && invItem.quantity > 1 && (
                    <Text position="absolute" bottom="1px" right="2px" fontSize="10px" color="#fff" fontWeight="bold">
                      {invItem.quantity}
                    </Text>
                  )}
                </Box>
              );
            })}
          </Grid>
        </Box>

        {/* Bank Section */}
        <Box>
          <Text color={T.goldMuted} fontSize="12px" mb="4" fontWeight="bold" letterSpacing="2px">
            {t("ui.bank.vault_label")} {bankItems.length} / 24
          </Text>
          <Grid templateColumns="repeat(6, 1fr)" gap="2" bg="blackAlpha.400" p="3" borderRadius="8px" border="1px solid" borderColor={T.border}>
            {Array.from({ length: 24 }).map((_, i) => {
              const bankItem = bankItems.find((it) => it.slotIndex === i);
              const def = bankItem ? ITEMS[bankItem.itemId] : null;
              const isSelected = selectedItem?.source === "bank" && selectedItem?.slotIndex === i;

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
                  onClick={() => {
                    if (bankItem) {
                      setSelectedItem({ ...bankItem, source: "bank" });
                      setQuantity(1);
                    }
                  }}
                >
                  {def && <Text fontSize="24px">{"\u2728"}</Text>}
                  {bankItem && bankItem.quantity > 1 && (
                    <Text position="absolute" bottom="1px" right="2px" fontSize="10px" color="#fff" fontWeight="bold">
                      {bankItem.quantity}
                    </Text>
                  )}
                </Box>
              );
            })}
          </Grid>
        </Box>
      </Grid>

      {/* Control Panel */}
      <Box mt="8" minH="120px" borderTop="1px solid" borderColor={T.border} pt="6">
        {selectedItem ? (
          <Flex gap="6" align="center">
            <Box w="60px" h="60px" bg="blackAlpha.600" border="1px solid" borderColor={T.gold} borderRadius="8px" display="flex" alignItems="center" justifyContent="center">
               <Text fontSize="32px">{"\u2728"}</Text>
            </Box>
            <Box flex="1">
              <Text color={T.gold} fontSize="20px" fontWeight="bold" mb="1">
                {selectedDef ? t(selectedDef.name) : ""}
              </Text>
              <Text color="whiteAlpha.600" fontSize="12px" textTransform="uppercase" letterSpacing="1px">
                {selectedItem.source === "inventory" ? t("ui.bank.held_in_bags") : t("ui.bank.stored_in_vault")}
              </Text>
            </Box>
            
            <Flex align="center" gap="4">
              <Box>
                <Text color={T.goldDark} fontSize="10px" mb="1" fontWeight="bold">{t("ui.bank.quantity")}</Text>
                <Flex align="center">
                  <Button size="xs" variant="outline" color={T.gold} onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</Button>
                  <Input
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
                  <Button size="xs" variant="outline" color={T.gold} onClick={() => setQuantity(Math.min(selectedItem.quantity, quantity + 1))}>+</Button>
                </Flex>
              </Box>

              <Button
                h="40px"
                px="8"
                bg={T.goldDim}
                color="#000"
                fontWeight="900"
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
                {selectedItem.source === "inventory" ? "DEPOSIT" : "WITHDRAW"}
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
    </Box>
  );
}

import React, { useState } from "react";
import { Box, Flex, Text, Button, Grid, Input, Tooltip } from "@chakra-ui/react";
import { ITEMS, type Item } from "@abraxas/shared";

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

const P = {
  bg: "rgba(10, 8, 16, 0.98)",
  surface: "#14111e",
  raised: "#1a1628",
  border: "#3a3250",
  gold: "#d4a843",
  goldDim: "#b8962e",
  goldDark: "#6e5a18",
  goldText: "#c8b68a",
  goldMuted: "#8a7a60",
  font: "'Friz Quadrata', Georgia, serif",
};

export function BankWindow({
  bankItems,
  playerInventory,
  onDeposit,
  onWithdraw,
  onClose,
}: BankWindowProps) {
  const [selectedItem, setSelectedItem] = useState<{
    itemId: string;
    quantity: number;
    slotIndex: number;
    source: "inventory" | "bank";
  } | null>(null);
  const [quantity, setQuantity] = useState<number>(1);

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val)) {
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
      bg={P.bg}
      backdropFilter="blur(20px)"
      border="1px solid"
      borderColor={P.gold}
      borderRadius="12px"
      p="8"
      minW="700px"
      maxH="90vh"
      boxShadow="0 20px 80px rgba(0,0,0,0.9), inset 0 0 40px rgba(212, 168, 67, 0.05)"
      fontFamily={P.font}
      zIndex="200"
    >
      <Flex justify="space-between" align="center" mb="8">
        <Box>
          <Text
            color={P.gold}
            fontSize="28px"
            fontWeight="900"
            letterSpacing="6px"
            textShadow={`0 0 15px ${P.goldDark}`}
            textTransform="uppercase"
          >
            Royal Vault
          </Text>
          <Text color={P.goldDark} fontSize="10px" letterSpacing="4px" textTransform="uppercase">
            Secure Asset Repository
          </Text>
        </Box>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          color={P.gold}
          fontSize="20px"
          _hover={{ bg: "whiteAlpha.100", transform: "scale(1.2)" }}
        >
          ✕
        </Button>
      </Flex>

      <Grid templateColumns="1fr 1fr" gap="8">
        {/* Inventory Section */}
        <Box>
          <Text color={P.goldMuted} fontSize="12px" mb="4" fontWeight="bold" letterSpacing="2px">
            PERSONAL INVENTORY
          </Text>
          <Grid templateColumns="repeat(6, 1fr)" gap="2" bg="blackAlpha.400" p="3" borderRadius="8px" border="1px solid" borderColor={P.border}>
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
                  borderColor={isSelected ? P.gold : P.border}
                  borderRadius="4px"
                  cursor={def ? "pointer" : "default"}
                  transition="all 0.15s"
                  _hover={def ? { borderColor: P.goldDim, transform: "scale(1.05)" } : {}}
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
          <Text color={P.goldMuted} fontSize="12px" mb="4" fontWeight="bold" letterSpacing="2px">
            VAULT STORAGE {bankItems.length} / 24
          </Text>
          <Grid templateColumns="repeat(6, 1fr)" gap="2" bg="blackAlpha.400" p="3" borderRadius="8px" border="1px solid" borderColor={P.border}>
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
                  borderColor={isSelected ? P.gold : P.border}
                  borderRadius="4px"
                  cursor={def ? "pointer" : "default"}
                  transition="all 0.15s"
                  _hover={def ? { borderColor: P.goldDim, transform: "scale(1.05)" } : {}}
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
      <Box mt="8" minH="120px" borderTop="1px solid" borderColor={P.border} pt="6">
        {selectedItem ? (
          <Flex gap="6" align="center">
            <Box w="60px" h="60px" bg="blackAlpha.600" border="1px solid" borderColor={P.gold} borderRadius="8px" display="flex" alignItems="center" justifyContent="center">
               <Text fontSize="32px">{"\u2728"}</Text>
            </Box>
            <Box flex="1">
              <Text color={P.gold} fontSize="20px" fontWeight="bold" mb="1">
                {selectedDef?.name}
              </Text>
              <Text color="whiteAlpha.600" fontSize="12px" textTransform="uppercase" letterSpacing="1px">
                {selectedItem.source === "inventory" ? "Held in bags" : "Stored in vault"}
              </Text>
            </Box>
            
            <Flex align="center" gap="4">
              <Box>
                <Text color={P.goldDark} fontSize="10px" mb="1" fontWeight="bold">QUANTITY</Text>
                <Flex align="center">
                  <Button size="xs" variant="outline" color={P.gold} onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</Button>
                  <Input
                    value={quantity}
                    onChange={handleQtyChange}
                    w="50px"
                    h="24px"
                    mx="2"
                    textAlign="center"
                    bg="transparent"
                    border="1px solid"
                    borderColor={P.border}
                    color="#fff"
                    fontSize="12px"
                  />
                  <Button size="xs" variant="outline" color={P.gold} onClick={() => setQuantity(Math.min(selectedItem.quantity, quantity + 1))}>+</Button>
                </Flex>
              </Box>

              <Button
                h="40px"
                px="8"
                bg={P.goldDim}
                color="#000"
                fontWeight="900"
                letterSpacing="2px"
                _hover={{ bg: P.gold, transform: "translateY(-2px)" }}
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
            <Text color={P.goldDark} fontStyle="italic" letterSpacing="2px">
              Select an item to manage your assets
            </Text>
          </Flex>
        )}
      </Box>
    </Box>
  );
}

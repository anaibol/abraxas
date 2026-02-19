import React, { useState } from "react";
import { Box, Flex, Text, Button, Grid } from "@chakra-ui/react";
import { ITEMS, type Item } from "@abraxas/shared";

interface MerchantShopProps {
  npcId: string;
  merchantInventory: string[];
  playerGold: number;
  playerInventory: { itemId: string; quantity: number }[];
  onBuy: (itemId: string, quantity: number) => void;
  onSell: (itemId: string, quantity: number) => void;
  onClose: () => void;
}

const P = {
  bg: "#0e0c14",
  raised: "#1a1628",
  border: "#2e2840",
  gold: "#d4a843",
  goldDim: "#b8962e",
  goldDark: "#6e5a18",
  goldText: "#c8b68a",
  font: "'Friz Quadrata', Georgia, serif",
};

export function MerchantShop({ npcId, merchantInventory, playerGold, playerInventory, onBuy, onSell, onClose }: MerchantShopProps) {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState<number>(1);

  return (
    <Box
      pos="fixed"
      top="50%"
      left="50%"
      transform="translate(-50%, -50%)"
      bg={P.bg}
      border="2px solid"
      borderColor={P.gold}
      borderRadius="4px"
      p="6"
      minW="500px"
      maxH="80vh"
      overflowY="auto"
      boxShadow="0 0 50px rgba(0,0,0,0.8)"
      fontFamily={P.font}
      zIndex="200"
    >
      <Flex justify="space-between" align="center" mb="4">
        <Text color={P.gold} fontSize="20px" fontWeight="700" letterSpacing="2px">MERCHANT SHOP</Text>
        <Button variant="ghost" size="sm" onClick={onClose} color={P.gold} p="0" minW="32px">X</Button>
      </Flex>

      <Flex mb="4" justify="space-between" bg={P.raised} p="2" borderRadius="2px">
        <Text color={P.goldDim} fontSize="14px">Your Gold: <Text as="span" color={P.gold}>{playerGold}</Text></Text>
      </Flex>

      <Flex mb="4" borderBottom="1px solid" borderColor={P.border}>
        <Box
          px="6"
          py="2"
          cursor="pointer"
          color={tab === "buy" ? P.gold : P.goldDark}
          borderBottom={tab === "buy" ? "2px solid" : "none"}
          borderColor={P.gold}
          onClick={() => { setTab("buy"); setSelectedItem(null); }}
        >
          BUY
        </Box>
        <Box
          px="6"
          py="2"
          cursor="pointer"
          color={tab === "sell" ? P.gold : P.goldDark}
          borderBottom={tab === "sell" ? "2px solid" : "none"}
          borderColor={P.gold}
          onClick={() => { setTab("sell"); setSelectedItem(null); }}
        >
          SELL
        </Box>
      </Flex>

      <Box>
        {tab === "buy" ? (
          <Grid templateColumns="repeat(2, 1fr)" gap="3">
            {merchantInventory.map((itemId) => {
              const item = ITEMS[itemId];
              if (!item) return null;
              return (
                <Box
                  key={itemId}
                  p="2"
                  bg={P.raised}
                  border="1px solid"
                  borderColor={selectedItem?.id === itemId ? P.gold : P.border}
                  cursor="pointer"
                  _hover={{ borderColor: P.goldDim }}
                  onClick={() => setSelectedItem(item)}
                >
                  <Flex align="center">
                    <Box w="32px" h="32px" bg="#000" mr="3" border="1px solid" borderColor={P.border}></Box>
                    <Box>
                      <Text color="#fff" fontSize="12px">{item.name}</Text>
                      <Text color={P.gold} fontSize="11px">{item.goldValue} Gold</Text>
                    </Box>
                  </Flex>
                </Box>
              );
            })}
          </Grid>
        ) : (
          <Grid templateColumns="repeat(2, 1fr)" gap="3">
            {playerInventory.length === 0 && <Text color="#888" fontSize="12px">Your inventory is empty</Text>}
            {playerInventory.map((invItem, idx) => {
              const item = ITEMS[invItem.itemId];
              if (!item) return null;
              return (
                <Box
                  key={`${invItem.itemId}-${idx}`}
                  p="2"
                  bg={P.raised}
                  border="1px solid"
                  borderColor={selectedItem?.id === invItem.itemId ? P.gold : P.border}
                  cursor="pointer"
                  _hover={{ borderColor: P.goldDim }}
                  onClick={() => setSelectedItem(item)}
                >
                  <Flex align="center">
                    <Box w="32px" h="32px" bg="#000" mr="3" border="1px solid" borderColor={P.border}></Box>
                    <Box>
                      <Text color="#fff" fontSize="12px">{item.name} (x{invItem.quantity})</Text>
                      <Text color={P.gold} fontSize="11px">Sell for {Math.floor(item.goldValue * 0.5)} Gold</Text>
                    </Box>
                  </Flex>
                </Box>
              );
            })}
          </Grid>
        )}
      </Box>

      {selectedItem && (
        <Box mt="6" p="4" border="1px solid" borderColor={P.goldDark} borderRadius="2px" bg="#0a0a0f">
          <Text color={P.gold} fontSize="16px" mb="1">{selectedItem.name}</Text>
          <Text color="#888" fontSize="12px" mb="4">{selectedItem.slot.toUpperCase()} - {selectedItem.rarity.toUpperCase()}</Text>
          <Flex align="center" mb="4">
            <Text color="#fff" mr="4">Quantity:</Text>
            <Button size="xs" onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</Button>
            <Text color="#fff" mx="4" w="30px" textAlign="center">{quantity}</Text>
            <Button size="xs" onClick={() => setQuantity(quantity + 1)}>+</Button>
          </Flex>
          <Button
            w="100%"
            bg={P.goldDim}
            color="#000"
            _hover={{ bg: P.gold }}
            onClick={() => {
              if (tab === "buy") onBuy(selectedItem.id, quantity);
              else onSell(selectedItem.id, quantity);
            }}
          >
            {tab === "buy" ? `BUY FOR ${selectedItem.goldValue * quantity}` : `SELL FOR ${Math.floor(selectedItem.goldValue * 0.5) * quantity}`}
          </Button>
        </Box>
      )}
    </Box>
  );
}

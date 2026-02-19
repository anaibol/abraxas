import React, { useState } from "react";
import { Box, Flex, Text, Button, Grid, Input } from "@chakra-ui/react";
import { ITEMS, type Item } from "@abraxas/shared";
import { P } from "./palette";
import { useTranslation } from "react-i18next";

interface MerchantShopProps {
  npcId: string;
  merchantInventory: string[];
  playerGold: number;
  playerInventory: { itemId: string; quantity: number }[];
  onBuy: (itemId: string, quantity: number) => void;
  onSell: (itemId: string, quantity: number) => void;
  onClose: () => void;
}


export function MerchantShop({ npcId, merchantInventory, playerGold, playerInventory, onBuy, onSell, onClose }: MerchantShopProps) {
  const { t } = useTranslation();
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState<number>(1);

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val)) {
      setQuantity(Math.max(1, Math.min(999, val)));
    }
  };

  return (
    <Box
      pos="fixed"
      top="50%"
      left="50%"
      transform="translate(-50%, -50%)"
      bg={P.bg}
      backdropFilter="blur(10px)"
      border="1px solid"
      borderColor={P.gold}
      borderRadius="8px"
      p="6"
      minW="550px"
      maxH="85vh"
      overflowY="auto"
      boxShadow="0 0 60px rgba(0,0,0,0.9), inset 0 0 20px rgba(212, 168, 67, 0.1)"
      fontFamily={P.font}
      zIndex="200"
      animation="fadeIn 0.3s ease-out"
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, -48%); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${P.goldDark}; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: ${P.gold}; }
      `}</style>

      <Flex justify="space-between" align="center" mb="6">
        <Text color={P.gold} fontSize="24px" fontWeight="700" letterSpacing="3px" textShadow={`0 0 10px ${P.goldDark}`}>
          {t("ui.merchant.title")}
        </Text>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onClose} 
          color={P.gold} 
          p="0" 
          minW="32px"
          _hover={{ bg: "whiteAlpha.100", transform: "scale(1.1)" }}
          transition="all 0.2s"
        >
          ✕
        </Button>
      </Flex>

      <Flex mb="6" justify="space-between" bg="blackAlpha.400" p="3" borderRadius="4px" border="1px solid" borderColor={P.border}>
        <Text color={P.goldDim} fontSize="14px" fontWeight="bold">
          {t("ui.merchant.purse")}: <Text as="span" color={P.gold} fontSize="16px" ml="2">{playerGold.toLocaleString()} GP</Text>
        </Text>
      </Flex>

      <Flex mb="6" borderBottom="1px solid" borderColor={P.border}>
        <Box
          px="8"
          py="3"
          cursor="pointer"
          fontWeight="bold"
          letterSpacing="1px"
          transition="all 0.3s"
          color={tab === "buy" ? P.gold : P.goldDark}
          borderBottom={tab === "buy" ? "3px solid" : "none"}
          borderColor={P.gold}
          _hover={{ color: P.gold }}
          onClick={() => { setTab("buy"); setSelectedItem(null); setQuantity(1); }}
        >
          {t("ui.merchant.tab_buy")}
        </Box>
        <Box
          px="8"
          py="3"
          cursor="pointer"
          fontWeight="bold"
          letterSpacing="1px"
          transition="all 0.3s"
          color={tab === "sell" ? P.gold : P.goldDark}
          borderBottom={tab === "sell" ? "3px solid" : "none"}
          borderColor={P.gold}
          _hover={{ color: P.gold }}
          onClick={() => { setTab("sell"); setSelectedItem(null); setQuantity(1); }}
        >
          {t("ui.merchant.tab_sell")}
        </Box>
      </Flex>

      <Box minH="300px">
        {tab === "buy" ? (
          <Grid templateColumns="repeat(2, 1fr)" gap="4">
            {merchantInventory.map((itemId) => {
              const item = ITEMS[itemId];
              if (!item) return null;
              const isSelected = selectedItem?.id === itemId;
              return (
                <Box
                  key={itemId}
                  p="3"
                  bg={isSelected ? "whiteAlpha.100" : P.raised}
                  border="1px solid"
                  borderColor={isSelected ? P.gold : P.border}
                  borderRadius="4px"
                  cursor="pointer"
                  transition="all 0.2s"
                  _hover={{ borderColor: P.goldDim, transform: "translateY(-2px)", boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}
                  onClick={() => { setSelectedItem(item); setQuantity(1); }}
                >
                  <Flex align="center">
                    <Box 
                      w="40px" 
                      h="40px" 
                      bg="#000" 
                      mr="4" 
                      border="1px solid" 
                      borderColor={isSelected ? P.gold : P.border}
                      boxShadow={isSelected ? `0 0 10px ${P.goldDark}` : "none"}
                    ></Box>
                    <Box>
                      <Text color="#fff" fontSize="13px" fontWeight="bold">{t(item.name)}</Text>
                      <Text color={P.gold} fontSize="12px">{item.goldValue.toLocaleString()} GP</Text>
                    </Box>
                  </Flex>
                </Box>
              );
            })}
          </Grid>
        ) : (
          <Grid templateColumns="repeat(2, 1fr)" gap="4">
            {playerInventory.length === 0 && (
              <Box gridColumn="span 2" py="10" textAlign="center">
                <Text color="#555" fontSize="14px" fontStyle="italic">{t("ui.merchant.no_items_sell")}</Text>
              </Box>
            )}
            {playerInventory.map((invItem, idx) => {
              const item = ITEMS[invItem.itemId];
              if (!item) return null;
              const isSelected = selectedItem?.id === invItem.itemId;
              return (
                <Box
                  key={`${invItem.itemId}-${idx}`}
                  p="3"
                  bg={isSelected ? "whiteAlpha.100" : P.raised}
                  border="1px solid"
                  borderColor={isSelected ? P.gold : P.border}
                  borderRadius="4px"
                  cursor="pointer"
                  transition="all 0.2s"
                  _hover={{ borderColor: P.goldDim, transform: "translateY(-2px)" }}
                  onClick={() => { setSelectedItem(item); setQuantity(1); }}
                >
                  <Flex align="center">
                    <Box w="40px" h="40px" bg="#000" mr="4" border="1px solid" borderColor={P.border}></Box>
                    <Box>
                      <Text color="#fff" fontSize="13px" fontWeight="bold">{t(item.name)} <Text as="span" color="whiteAlpha.600">(x{invItem.quantity})</Text></Text>
                      <Text color={P.gold} fontSize="12px">{t("ui.merchant.value_label")}: {Math.floor(item.goldValue * 0.5).toLocaleString()} GP</Text>
                    </Box>
                  </Flex>
                </Box>
              );
            })}
          </Grid>
        )}
      </Box>

      {selectedItem && (
        <Box 
          mt="8" 
          p="5" 
          border="1px solid" 
          borderColor={P.gold} 
          borderRadius="6px" 
          bg="blackAlpha.600"
          boxShadow={`0 0 20px ${P.goldDark}22`}
        >
          <Flex justify="space-between" align="start" mb="4">
            <Box>
              <Text color={P.gold} fontSize="18px" fontWeight="bold" mb="1">{t(selectedItem.name)}</Text>
              <Text color="whiteAlpha.600" fontSize="12px" letterSpacing="1px">
                {selectedItem.slot.toUpperCase()} | {selectedItem.rarity.toUpperCase()}
              </Text>
            </Box>
            <Box textAlign="right">
              <Text color="#fff" fontSize="12px" mb="1">{t("ui.merchant.unit_price")}</Text>
              <Text color={P.gold} fontSize="16px" fontWeight="bold">
                {tab === "buy" ? selectedItem.goldValue : Math.floor(selectedItem.goldValue * 0.5)} GP
              </Text>
            </Box>
          </Flex>

          <Flex align="center" mb="6" bg="blackAlpha.300" p="3" borderRadius="4px" border="1px solid" borderColor="whiteAlpha.100">
            <Text color="whiteAlpha.800" fontSize="13px" mr="6">{t("ui.merchant.quantity")}:</Text>
            <Flex align="center" flex="1">
              <Button 
                size="sm" 
                variant="outline" 
                borderColor={P.goldDark} 
                color={P.gold}
                _hover={{ bg: P.goldDark, color: "white" }}
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                -
              </Button>
              <Input
                value={quantity}
                onChange={handleQtyChange}
                h="32px"
                w="60px"
                mx="3"
                textAlign="center"
                bg="transparent"
                border="1px solid"
                borderColor={P.goldDark}
                color="#fff"
                _focus={{ borderColor: P.gold, boxShadow: "none" }}
              />
              <Button 
                size="sm" 
                variant="outline" 
                borderColor={P.goldDark} 
                color={P.gold}
                _hover={{ bg: P.goldDark, color: "white" }}
                onClick={() => setQuantity(Math.min(999, quantity + 1))}
              >
                +
              </Button>
            </Flex>
            <Box textAlign="right" ml="6">
              <Text color="whiteAlpha.600" fontSize="11px">{t("ui.merchant.total_cost")}</Text>
              <Text color={P.gold} fontSize="20px" fontWeight="bold">
                {(tab === "buy" ? selectedItem.goldValue * quantity : Math.floor(selectedItem.goldValue * 0.5) * quantity).toLocaleString()} GP
              </Text>
            </Box>
          </Flex>

          <Button
            w="100%"
            h="48px"
            bg={P.goldDim}
            color="#000"
            fontSize="16px"
            fontWeight="bold"
            letterSpacing="2px"
            _hover={{ bg: P.gold, transform: "scale(1.02)" }}
            _active={{ bg: P.goldDark, transform: "scale(0.98)" }}
            transition="all 0.2s"
            onClick={() => {
              if (tab === "buy") onBuy(selectedItem.id, quantity);
              else onSell(selectedItem.id, quantity);
            }}
          >
            {tab === "buy" ? t("ui.merchant.confirm_buy") : t("ui.merchant.confirm_sell")}
          </Button>
        </Box>
      )}
    </Box>
  );
}

import React, { useState } from "react";
import { Box, Flex, Text, Grid, Input } from "@chakra-ui/react";
import { Button } from "./components/Button";
import { ITEMS, type Item } from "@abraxas/shared";
import { useTranslation } from "react-i18next";
import { useAudio } from "../contexts/AudioContext";
import { ItemGrid } from "./components/ItemGrid";

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
  const { playUIClick, playUIHover } = useAudio();
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState<number>(1);

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!Number.isNaN(val)) {
      setQuantity(Math.max(1, Math.min(999, val)));
    }
  };

  return (
    <Box
      pos="fixed"
      top="50%"
      left="50%"
      transform="translate(-50%, -50%)"
      bg={T.bg}
      backdropFilter="blur(10px)"
      border="1px solid"
      borderColor={T.gold}
      borderRadius="8px"
      p={{ base: "4", md: "6" }}
      w={{ base: "calc(100vw - 32px)", md: "550px" }}
      maxH="85dvh"
      overflowY="auto"
      boxShadow="0 0 60px rgba(0,0,0,0.9), inset 0 0 20px rgba(212, 168, 67, 0.1)"
      fontFamily={T.display}
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
        ::-webkit-scrollbar-thumb { background: ${HEX.goldDark}; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: ${HEX.gold}; }
      `}</style>

      <Flex justify="space-between" align="center" mb="6">
        <Text color={T.gold} fontSize="24px" fontWeight="700" letterSpacing="3px" textShadow={`0 0 10px ${HEX.goldDark}`}>
          {t("ui.merchant.title")}
        </Text>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onClose} 
          color={T.gold} 
          p="0" 
          minW="32px"
          _hover={{ bg: "whiteAlpha.100", transform: "scale(1.1)" }}
          transition="all 0.2s"
        >
          ✕
        </Button>
      </Flex>

      <Flex mb="6" justify="space-between" bg="blackAlpha.400" p="3" borderRadius="4px" border="1px solid" borderColor={T.border}>
        <Text color={T.goldDim} fontSize="14px" fontWeight="bold">
          {t("ui.merchant.purse")}: <Text as="span" color={T.gold} fontSize="16px" ml="2">{playerGold.toLocaleString()} GP</Text>
        </Text>
      </Flex>

      <Flex mb="6" borderBottom="1px solid" borderColor={T.border}>
        <Box
          px="8"
          py="3"
          cursor="pointer"
          fontWeight="bold"
          letterSpacing="1px"
          transition="all 0.3s"
          color={tab === "buy" ? T.gold : T.goldDark}
          borderBottom={tab === "buy" ? "3px solid" : "none"}
          borderColor={T.gold}
          _hover={{ color: T.gold }}
          onMouseEnter={() => { if (tab !== "buy") playUIHover?.(); }}
          onClick={() => { playUIClick?.(); setTab("buy"); setSelectedItem(null); setQuantity(1); }}
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
          color={tab === "sell" ? T.gold : T.goldDark}
          borderBottom={tab === "sell" ? "3px solid" : "none"}
          borderColor={T.gold}
          _hover={{ color: T.gold }}
          onMouseEnter={() => { if (tab !== "sell") playUIHover?.(); }}
          onClick={() => { playUIClick?.(); setTab("sell"); setSelectedItem(null); setQuantity(1); }}
        >
          {t("ui.merchant.tab_sell")}
        </Box>
      </Flex>

      <Box minH="300px">
        {tab === "buy" ? (
          <ItemGrid
            slots={merchantInventory.map((id, i) => ({ itemId: id, quantity: 1, slotIndex: i }))}
            selectedSlotIndex={selectedItem ? merchantInventory.indexOf(selectedItem.id) : null}
            onSelect={(slot) => {
              const item = ITEMS[slot.itemId];
              if (item) {
                setSelectedItem(item);
                setQuantity(1);
              }
            }}
            maxSlots={merchantInventory.length}
          />
        ) : (
          <>
            {playerInventory.length === 0 && (
              <Box py="10" textAlign="center">
                <Text color="#555" fontSize="14px" fontStyle="italic">{t("ui.merchant.no_items_sell")}</Text>
              </Box>
            )}
            {playerInventory.length > 0 && (
              <ItemGrid
                slots={playerInventory.map((item, i) => ({ ...item, slotIndex: i }))}
                selectedSlotIndex={selectedItem ? playerInventory.findIndex(i => i.itemId === selectedItem.id) : null}
                onSelect={(slot) => {
                  const item = ITEMS[slot.itemId];
                  if (item) {
                    setSelectedItem(item);
                    setQuantity(1);
                  }
                }}
                maxSlots={Math.max(24, Math.ceil(playerInventory.length / 6) * 6)}
              />
            )}
          </>
        )}
      </Box>

      {selectedItem && (
        <Box 
          mt="8" 
          p="5" 
          border="1px solid" 
          borderColor={T.gold} 
          borderRadius="6px" 
          bg="blackAlpha.600"
          boxShadow={`0 0 20px ${HEX.goldDark}22`}
        >
          <Flex justify="space-between" align="start" mb="4">
            <Box>
              <Text color={T.gold} fontSize="18px" fontWeight="bold" mb="1">{t(selectedItem.name)}</Text>
              <Text color="whiteAlpha.600" fontSize="12px" letterSpacing="1px">
                {t(`item_slot.${selectedItem.slot}`).toUpperCase()} | {t(`item_rarity.${selectedItem.rarity}`).toUpperCase()}
              </Text>
            </Box>
            <Box textAlign="right">
              <Text color="#fff" fontSize="12px" mb="1">{t("ui.merchant.unit_price")}</Text>
              <Text color={T.gold} fontSize="16px" fontWeight="bold">
                {tab === "buy" ? selectedItem.goldValue : Math.floor(selectedItem.goldValue * 0.5)} GP
              </Text>
            </Box>
          </Flex>

          <Flex align="center" mb="6" bg="blackAlpha.300" p="3" borderRadius="4px" border="1px solid" borderColor="whiteAlpha.100" flexWrap="wrap" gap="3">
            <Text color="whiteAlpha.800" fontSize="13px">{t("ui.merchant.quantity")}:</Text>
            <Flex align="center" flex="1" minW="120px">
              <Button 
                size="sm" 
                variant="outline" 
                borderColor={T.goldDark} 
                color={T.gold}
                _hover={{ bg: T.goldDark, color: "white" }}
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
                borderColor={T.goldDark}
                color="#fff"
                _focus={{ borderColor: T.gold, boxShadow: "none" }}
              />
              <Button 
                size="sm" 
                variant="outline" 
                borderColor={T.goldDark} 
                color={T.gold}
                _hover={{ bg: T.goldDark, color: "white" }}
                onClick={() => setQuantity(Math.min(999, quantity + 1))}
              >
                +
              </Button>
            </Flex>
            <Box textAlign="right" ml={{ base: "0", md: "6" }}>
              <Text color="whiteAlpha.600" fontSize="11px">{t("ui.merchant.total_cost")}</Text>
              <Text color={T.gold} fontSize="20px" fontWeight="bold">
                {(tab === "buy" ? selectedItem.goldValue * quantity : Math.floor(selectedItem.goldValue * 0.5) * quantity).toLocaleString()} GP
              </Text>
            </Box>
          </Flex>

          <Button
            w="100%"
            h="48px"
            bg={T.goldDim}
            color="#000"
            fontSize="16px"
            fontWeight="bold"
            letterSpacing="2px"
            _hover={{ bg: T.gold, transform: "scale(1.02)" }}
            _active={{ bg: T.goldDark, transform: "scale(0.98)" }}
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

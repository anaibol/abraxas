import { ITEMS, type Item } from "@abraxas/shared";
import { Box, Flex, Input, Text } from "@chakra-ui/react";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAudio } from "../contexts/AudioContext";
import { Button } from "./components/Button";
import { ItemGrid } from "./components/ItemGrid";
import { ModalOverlay } from "./components/ModalOverlay";
import { PanelHeader } from "./components/PanelHeader";
import { HEX, T } from "./tokens";

interface MerchantShopProps {
  npcId: string;
  merchantInventory: string[];
  playerGold: number;
  playerInventory: { itemId: string; quantity: number }[];
  onBuy: (itemId: string, quantity: number) => void;
  onSell: (itemId: string, quantity: number, npcId?: string) => void;
  onClose: () => void;
}

export function MerchantShop({
  npcId,
  merchantInventory,
  playerGold,
  playerInventory,
  onBuy,
  onSell,
  onClose,
}: MerchantShopProps) {
  const { t } = useTranslation();
  const { playUIClick, playUIHover, playCoins } = useAudio();
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
    <ModalOverlay
      onClose={onClose}
      panelProps={{
        p: { base: "4", md: "6" },
        w: { base: "calc(100vw - 32px)", md: "550px" },
        maxH: "85dvh",
        overflowY: "auto",
        css: {
          "&::-webkit-scrollbar": { width: "6px" },
          "&::-webkit-scrollbar-track": { background: "transparent" },
          "&::-webkit-scrollbar-thumb": { background: HEX.goldDark, borderRadius: "10px" },
          "&::-webkit-scrollbar-thumb:hover": { background: HEX.gold },
        },
      }}
    >
      <PanelHeader title={t("ui.merchant.title")} onClose={onClose} />

      <Flex
        mb="6"
        justify="space-between"
        bg="blackAlpha.400"
        p="3"
        borderRadius="4px"
        border="1px solid"
        borderColor={T.border}
      >
        <Text color={T.goldDim} textStyle={T.bodyText} fontWeight="700">
          {t("ui.merchant.purse")}:{" "}
          <Text as="span" color={T.gold} textStyle={T.heading} ml="2">
            {playerGold.toLocaleString()} GP
          </Text>
        </Text>
      </Flex>

      <Flex mb="6" borderBottom="1px solid" borderColor={T.border}>
        <Box
          px="8"
          py="3"
          cursor="pointer"
          fontWeight="700"
          letterSpacing="1px"
          transition="all 0.3s"
          color={tab === "buy" ? T.gold : T.goldDark}
          borderBottom={tab === "buy" ? "3px solid" : "none"}
          borderColor={T.gold}
          _hover={{ color: T.gold }}
          onMouseEnter={() => {
            if (tab !== "buy") playUIHover?.();
          }}
          onClick={() => {
            playUIClick?.();
            setTab("buy");
            setSelectedItem(null);
            setQuantity(1);
          }}
        >
          {t("ui.merchant.tab_buy")}
        </Box>
        <Box
          px="8"
          py="3"
          cursor="pointer"
          fontWeight="700"
          letterSpacing="1px"
          transition="all 0.3s"
          color={tab === "sell" ? T.gold : T.goldDark}
          borderBottom={tab === "sell" ? "3px solid" : "none"}
          borderColor={T.gold}
          _hover={{ color: T.gold }}
          onMouseEnter={() => {
            if (tab !== "sell") playUIHover?.();
          }}
          onClick={() => {
            playUIClick?.();
            setTab("sell");
            setSelectedItem(null);
            setQuantity(1);
          }}
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
                <Text color="#555" textStyle={T.bodyText} fontStyle="italic">
                  {t("ui.merchant.no_items_sell")}
                </Text>
              </Box>
            )}
            {playerInventory.length > 0 && (
              <ItemGrid
                slots={playerInventory.map((item, i) => ({ ...item, slotIndex: i }))}
                selectedSlotIndex={
                  selectedItem
                    ? playerInventory.findIndex((i) => i.itemId === selectedItem.id)
                    : null
                }
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
              <Text color={T.gold} textStyle={T.heading} fontSize="18px" mb="1">
                {t(selectedItem.name)}
              </Text>
              <Text color="whiteAlpha.600" textStyle={T.bodyMuted} letterSpacing="1px">
                {t(`item_slot.${selectedItem.slot}`).toUpperCase()} |{" "}
                {t(`item_rarity.${selectedItem.rarity}`).toUpperCase()}
              </Text>
            </Box>
            <Box textAlign="right">
              <Text color="#fff" textStyle={T.bodyMuted} mb="1">
                {t("ui.merchant.unit_price")}
              </Text>
              <Text color={T.gold} textStyle={T.heading}>
                {tab === "buy" ? selectedItem.goldValue : Math.floor(selectedItem.goldValue * 0.5)}{" "}
                GP
              </Text>
            </Box>
          </Flex>

          <Flex
            align="center"
            mb="6"
            bg="blackAlpha.300"
            p="3"
            borderRadius="4px"
            border="1px solid"
            borderColor="whiteAlpha.100"
            flexWrap="wrap"
            gap="3"
          >
            <Text color="whiteAlpha.800" textStyle={T.bodyText}>
              {t("ui.merchant.quantity")}:
            </Text>
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
              <Text color="whiteAlpha.600" textStyle={T.statLabel}>
                {t("ui.merchant.total_cost")}
              </Text>
              <Text color={T.gold} textStyle={T.headingLg}>
                {(tab === "buy"
                  ? selectedItem.goldValue * quantity
                  : Math.floor(selectedItem.goldValue * 0.5) * quantity
                ).toLocaleString()}{" "}
                GP
              </Text>
            </Box>
          </Flex>

          <Button
            w="100%"
            h="48px"
            bg={T.goldDim}
            color="#000"
            textStyle={T.heading}
            fontWeight="700"
            letterSpacing="2px"
            _hover={{ bg: T.gold, transform: "scale(1.02)" }}
            _active={{ bg: T.goldDark, transform: "scale(0.98)" }}
            transition="all 0.2s"
            onClick={() => {
              playCoins?.();
              if (tab === "buy") onBuy(selectedItem.id, quantity);
              else onSell(selectedItem.id, quantity, npcId);
            }}
          >
            {tab === "buy" ? t("ui.merchant.confirm_buy") : t("ui.merchant.confirm_sell")}
          </Button>
        </Box>
      )}
    </ModalOverlay>
  );
}

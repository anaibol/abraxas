import type { TradeState } from "@abraxas/shared";
import { ITEMS } from "@abraxas/shared";
import { Box, Flex, Grid, HStack, Input, Text, VStack } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAudio } from "../contexts/AudioContext";
import { Button } from "./components/Button";
import { ItemGrid } from "./components/ItemGrid";
import type { InventorySlot } from "./sidebar/types";
import { T } from "./tokens";

const ITEM_ICONS: Record<string, string> = {
  weapon: "⚔️",
  armor: "🛡️",
  shield: "🛡️",
  helmet: "⛑️",
  ring: "💍",
  consumable: "🧪",
};

type OfferItem = { itemId: string; quantity: number };

interface TradeWindowProps {
  trade: TradeState;
  mySessionId: string;
  playerInventory: InventorySlot[];
  playerGold: number;
  onUpdateOffer: (gold: number, items: OfferItem[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TradeWindow({
  trade,
  mySessionId,
  playerInventory,
  playerGold,
  onUpdateOffer,
  onConfirm,
  onCancel,
}: TradeWindowProps) {
  const { t } = useTranslation();
  const { playUIClick, playUIHover } = useAudio();
  const isAlice = trade.alice.sessionId === mySessionId;
  const me = isAlice ? trade.alice : trade.bob;
  const them = isAlice ? trade.bob : trade.alice;

  const [offerGold, setOfferGold] = useState(me.offer.gold);
  const [offerItems, setOfferItems] = useState<OfferItem[]>(me.offer.items);

  // Sync local gold/items when server resets them (e.g. other side changes offer)
  useEffect(() => {
    setOfferGold(me.offer.gold);
    setOfferItems(me.offer.items);
  }, [me.offer.gold, me.offer.items]);

  const pushOffer = (gold: number, items: OfferItem[]) => {
    onUpdateOffer(gold, items);
  };

  const addItem = (slot: InventorySlot) => {
    const existing = offerItems.find((i) => i.itemId === slot.itemId);
    let next: OfferItem[];
    if (existing) {
      if (existing.quantity >= slot.quantity) return;
      next = offerItems.map((i) =>
        i.itemId === slot.itemId ? { ...i, quantity: i.quantity + 1 } : i,
      );
    } else {
      next = [...offerItems, { itemId: slot.itemId, quantity: 1 }];
    }
    setOfferItems(next);
    pushOffer(offerGold, next);
  };

  const removeItem = (itemId: string) => {
    const next = offerItems
      .map((i) => (i.itemId === itemId ? { ...i, quantity: i.quantity - 1 } : i))
      .filter((i) => i.quantity > 0);
    setOfferItems(next);
    pushOffer(offerGold, next);
  };

  const handleGoldChange = (val: number) => {
    const clamped = Math.max(0, Math.min(val, playerGold));
    setOfferGold(clamped);
    pushOffer(clamped, offerItems);
  };

  const myConfirmed = me.offer.confirmed;
  const theirConfirmed = them.offer.confirmed;

  const renderOfferSlots = (
    items: OfferItem[],
    gold: number,
    label: string,
    confirmed: boolean,
  ) => (
    <Box flex="1" minW="0">
      <Flex justify="space-between" align="center" mb="2">
        <Text
          fontSize="12px"
          letterSpacing="2px"
          color={T.gold}
          textTransform="uppercase"
          fontWeight="700"
        >
          {label}
        </Text>
        {confirmed && (
          <Text fontSize="11px" color="#44ff88" letterSpacing="1px" fontWeight="700">
            {t("trade.confirmed_badge")}
          </Text>
        )}
      </Flex>
      <Box
        minH="100px"
        bg={T.darkest}
        border="1px solid"
        borderColor={T.border}
        borderRadius="2px"
        p="2"
      >
        {gold > 0 && (
          <Flex align="center" gap="2" mb="1.5" p="1.5" bg={T.surface} borderRadius="2px">
            <Text fontSize="13px">🪙</Text>
            <Text fontSize="12px" color={T.gold} fontFamily={T.mono}>
              {gold}g
            </Text>
          </Flex>
        )}
        {items.length === 0 && gold === 0 && (
          <Text fontSize="12px" color={T.goldDark} textAlign="center" pt="3" fontStyle="italic">
            {t("trade.nothing_offered")}
          </Text>
        )}
        {items.map((item) => {
          const def = ITEMS[item.itemId];
          return (
            <Flex
              key={item.itemId}
              align="center"
              gap="2"
              mb="1"
              p="1.5"
              bg={T.surface}
              borderRadius="2px"
            >
              <Text fontSize="13px">{def ? ITEM_ICONS[def.slot] || "✨" : "❓"}</Text>
              <Text fontSize="12px" color={T.goldText} flex="1">
                {def?.name ?? item.itemId}
              </Text>
              {item.quantity > 1 && (
                <Text fontSize="11px" color={T.goldDark} fontFamily={T.mono}>
                  ×{item.quantity}
                </Text>
              )}
            </Flex>
          );
        })}
      </Box>
    </Box>
  );

  return (
    <Box
      pos="fixed"
      inset="0"
      zIndex={300}
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="rgba(0,0,0,0.7)"
    >
      <Box
        layerStyle={T.panelGlass}
        animation="popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards"
        w={{ base: "calc(100vw - 32px)", md: "560px" }}
        maxH="90dvh"
        overflowY="auto"
        fontFamily={T.display}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <Box
          px="5"
          py="3"
          bg={T.surface}
          borderBottom="1px solid"
          borderBottomColor={T.border}
          textAlign="center"
        >
          <Text
            fontSize="13px"
            fontWeight="700"
            color={T.gold}
            letterSpacing="3px"
            textTransform="uppercase"
          >
            {t("trade.title")}
          </Text>
          <Text fontSize="12px" color={T.goldDark} mt="0.5">
            {me.name} ↔ {them.name}
          </Text>
        </Box>

        {/* Offer panels */}
        <Flex gap="3" p="4" direction={{ base: "column", sm: "row" }}>
          {renderOfferSlots(me.offer.items, me.offer.gold, t("trade.your_offer"), myConfirmed)}
          <Box
            w={{ base: "100%", sm: "1px" }}
            h={{ base: "1px", sm: "auto" }}
            bg={T.border}
            flexShrink={0}
          />
          {renderOfferSlots(
            them.offer.items,
            them.offer.gold,
            t("trade.their_offer", { name: them.name }),
            theirConfirmed,
          )}
        </Flex>

        {/* Your gold input */}
        <Box px="4" pb="3" borderTop="1px solid" borderTopColor={T.raised}>
          <Text
            fontSize="11px"
            color={T.goldDark}
            letterSpacing="2px"
            textTransform="uppercase"
            mt="3"
            mb="1.5"
          >
            {t("trade.offer_gold", { gold: playerGold })}
          </Text>
          <HStack gap="2">
            <Input
              type="number"
              min={0}
              max={playerGold}
              value={offerGold}
              onChange={(e) => handleGoldChange(Number(e.target.value))}
              size="xs"
              bg={T.darkest}
              borderColor={T.border}
              color={T.gold}
              fontFamily={T.mono}
              w="100px"
              _focus={{ borderColor: T.gold }}
              disabled={myConfirmed}
            />
            <Text fontSize="12px" color={T.goldDark}>
              {t("trade.gold")}
            </Text>
          </HStack>
        </Box>

        {/* Inventory — click to add items */}
        {!myConfirmed && (
          <Box px="4" pb="3">
            <Text
              fontSize="11px"
              color={T.goldDark}
              letterSpacing="2px"
              textTransform="uppercase"
              mb="1.5"
            >
              {t("trade.add_items_hint")}
            </Text>
            <ItemGrid
              slots={playerInventory
                .map((slot) => {
                  const inOffer = offerItems.find((i) => i.itemId === slot.itemId);
                  const availableQty = slot.quantity - (inOffer?.quantity ?? 0);
                  return { ...slot, quantity: availableQty };
                })
                .filter((slot) => slot.quantity > 0)}
              selectedSlotIndex={null}
              onSelect={(slot) => addItem(slot)}
              maxSlots={Math.max(24, Math.ceil(playerInventory.length / 8) * 8)}
            />
            {/* Click items in offer to remove */}
            {offerItems.length > 0 && (
              <Box mt="2">
                <Text fontSize="11px" color={T.goldDark} mb="1">
                  {t("trade.offered_items")}
                </Text>
                <HStack gap="1" flexWrap="wrap">
                  {offerItems.map((item) => {
                    const def = ITEMS[item.itemId];
                    return (
                      <Box
                        key={item.itemId}
                        px="2"
                        py="1"
                        bg={T.surface}
                        border="1px solid"
                        borderColor={T.border}
                        borderRadius="2px"
                        cursor="pointer"
                        fontSize="12px"
                        color={T.goldText}
                        onMouseEnter={() => playUIHover?.()}
                        onClick={() => {
                          playUIClick?.();
                          removeItem(item.itemId);
                        }}
                        _hover={{ borderColor: "red.400", color: "red.400" }}
                      >
                        {def?.name ?? item.itemId}
                        {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                      </Box>
                    );
                  })}
                </HStack>
              </Box>
            )}
          </Box>
        )}

        {/* Actions */}
        <Flex px="4" pb="4" gap="3" borderTop="1px solid" borderTopColor={T.raised} pt="3">
          {myConfirmed ? (
            <VStack flex="1" gap="1" align="stretch">
              <Text fontSize="12px" color="#44ff88" textAlign="center" fontWeight="700">
                {t("trade.waiting_for", { name: them.name })}
              </Text>
              <Button
                size="xs"
                variant="outline"
                borderColor={T.blood}
                color="red.400"
                _hover={{ bg: T.blood }}
                onClick={onCancel}
              >
                {t("trade.cancel_trade")}
              </Button>
            </VStack>
          ) : (
            <>
              <Button
                flex="1"
                size="sm"
                bg={T.goldDark}
                color={T.gold}
                border="1px solid"
                borderColor={T.gold}
                fontFamily={T.display}
                fontWeight="700"
                fontSize="13px"
                letterSpacing="1px"
                _hover={{ bg: T.gold, color: "#000" }}
                onClick={onConfirm}
              >
                {t("trade.confirm_trade")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                borderColor={T.blood}
                color="red.400"
                fontFamily={T.display}
                fontSize="13px"
                _hover={{ bg: T.blood }}
                onClick={onCancel}
              >
                {t("trade.cancel")}
              </Button>
            </>
          )}
        </Flex>
      </Box>
    </Box>
  );
}

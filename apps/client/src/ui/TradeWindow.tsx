import { useState, useEffect } from "react";
import { Box, Flex, Text, Grid, Button, Input, VStack, HStack } from "@chakra-ui/react";
import { ITEMS } from "@abraxas/shared";
import type { TradeState } from "@abraxas/shared";
import type { InventorySlot } from "./Sidebar";
import { P } from "./palette";


const ITEM_ICONS: Record<string, string> = {
  weapon: "⚔️", armor: "🛡️", shield: "🛡️", helmet: "⛑️",
  ring: "💍", consumable: "🧪",
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
        i.itemId === slot.itemId ? { ...i, quantity: i.quantity + 1 } : i
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

  const renderOfferSlots = (items: OfferItem[], gold: number, label: string, confirmed: boolean) => (
    <Box flex="1" minW="0">
      <Flex justify="space-between" align="center" mb="2">
        <Text fontSize="12px" letterSpacing="2px" color={P.gold} textTransform="uppercase" fontWeight="700">{label}</Text>
        {confirmed && (
          <Text fontSize="11px" color="#44ff88" letterSpacing="1px" fontWeight="700">✓ CONFIRMED</Text>
        )}
      </Flex>
      <Box minH="100px" bg={P.darkest} border="1px solid" borderColor={P.border} borderRadius="2px" p="2">
        {gold > 0 && (
          <Flex align="center" gap="2" mb="1.5" p="1.5" bg={P.surface} borderRadius="2px">
            <Text fontSize="13px">🪙</Text>
            <Text fontSize="12px" color={P.gold} fontFamily={P.mono}>{gold}g</Text>
          </Flex>
        )}
        {items.length === 0 && gold === 0 && (
          <Text fontSize="12px" color={P.goldDark} textAlign="center" pt="3" fontStyle="italic">Nothing offered</Text>
        )}
        {items.map((item) => {
          const def = ITEMS[item.itemId];
          return (
            <Flex key={item.itemId} align="center" gap="2" mb="1" p="1.5" bg={P.surface} borderRadius="2px">
              <Text fontSize="13px">{def ? (ITEM_ICONS[def.slot] || "✨") : "❓"}</Text>
              <Text fontSize="12px" color={P.goldText} flex="1">{def?.name ?? item.itemId}</Text>
              {item.quantity > 1 && (
                <Text fontSize="11px" color={P.goldDark} fontFamily={P.mono}>×{item.quantity}</Text>
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
        w="560px"
        bg={P.bg}
        border="2px solid"
        borderColor={P.border}
        borderRadius="4px"
        fontFamily={P.font}
        boxShadow="0 8px 40px rgba(0,0,0,0.8)"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <Box px="5" py="3" bg={P.surface} borderBottom="1px solid" borderBottomColor={P.border} textAlign="center">
          <Text fontSize="13px" fontWeight="700" color={P.gold} letterSpacing="3px" textTransform="uppercase">
            Trade
          </Text>
          <Text fontSize="12px" color={P.goldDark} mt="0.5">
            {me.name} ↔ {them.name}
          </Text>
        </Box>

        {/* Offer panels */}
        <Flex gap="3" p="4">
          {renderOfferSlots(me.offer.items, me.offer.gold, "Your Offer", myConfirmed)}
          <Box w="1px" bg={P.border} flexShrink={0} />
          {renderOfferSlots(them.offer.items, them.offer.gold, `${them.name}'s Offer`, theirConfirmed)}
        </Flex>

        {/* Your gold input */}
        <Box px="4" pb="3" borderTop="1px solid" borderTopColor={P.raised}>
          <Text fontSize="11px" color={P.goldDark} letterSpacing="2px" textTransform="uppercase" mt="3" mb="1.5">
            Offer Gold (you have {playerGold}g)
          </Text>
          <HStack gap="2">
            <Input
              type="number"
              min={0}
              max={playerGold}
              value={offerGold}
              onChange={(e) => handleGoldChange(Number(e.target.value))}
              size="xs"
              bg={P.darkest}
              borderColor={P.border}
              color={P.gold}
              fontFamily={P.mono}
              w="100px"
              _focus={{ borderColor: P.gold }}
              disabled={myConfirmed}
            />
            <Text fontSize="12px" color={P.goldDark}>gold</Text>
          </HStack>
        </Box>

        {/* Inventory — click to add items */}
        {!myConfirmed && (
          <Box px="4" pb="3">
            <Text fontSize="11px" color={P.goldDark} letterSpacing="2px" textTransform="uppercase" mb="1.5">
              Add Items (click to add · click offer to remove)
            </Text>
            <Grid templateColumns="repeat(8, 1fr)" gap="1">
              {playerInventory.map((slot) => {
                const def = ITEMS[slot.itemId];
                const inOffer = offerItems.find((i) => i.itemId === slot.itemId);
                const availableQty = slot.quantity - (inOffer?.quantity ?? 0);
                return (
                  <Box
                    key={slot.slotIndex}
                    aspectRatio="1"
                    bg={P.darkest}
                    border="1px solid"
                    borderColor={inOffer ? P.gold : P.border}
                    borderRadius="2px"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    cursor={availableQty > 0 ? "pointer" : "not-allowed"}
                    opacity={availableQty > 0 ? 1 : 0.4}
                    title={def ? `${def.name}${slot.quantity > 1 ? ` (${availableQty} available)` : ""}` : ""}
                    onClick={() => availableQty > 0 && addItem(slot)}
                    _hover={availableQty > 0 ? { borderColor: P.gold, bg: P.surface } : {}}
                    pos="relative"
                    fontSize="14px"
                  >
                    {def ? (ITEM_ICONS[def.slot] || "✨") : ""}
                    {slot.quantity > 1 && (
                      <Text pos="absolute" bottom="0" right="1px" fontSize="10px" color="#fff" fontFamily={P.mono}>
                        {slot.quantity}
                      </Text>
                    )}
                  </Box>
                );
              })}
            </Grid>
            {/* Click items in offer to remove */}
            {offerItems.length > 0 && (
              <Box mt="2">
                <Text fontSize="11px" color={P.goldDark} mb="1">Offered items (click to remove):</Text>
                <HStack gap="1" flexWrap="wrap">
                  {offerItems.map((item) => {
                    const def = ITEMS[item.itemId];
                    return (
                      <Box
                        key={item.itemId}
                        px="2" py="1"
                        bg={P.surface}
                        border="1px solid" borderColor={P.border}
                        borderRadius="2px"
                        cursor="pointer"
                        fontSize="12px"
                        color={P.goldText}
                        onClick={() => removeItem(item.itemId)}
                        _hover={{ borderColor: "red.400", color: "red.400" }}
                      >
                        {def?.name ?? item.itemId}{item.quantity > 1 ? ` ×${item.quantity}` : ""}
                      </Box>
                    );
                  })}
                </HStack>
              </Box>
            )}
          </Box>
        )}

        {/* Actions */}
        <Flex px="4" pb="4" gap="3" borderTop="1px solid" borderTopColor={P.raised} pt="3">
          {myConfirmed ? (
            <VStack flex="1" gap="1" align="stretch">
              <Text fontSize="12px" color="#44ff88" textAlign="center" fontWeight="700">
                ✓ You confirmed. Waiting for {them.name}…
              </Text>
              <Button
                size="xs"
                variant="outline"
                borderColor={P.blood}
                color="red.400"
                _hover={{ bg: P.blood }}
                onClick={onCancel}
              >
                Cancel Trade
              </Button>
            </VStack>
          ) : (
            <>
              <Button
                flex="1"
                size="sm"
                bg={P.goldDark}
                color={P.gold}
                border="1px solid"
                borderColor={P.gold}
                fontFamily={P.font}
                fontWeight="700"
                fontSize="13px"
                letterSpacing="1px"
                _hover={{ bg: P.gold, color: "#000" }}
                onClick={onConfirm}
              >
                Confirm Trade
              </Button>
              <Button
                size="sm"
                variant="outline"
                borderColor={P.blood}
                color="red.400"
                fontFamily={P.font}
                fontSize="13px"
                _hover={{ bg: P.blood }}
                onClick={onCancel}
              >
                Cancel
              </Button>
            </>
          )}
        </Flex>
      </Box>
    </Box>
  );
}

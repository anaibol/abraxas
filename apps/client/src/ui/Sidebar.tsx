import { useState } from "react";
import { Box, Flex, Text, Grid, Input, Button, VStack, HStack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { CLASS_STATS, SPELLS, ITEMS, EQUIPMENT_SLOTS, type EquipmentSlot, type PlayerQuestState } from "@abraxas/shared";
import { QuestLog } from "./QuestLog";

export interface InventorySlot {
  itemId: string;
  quantity: number;
  slotIndex: number;
}

export interface EquipmentState {
  weapon: string;
  armor: string;
  shield: string;
  helmet: string;
  ring: string;
}

export interface PlayerState {
  name: string;
  classType: string;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  alive: boolean;
  str?: number;
  agi?: number;
  intStat?: number;
  gold?: number;
  stealthed?: boolean;
  stunned?: boolean;
  level?: number;
  xp?: number;
  maxXp?: number;
  inventory?: InventorySlot[];
  equipment?: EquipmentState;
}

const P = {
  bg: "#0e0c14",
  surface: "#14111e",
  raised: "#1a1628",
  darkest: "#08080c",
  border: "#2e2840",
  borderLight: "#3e3555",
  gold: "#d4a843",
  goldDim: "#b8962e",
  goldDark: "#6e5a18",
  goldMuted: "#8a7a60",
  goldText: "#c8b68a",
  blood: "#8b1a1a",
  bloodBright: "#c41e3a",
  arcane: "#1e3a8a",
  font: "'Friz Quadrata', Georgia, serif",
  mono: "'Consolas', monospace",
};

const SPELL_ICONS: Record<string, string> = {
  fireball: "\uD83D\uDD25",
  ice_bolt: "\u2744\uFE0F",
  thunderstorm: "\u26A1",
  mana_shield: "\uD83D\uDEE1\uFE0F",
  war_cry: "\uD83D\uDCE3",
  shield_bash: "\uD83D\uDEE1\uFE0F",
  multi_shot: "\uD83C\uDFF9",
  poison_arrow: "\u2620\uFE0F",
  evasion: "\uD83D\uDCA8",
  backstab: "\uD83D\uDDE1\uFE0F",
  stealth: "\uD83D\uDC7B",
  envenom: "\uD83E\uDDEA",
  holy_strike: "\u2728",
  heal: "\uD83D\uDC9A",
  divine_shield: "\uD83D\uDD30",
  entangle: "\uD83C\uDF3F",
  rejuvenation: "\uD83C\uDF3B",
  lightning_bolt: "\u26A1",
  shapeshift: "\uD83D\uDC3B",
};

type PartyMember = { sessionId: string; name: string };
type Friend = { id: string; name: string; online: boolean };

interface SidebarProps {
  state: PlayerState;
  isRecording?: boolean;
  onEquip?: (itemId: string) => void;
  onUnequip?: (slot: EquipmentSlot) => void;
  onUseItem?: (itemId: string) => void;
  onDropItem?: (itemId: string) => void;
  quests: PlayerQuestState[];
  partyId?: string;
  leaderId?: string;
  partyMembers?: PartyMember[];
  onPartyInvite?: (sessionId: string) => void;
  onPartyLeave?: () => void;
  onPartyKick?: (sessionId: string) => void;
  friends?: Friend[];
  pendingFriendRequests?: { id: string; name: string }[];
  onFriendRequest?: (name: string) => void;
  onFriendAccept?: (requesterId: string) => void;
  onWhisper?: (name: string) => void;
  onTradeRequest?: (sessionId: string) => void;
  /** The currently selected inventory item id (controlled from parent). */
  selectedItemId?: string | null;
  /** Called when the player selects or deselects an inventory slot. */
  onSelectItem?: (itemId: string | null) => void;
  /** Called when the player clicks a spell to begin targeting. */
  onSpellClick?: (spellId: string, rangeTiles: number) => void;
  /** The spell currently queued for targeting (shows as selected). */
  pendingSpellId?: string | null;
  /** Whether the user is on a mobile/touch device. */
  isMobile?: boolean;
  /** Called when the mobile overlay close button is tapped. */
  onClose?: () => void;
}

const RARITY_COLORS: Record<string, string> = {
  common: "#8a7a60",
  uncommon: "#33aa44",
  rare: "#3355cc",
};

const ITEM_ICONS: Record<string, string> = {
  weapon: "\u2694\uFE0F",
  armor: "\uD83D\uDEE1\uFE0F",
  shield: "\uD83D\uDEE1\uFE0F",
  helmet: "\u26D1\uFE0F",
  ring: "\uD83D\uDC8D",
  consumable: "\uD83E\uDDEA",
};

const SIDEBAR_TABS: readonly { key: "inv" | "spells" | "quests" | "party" | "friends"; label: string }[] = [
  { key: "inv", label: "inv" },
  { key: "spells", label: "spells" },
  { key: "quests", label: "quests" },
  { key: "party", label: "party" },
  { key: "friends", label: "friends" },
];

export function Sidebar({
  state, isRecording, onEquip, onUnequip, onUseItem, onDropItem, quests,
  partyId = "", leaderId = "", partyMembers = [],
  onPartyInvite, onPartyLeave, onPartyKick,
  friends = [], pendingFriendRequests = [], onFriendRequest, onFriendAccept, onWhisper, onTradeRequest,
  selectedItemId, onSelectItem, onSpellClick, pendingSpellId,
  isMobile, onClose,
}: SidebarProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"inv" | "spells" | "quests" | "party" | "friends">("inv");
  const [inviteId, setInviteId] = useState("");
  const [friendName, setFriendName] = useState("");
  const stats = CLASS_STATS[state.classType];
  const hpPct = state.maxHp > 0 ? Math.max(0, (state.hp / state.maxHp) * 100) : 0;
  const manaPct = state.maxMana > 0 ? Math.max(0, (state.mana / state.maxMana) * 100) : 0;
  const hpColor = hpPct > 50 ? P.blood : hpPct > 25 ? "#8b5a1a" : "#5a0e0e";
  const classSpells = stats?.spells?.map((id: string) => SPELLS[id]).filter(Boolean) ?? [];

  const sidebarPanel = (
    <Flex
      w={isMobile ? "min(380px, 100vw)" : "380px"}
      h={isMobile ? "100dvh" : "100%"}
      direction="column"
      bg={P.bg}
      borderLeft={isMobile ? "none" : "3px solid"}
      borderColor={P.border}
      flexShrink={0}
      overflow="hidden"
      userSelect="none"
      fontFamily={P.font}
      position={isMobile ? "relative" : undefined}
    >
      {isMobile && (
        <Box
          position="absolute"
          top="10px"
          right="12px"
          zIndex={10}
          w="36px"
          h="36px"
          bg={P.raised}
          border={`1px solid ${P.border}`}
          borderRadius="6px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontSize="16px"
          color={P.gold}
          cursor="pointer"
          onPointerDown={(e) => { e.preventDefault(); onClose?.(); }}
        >
          ✕
        </Box>
      )}
      {/* Header */}
      <Box px="4" pt="3.5" pb="2.5" bg={P.surface} borderBottom="1px solid" borderBottomColor={P.border} textAlign="center">
        <Text fontSize="16px" fontWeight="700" color={P.gold} letterSpacing="2px" textShadow="0 0 12px rgba(180,140,50,0.25)">
          {state.name}
        </Text>
        <Text fontSize="9px" color={P.goldDark} letterSpacing="4px" textTransform="uppercase" mt="0.5">
          {t(`classes.${state.classType}.name`)}
        </Text>
        {!state.alive && <Text fontSize="12px" color={P.bloodBright} fontWeight="700" mt="1" letterSpacing="3px">{t("status.dead")}</Text>}
        {state.stunned && <Text fontSize="10px" color="#cccc33" fontWeight="700" mt="0.5" letterSpacing="2px">{t("status.stunned")}</Text>}
        {state.stealthed && <Text fontSize="10px" color="#9944cc" fontWeight="700" mt="0.5" letterSpacing="2px">{t("status.stealthed")}</Text>}
        {isRecording && (
            <Flex align="center" justify="center" gap="2" mt="1.5">
                <Box w="8px" h="8px" bg="#ff0000" borderRadius="full" animation="pulse 1s infinite" />
                <Text fontSize="10px" color="#ff4444" fontWeight="700" letterSpacing="2px">{t("status.transmitting")}</Text>
            </Flex>
        )}
        {/* Level + XP bar */}
        <Flex align="center" justify="space-between" mt="2" px="0.5">
          <Text fontSize="9px" color={P.goldDark} letterSpacing="2px" textTransform="uppercase">Lv {state.level ?? 1}</Text>
          <Text fontSize="9px" color={P.goldDark} fontFamily={P.mono}>{state.xp ?? 0} / {state.maxXp ?? 100} xp</Text>
        </Flex>
        <Box pos="relative" h="6px" bg={P.darkest} border="1px solid" borderColor={P.border} borderRadius="full" overflow="hidden" mt="0.5">
          <Box
            h="100%"
            w={`${state.maxXp ? Math.min(100, ((state.xp ?? 0) / state.maxXp) * 100) : 0}%`}
            bg={`linear-gradient(90deg, ${P.goldDark}, ${P.gold})`}
            transition="width 0.3s"
          />
        </Box>
      </Box>
      <Box h="1px" bg={`linear-gradient(90deg, transparent, ${P.gold}, transparent)`} />

      {/* Gold display */}
      <Flex justify="center" py="1.5" bg={P.darkest} borderBottom="1px solid" borderBottomColor={P.border}>
        <Text fontSize="11px" color={P.gold} fontWeight="700">{state.gold ?? 0}g</Text>
      </Flex>

      {/* Tabs */}
      <Flex borderBottom="2px solid" borderBottomColor={P.border}>
        {SIDEBAR_TABS.map(({ key, label }) => (
          <Box
            key={key}
            flex="1"
            py="2.5"
            textAlign="center"
            bg={tab === key ? P.surface : P.darkest}
            color={tab === key ? P.gold : P.goldDark}
            borderBottom="2px solid"
            borderBottomColor={tab === key ? P.gold : "transparent"}
            mb="-2px"
            fontSize="10px"
            fontWeight="700"
            fontFamily={P.font}
            letterSpacing="1px"
            textTransform="uppercase"
            cursor="pointer"
            transition="all 0.12s"
            _hover={{ color: P.goldText, bg: P.surface }}
            onClick={() => setTab(key)}
          >
            {t(`sidebar.tabs.${key}`)}
          </Box>
        ))}
      </Flex>

      {/* Inventory */}
      {tab === "inv" && (
        <Box flex="1" overflow="auto" p="2.5">
          {/* Equipment slots */}
          {state.equipment && (
            <Flex gap="1" mb="2" justify="center">
              {EQUIPMENT_SLOTS.map((slot) => {
                const equipped = state.equipment![slot];
                const def = equipped ? ITEMS[equipped] : null;
                return (
                  <Box
                    key={slot}
                    w="42px" h="42px"
                    bg={P.darkest}
                    border="1px solid"
                    borderColor={def ? (RARITY_COLORS[def.rarity] || P.border) : P.border}
                    borderRadius="2px"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    cursor={def ? "pointer" : "default"}
                    title={def ? t("sidebar.inventory.unequip_hint", { name: t(def.name) }) : slot}
                    onClick={() => def && onUnequip?.(slot)}
                    _hover={def ? { borderColor: P.gold } : {}}
                    position="relative"
                  >
                    <Text fontSize="16px">{def ? (ITEM_ICONS[def.slot] || "\u2728") : ""}</Text>
                    {!def && <Text fontSize="7px" color={P.goldDark} position="absolute" bottom="1px">{slot.slice(0, 3)}</Text>}
                  </Box>
                );
              })}
            </Flex>
          )}
          <Grid templateColumns="repeat(4, 1fr)" gap="1">
            {Array.from({ length: 24 }, (_, i) => {
              const invItem = state.inventory?.find((it) => it.slotIndex === i);
              const def = invItem ? ITEMS[invItem.itemId] : null;
              const isSelected = !!invItem && invItem.itemId === selectedItemId;
              return (
                <Box
                  key={i}
                  aspectRatio="1"
                  bg={isSelected ? P.surface : P.darkest}
                  border="2px solid"
                  borderColor={
                    isSelected
                      ? P.gold
                      : def
                        ? (RARITY_COLORS[def.rarity] || P.border)
                        : P.border
                  }
                  borderRadius="2px"
                  transition="all 0.1s"
                  cursor={def ? "pointer" : "default"}
                    title={
                      def
                        ? t("sidebar.inventory.interactions_hint", {
                            name: t(def.name),
                            qty: invItem && invItem.quantity > 1 ? ` x${invItem.quantity}` : "",
                            action: def.consumeEffect ? t("controls.use") : t("controls.equip")
                          })
                        : ""
                    }
                  _hover={def ? { borderColor: P.gold, bg: P.surface } : {}}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  position="relative"
                  onClick={() => {
                    if (!def || !invItem) return;
                    // Toggle selection: clicking again deselects
                    onSelectItem?.(isSelected ? null : invItem.itemId);
                  }}
                  onDoubleClick={() => {
                    if (!def || !invItem) return;
                    if (def.consumeEffect) {
                      onUseItem?.(invItem.itemId);
                    } else if (def.slot !== "consumable") {
                      onEquip?.(invItem.itemId);
                    }
                  }}
                >
                  {def && <Text fontSize="16px">{ITEM_ICONS[def.slot] || "\u2728"}</Text>}
                  {invItem && invItem.quantity > 1 && (
                    <Text fontSize="8px" color="#fff" position="absolute" bottom="0" right="1px" fontFamily={P.mono}>{invItem.quantity}</Text>
                  )}
                  {isSelected && (
                    <Box
                      position="absolute"
                      bottom="0" left="0" right="0"
                      h="2px"
                      bg={P.gold}
                      borderRadius="0 0 2px 2px"
                    />
                  )}
                </Box>
              );
            })}
          </Grid>
        </Box>
      )}

      {/* Spells */}
      {tab === "spells" && (
        <Box flex="1" overflow="auto" p="2.5">
          {classSpells.length === 0 ? (
            <Text textAlign="center" color={P.borderLight} fontSize="11px" py="8" fontStyle="italic">{t("sidebar.inventory.empty_spells")}</Text>
          ) : (
            <Flex direction="column" gap="1.5">
              {classSpells.map((spell) => {
                const isPending = pendingSpellId === spell.id;
                return (
                  <Flex
                    key={spell.id}
                    align="center"
                    gap="3"
                    p="2.5"
                    bg={isPending ? P.surface : P.darkest}
                    border="1px solid"
                    borderColor={isPending ? P.gold : P.border}
                    borderRadius="2px"
                    cursor="pointer"
                    transition="all 0.12s"
                    _hover={{ bg: P.surface, borderColor: P.gold }}
                    onClick={() => onSpellClick?.(spell.id, spell.rangeTiles)}
                    title={spell.rangeTiles > 0 ? t("sidebar.inventory.spell_click_hint") : undefined}
                  >
                    <Flex
                      w="36px" h="36px" align="center" justify="center"
                      bg={isPending ? P.raised : P.surface}
                      border="1px solid"
                      borderColor={isPending ? P.gold : P.border}
                      borderRadius="2px"
                      fontSize="20px"
                      flexShrink={0}
                    >
                      {SPELL_ICONS[spell.id] || "\u2728"}
                    </Flex>
                    <Box flex="1">
                      <Text fontSize="12px" fontWeight="700" color={isPending ? P.gold : P.gold}>
                        {t(`spells.${spell.id}.name`)}
                      </Text>
                      <Text fontSize="9px" color={P.goldDark} mt="0.5">
                        {t("sidebar.inventory.mana")}: {spell.manaCost} · {spell.rangeTiles > 0 ? `${t("sidebar.inventory.range")}: ${spell.rangeTiles}` : t("sidebar.inventory.self")} · [{spell.key}]
                      </Text>
                    </Box>
                    {isPending && (
                      <Text fontSize="9px" color={P.gold} fontWeight="700" letterSpacing="1px" textTransform="uppercase" flexShrink={0}>
                        {t("sidebar.inventory.targeting")}
                      </Text>
                    )}
                  </Flex>
                );
              })}
            </Flex>
          )}
        </Box>
      )}
      {/* Quests */}
      {tab === "quests" && <QuestLog quests={quests} />}

      {/* Party */}
      {tab === "party" && (
        <Box flex="1" overflow="auto" p="3">
          {!partyId ? (
            <VStack align="stretch" gap="3">
              <Text fontSize="11px" color={P.goldDark} fontStyle="italic">{t("sidebar.party.not_in_party")}</Text>
              <HStack gap="2">
                <Input
                  placeholder={t("sidebar.party.session_id")}
                  size="xs"
                  value={inviteId}
                  onChange={(e) => setInviteId(e.target.value)}
                  bg={P.darkest}
                  borderColor={P.border}
                  color={P.goldText}
                  fontSize="11px"
                  fontFamily={P.mono}
                  _focus={{ borderColor: P.gold }}
                />
                <Button
                  size="xs"
                  bg={P.raised}
                  color={P.gold}
                  borderColor={P.border}
                  border="1px solid"
                  _hover={{ bg: P.surface, borderColor: P.gold }}
                  onClick={() => { onPartyInvite?.(inviteId); setInviteId(""); }}
                >
                  {t("sidebar.party.invite")}
                </Button>
              </HStack>
            </VStack>
          ) : (
            <VStack align="stretch" gap="2">
              <Text fontSize="9px" color={P.goldDark} letterSpacing="2px" textTransform="uppercase">{t("sidebar.party.party_id", { id: partyId })}</Text>
              {partyMembers.map((member) => (
                <Flex key={member.sessionId} justify="space-between" align="center" p="2" bg={P.darkest} border="1px solid" borderColor={P.border} borderRadius="2px">
                  <HStack gap="2">
                    <Box w="6px" h="6px" borderRadius="full" bg="green.400" flexShrink={0} />
                    <Text fontSize="12px" color={member.sessionId === leaderId ? P.gold : P.goldText} fontWeight={member.sessionId === leaderId ? "700" : "400"}>
                      {member.name}{member.sessionId === leaderId ? ` ${t("sidebar.party.leader_tag")}` : ""}
                    </Text>
                  </HStack>
                  <HStack gap="1">
                    {member.sessionId !== leaderId && (
                      <Button size="xs" variant="ghost" p="0" h="auto" minW="auto" color={P.gold} fontSize="10px" onClick={() => onTradeRequest?.(member.sessionId)}>
                        [Trade]
                      </Button>
                    )}
                    {leaderId === partyMembers[0]?.sessionId && member.sessionId !== leaderId && (
                      <Button size="xs" variant="ghost" p="0" h="auto" minW="auto" color="red.400" fontSize="10px" onClick={() => onPartyKick?.(member.sessionId)}>
                        {t("sidebar.party.kick")}
                      </Button>
                    )}
                  </HStack>
                </Flex>
              ))}
              <Button
                mt="1"
                size="xs"
                variant="outline"
                borderColor={P.blood}
                color="red.400"
                _hover={{ bg: P.blood }}
                fontSize="10px"
                onClick={onPartyLeave}
              >
                {t("sidebar.party.leave")}
              </Button>
            </VStack>
          )}
        </Box>
      )}

      {/* Friends */}
      {tab === "friends" && (
        <Box flex="1" overflow="auto" p="3">
          <VStack align="stretch" gap="3">
            <HStack gap="2">
              <Input
                placeholder={t("sidebar.friends.friend_name")}
                size="xs"
                value={friendName}
                onChange={(e) => setFriendName(e.target.value)}
                bg={P.darkest}
                borderColor={P.border}
                color={P.goldText}
                fontSize="11px"
                fontFamily={P.mono}
                _focus={{ borderColor: P.gold }}
              />
              <Button
                size="xs"
                bg={P.raised}
                color={P.gold}
                borderColor={P.border}
                border="1px solid"
                _hover={{ bg: P.surface, borderColor: P.gold }}
                onClick={() => { onFriendRequest?.(friendName); setFriendName(""); }}
              >
                {t("sidebar.friends.add")}
              </Button>
            </HStack>
            <VStack align="stretch" gap="1">
              {friends.length === 0 && (
                <Text fontSize="11px" color={P.goldDark} textAlign="center" fontStyle="italic" py="4">{t("sidebar.friends.no_friends")}</Text>
              )}
              {friends.map((friend) => (
                <Flex key={friend.id} justify="space-between" align="center" p="2" bg={P.darkest} border="1px solid" borderColor={P.border} borderRadius="2px">
                  <HStack gap="2">
                    <Box w="6px" h="6px" borderRadius="full" bg={friend.online ? "green.400" : "gray.600"} flexShrink={0} />
                    <Text fontSize="12px" color={friend.online ? P.goldText : P.goldDark}>{friend.name}</Text>
                  </HStack>
                  <HStack gap="1">
                    <Button size="xs" variant="ghost" p="0" h="auto" minW="auto" color={P.gold} fontSize="10px" onClick={() => onWhisper?.(friend.name)}>
                      {t("sidebar.friends.whisper_tag")}
                    </Button>
                    {friend.online && (
                      <Button size="xs" variant="ghost" p="0" h="auto" minW="auto" color="blue.400" fontSize="10px" onClick={() => onPartyInvite?.(friend.id)}>
                        {t("sidebar.friends.party_invite_tag")}
                      </Button>
                    )}
                    {friend.online && (
                      <Button size="xs" variant="ghost" p="0" h="auto" minW="auto" color={P.gold} fontSize="10px" onClick={() => onTradeRequest?.(friend.id)}>
                        [Trade]
                      </Button>
                    )}
                  </HStack>
                </Flex>
              ))}
            </VStack>
            {pendingFriendRequests.length > 0 && (
              <VStack align="stretch" gap="1">
                <Text fontSize="9px" letterSpacing="2px" color={P.goldDark} textTransform="uppercase">{t("sidebar.friends.pending_requests")}</Text>
                {pendingFriendRequests.map((req) => (
                  <Flex key={req.id} justify="space-between" align="center" p="2" bg={P.darkest} border="1px solid" borderColor={P.border} borderRadius="2px">
                    <Text fontSize="12px" color={P.goldText}>{req.name}</Text>
                    <Button
                      size="xs"
                      variant="ghost"
                      p="0"
                      h="auto"
                      minW="auto"
                      color="green.400"
                      fontSize="10px"
                      onClick={() => onFriendAccept?.(req.id)}
                    >
                      {t("sidebar.friends.accept")}
                    </Button>
                  </Flex>
                ))}
              </VStack>
            )}
          </VStack>
        </Box>
      )}

      {/* Stats — pinned to bottom */}
      <Box mt="auto" flexShrink={0} borderTop="2px solid" borderTopColor={P.border} bg={P.darkest}>
        <Box h="1px" bg={`linear-gradient(90deg, transparent, ${P.gold}, transparent)`} />
        <Flex justify="space-around" py="2.5" px="3" borderBottom="1px solid" borderBottomColor={P.raised}>
          <StatChip label="STR" value={state.str ?? stats?.str ?? 0} />
          <StatChip label="AGI" value={state.agi ?? stats?.agi ?? 0} />
          <StatChip label="INT" value={state.intStat ?? stats?.int ?? 0} />
        </Flex>

        {/* HP bar */}
        <Box px="3.5" pt="2.5" pb="1">
          <Text fontSize="8px" letterSpacing="3px" color={P.goldDark} textAlign="center" textTransform="uppercase" mb="0.5">{t("status.health")}</Text>
          <Box pos="relative" h="22px" bg="#0a0810" border="1px solid" borderColor={P.border} borderRadius="2px" overflow="hidden">
            <Box h="100%" w={`${hpPct}%`} bg={hpColor} transition="width 0.2s" />
            <Flex pos="absolute" inset="0" align="center" justify="center" fontSize="10px" fontWeight="700" color="#fff" textShadow="1px 1px 3px #000" fontFamily={P.mono}>
              {state.hp}/{state.maxHp}
            </Flex>
          </Box>
        </Box>

        {/* Mana bar */}
        <Box px="3.5" pt="1.5" pb="2.5">
          <Text fontSize="8px" letterSpacing="3px" color={P.goldDark} textAlign="center" textTransform="uppercase" mb="0.5">{t("status.mana")}</Text>
          <Box pos="relative" h="22px" bg="#080818" border="1px solid" borderColor={P.border} borderRadius="2px" overflow="hidden">
            <Box h="100%" w={`${manaPct}%`} bg={P.arcane} transition="width 0.2s" />
            <Flex pos="absolute" inset="0" align="center" justify="center" fontSize="10px" fontWeight="700" color="#fff" textShadow="1px 1px 3px #000" fontFamily={P.mono}>
              {state.mana}/{state.maxMana}
            </Flex>
          </Box>
        </Box>
      </Box>

      {/* Keybinds — hide on mobile since controls are on-screen */}
      {!isMobile && (
        <Flex px="3" py="2" gap="2" justify="center" flexWrap="wrap" borderTop="1px solid" borderTopColor={P.raised} bg={P.bg}>
          <KeyHint keys="Arrows" action={t("controls.move")} />
          <KeyHint keys="Ctrl" action={t("controls.melee")} />
          <KeyHint keys="A" action={t("controls.pickup")} />
          <KeyHint keys="T" action={t("controls.drop")} />
          {classSpells.map((spell) => (
            <KeyHint key={spell.id} keys={`${spell.key}${spell.rangeTiles > 0 ? "+Click" : ""}`} action={t(`spells.${spell.id}.name`)} />
          ))}
        </Flex>
      )}
    </Flex>
  );

  if (isMobile) {
    return (
      <Box
        position="fixed"
        inset="0"
        zIndex={100}
        display="flex"
        justifyContent="flex-end"
        onClick={() => onClose?.()}
      >
        <Box onClick={(e) => e.stopPropagation()}>
          {sidebarPanel}
        </Box>
      </Box>
    );
  }

  return sidebarPanel;
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <Box textAlign="center">
      <Text fontSize="8px" color={P.goldDark} letterSpacing="1px" textTransform="uppercase">{label}</Text>
      <Text fontSize="20px" fontWeight="700" color={P.gold} mt="0.5">{value}</Text>
    </Box>
  );
}

function KeyHint({ keys, action }: { keys: string; action: string }) {
  return (
    <Flex align="center" gap="1" fontSize="9px" color={P.goldDark}>
      <Box bg={P.surface} border="1px solid" borderColor={P.border} borderRadius="2px" px="1.5" py="0.5" fontSize="8px" fontFamily="'Consolas', monospace" color={P.goldMuted}>
        {keys}
      </Box>
      {action}
    </Flex>
  );
}

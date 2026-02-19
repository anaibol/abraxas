import { useState } from "react";
import { X } from "lucide-react";
import { Box, Flex, Text, Grid, Input, Button, VStack, HStack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { CLASS_STATS, SPELLS, ITEMS, EQUIPMENT_SLOTS, type EquipmentSlot, type PlayerQuestState, type ClassType } from "@abraxas/shared";
import { P } from "./palette";
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

export type PlayerState = {
  name: string;
  classType: ClassType;
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
  meditating?: boolean;
  level?: number;
  xp?: number;
  maxXp?: number;
  inventory?: InventorySlot[];
  equipment?: EquipmentState;
}


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
          color={P.gold}
          cursor="pointer"
          onPointerDown={(e) => { e.preventDefault(); onClose?.(); }}
        >
          <X size={18} />
        </Box>
      )}
      {/* Header */}
      <CharacterHeader state={state} isRecording={isRecording} />

      <Box h="1px" bg={`linear-gradient(90deg, transparent, ${P.gold}, transparent)`} />

      {/* Gold display - Moved into Header or kept separate? Let's keep separate for now but localized */}
      <Flex justify="center" py="1.5" bg={P.darkest} borderBottom="1px solid" borderBottomColor={P.border}>
        <Text fontSize="11px" color={P.gold} fontWeight="700">{state.gold ?? 0}{t("sidebar.inventory.gold_abbr")}</Text>
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

      {/* Tab Content */}
      <Box flex="1" overflow="auto">
        {tab === "inv" && (
          <InventoryTab
            state={state}
            selectedItemId={selectedItemId}
            onSelectItem={onSelectItem}
            onEquip={onEquip}
            onUnequip={onUnequip}
            onUseItem={onUseItem}
          />
        )}
        {tab === "spells" && (
          <SpellsTab
            classSpells={classSpells}
            pendingSpellId={pendingSpellId}
            onSpellClick={onSpellClick}
          />
        )}
        {tab === "quests" && <QuestLog quests={quests} />}
        {tab === "party" && (
          <PartyTab
            partyId={partyId}
            leaderId={leaderId}
            partyMembers={partyMembers}
            inviteId={inviteId}
            setInviteId={setInviteId}
            onPartyInvite={onPartyInvite}
            onPartyLeave={onPartyLeave}
            onPartyKick={onPartyKick}
            onTradeRequest={onTradeRequest}
          />
        )}
        {tab === "friends" && (
          <FriendsTab
            friends={friends}
            pendingFriendRequests={pendingFriendRequests}
            friendName={friendName}
            setFriendName={setFriendName}
            onFriendRequest={onFriendRequest}
            onFriendAccept={onFriendAccept}
            onWhisper={onWhisper}
            onTradeRequest={onTradeRequest}
            onPartyInvite={onPartyInvite}
          />
        )}
      </Box>

      {/* Footer */}
      <SidebarFooter state={state} isMobile={isMobile} classSpells={classSpells} />
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

function CharacterHeader({ state, isRecording }: { state: PlayerState; isRecording?: boolean }) {
  const { t } = useTranslation();
  return (
    <Box px="4" pt="3.5" pb="2.5" bg={P.surface} borderBottom="1px solid" borderBottomColor={P.border} textAlign="center">
      <Text fontSize="16px" fontWeight="700" color={P.gold} letterSpacing="2px" textShadow="0 0 12px rgba(180,140,50,0.25)">
        {state.name}
      </Text>
      <Text fontSize="9px" color={P.goldDark} letterSpacing="4px" textTransform="uppercase" mt="0.5">
        {t(`classes.${state.classType}.name`)}
      </Text>
      <HStack gap="2" justify="center" mt="1" flexWrap="wrap">
        {!state.alive && <Text fontSize="12px" color={P.bloodBright} fontWeight="700" letterSpacing="3px">{t("status.dead")}</Text>}
        {state.stunned && <Text fontSize="10px" color="#cccc33" fontWeight="700" letterSpacing="2px">{t("status.stunned")}</Text>}
        {state.stealthed && <Text fontSize="10px" color="#9944cc" fontWeight="700" letterSpacing="2px">{t("status.stealthed")}</Text>}
        {state.meditating && <Text fontSize="10px" color="#44aacc" fontWeight="700" letterSpacing="2px">{t("status.meditating")}</Text>}
      </HStack>
      {isRecording && (
          <Flex align="center" justify="center" gap="2" mt="1.5">
              <Box w="8px" h="8px" bg="#ff0000" borderRadius="full" animation="pulse 1s infinite" />
              <Text fontSize="10px" color="#ff4444" fontWeight="700" letterSpacing="2px">{t("status.transmitting")}</Text>
          </Flex>
      )}
      {/* Level + XP bar */}
      <Flex align="center" justify="space-between" mt="2" px="0.5">
        <Text fontSize="9px" color={P.goldDark} letterSpacing="2px" textTransform="uppercase">{t("sidebar.inventory.level")} {state.level ?? 1}</Text>
        <Text fontSize="9px" color={P.goldDark} fontFamily={P.mono}>{state.xp ?? 0} / {state.maxXp ?? 100} {t("sidebar.inventory.xp")}</Text>
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
  );
}

function SidebarFooter({ state, isMobile, classSpells }: { state: PlayerState; isMobile?: boolean; classSpells: any[] }) {
  const { t } = useTranslation();
  const hpPct = state.maxHp > 0 ? Math.max(0, (state.hp / state.maxHp) * 100) : 0;
  const manaPct = state.maxMana > 0 ? Math.max(0, (state.mana / state.maxMana) * 100) : 0;
  const hpColor = hpPct > 50 ? P.blood : hpPct > 25 ? "#8b5a1a" : "#5a0e0e";
  const stats = CLASS_STATS[state.classType];

  return (
    <Box mt="auto" flexShrink={0} borderTop="2px solid" borderTopColor={P.border} bg={P.darkest}>
      <Box h="1px" bg={`linear-gradient(90deg, transparent, ${P.gold}, transparent)`} />
      <Flex justify="space-around" py="2.5" px="3" borderBottom="1px solid" borderBottomColor={P.raised}>
        <StatChip label={t("sidebar.stats.str")} value={state.str ?? stats?.str ?? 0} />
        <StatChip label={t("sidebar.stats.agi")} value={state.agi ?? stats?.agi ?? 0} />
        <StatChip label={t("sidebar.stats.int")} value={state.intStat ?? stats?.int ?? 0} />
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

      {/* Keybinds — hide on mobile since controls are on-screen */}
      {!isMobile && (
        <Flex px="3" py="2" gap="2" justify="center" flexWrap="wrap" borderTop="1px solid" borderTopColor={P.raised} bg={P.bg}>
          <KeyHint keys="Arrows" action={t("controls.move")} />
          <KeyHint keys="Ctrl" action={t("controls.melee")} />
          <KeyHint keys="A" action={t("controls.pickup")} />
          <KeyHint keys="T" action={t("controls.drop")} />
          <KeyHint keys="M" action={t("controls.meditate")} />
          {classSpells.map((spell) => (
            <KeyHint key={spell.id} keys={`${spell.key}${spell.rangeTiles > 0 ? "+Click" : ""}`} action={t(`spells.${spell.id}.name`)} />
          ))}
        </Flex>
      )}
    </Box>
  );
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

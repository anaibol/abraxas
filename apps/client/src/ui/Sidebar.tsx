import { useState } from "react";
import { Box, Flex, Text, Grid } from "@chakra-ui/react";
import { CLASS_STATS, SPELLS, ITEMS } from "@ao5/shared";

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

interface SidebarProps {
  state: PlayerState;
  onEquip?: (itemId: string) => void;
  onUnequip?: (slot: string) => void;
  onUseItem?: (itemId: string) => void;
  onDropItem?: (itemId: string) => void;
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

export function Sidebar({ state, onEquip, onUnequip, onUseItem, onDropItem }: SidebarProps) {
  const [tab, setTab] = useState<"inv" | "spells">("inv");
  const stats = CLASS_STATS[state.classType];
  const hpPct = state.maxHp > 0 ? Math.max(0, (state.hp / state.maxHp) * 100) : 0;
  const manaPct = state.maxMana > 0 ? Math.max(0, (state.mana / state.maxMana) * 100) : 0;
  const hpColor = hpPct > 50 ? P.blood : hpPct > 25 ? "#8b5a1a" : "#5a0e0e";
  const classSpells = stats?.spells?.map((id: string) => SPELLS[id]).filter(Boolean) ?? [];

  return (
    <Flex w="280px" h="100%" direction="column" bg={P.bg} borderLeft="3px solid" borderColor={P.border} flexShrink={0} overflow="hidden" userSelect="none" fontFamily={P.font}>
      {/* Header */}
      <Box px="4" pt="3.5" pb="2.5" bg={P.surface} borderBottom="1px solid" borderBottomColor={P.border} textAlign="center">
        <Text fontSize="16px" fontWeight="700" color={P.gold} letterSpacing="2px" textShadow="0 0 12px rgba(180,140,50,0.25)">
          {state.name}
        </Text>
        <Text fontSize="9px" color={P.goldDark} letterSpacing="4px" textTransform="uppercase" mt="0.5">
          {state.classType}
        </Text>
        {!state.alive && <Text fontSize="12px" color={P.bloodBright} fontWeight="700" mt="1" letterSpacing="3px">DEAD</Text>}
        {state.stunned && <Text fontSize="10px" color="#cccc33" fontWeight="700" mt="0.5" letterSpacing="2px">STUNNED</Text>}
        {state.stealthed && <Text fontSize="10px" color="#9944cc" fontWeight="700" mt="0.5" letterSpacing="2px">STEALTHED</Text>}
      </Box>
      <Box h="1px" bg={`linear-gradient(90deg, transparent, ${P.gold}, transparent)`} />

      {/* Gold display */}
      <Flex justify="center" py="1.5" bg={P.darkest} borderBottom="1px solid" borderBottomColor={P.border}>
        <Text fontSize="11px" color={P.gold} fontWeight="700">{state.gold ?? 0}g</Text>
      </Flex>

      {/* Tabs */}
      <Flex borderBottom="2px solid" borderBottomColor={P.border}>
        {([["inv", "\u2694 Inventory"], ["spells", "\uD83D\uDCD6 Spells"]] as const).map(([key, label]) => (
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
            {label}
          </Box>
        ))}
      </Flex>

      {/* Inventory */}
      {tab === "inv" && (
        <Box flex="1" overflow="auto" p="2.5">
          {/* Equipment slots */}
          {state.equipment && (
            <Flex gap="1" mb="2" justify="center">
              {(["weapon", "armor", "shield", "helmet", "ring"] as const).map((slot) => {
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
                    title={def ? `${def.name} (right-click unequip)` : slot}
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
              return (
                <Box
                  key={i}
                  aspectRatio="1"
                  bg={P.darkest}
                  border="1px solid"
                  borderColor={def ? (RARITY_COLORS[def.rarity] || P.border) : P.border}
                  borderRadius="2px"
                  transition="all 0.1s"
                  cursor={def ? "pointer" : "default"}
                  title={def ? `${def.name}${invItem && invItem.quantity > 1 ? ` x${invItem.quantity}` : ""}\nClick: ${def.consumeEffect ? "Use" : "Equip"}` : ""}
                  _hover={def ? { borderColor: P.gold, bg: P.surface } : { borderColor: P.gold, bg: P.surface }}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  position="relative"
                  onClick={() => {
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
            <Text textAlign="center" color={P.borderLight} fontSize="11px" py="8" fontStyle="italic">No spells available</Text>
          ) : (
            <Flex direction="column" gap="1.5">
              {classSpells.map((spell) => (
                <Flex
                  key={spell.id}
                  align="center"
                  gap="3"
                  p="2.5"
                  bg={P.darkest}
                  border="1px solid"
                  borderColor={P.border}
                  borderRadius="2px"
                  cursor="pointer"
                  transition="all 0.12s"
                  _hover={{ bg: P.surface, borderColor: P.gold }}
                >
                  <Flex w="36px" h="36px" align="center" justify="center" bg={P.surface} border="1px solid" borderColor={P.border} borderRadius="2px" fontSize="20px" flexShrink={0}>
                    {SPELL_ICONS[spell.id] || "\u2728"}
                  </Flex>
                  <Box>
                    <Text fontSize="12px" fontWeight="700" color={P.gold}>
                      {spell.id.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </Text>
                    <Text fontSize="9px" color={P.goldDark} mt="0.5">
                      Mana: {spell.manaCost} · {spell.rangeTiles > 0 ? `Range: ${spell.rangeTiles}` : "Self"} · [{spell.key}]
                    </Text>
                  </Box>
                </Flex>
              ))}
            </Flex>
          )}
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
          <Text fontSize="8px" letterSpacing="3px" color={P.goldDark} textAlign="center" textTransform="uppercase" mb="0.5">Salud</Text>
          <Box pos="relative" h="22px" bg="#0a0810" border="1px solid" borderColor={P.border} borderRadius="2px" overflow="hidden">
            <Box h="100%" w={`${hpPct}%`} bg={hpColor} transition="width 0.2s" />
            <Flex pos="absolute" inset="0" align="center" justify="center" fontSize="10px" fontWeight="700" color="#fff" textShadow="1px 1px 3px #000" fontFamily={P.mono}>
              {state.hp}/{state.maxHp}
            </Flex>
          </Box>
        </Box>

        {/* Mana bar */}
        <Box px="3.5" pt="1.5" pb="2.5">
          <Text fontSize="8px" letterSpacing="3px" color={P.goldDark} textAlign="center" textTransform="uppercase" mb="0.5">Mana</Text>
          <Box pos="relative" h="22px" bg="#080818" border="1px solid" borderColor={P.border} borderRadius="2px" overflow="hidden">
            <Box h="100%" w={`${manaPct}%`} bg={P.arcane} transition="width 0.2s" />
            <Flex pos="absolute" inset="0" align="center" justify="center" fontSize="10px" fontWeight="700" color="#fff" textShadow="1px 1px 3px #000" fontFamily={P.mono}>
              {state.mana}/{state.maxMana}
            </Flex>
          </Box>
        </Box>
      </Box>

      {/* Keybinds */}
      <Flex px="3" py="2" gap="2" justify="center" flexWrap="wrap" borderTop="1px solid" borderTopColor={P.raised} bg={P.bg}>
        <KeyHint keys="Arrows" action="Move" />
        <KeyHint keys="Ctrl" action="Melee" />
        {classSpells.map((spell) => (
          <KeyHint key={spell.id} keys={`${spell.key}${spell.rangeTiles > 0 ? "+Click" : ""}`} action={spell.id.split("_")[0]} />
        ))}
      </Flex>
    </Flex>
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

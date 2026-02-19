import { useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import {
	Box,
	Flex,
	Text,
	Grid,
	Input,
	Button,
	VStack,
	HStack,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import {
	CLASS_STATS,
	SPELLS,
	ITEMS,
	EQUIPMENT_SLOTS,
	type Spell,
	type EquipmentSlot,
	type PlayerQuestState,
	type ClassType,
} from "@abraxas/shared";
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
};

const SPELL_ICONS: Record<string, string> = {
	// Warrior
	war_cry: "📣",
	shield_bash: "🛡️",
	whirlwind: "🌀",
	battle_shout: "📯",
	// Mage
	fireball: "🔥",
	ice_bolt: "❄️",
	thunderstorm: "⚡",
	mana_shield: "🔵",
	frost_nova: "🌨️",
	arcane_surge: "✨",
	// Ranger
	multi_shot: "🏹",
	poison_arrow: "☠️",
	evasion: "💨",
	aimed_shot: "🎯",
	mark_target: "🔍",
	// Rogue
	backstab: "🗡️",
	stealth: "👻",
	envenom: "🧪",
	smoke_bomb: "🌫️",
	hemorrhage: "🩸",
	// Cleric
	holy_strike: "✨",
	heal: "💚",
	divine_shield: "🔮",
	holy_nova: "🌟",
	curse: "💀",
	smite: "☀️",
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

const SIDEBAR_TABS: readonly {
	key: "inv" | "spells" | "quests" | "party" | "friends";
	label: string;
}[] = [
	{ key: "inv", label: "inv" },
	{ key: "spells", label: "spells" },
	{ key: "quests", label: "quests" },
	{ key: "party", label: "party" },
	{ key: "friends", label: "friends" },
];

export function Sidebar({
	state,
	isRecording,
	onEquip,
	onUnequip,
	onUseItem,
	onDropItem,
	quests,
	partyId = "",
	leaderId = "",
	partyMembers = [],
	onPartyInvite,
	onPartyLeave,
	onPartyKick,
	friends = [],
	pendingFriendRequests = [],
	onFriendRequest,
	onFriendAccept,
	onWhisper,
	onTradeRequest,
	selectedItemId,
	onSelectItem,
	onSpellClick,
	pendingSpellId,
	isMobile,
	onClose,
}: SidebarProps) {
	const { t } = useTranslation();
	const [tab, setTab] = useState<
		"inv" | "spells" | "quests" | "party" | "friends"
	>("inv");
	const [inviteId, setInviteId] = useState("");
	const [friendName, setFriendName] = useState("");
	const stats = CLASS_STATS[state.classType];
	const hpPct =
		state.maxHp > 0 ? Math.max(0, (state.hp / state.maxHp) * 100) : 0;
	const manaPct =
		state.maxMana > 0 ? Math.max(0, (state.mana / state.maxMana) * 100) : 0;
	const hpColor = hpPct > 50 ? P.blood : hpPct > 25 ? "#8b5a1a" : "#5a0e0e";
	const classSpells =
		stats?.spells?.map((id) => SPELLS[id]).filter(Boolean) ?? [];

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
					onPointerDown={(e) => {
						e.preventDefault();
						onClose?.();
					}}
				>
					<X size={18} />
				</Box>
			)}
			{/* Header */}
			<CharacterHeader state={state} isRecording={isRecording} />

			<Box
				h="1px"
				bg={`linear-gradient(90deg, transparent, ${P.gold}, transparent)`}
			/>

			{/* Gold display - Moved into Header or kept separate? Let's keep separate for now but localized */}
			<Flex
				justify="center"
				py="1.5"
				bg={P.darkest}
				borderBottom="1px solid"
				borderBottomColor={P.border}
			>
		<Text fontSize="13px" color={P.gold} fontWeight="700">
				{state.gold ?? 0}
				{t("sidebar.inventory.gold_abbr")}
			</Text>
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
					fontSize="12px"
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
						currentMana={state.mana}
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
			<SidebarFooter
				state={state}
				isMobile={isMobile}
				classSpells={classSpells}
			/>
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
				<Box onClick={(e) => e.stopPropagation()}>{sidebarPanel}</Box>
			</Box>
		);
	}

	return sidebarPanel;
}

function CharacterHeader({
	state,
	isRecording,
}: {
	state: PlayerState;
	isRecording?: boolean;
}) {
	const { t } = useTranslation();
	return (
		<Box
			px="4"
			pt="3.5"
			pb="2.5"
			bg={P.surface}
			borderBottom="1px solid"
			borderBottomColor={P.border}
			textAlign="center"
		>
			<Text
				fontSize="16px"
				fontWeight="700"
				color={P.gold}
				letterSpacing="2px"
				textShadow="0 0 12px rgba(180,140,50,0.25)"
			>
				{state.name}
			</Text>
		<Text
			fontSize="11px"
			color={P.goldDark}
			letterSpacing="4px"
			textTransform="uppercase"
			mt="0.5"
		>
			{t(`classes.${state.classType}.name`)}
			</Text>
			<HStack gap="2" justify="center" mt="1" flexWrap="wrap">
				{!state.alive && (
					<Text
						fontSize="12px"
						color={P.bloodBright}
						fontWeight="700"
						letterSpacing="3px"
					>
						{t("status.dead")}
					</Text>
				)}
			{state.stunned && (
				<Text
					fontSize="12px"
					color="#cccc33"
					fontWeight="700"
					letterSpacing="2px"
				>
					{t("status.stunned")}
				</Text>
			)}
			{state.stealthed && (
				<Text
					fontSize="12px"
					color="#9944cc"
					fontWeight="700"
					letterSpacing="2px"
				>
					{t("status.stealthed")}
				</Text>
			)}
			{state.meditating && (
				<Text
					fontSize="12px"
					color="#44aacc"
					fontWeight="700"
					letterSpacing="2px"
				>
					{t("status.meditating")}
				</Text>
			)}
			</HStack>
			{isRecording && (
				<Flex align="center" justify="center" gap="2" mt="1.5">
					<Box
						w="8px"
						h="8px"
						bg="#ff0000"
						borderRadius="full"
						animation="pulse 1s infinite"
					/>
				<Text
					fontSize="12px"
					color="#ff4444"
					fontWeight="700"
					letterSpacing="2px"
				>
					{t("status.transmitting")}
					</Text>
				</Flex>
			)}
			{/* Level + XP bar */}
			<Flex align="center" justify="space-between" mt="2" px="0.5">
			<Text
				fontSize="11px"
				color={P.goldDark}
				letterSpacing="2px"
				textTransform="uppercase"
			>
				{t("sidebar.inventory.level")} {state.level ?? 1}
			</Text>
			<Text fontSize="11px" color={P.goldDark} fontFamily={P.mono}>
				{state.xp ?? 0} / {state.maxXp ?? 100} {t("sidebar.inventory.xp")}
				</Text>
			</Flex>
			<Box
				pos="relative"
				h="6px"
				bg={P.darkest}
				border="1px solid"
				borderColor={P.border}
				borderRadius="full"
				overflow="hidden"
				mt="0.5"
			>
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

function SidebarFooter({
	state,
	isMobile,
	classSpells,
}: {
	state: PlayerState;
	isMobile?: boolean;
	classSpells: Spell[];
}) {
	const { t } = useTranslation();
	const hpPct =
		state.maxHp > 0 ? Math.max(0, (state.hp / state.maxHp) * 100) : 0;
	const manaPct =
		state.maxMana > 0 ? Math.max(0, (state.mana / state.maxMana) * 100) : 0;
	const hpColor = hpPct > 50 ? P.blood : hpPct > 25 ? "#8b5a1a" : "#5a0e0e";
	const stats = CLASS_STATS[state.classType];

	return (
		<Box
			mt="auto"
			flexShrink={0}
			borderTop="2px solid"
			borderTopColor={P.border}
			bg={P.darkest}
		>
			<Box
				h="1px"
				bg={`linear-gradient(90deg, transparent, ${P.gold}, transparent)`}
			/>
			<Flex
				justify="space-around"
				py="2.5"
				px="3"
				borderBottom="1px solid"
				borderBottomColor={P.raised}
			>
				<StatChip
					label={t("sidebar.stats.str")}
					value={state.str ?? stats?.str ?? 0}
				/>
				<StatChip
					label={t("sidebar.stats.agi")}
					value={state.agi ?? stats?.agi ?? 0}
				/>
				<StatChip
					label={t("sidebar.stats.int")}
					value={state.intStat ?? stats?.int ?? 0}
				/>
			</Flex>

			{/* HP bar */}
			<Box px="3.5" pt="2.5" pb="1">
			<Text
				fontSize="11px"
				letterSpacing="3px"
				color={P.goldDark}
				textAlign="center"
				textTransform="uppercase"
				mb="0.5"
			>
				{t("status.health")}
				</Text>
				<Box
					pos="relative"
					h="22px"
					bg="#0a0810"
					border="1px solid"
					borderColor={P.border}
					borderRadius="2px"
					overflow="hidden"
				>
					<Box h="100%" w={`${hpPct}%`} bg={hpColor} transition="width 0.2s" />
				<Flex
					pos="absolute"
					inset="0"
					align="center"
					justify="center"
					fontSize="12px"
					fontWeight="700"
					color="#fff"
					textShadow="1px 1px 3px #000"
					fontFamily={P.mono}
				>
					{state.hp}/{state.maxHp}
					</Flex>
				</Box>
			</Box>

			{/* Mana bar */}
			<Box px="3.5" pt="1.5" pb="2.5">
		<Text
			fontSize="11px"
			letterSpacing="3px"
			color={P.goldDark}
			textAlign="center"
			textTransform="uppercase"
			mb="0.5"
		>
			{t("status.mana")}
				</Text>
				<Box
					pos="relative"
					h="22px"
					bg="#080818"
					border="1px solid"
					borderColor={P.border}
					borderRadius="2px"
					overflow="hidden"
				>
					<Box
						h="100%"
						w={`${manaPct}%`}
						bg={P.arcane}
						transition="width 0.2s"
					/>
				<Flex
					pos="absolute"
					inset="0"
					align="center"
					justify="center"
					fontSize="12px"
					fontWeight="700"
					color="#fff"
					textShadow="1px 1px 3px #000"
					fontFamily={P.mono}
				>
					{state.mana}/{state.maxMana}
					</Flex>
				</Box>
			</Box>

			{/* Keybinds — hide on mobile since controls are on-screen */}
			{!isMobile && (
				<Flex
					px="3"
					py="2"
					gap="2"
					justify="center"
					flexWrap="wrap"
					borderTop="1px solid"
					borderTopColor={P.raised}
					bg={P.bg}
				>
					<KeyHint keys="Arrows" action={t("controls.move")} />
					<KeyHint keys="Ctrl" action={t("controls.melee")} />
					<KeyHint keys="A" action={t("controls.pickup")} />
					<KeyHint keys="T" action={t("controls.drop")} />
					<KeyHint keys="M" action={t("controls.meditate")} />
					{classSpells.map((spell) => (
						<KeyHint
							key={spell.id}
							keys={`${spell.key}${spell.rangeTiles > 0 ? "+Click" : ""}`}
							action={t(`spells.${spell.id}.name`)}
						/>
					))}
				</Flex>
			)}
		</Box>
	);
}

function InventoryTab({
	state,
	selectedItemId,
	onSelectItem,
	onEquip,
	onUnequip,
	onUseItem,
}: {
	state: PlayerState;
	selectedItemId?: string | null;
	onSelectItem?: (id: string | null) => void;
	onEquip?: (id: string) => void;
	onUnequip?: (slot: EquipmentSlot) => void;
	onUseItem?: (id: string) => void;
}) {
	const { t } = useTranslation();
	return (
		<Box p="2.5">
			{/* Equipment slots */}
			{state.equipment && (
				<Flex gap="1" mb="2" justify="center">
					{EQUIPMENT_SLOTS.map((slot) => {
						const equipped = state.equipment![slot];
						const def = equipped ? ITEMS[equipped] : null;
						return (
							<Box
								key={slot}
								w="42px"
								h="42px"
								bg={P.darkest}
								border="1px solid"
								borderColor={
									def ? RARITY_COLORS[def.rarity] || P.border : P.border
								}
								borderRadius="2px"
								display="flex"
								alignItems="center"
								justifyContent="center"
								cursor={def ? "pointer" : "default"}
								title={
									def
										? t("sidebar.inventory.unequip_hint", { name: t(def.name) })
										: t(`controls.unequip`)
								}
								onClick={() => def && onUnequip?.(slot)}
								_hover={def ? { borderColor: P.gold } : {}}
								position="relative"
							>
								<Text fontSize="16px">
									{def ? ITEM_ICONS[def.slot] || "\u2728" : ""}
								</Text>
							{!def && (
								<Text
									fontSize="9px"
									color={P.goldDark}
									position="absolute"
									bottom="1px"
								>
									{slot.slice(0, 3).toUpperCase()}
								</Text>
							)}
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
										? RARITY_COLORS[def.rarity] || P.border
										: P.border
							}
							borderRadius="2px"
							transition="all 0.1s"
							cursor={def ? "pointer" : "default"}
							title={
								def
									? t("sidebar.inventory.interactions_hint", {
											name: t(def.name),
											qty:
												invItem && invItem.quantity > 1
													? ` x${invItem.quantity}`
													: "",
											action: def.consumeEffect
												? t("controls.use")
												: t("controls.equip"),
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
							{def && (
								<Text fontSize="16px">{ITEM_ICONS[def.slot] || "\u2728"}</Text>
							)}
						{invItem && invItem.quantity > 1 && (
							<Text
								fontSize="10px"
								color="#fff"
								position="absolute"
								bottom="0"
								right="1px"
								fontFamily={P.mono}
							>
								{invItem.quantity}
								</Text>
							)}
							{isSelected && (
								<Box
									position="absolute"
									bottom="0"
									left="0"
									right="0"
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
	);
}

const EFFECT_LABELS: Record<string, { label: string; color: string }> = {
	damage: { label: "DMG", color: "#cc4444" },
	aoe: { label: "AOE", color: "#cc6622" },
	dot: { label: "DoT", color: "#44aa44" },
	heal: { label: "HEAL", color: "#33cc66" },
	aoe_heal: { label: "HEAL✦", color: "#33cc88" },
	buff: { label: "BUFF", color: "#4488cc" },
	debuff: { label: "DEBUFF", color: "#9944bb" },
	stun: { label: "STUN", color: "#ccaa22" },
	stealth: { label: "INVIS", color: "#8844cc" },
	leech: { label: "LEECH", color: "#cc2277" },
	summon: { label: "SUMMON", color: "#888844" },
};

function SpellsTab({
	classSpells,
	currentMana,
	pendingSpellId,
	onSpellClick,
}: {
	classSpells: Spell[];
	currentMana: number;
	pendingSpellId?: string | null;
	onSpellClick?: (id: string, range: number) => void;
}) {
	const { t } = useTranslation();
	return (
		<Box p="2.5">
			{classSpells.length === 0 ? (
				<Text
					textAlign="center"
					color={P.borderLight}
					fontSize="11px"
					py="8"
					fontStyle="italic"
				>
					{t("sidebar.inventory.empty_spells")}
				</Text>
			) : (
				<Flex direction="column" gap="1.5">
					{classSpells.map((spell) => {
						const isPending = pendingSpellId === spell.id;
						const noMana = currentMana < spell.manaCost;
						const isDisabled = noMana;
						const effectMeta = EFFECT_LABELS[spell.effect];
						const rangeLabel =
							spell.rangeTiles > 0
								? `${t("sidebar.inventory.range")}: ${spell.rangeTiles}`
								: t("sidebar.inventory.self");

						return (
							<Flex
								key={spell.id}
								align="center"
								gap="2.5"
								p="2"
								bg={isPending ? P.surface : P.darkest}
								border="1px solid"
								borderColor={
									isPending ? P.gold : isDisabled ? "#2a1a1a" : P.border
								}
								borderRadius="3px"
								cursor={isDisabled ? "not-allowed" : "pointer"}
								transition="all 0.12s"
								opacity={isDisabled ? 0.45 : 1}
								_hover={
									isDisabled ? {} : { bg: P.surface, borderColor: P.gold }
								}
								onClick={() => {
									if (!isDisabled) onSpellClick?.(spell.id, spell.rangeTiles);
								}}
								title={
									isDisabled
										? `Not enough mana (${spell.manaCost} required)`
										: spell.rangeTiles > 0
											? t("sidebar.inventory.spell_click_hint")
											: undefined
								}
								position="relative"
							>
								{/* Icon */}
								<Flex
									w="40px"
									h="40px"
									align="center"
									justify="center"
									bg={isPending ? P.raised : "#12100e"}
									border="1px solid"
									borderColor={
										isPending ? P.gold : isDisabled ? "#2a1a1a" : P.raised
									}
									borderRadius="3px"
									fontSize="22px"
									flexShrink={0}
									position="relative"
								>
									{SPELL_ICONS[spell.id] || "✨"}
								{/* Keybind badge */}
								{spell.key && (
									<Box
										position="absolute"
										bottom="-1px"
										right="-1px"
										bg={isPending ? P.gold : "#1a1510"}
										border="1px solid"
										borderColor={isPending ? P.gold : P.raised}
										borderRadius="2px"
										px="1"
										fontSize="10px"
										fontFamily="'Consolas', monospace"
										color={isPending ? P.bg : P.goldMuted}
										lineHeight="1.4"
									>
										{spell.key}
									</Box>
								)}
								</Flex>

								{/* Text block */}
								<Box flex="1" minW="0">
									<Flex align="center" gap="1.5" mb="0.5">
								<Text
										fontSize="13px"
										fontWeight="700"
										color={
											isPending
												? P.gold
												: isDisabled
													? P.goldDark
													: P.goldText
										}
										overflow="hidden"
										textOverflow="ellipsis"
										whiteSpace="nowrap"
									>
										{t(`spells.${spell.id}.name`)}
										</Text>
										{/* Effect type badge */}
									{effectMeta && (
										<Box
											px="1"
											py="0.5"
											bg="#0e0c0a"
											border="1px solid"
											borderColor={effectMeta.color}
											borderRadius="2px"
											fontSize="10px"
											fontWeight="700"
											letterSpacing="0.5px"
											color={effectMeta.color}
											flexShrink={0}
										>
											{effectMeta.label}
										</Box>
									)}
									</Flex>
									{/* Description */}
								<Text
									fontSize="11px"
									color={P.goldDark}
									lineHeight="1.3"
									overflow="hidden"
									style={
										{
											display: "-webkit-box",
											WebkitLineClamp: 2,
											WebkitBoxOrient: "vertical",
										} as CSSProperties
									}
								>
									{t(`spells.${spell.id}.desc`, { defaultValue: "" })}
									</Text>
									{/* Stats row */}
								<Flex align="center" gap="2" mt="1">
									<Text
										fontSize="10px"
										color={noMana ? "#882222" : P.arcane}
										fontFamily="'Consolas', monospace"
										fontWeight="700"
									>
										{spell.manaCost}mp
									</Text>
									<Text
										fontSize="10px"
										color={P.goldDark}
										fontFamily="'Consolas', monospace"
									>
										·
									</Text>
									<Text
										fontSize="10px"
										color={P.goldDark}
										fontFamily="'Consolas', monospace"
									>
										{rangeLabel}
									</Text>
									{spell.cooldownMs >= 1000 && (
										<>
											<Text
												fontSize="10px"
												color={P.goldDark}
												fontFamily="'Consolas', monospace"
											>
												·
											</Text>
											<Text
												fontSize="10px"
												color={P.goldDark}
												fontFamily="'Consolas', monospace"
											>
												{spell.cooldownMs / 1000}s cd
											</Text>
										</>
									)}
								</Flex>
								</Box>

								{/* Right badge */}
							{isPending && (
								<Text
									fontSize="10px"
									color={P.gold}
									fontWeight="700"
									letterSpacing="1px"
									textTransform="uppercase"
									flexShrink={0}
								>
									{t("sidebar.inventory.targeting")}
								</Text>
							)}
							{noMana && !isPending && (
								<Text
									fontSize="10px"
									color="#882222"
									fontWeight="700"
									letterSpacing="1px"
									textTransform="uppercase"
									flexShrink={0}
								>
									OOM
								</Text>
							)}
							</Flex>
						);
					})}
				</Flex>
			)}
		</Box>
	);
}

function PartyTab({
	partyId,
	leaderId,
	partyMembers,
	inviteId,
	setInviteId,
	onPartyInvite,
	onPartyLeave,
	onPartyKick,
	onTradeRequest,
}: {
	partyId: string;
	leaderId: string;
	partyMembers: PartyMember[];
	inviteId: string;
	setInviteId: (val: string) => void;
	onPartyInvite?: (id: string) => void;
	onPartyLeave?: () => void;
	onPartyKick?: (id: string) => void;
	onTradeRequest?: (id: string) => void;
}) {
	const { t } = useTranslation();
	return (
		<Box p="3">
			{!partyId ? (
				<VStack align="stretch" gap="3">
					<Text fontSize="11px" color={P.goldDark} fontStyle="italic">
						{t("sidebar.party.not_in_party")}
					</Text>
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
							onClick={() => {
								onPartyInvite?.(inviteId);
								setInviteId("");
							}}
						>
							{t("sidebar.party.invite")}
						</Button>
					</HStack>
				</VStack>
			) : (
				<VStack align="stretch" gap="2">
				<Text
					fontSize="11px"
					color={P.goldDark}
					letterSpacing="2px"
					textTransform="uppercase"
				>
					{t("sidebar.party.party_id", { id: partyId })}
					</Text>
					{partyMembers.map((member) => (
						<Flex
							key={member.sessionId}
							justify="space-between"
							align="center"
							p="2"
							bg={P.darkest}
							border="1px solid"
							borderColor={P.border}
							borderRadius="2px"
						>
							<HStack gap="2">
								<Box
									w="6px"
									h="6px"
									borderRadius="full"
									bg="green.400"
									flexShrink={0}
								/>
								<Text
									fontSize="12px"
									color={member.sessionId === leaderId ? P.gold : P.goldText}
									fontWeight={member.sessionId === leaderId ? "700" : "400"}
								>
									{member.name}
									{member.sessionId === leaderId
										? ` ${t("sidebar.party.leader_tag")}`
										: ""}
								</Text>
							</HStack>
							<HStack gap="1">
								{member.sessionId !== leaderId && (
									<Button
										size="xs"
										variant="ghost"
										p="0"
										h="auto"
										minW="auto"
										color={P.gold}
										fontSize="10px"
										onClick={() => onTradeRequest?.(member.sessionId)}
									>
										{t("sidebar.social.trade")}
									</Button>
								)}
								{leaderId === partyMembers[0]?.sessionId &&
									member.sessionId !== leaderId && (
										<Button
											size="xs"
											variant="ghost"
											p="0"
											h="auto"
											minW="auto"
											color="red.400"
											fontSize="10px"
											onClick={() => onPartyKick?.(member.sessionId)}
										>
											{t("sidebar.social.kick")}
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
	);
}

function FriendsTab({
	friends,
	pendingFriendRequests,
	friendName,
	setFriendName,
	onFriendRequest,
	onFriendAccept,
	onWhisper,
	onTradeRequest,
	onPartyInvite,
}: {
	friends: Friend[];
	pendingFriendRequests: { id: string; name: string }[];
	friendName: string;
	setFriendName: (val: string) => void;
	onFriendRequest?: (name: string) => void;
	onFriendAccept?: (id: string) => void;
	onWhisper?: (name: string) => void;
	onTradeRequest?: (id: string) => void;
	onPartyInvite?: (id: string) => void;
}) {
	const { t } = useTranslation();
	return (
		<Box p="3">
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
						onClick={() => {
							onFriendRequest?.(friendName);
							setFriendName("");
						}}
					>
						{t("sidebar.friends.add")}
					</Button>
				</HStack>
				<VStack align="stretch" gap="1">
					{friends.length === 0 && (
						<Text
							fontSize="11px"
							color={P.goldDark}
							textAlign="center"
							fontStyle="italic"
							py="4"
						>
							{t("sidebar.friends.no_friends")}
						</Text>
					)}
					{friends.map((friend) => (
						<Flex
							key={friend.id}
							justify="space-between"
							align="center"
							p="2"
							bg={P.darkest}
							border="1px solid"
							borderColor={P.border}
							borderRadius="2px"
						>
							<HStack gap="2">
								<Box
									w="6px"
									h="6px"
									borderRadius="full"
									bg={friend.online ? "green.400" : "gray.600"}
									flexShrink={0}
								/>
								<Text
									fontSize="12px"
									color={friend.online ? P.goldText : P.goldDark}
								>
									{friend.name}
								</Text>
							</HStack>
							<HStack gap="1">
								<Button
									size="xs"
									variant="ghost"
									p="0"
									h="auto"
									minW="auto"
									color={P.gold}
									fontSize="10px"
									onClick={() => onWhisper?.(friend.name)}
								>
									{t("sidebar.social.whisper")}
								</Button>
								{friend.online && (
									<Button
										size="xs"
										variant="ghost"
										p="0"
										h="auto"
										minW="auto"
										color="blue.400"
										fontSize="10px"
										onClick={() => onPartyInvite?.(friend.id)}
									>
										{t("sidebar.social.party_invite")}
									</Button>
								)}
								{friend.online && (
									<Button
										size="xs"
										variant="ghost"
										p="0"
										h="auto"
										minW="auto"
										color={P.gold}
										fontSize="10px"
										onClick={() => onTradeRequest?.(friend.id)}
									>
										{t("sidebar.social.trade")}
									</Button>
								)}
							</HStack>
						</Flex>
					))}
				</VStack>
				{pendingFriendRequests.length > 0 && (
					<VStack align="stretch" gap="1">
						<Text
							fontSize="9px"
							letterSpacing="2px"
							color={P.goldDark}
							textTransform="uppercase"
						>
							{t("sidebar.friends.pending_requests")}
						</Text>
						{pendingFriendRequests.map((req) => (
							<Flex
								key={req.id}
								justify="space-between"
								align="center"
								p="2"
								bg={P.darkest}
								border="1px solid"
								borderColor={P.border}
								borderRadius="2px"
							>
								<Text fontSize="12px" color={P.goldText}>
									{req.name}
								</Text>
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
	);
}

function StatChip({ label, value }: { label: string; value: number }) {
	return (
		<Box textAlign="center">
			<Text
				fontSize="11px"
				color={P.goldDark}
				letterSpacing="1px"
				textTransform="uppercase"
			>
				{label}
			</Text>
			<Text fontSize="20px" fontWeight="700" color={P.gold} mt="0.5">
				{value}
			</Text>
		</Box>
	);
}

function KeyHint({ keys, action }: { keys: string; action: string }) {
	return (
		<Flex align="center" gap="1" fontSize="11px" color={P.goldDark}>
			<Box
				bg={P.surface}
				border="1px solid"
				borderColor={P.border}
				borderRadius="2px"
				px="1.5"
				py="0.5"
				fontSize="10px"
				fontFamily="'Consolas', monospace"
				color={P.goldMuted}
			>
				{keys}
			</Box>
			{action}
		</Flex>
	);
}

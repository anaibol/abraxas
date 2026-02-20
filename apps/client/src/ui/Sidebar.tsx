import { useState } from "react";
import { X } from "lucide-react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { CLASS_STATS, ABILITIES } from "@abraxas/shared";
import { T, HEX } from "./tokens";
import { QuestLog } from "./QuestLog";
import { CharacterHeader } from "./sidebar/CharacterHeader";
import { SidebarFooter } from "./sidebar/SidebarFooter";
import { InventoryTab } from "./sidebar/InventoryTab";
import { SpellsTab } from "./sidebar/SpellsTab";
import { GroupTab } from "./sidebar/GroupTab";
import { GuildTab } from "./sidebar/GuildTab";
import { FriendsTab } from "./sidebar/FriendsTab";
import type { SidebarProps } from "./sidebar/types";
import { useAudio } from "../contexts/AudioContext";
import { useIsMobile } from "../hooks/useIsMobile";

const SIDEBAR_TABS: readonly {
	key: "inv" | "spells" | "quests" | "group" | "guild" | "friends";
	icon: string;
}[] = [
	{ key: "inv",     icon: "⚔️" },
	{ key: "spells",  icon: "📖" },
	{ key: "quests",  icon: "📜" },
	{ key: "group",   icon: "⚔️" },
	{ key: "guild",   icon: "🛡️" },
	{ key: "friends", icon: "👥" },
];

export function Sidebar({
	state,
	isRecording,
	onEquip,
	onUnequip,
	onUseItem,
	// onDropItem, // Used in App.tsx typically
	quests,
	groupId = "",
	leaderId = "",
	groupMembers = [],
	onGroupInvite,
	onGroupLeave,
	onGroupKick,
	friends = [],
	pendingFriendRequests = [],
	onFriendRequest,
	onFriendAccept,
	onWhisper,
	onTradeRequest,
	guildMembers = [],
	onGuildCreate,
	onGuildInvite,
	onGuildLeave,
	onGuildKick,
	onGuildPromote,
	onGuildDemote,
	selectedItemId,
	onSelectItem,
	onSpellClick,
	pendingSpellId,
	onClose,
	onSettings,
	onLogout,
}: SidebarProps) {
	const isMobile = useIsMobile();
	const { t } = useTranslation();
	const [tab, setTab] = useState<
		"inv" | "spells" | "quests" | "group" | "guild" | "friends"
	>("inv");
	const [inviteId, setInviteId] = useState("");
	const [friendName, setFriendName] = useState("");
	const { playUIClick, playUIHover } = useAudio();

	const stats = CLASS_STATS[state.classType];
	const classSpells =
		stats?.abilities?.map((id) => ABILITIES[id]).filter(Boolean) ?? [];

	const sidebarPanel = (
		<Flex
			w={{ base: "min(380px, 100vw)", md: "380px" }}
			h={{ base: "100dvh", md: "100%" }}
			direction="column"
			bg={T.bg}
			borderLeft={{ base: "none", md: "3px solid" }}
			borderColor={T.border}
			flexShrink={0}
			overflow="hidden"
			userSelect="none"
			fontFamily={T.display}
			position="relative"
		>
			<Box
				display={{ base: "flex", md: "none" }}
				position="absolute"
				top="10px"
				right="12px"
				zIndex={10}
				w="36px"
				h="36px"
				bg={T.raised}
				border="1px solid"
				borderColor={T.border}
				borderRadius="6px"
				alignItems="center"
				justifyContent="center"
				color={T.gold}
				cursor="pointer"
				onPointerDown={(e) => {
					e.preventDefault();
					onClose?.();
				}}
			>
				<X size={18} />
			</Box>

			{/* Header */}
			<CharacterHeader state={state} isRecording={isRecording} />

			<Box
				h="1px"
				bg={`linear-gradient(90deg, transparent, ${HEX.gold}, transparent)`}
			/>

			{/* Gold display */}
			<Flex
				justify="center"
				py="1.5"
				bg={T.darkest}
				borderBottom="1px solid"
				borderBottomColor={T.border}
			>
				<Text textStyle={T.codeText} color={T.gold} fontWeight="700">
					{state.gold ?? 0}
					{t("sidebar.inventory.gold_abbr")}
				</Text>
			</Flex>

		{/* Tabs */}
		<Flex borderBottom="2px solid" borderBottomColor={T.border}>
			{SIDEBAR_TABS.map(({ key, icon }) => (
				<Flex
					key={key}
					flex="1"
					direction="column"
					align="center"
					justify="center"
					py="2"
					gap="0.5"
					bg={tab === key ? T.surface : T.darkest}
					color={tab === key ? T.gold : T.goldDark}
					borderBottom="2px solid"
					borderBottomColor={tab === key ? T.gold : "transparent"}
					mb="-2px"
					cursor="pointer"
					transition="all 0.12s"
					_hover={{ color: T.goldText, bg: T.surface }}
					onMouseEnter={() => {
						if (tab !== key) playUIHover?.();
					}}
					onClick={() => {
						if (tab !== key) playUIClick?.();
						setTab(key);
					}}
				>
					<Box fontSize="16px" lineHeight="1">{icon}</Box>
					<Box
						fontFamily={T.display}
						fontSize="9px"
						fontWeight="700"
						letterSpacing="0.5px"
						textTransform="uppercase"
						lineHeight="1"
					>
						{t(`sidebar.tabs.${key}`)}
					</Box>
				</Flex>
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
						playerLevel={state.level ?? 1}
						pendingSpellId={pendingSpellId}
						onSpellClick={onSpellClick}
					/>
				)}
				{tab === "quests" && <QuestLog quests={quests ?? []} />}
				{tab === "group" && (
					<GroupTab
						groupId={groupId}
						leaderId={leaderId}
						groupMembers={groupMembers}
						inviteId={inviteId}
						setInviteId={setInviteId}
						onGroupInvite={onGroupInvite}
						onGroupLeave={onGroupLeave}
						onGroupKick={onGroupKick}
						onTradeRequest={onTradeRequest}
					/>
				)}
				{tab === "guild" && (
					<GuildTab
						guildId={state.guildId}
						guildMembers={guildMembers}
						onGuildCreate={onGuildCreate}
						onGuildInvite={onGuildInvite}
						onGuildLeave={onGuildLeave}
						onGuildKick={onGuildKick}
						onGuildPromote={onGuildPromote}
						onGuildDemote={onGuildDemote}
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
						onGroupInvite={onGroupInvite}
					/>
				)}
			</Box>

	{/* Footer */}
	<SidebarFooter
		state={state}
		onSettings={onSettings}
		onLogout={onLogout}
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

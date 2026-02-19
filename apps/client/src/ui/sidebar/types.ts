import { type ClassType, type EquipmentSlot, type PlayerQuestState } from "@abraxas/shared";

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

export type PartyMember = { sessionId: string; name: string };
export type Friend = { id: string; name: string; online: boolean };

export interface SidebarProps {
	state: PlayerState;
	isRecording?: boolean;
	onEquip?: (itemId: string) => void;
	onUnequip?: (slot: EquipmentSlot) => void;
	onUseItem?: (itemId: string) => void;
	onDropItem?: (itemId: string) => void;
	quests?: PlayerQuestState[];
	partyId?: string;
	leaderId?: string;
	partyMembers?: PartyMember[];
	onPartyInvite?: (targetId: string) => void;
	onPartyLeave?: () => void;
	onPartyKick?: (targetSessionId: string) => void;
	friends?: Friend[];
	pendingFriendRequests?: { id: string; name: string }[];
	onFriendRequest?: (name: string) => void;
	onFriendAccept?: (id: string) => void;
	onWhisper?: (targetName: string) => void;
	onTradeRequest?: (targetSessionId: string) => void;
	selectedItemId?: string | null;
	onSelectItem?: (itemId: string | null) => void;
	onSpellClick?: (spellId: string, rangeTiles: number) => void;
	pendingSpellId?: string | null;
	onClose?: () => void;
}

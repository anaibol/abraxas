import type { ClassType, EquipmentSlot, PlayerQuestState } from "@abraxas/shared";

export interface InventorySlot {
  itemId: string;
  quantity: number;
  slotIndex: number;
}

export type EquipmentState = Partial<Record<EquipmentSlot, string>>;

export type PlayerState = {
  name: string;
  classType: ClassType;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  alive: boolean;
  str: number;
  agi: number;
  intStat: number;
  gold: number;
  level: number;
  xp: number;
  maxXp: number;
  stealthed?: boolean;
  stunned?: boolean;
  meditating?: boolean;
  pvpEnabled?: boolean;
  inSafeZone?: boolean;
  guildId?: string;
  inventory?: InventorySlot[];
  equipment?: EquipmentState;
};

export type GroupMember = { sessionId: string; name: string };
export type Friend = { id: string; name: string; online: boolean };

export interface SidebarProps {
  state: PlayerState;
  isRecording?: boolean;
  onEquip?: (itemId: string) => void;
  onUnequip?: (slot: EquipmentSlot) => void;
  onUseItem?: (itemId: string) => void;
  onDropItem?: (itemId: string, quantity?: number) => void;
  quests?: PlayerQuestState[];
  groupId?: string;
  leaderId?: string;
  groupMembers?: GroupMember[];
  onGroupInvite?: (targetId: string) => void;
  onGroupLeave?: () => void;
  onGroupKick?: (targetSessionId: string) => void;
  friends?: Friend[];
  pendingFriendRequests?: { id: string; name: string }[];
  onFriendRequest?: (name: string) => void;
  onFriendAccept?: (id: string) => void;
  onFriendRemove?: (id: string) => void;
  onWhisper?: (targetName: string) => void;
  onTradeRequest?: (targetSessionId: string) => void;
  guildMembers?: {
    sessionId?: string;
    name: string;
    role: "LEADER" | "OFFICER" | "MEMBER";
    online: boolean;
  }[];
  onGuildCreate?: (name: string) => void;
  onGuildInvite?: (targetName: string) => void;
  onGuildLeave?: () => void;
  onGuildKick?: (targetName: string) => void;
  onGuildPromote?: (targetName: string) => void;
  onGuildDemote?: (targetName: string) => void;
  selectedItemId?: string | null;
  onSelectItem?: (itemId: string | null) => void;
  onSpellClick?: (spellId: string, rangeTiles: number) => void;
  pendingSpellId?: string | null;
  onTogglePvP?: () => void;
  onClose?: () => void;
  onSettings?: () => void;
  onLogout?: () => void;
}

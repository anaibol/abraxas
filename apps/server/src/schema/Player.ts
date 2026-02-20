import type { Ability, ClassStats, ClassType } from "@abraxas/shared";
import { ABILITIES, CLASS_STATS, EntityType } from "@abraxas/shared";
import { ArraySchema, type as schemaType, view } from "@colyseus/schema";
import { Char } from "./Char";
import { InventoryItem } from "./InventoryItem";

export class Player extends Char {
  type = EntityType.PLAYER;
  // ── Shared (visible to all clients) ─────────────────────────────────────
  @schemaType("string") groupId: string = "";
  @schemaType("string") guildId: string = "";
  @schemaType("string") classType: ClassType = "WARRIOR";
  @schemaType("boolean") meditating: boolean = false;
  @schemaType("boolean") pvpEnabled: boolean = false;

  // ── Private (only visible to the owning client via StateView) ────────────

  /** Internal DB references — server-only, never synced to clients */
  userId: string = "";
  dbId: string = "";
  @schemaType("string") role: string = "USER";
  @view() @schemaType("uint8") speedOverride: number = 0;

  /** Mana — only the local player's mana bar is rendered */
  @view() @schemaType("int32") mana: number = 0;
  @view() @schemaType("int32") maxMana: number = 0;

  /** Souls — Necromancer-only resource */
  @view() @schemaType("uint8") souls: number = 0;
  @view() @schemaType("uint8") maxSouls: number = 20;

  /** Economy — no other player should see your gold */
  @view() @schemaType("uint32") gold: number = 0;

  /** Progression — XP is private */
  @view() @schemaType("uint8") level: number = 1;
  @view() @schemaType("uint32") xp: number = 0;
  @view() @schemaType("uint32") maxXp: number = 100;

  /** Inventory — only the owning client needs item contents */
  @view() @schemaType([InventoryItem]) inventory = new ArraySchema<InventoryItem>();

  /** Equipment — only the owning client's sidebar renders these */
  @view() @schemaType(InventoryItem) equipWeapon?: InventoryItem;
  @view() @schemaType(InventoryItem) equipArmor?: InventoryItem;
  @view() @schemaType(InventoryItem) equipShield?: InventoryItem;
  @view() @schemaType(InventoryItem) equipHelmet?: InventoryItem;
  @view() @schemaType(InventoryItem) equipRing?: InventoryItem;
  @view() @schemaType(InventoryItem) equipMount?: InventoryItem;

  /** Temporary storage for reconstructed companions on login */
  savedCompanions: { type: string; level: number; exp: number; hp: number }[] = [];

  getStats(): ClassStats {
    return CLASS_STATS[this.classType];
  }

  getAbility(abilityId: string): Ability | undefined {
    return ABILITIES[abilityId];
  }
}

import type { Ability, ClassStats, ClassType } from "@abraxas/shared";
import { ABILITIES, CLASS_STATS, EntityType } from "@abraxas/shared";
import { ArraySchema, type as typeSchema, view } from "@colyseus/schema";
import { Char } from "./Char";
import { InventoryItem } from "./InventoryItem";

export class Player extends Char {
  type = EntityType.PLAYER;
  // ── Shared (visible to all clients) ─────────────────────────────────────
  @typeSchema("string") groupId: string = "";
  @typeSchema("string") guildId: string = "";
  @typeSchema("string") classType: ClassType = "WARRIOR";
  @typeSchema("boolean") meditating: boolean = false;
  @typeSchema("boolean") pvpEnabled: boolean = false;

  // ── Private (only visible to the owning client via StateView) ────────────

  /** Internal DB references — server-only, never synced to clients */
  userId: string = "";
  dbId: string = "";
  @typeSchema("string") role: string = "USER";
  @view() @typeSchema("uint8") speedOverride: number = 0;

  /** Mana — only the local player's mana bar is rendered */
  @view() @typeSchema("int32") mana: number = 0;
  @view() @typeSchema("int32") maxMana: number = 0;

  /** Souls — Necromancer-only resource */
  @view() @typeSchema("uint8") souls: number = 0;
  @view() @typeSchema("uint8") maxSouls: number = 20;

  /** Economy — no other player should see your gold */
  @view() @typeSchema("uint32") gold: number = 0;

  /** Progression — XP is private */
  @view() @typeSchema("uint8") level: number = 1;
  @view() @typeSchema("uint32") xp: number = 0;
  @view() @typeSchema("uint32") maxXp: number = 100;

  /** Inventory — only the owning client needs item contents */
  @view() @typeSchema([InventoryItem]) inventory = new ArraySchema<InventoryItem>();

  /** Equipment — only the owning client's sidebar renders these */
  @view() @typeSchema(InventoryItem) equipWeapon?: InventoryItem;
  @view() @typeSchema(InventoryItem) equipArmor?: InventoryItem;
  @view() @typeSchema(InventoryItem) equipShield?: InventoryItem;
  @view() @typeSchema(InventoryItem) equipHelmet?: InventoryItem;
  @view() @typeSchema(InventoryItem) equipRing?: InventoryItem;
  @view() @typeSchema(InventoryItem) equipMount?: InventoryItem;

  /** Temporary storage for reconstructed companions on login */
  savedCompanions: { type: string; level: number; exp: number; hp: number }[] = [];

  getStats(): ClassStats {
    return CLASS_STATS[this.classType];
  }

  getAbility(abilityId: string): Ability | undefined {
    return ABILITIES[abilityId];
  }
}

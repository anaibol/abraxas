import type { Ability, ClassStats, ClassType } from "@abraxas/shared";
import { ABILITIES, CLASS_STATS, EntityType } from "@abraxas/shared";
import { ArraySchema, type, view } from "@colyseus/schema";
import { Char } from "./Char";
import { InventoryItem } from "./InventoryItem";

export class Player extends Char {
  // ── Shared (visible to all clients) ─────────────────────────────────────
  @type("string") groupId: string = "";
  @type("string") guildId: string = "";

  constructor() {
    super();
    this.entityType = EntityType.PLAYER;
  }
  @type("string") classType: ClassType = "WARRIOR";
  @type("boolean") meditating: boolean = false;
  @type("boolean") pvpEnabled: boolean = false;

  /** Public equip item IDs — visible to all clients for rendering (weapon/shield/helmet/mount sprites). */
  @type("string") equipWeaponId: string = "";
  @type("string") equipArmorId: string = "";
  @type("string") equipShieldId: string = "";
  @type("string") equipHelmetId: string = "";
  @type("string") equipRingId: string = "";
  @type("string") equipMountId: string = "";

  // ── Private (only visible to the owning client via StateView) ────────────
  // Note: Privacy is guaranteed by client.view.add(player) in ArenaRoom.onJoin,
  // which scopes ALL @type() fields on this Player to the owning client.
  // @view() should only be used on nested Schema objects (ArraySchema/child Schemas),
  // NOT on scalar primitives — it causes refId desync in the client decoder.

  /** Internal DB references — server-only, never synced to clients */
  userId: string = "";
  dbId: string = "";
  @type("string") role: string = "USER";
  @type("uint8") speedOverride: number = 0;

  /** Mana — only the local player's mana bar is rendered */
  @type("int32") mana: number = 0;
  @type("int32") maxMana: number = 0;

  /** Souls — Necromancer-only resource */
  @type("uint8") souls: number = 0;
  @type("uint8") maxSouls: number = 20;

  /** Rage — Warrior-only resource */
  @type("uint8") rage: number = 0;
  @type("uint8") maxRage: number = 100;

  /** Energy — Rogue-only resource */
  @type("uint8") energy: number = 0;
  @type("uint8") maxEnergy: number = 100;

  /** Focus — Ranger-only resource */
  @type("uint8") focus: number = 0;
  @type("uint8") maxFocus: number = 100;

  /** Holy Power — Paladin-only resource */
  @type("uint8") holyPower: number = 0;
  @type("uint8") maxHolyPower: number = 5;

  /** Combo Points — Rogue-only resource */
  @type("uint8") comboPoints: number = 0;
  @type("uint8") maxComboPoints: number = 5;

  /** Economy — no other player should see your gold */
  @type("uint32") gold: number = 0;

  /** Progression — XP is private */
  @type("uint8") level: number = 1;
  @type("uint32") xp: number = 0;
  @type("uint32") maxXp: number = 100;

  /** Inventory — only the owning client needs item contents */
  @view() @type([InventoryItem]) inventory = new ArraySchema<InventoryItem>();

  /**
   * Equipment slots — server-only plain properties (no @type decorator).
   * These are NOT sent to any client via schema sync; client-visible equip info
   * uses the public equipWeaponId / equipShieldId / … string fields above.
   * Removing @type() eliminates the global refId allocation that was causing
   * "refId not found" errors in non-owner clients' decoders.
   */
  equipWeapon?: InventoryItem;
  equipArmor?: InventoryItem;
  equipShield?: InventoryItem;
  equipHelmet?: InventoryItem;
  equipRing?: InventoryItem;
  equipMount?: InventoryItem;

  /** Temporary storage for reconstructed companions on login */
  savedCompanions: { type: string; level: number; exp: number; hp: number }[] = [];

  getStats(): ClassStats {
    return CLASS_STATS[this.classType];
  }

  getAbility(abilityId: string): Ability | undefined {
    return ABILITIES[abilityId];
  }
}

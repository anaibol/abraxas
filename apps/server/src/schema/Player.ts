import { type, ArraySchema, view } from "@colyseus/schema";
import { Char } from "./Char";
import { InventoryItem } from "./InventoryItem";
import { CLASS_STATS, SPELLS } from "@abraxas/shared";
import type { ClassType, ClassStats, Spell } from "@abraxas/shared";

export class Player extends Char {
  // ── Shared (visible to all clients) ─────────────────────────────────────
  @type("string") partyId: string = "";
  @type("string") classType: ClassType = "WARRIOR";

  // ── Private (only visible to the owning client via StateView) ────────────

  /** Internal DB references — server-only, never synced to clients */
  userId: string = "";
  dbId: string = "";

  /** Mana — only the local player's mana bar is rendered */
  @view() @type("int16") mana: number = 0;
  @view() @type("int16") maxMana: number = 0;

  /** Economy — no other player should see your gold */
  @view() @type("uint16") gold: number = 0;

  /** Progression — XP is private */
  @view() @type("uint8") level: number = 1;
  @view() @type("uint32") xp: number = 0;
  @view() @type("uint32") maxXp: number = 100;

  /** Inventory — only the owning client needs item contents */
  @view() @type([InventoryItem]) inventory = new ArraySchema<InventoryItem>();

  /** Equipment — only the owning client's sidebar renders these */
  @view() @type("string") equipWeapon: string = "";
  @view() @type("string") equipArmor: string = "";
  @view() @type("string") equipShield: string = "";
  @view() @type("string") equipHelmet: string = "";
  @view() @type("string") equipRing: string = "";

  getStats(): ClassStats {
    return CLASS_STATS[this.classType];
  }

  getSpell(spellId: string): Spell | undefined {
    return SPELLS[spellId];
  }
}

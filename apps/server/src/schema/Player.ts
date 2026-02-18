import { Schema, type, ArraySchema, view } from "@colyseus/schema";
import { InventoryItem } from "./InventoryItem";
import { Direction } from "@abraxas/shared";
import type { ClassType } from "@abraxas/shared";

export class Player extends Schema {
  // ── Shared (visible to all clients) ─────────────────────────────────────
  @type("string") sessionId: string = "";
  @type("string") name: string = "";
  @type("string") partyId: string = "";
  @type("string") classType: ClassType = "warrior";
  @type("uint16") tileX: number = 0;
  @type("uint16") tileY: number = 0;
  @type("uint8") facing: Direction = Direction.DOWN;
  @type("int16") _hp: number = 0;
  @type("int16") maxHp: number = 0;

  @type("int16")
  get hp() {
    return this._hp;
  }
  set hp(value: number) {
    this._hp = value;
    this.alive = this._hp > 0;
  }
  @type("boolean") alive: boolean = true;
  @type("boolean") stealthed: boolean = false;
  @type("boolean") stunned: boolean = false;

  // ── Private (only visible to the owning client via StateView) ────────────
  /** Internal DB references — never needed by other clients */
  @view() @type("string") userId: string = "";
  @view() @type("string") dbId: string = "";

  /** Mana — only the local player's mana bar is rendered */
  @view() @type("int16") mana: number = 0;
  @view() @type("int16") maxMana: number = 0;

  /** Base stats — shown only in the local player's sidebar */
  @view() @type("uint8") str: number = 0;
  @view() @type("uint8") agi: number = 0;
  @view() @type("uint8") intStat: number = 0;

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
}

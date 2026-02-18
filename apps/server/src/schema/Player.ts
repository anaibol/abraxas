import { Schema, type, ArraySchema } from "@colyseus/schema";
import { InventoryItem } from "./InventoryItem";
import { Direction } from "@abraxas/shared";
import type { ClassType } from "@abraxas/shared";

export class Player extends Schema {
  @type("string") sessionId: string = "";
  @type("string") userId: string = "";
  @type("string") dbId: string = "";
  @type("string") name: string = "";
  @type("string") partyId: string = "";
  @type("string") classType: ClassType = "warrior";
  @type("uint16") tileX: number = 0;
  @type("uint16") tileY: number = 0;
  @type("uint8") facing: Direction = Direction.DOWN;
  @type("int16") _hp: number = 0;
  @type("int16") maxHp: number = 0;
  
  @type("int16") 
  get hp() { return this._hp; }
  set hp(value: number) {
      this._hp = value;
      this.alive = this._hp > 0;
  }
  @type("int16") mana: number = 0;
  @type("int16") maxMana: number = 0;
  @type("boolean") alive: boolean = true;
  @type("uint8") str: number = 0;
  @type("uint8") agi: number = 0;
  @type("uint8") intStat: number = 0;
  @type("uint16") gold: number = 0;
  @type("boolean") stealthed: boolean = false;
  @type("boolean") stunned: boolean = false;

  // Leveling
  @type("uint8") level: number = 1;
  @type("uint32") xp: number = 0;
  @type("uint32") maxXp: number = 100;

  // Inventory: up to 24 slots
  @type([InventoryItem]) inventory = new ArraySchema<InventoryItem>();

  // Equipment slots (item IDs, empty string = nothing equipped)
  @type("string") equipWeapon: string = "";
  @type("string") equipArmor: string = "";
  @type("string") equipShield: string = "";
  @type("string") equipHelmet: string = "";
  @type("string") equipRing: string = "";
}

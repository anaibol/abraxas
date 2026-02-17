import { Schema, type, ArraySchema } from "@colyseus/schema";
import { InventoryItem } from "./InventoryItem";

export class Player extends Schema {
  @type("string") sessionId: string = "";
  @type("string") name: string = "";
  @type("string") classType: string = "warrior";
  @type("uint16") tileX: number = 0;
  @type("uint16") tileY: number = 0;
  @type("string") facing: string = "down";
  @type("int16") hp: number = 0;
  @type("int16") maxHp: number = 0;
  @type("int16") mana: number = 0;
  @type("int16") maxMana: number = 0;
  @type("boolean") alive: boolean = true;
  @type("uint8") str: number = 0;
  @type("uint8") agi: number = 0;
  @type("uint8") intStat: number = 0;
  @type("uint16") gold: number = 0;
  @type("boolean") stealthed: boolean = false;
  @type("boolean") stunned: boolean = false;

  // Inventory: up to 24 slots
  @type([InventoryItem]) inventory = new ArraySchema<InventoryItem>();

  // Equipment slots (item IDs, empty string = nothing equipped)
  @type("string") equipWeapon: string = "";
  @type("string") equipArmor: string = "";
  @type("string") equipShield: string = "";
  @type("string") equipHelmet: string = "";
  @type("string") equipRing: string = "";
}

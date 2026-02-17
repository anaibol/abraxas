import { Schema, type } from "@colyseus/schema";
import type { Direction, NpcType } from "@abraxas/shared";

export class Npc extends Schema {
  @type("string") sessionId: string = "";
  @type("string") type: NpcType = "orc"; 
  @type("uint16") tileX: number = 0;
  @type("uint16") tileY: number = 0;
  @type("string") facing: Direction = "down";
  @type("int16") hp: number = 0;
  @type("int16") maxHp: number = 0;
  @type("boolean") alive: boolean = true;
  @type("uint8") str: number = 0;
  @type("uint8") agi: number = 0;
  @type("uint8") intStat: number = 0;
  @type("int16") mana: number = 0;
  @type("boolean") stealthed: boolean = false;
  @type("boolean") stunned: boolean = false;
  
  // NPCs don't need inventory/equip for now, but maybe loot table reference?
  // For now simple.
}

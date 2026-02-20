import { ArraySchema, Schema, type } from "@colyseus/schema";
import { ItemAffixSchema } from "./InventoryItem";

export class Drop extends Schema {
  @type("string") id: string = "";
  @type("string") itemType: string = "";
  @type("string") itemId: string = "";
  @type("uint32") quantity: number = 1;
  @type("uint32") goldAmount: number = 0;
  @type("uint16") tileX: number = 0;
  @type("uint16") tileY: number = 0;
  @type("float64") spawnedAt: number = 0;

  // Instance data
  @type("string") rarity: string = "common";
  @type("string") nameOverride?: string;
  @type({ [0]: ItemAffixSchema }) affixes = new ArraySchema<ItemAffixSchema>();
}

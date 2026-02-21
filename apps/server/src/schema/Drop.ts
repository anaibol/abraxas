import { DropType, ItemRarity } from "@abraxas/shared";
import { ArraySchema, Schema, type } from "@colyseus/schema";
import { ItemAffixSchema } from "./InventoryItem";

export class Drop extends Schema {
  @type("string") id: string = "";
  @type("string") itemType: string = DropType.GOLD; // DropType.GOLD or DropType.ITEM
  @type("uint32") goldAmount: number = 0;
  @type("string") itemId: string = "";
  @type("uint32") quantity: number = 0;

  @type("uint16") tileX: number = 0;
  @type("uint16") tileY: number = 0;

  // Instance data for items
  @type("string") rarity: ItemRarity = ItemRarity.COMMON;
  @type("string") nameOverride: string = "";
  @type([ItemAffixSchema]) affixes = new ArraySchema<ItemAffixSchema>();

  spawnedAt: number = 0;
}

import { DropType, ItemRarity } from "@abraxas/shared";
import { ArraySchema, Schema, type as typeSchema } from "@colyseus/schema";
import { ItemAffixSchema } from "./InventoryItem";

export class Drop extends Schema {
  @typeSchema("string") id: string = "";
  @typeSchema("string") itemType: string = DropType.GOLD; // DropType.GOLD or DropType.ITEM
  @typeSchema("uint32") goldAmount: number = 0;
  @typeSchema("string") itemId: string = "";
  @typeSchema("uint32") quantity: number = 0;

  @typeSchema("uint16") tileX: number = 0;
  @typeSchema("uint16") tileY: number = 0;

  // Instance data for items
  @typeSchema("string") rarity: string = ItemRarity.COMMON;
  @typeSchema("string") nameOverride: string = "";
  @typeSchema([ItemAffixSchema]) affixes = new ArraySchema<ItemAffixSchema>();

  spawnedAt: number = 0;
}

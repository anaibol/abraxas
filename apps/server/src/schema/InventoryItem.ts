import { ArraySchema, Schema, type as typeSchema } from "@colyseus/schema";

export class ItemAffixSchema extends Schema {
  @typeSchema("string") type: string = "";
  @typeSchema("string") stat: string = "";
  @typeSchema("int32") value: number = 0;
}

export class InventoryItem extends Schema {
  @typeSchema("string") itemId: string = "";
  @typeSchema("uint8") quantity: number = 1;
  @typeSchema("uint8") slotIndex: number = 0;

  // Instance data
  @typeSchema("string") rarity: string = "common";
  @typeSchema("string") nameOverride: string = "";
  @typeSchema([ItemAffixSchema]) affixes = new ArraySchema<ItemAffixSchema>();
}

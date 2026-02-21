import { ItemRarity } from "@abraxas/shared";
import { ArraySchema, Schema, type } from "@colyseus/schema";

export class ItemAffixSchema extends Schema {
  @type("string") affixType: string = "";
  @type("string") stat: string = "";
  @type("int32") value: number = 0;
}

export class InventoryItem extends Schema {
  @type("string") itemId: string = "";
  @type("uint8") quantity: number = 1;
  @type("uint8") slotIndex: number = 0;

  // Instance data
  @type("string") rarity: string = ItemRarity.COMMON;
  @type("string") nameOverride: string = "";
  @type([ItemAffixSchema]) affixes = new ArraySchema<ItemAffixSchema>();
}

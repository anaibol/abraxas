import { Schema, type } from "@colyseus/schema";

export class InventoryItem extends Schema {
  @type("string") itemId: string = "";
  @type("uint8") quantity: number = 1;
  @type("uint8") slotIndex: number = 0;
}

import { Schema, type } from "@colyseus/schema";

export class Drop extends Schema {
  @type("string") id: string = "";
  @type("string") itemType: string = "";
  @type("string") itemId: string = "";
  @type("uint8") quantity: number = 1;
  @type("uint16") goldAmount: number = 0;
  @type("uint16") tileX: number = 0;
  @type("uint16") tileY: number = 0;
  @type("float64") spawnedAt: number = 0;
}

import { Schema, type } from "@colyseus/schema";
import { Direction } from "@abraxas/shared";

/**
 * Base schema shared by both Player and Npc.
 * Contains all fields that are publicly visible to every client
 * and are common across character types.
 */
export abstract class Char extends Schema {
  @type("string") sessionId: string = "";
  @type("string") name: string = "";
  @type("uint16") tileX: number = 0;
  @type("uint16") tileY: number = 0;
  @type("uint8") facing: Direction = Direction.DOWN;

  // hp is tracked via _hp; the setter keeps `alive` in sync automatically.
  @type("int16") _hp: number = 0;
  @type("int16") maxHp: number = 0;

  @type("int16")
  get hp() {
    return this._hp;
  }
  set hp(value: number) {
    this._hp = value;
    this.alive = this._hp > 0;
  }

  @type("boolean") alive: boolean = true;
  @type("boolean") stealthed: boolean = false;
  @type("boolean") stunned: boolean = false;
}

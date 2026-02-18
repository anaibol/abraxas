import { Schema, type } from "@colyseus/schema";
import { Direction } from "@abraxas/shared";
import type { NpcStats } from "@abraxas/shared";

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

  // Combat stats (common to players and NPCs)
  @type("uint8") str: number = 0;
  @type("uint8") agi: number = 0;
  @type("uint8") intStat: number = 0;

  // hp is the Colyseus-tracked field; `alive` is kept in sync by the setter.
  // _hp is a plain backing field — NOT decorated — to avoid double-registration.
  private _hp: number = 0;
  @type("int16") maxHp: number = 0;

  @type("int16")
  get hp(): number {
    return this._hp;
  }
  set hp(value: number) {
    this._hp = value;
    this.alive = this._hp > 0;
  }

  @type("boolean") alive: boolean = true;
  @type("boolean") stealthed: boolean = false;
  @type("boolean") stunned: boolean = false;

  /** Returns the combat stats for this entity (class or NPC stats). */
  abstract getStats(): NpcStats | undefined;

  /** Returns the spell definition if the entity can use it. */
  abstract getSpell(spellId: string): any;

  /** Returns the tile position as a plain object. */
  getPosition() {
    return { x: this.tileX, y: this.tileY };
  }

  /** True when the entity can be targeted (alive and not stealthed). */
  isAttackable() {
    return this.alive && !this.stealthed;
  }
}

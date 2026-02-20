import type { Ability, NpcStats } from "@abraxas/shared";
import { type BufferedAction, Direction, type WindupAction } from "@abraxas/shared";
import { Schema, type } from "@colyseus/schema";

/**
 * Base schema shared by both Player and Npc.
 * Contains all fields that are publicly visible to every client
 * and are common across character types.
 */
export abstract class Char extends Schema {
  @type("string") type: string = "";
  @type("string") sessionId: string = "";
  @type("string") name: string = "";
  @type("uint16") tileX: number = 0;
  @type("uint16") tileY: number = 0;
  @type("uint8") facing: Direction = Direction.DOWN;

  // Transient server-side state (not synced to clients)
  lastMoveMs: number = 0;
  lastGcdMs: number = 0;
  spellCooldowns = new Map<string, number>();
  bufferedAction: BufferedAction | null = null;
  windupAction: WindupAction | null = null;

  // Combat stats (common to players and NPCs)
  @type("uint8") str: number = 0;
  @type("uint8") agi: number = 0;
  @type("uint8") intStat: number = 0;
  @type("uint16") armor: number = 0;

  // hp is the Colyseus-tracked field; `alive` is kept in sync by the setter.
  // _hp is a plain backing field — NOT decorated — to avoid double-registration.
  private _hp: number = 0;
  @type("int32") maxHp: number = 0;

  @type("int32")
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
  @type("boolean") spawnProtection: boolean = false;

  /** Returns the combat stats for this entity (class or NPC stats). */
  abstract getStats(): NpcStats | undefined;

  /** Returns the ability definition if the entity can use it. */
  abstract getAbility(abilityId: string): Ability | undefined;

  /** Returns the tile position as a plain object. */
  getPosition() {
    return { x: this.tileX, y: this.tileY };
  }

  /** True when the entity can be targeted (alive, not stealthed, and not spawn-protected). */
  isAttackable() {
    return this.alive && !this.stealthed && !this.spawnProtection;
  }
}

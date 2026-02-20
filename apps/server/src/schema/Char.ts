import { type Ability, EntityType, type NpcStats } from "@abraxas/shared";
import { type BufferedAction, Direction, type WindupAction } from "@abraxas/shared";
import { Schema, type as schemaType } from "@colyseus/schema";

/**
 * Base schema shared by both Player and Npc.
 * Contains all fields that are publicly visible to every client
 * and are common across character types.
 */
export abstract class Char extends Schema {
  @schemaType("string") type: EntityType = EntityType.NPC;
  @schemaType("string") sessionId: string = "";
  @schemaType("string") name: string = "";
  @schemaType("uint16") tileX: number = 0;
  @schemaType("uint16") tileY: number = 0;
  @schemaType("uint8") facing: Direction = Direction.DOWN;

  // Transient server-side state (not synced to clients)
  lastMoveMs: number = 0;
  lastGcdMs: number = 0;
  spellCooldowns = new Map<string, number>();
  bufferedAction: BufferedAction | null = null;
  windupAction: WindupAction | null = null;

  // Combat stats (common to players and NPCs)
  @schemaType("uint8") str: number = 0;
  @schemaType("uint8") agi: number = 0;
  @schemaType("uint8") intStat: number = 0;
  @schemaType("uint16") armor: number = 0;

  // hp is the Colyseus-tracked field; `alive` is kept in sync by the setter.
  // _hp is a plain backing field — NOT decorated — to avoid double-registration.
  @schemaType("int32") hp: number = 0;
  @schemaType("int32") maxHp: number = 0;

  @schemaType("boolean") alive: boolean = true;
  @schemaType("boolean") stealthed: boolean = false;
  @schemaType("boolean") stunned: boolean = false;
  @schemaType("boolean") spawnProtection: boolean = false;
  @schemaType("uint16") overrideBodyId: number = 0;
  @schemaType("uint16") overrideHeadId: number = 0;

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

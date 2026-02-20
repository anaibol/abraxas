import { MapSchema, Schema, type as schemaType } from "@colyseus/schema";
import { Drop } from "./Drop";
import { Group } from "./Group";
import { Npc } from "./Npc";
import { Player } from "./Player";

export class GameState extends Schema {
  @schemaType({ map: Player }) players = new MapSchema<Player>();
  @schemaType({ map: Npc }) npcs = new MapSchema<Npc>();
  @schemaType({ map: Drop }) drops = new MapSchema<Drop>();
  @schemaType({ map: Group }) groups = new MapSchema<Group>();
  @schemaType("uint32") tick: number = 0;
  @schemaType("number") timeOfDay: number = 12;
  @schemaType("string") weather: string = "clear";
}

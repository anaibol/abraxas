import { MapSchema, Schema, type } from "@colyseus/schema";
import { Drop } from "./Drop";
import { Group } from "./Group";
import { Npc } from "./Npc";
import { Player } from "./Player";

export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Npc }) npcs = new MapSchema<Npc>();
  @type({ map: Drop }) drops = new MapSchema<Drop>();
  @type({ map: Group }) groups = new MapSchema<Group>();
  @type("uint32") tick: number = 0;
  @type("number") timeOfDay: number = 12;
  @type("string") weather: string = "clear";
}

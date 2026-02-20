import { Schema, type, MapSchema } from "@colyseus/schema";
import { Player } from "./Player";
import { Drop } from "./Drop";
import { Npc } from "./Npc";
import { Group } from "./Group";

export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Npc }) npcs = new MapSchema<Npc>();
  @type({ map: Drop }) drops = new MapSchema<Drop>();
  @type({ map: Group }) groups = new MapSchema<Group>();
  @type("uint32") tick: number = 0;
}

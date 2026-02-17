import { Schema, type, MapSchema } from "@colyseus/schema";
import { Player } from "./Player";
import { Drop } from "./Drop";

export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Drop }) drops = new MapSchema<Drop>();
  @type("uint32") tick: number = 0;
}

import { Schema, type, ArraySchema } from "@colyseus/schema";

export class Party extends Schema {
  @type("string") id: string = "";
  @type("string") leaderSessionId: string = "";
  @type([ "string" ]) memberIds = new ArraySchema<string>();
}

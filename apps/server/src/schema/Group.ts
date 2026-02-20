import { ArraySchema, Schema, type } from "@colyseus/schema";

export class Group extends Schema {
  @type("string") id: string = "";
  @type("string") leaderSessionId: string = "";
  @type(["string"]) memberIds = new ArraySchema<string>();
}

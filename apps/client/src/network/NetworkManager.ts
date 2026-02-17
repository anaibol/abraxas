import { Client, Room } from "colyseus.js";
import type { ClassType } from "@ao5/shared";

export interface WelcomeData {
  sessionId: string;
  tileX: number;
  tileY: number;
  mapWidth: number;
  mapHeight: number;
  tileSize: number;
  collision: number[][];
}

function getServerUrl(): string {
  if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}`;
  }
  return "ws://localhost:2567";
}

export class NetworkManager {
  private client: Client;
  private room: Room | null = null;
  private welcomeData: WelcomeData | null = null;
  private welcomeResolve: ((data: WelcomeData) => void) | null = null;

  constructor(serverUrl?: string) {
    this.client = new Client(serverUrl ?? getServerUrl());
  }

  async connect(name: string, classType: ClassType): Promise<Room> {
    this.room = await this.client.joinOrCreate("arena", { name, classType });

    const welcomePromise = new Promise<WelcomeData>((resolve) => {
      this.welcomeResolve = resolve;
    });

    this.room.onMessage("welcome", (data: WelcomeData) => {
      this.welcomeData = data;
      if (this.welcomeResolve) {
        this.welcomeResolve(data);
        this.welcomeResolve = null;
      }
    });

    await welcomePromise;
    return this.room;
  }

  getRoom(): Room {
    if (!this.room) throw new Error("Not connected");
    return this.room;
  }

  getWelcomeData(): WelcomeData {
    if (!this.welcomeData) throw new Error("No welcome data");
    return this.welcomeData;
  }

  get sessionId(): string {
    return this.room?.sessionId ?? "";
  }

  sendMove(direction: string) {
    this.room?.send("move", { direction });
  }

  sendAttack(targetTileX?: number, targetTileY?: number) {
    if (targetTileX != null && targetTileY != null) {
      this.room?.send("attack", { targetTileX, targetTileY });
    } else {
      this.room?.send("attack", {});
    }
  }

  sendCast(spellId: string, targetTileX: number, targetTileY: number) {
    this.room?.send("cast", { spellId, targetTileX, targetTileY });
  }

  sendPickup(dropId: string) {
    this.room?.send("pickup", { dropId });
  }

  sendEquip(itemId: string) {
    this.room?.send("equip", { itemId });
  }

  sendUnequip(slot: string) {
    this.room?.send("unequip", { slot });
  }

  sendUseItem(itemId: string) {
    this.room?.send("use_item", { itemId });
  }

  sendDropItem(itemId: string) {
    this.room?.send("drop_item", { itemId });
  }

  sendPing() {
    this.room?.send("ping", {});
  }

  disconnect() {
    this.room?.leave();
  }
}

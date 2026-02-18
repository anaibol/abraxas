import { Client, Room } from "colyseus.js";
import type { ClassType, Direction, EquipmentSlot } from "@abraxas/shared";

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

export class NetworkManager<SC = unknown> {
  private client: Client;
  private room: Room<SC> | null = null;
  private welcomeData: WelcomeData | null = null;
  private welcomeResolve: ((data: WelcomeData) => void) | null = null;

  constructor(serverUrl?: string) {
    this.client = new Client(serverUrl ?? getServerUrl());
  }

  public onWarp: ((data: { targetMap: string; targetX: number; targetY: number }) => void) | null = null;

  async connect(name: string, classType: ClassType, token?: string, mapName?: string): Promise<Room<SC>> {
    this.room = await this.client.joinOrCreate<SC>("arena", { name, classType, token, mapName });

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

    this.room.onMessage("warp", (data: { targetMap: string; targetX: number; targetY: number }) => {
        if (this.onWarp) this.onWarp(data);
    });

    this.room.onMessage("audio", (data: { sessionId: string; data: ArrayBuffer }) => {
        if (this.onAudioData) this.onAudioData(data.sessionId, data.data);
    });

    await welcomePromise;
    return this.room;
  }

  public onAudioData: ((sessionId: string, data: ArrayBuffer) => void) | null = null;

  sendAudio(data: ArrayBuffer) {
    this.room?.send("audio", data);
  }

  getRoom(): Room<SC> {
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

  sendMove(direction: Direction) {
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

  sendUnequip(slot: EquipmentSlot) {
    this.room?.send("unequip", { slot });
  }

  sendUseItem(itemId: string) {
    this.room?.send("use_item", { itemId });
  }

  sendDropItem(itemId: string) {
    this.room?.send("drop_item", { itemId });
  }

  sendChat(message: string) {
    this.room?.send("chat", { message });
  }

  // Party System
  sendPartyInvite(targetSessionId: string) {
    this.room?.send("party_invite", { targetSessionId });
  }

  sendPartyAccept(partyId: string) {
    this.room?.send("party_accept", { partyId });
  }

  sendPartyLeave() {
    this.room?.send("party_leave", {});
  }

  sendPartyKick(targetSessionId: string) {
    this.room?.send("party_kick", { targetSessionId });
  }

  // Friend System
  sendFriendRequest(targetName: string) {
    this.room?.send("friend_request", { targetName });
  }

  sendFriendAccept(requesterId: string) {
    this.room?.send("friend_accept", { requesterId });
  }

  // Interaction
  sendInteract(npcId: string) {
    this.room?.send("interact", { npcId });
  }

  sendBuyItem(itemId: string, quantity: number) {
    this.room?.send("buy_item", { itemId, quantity });
  }

  sendSellItem(itemId: string, quantity: number, npcId?: string) {
    this.room?.send("sell_item", { itemId, quantity, npcId });
  }

  sendPing() {
    this.room?.send("ping", {});
  }

  disconnect() {
    this.room?.leave();
  }
}

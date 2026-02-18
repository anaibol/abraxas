import { Client, Room } from "colyseus.js";
import type { ClassType, Direction, EquipmentSlot, WelcomeData, ServerMessages } from "@abraxas/shared";
import { ClientMessageType, ServerMessageType } from "@abraxas/shared";



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

    this.room.onMessage(ServerMessageType.Welcome, (data: WelcomeData) => {
      this.welcomeData = data;
      if (this.welcomeResolve) {
        this.welcomeResolve(data);
        this.welcomeResolve = null;
      }
    });

    this.room.onMessage(ServerMessageType.Warp, (data: ServerMessages[ServerMessageType.Warp]) => {
        if (this.onWarp) this.onWarp(data);
    });

    this.room.onMessage(ServerMessageType.Audio, (data: ServerMessages[ServerMessageType.Audio]) => {
        if (this.onAudioData) this.onAudioData(data.sessionId, data.data);
    });

    await welcomePromise;
    return this.room;
  }

  public onAudioData: ((sessionId: string, data: ArrayBuffer) => void) | null = null;

  sendAudio(data: ArrayBuffer) {
    this.room?.send(ClientMessageType.Audio, data);
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
    this.room?.send(ClientMessageType.Move, { direction });
  }

  sendAttack(targetTileX?: number, targetTileY?: number) {
    this.room?.send(ClientMessageType.Attack, { targetTileX, targetTileY });
  }

  sendCast(spellId: string, targetTileX: number, targetTileY: number) {
    this.room?.send(ClientMessageType.Cast, { spellId, targetTileX, targetTileY });
  }

  sendPickup(dropId: string) {
    this.room?.send(ClientMessageType.Pickup, { dropId });
  }

  sendEquip(itemId: string) {
    this.room?.send(ClientMessageType.Equip, { itemId });
  }

  sendUnequip(slot: EquipmentSlot) {
    this.room?.send(ClientMessageType.Unequip, { slot });
  }

  sendUseItem(itemId: string) {
    this.room?.send(ClientMessageType.UseItem, { itemId });
  }

  sendDropItem(itemId: string) {
    this.room?.send(ClientMessageType.DropItem, { itemId });
  }

  sendChat(message: string) {
    this.room?.send(ClientMessageType.Chat, { message });
  }

  // Party System
  sendPartyInvite(targetSessionId: string) {
    this.room?.send(ClientMessageType.PartyInvite, { targetSessionId });
  }

  sendPartyAccept(partyId: string) {
    this.room?.send(ClientMessageType.PartyAccept, { partyId });
  }

  sendPartyLeave() {
    this.room?.send(ClientMessageType.PartyLeave, {});
  }

  sendPartyKick(targetSessionId: string) {
    this.room?.send(ClientMessageType.PartyKick, { targetSessionId });
  }

  // Friend System
  sendFriendRequest(targetName: string) {
    this.room?.send(ClientMessageType.FriendRequest, { targetName });
  }

  sendFriendAccept(requesterId: string) {
    this.room?.send(ClientMessageType.FriendAccept, { requesterId });
  }

  // Interaction
  sendInteract(npcId: string) {
    this.room?.send(ClientMessageType.Interact, { npcId });
  }

  sendBuyItem(itemId: string, quantity: number) {
    this.room?.send(ClientMessageType.BuyItem, { itemId, quantity });
  }

  sendSellItem(itemId: string, quantity: number, npcId?: string) {
    this.room?.send(ClientMessageType.SellItem, { itemId, quantity, npcId });
  }

  sendPing() {
    this.room?.send(ClientMessageType.Ping, {});
  }

  disconnect() {
    this.room?.leave();
  }
}

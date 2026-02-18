import { Client, Room } from "@colyseus/sdk";
import type {
  ClassType,
  Direction,
  EquipmentSlot,
  WelcomeData,
  ServerMessages,
  ClientMessages,
} from "@abraxas/shared";
import { ClientMessageType, ServerMessageType } from "@abraxas/shared";
import { GameState } from "../../../server/src/schema/GameState";

/**
 * Room type as seen from the client side.
 *
 * `@colyseus/sdk`'s `joinOrCreate<S>()` returns `Room<any, S>` where:
 *  - 1st param = server room class type → unknown to clients by design, so `any`
 *  - 2nd param = synchronized state schema → fully typed as `S`
 *
 * This alias makes that intentional constraint explicit and keeps it in one place.
 */
type ClientRoom = Room<any, GameState>; // eslint-disable-line @typescript-eslint/no-explicit-any

function getServerUrl(): string {
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost"
  ) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}`;
  }
  return "ws://localhost:2567";
}

export class NetworkManager {
  private client: Client;
  private room: ClientRoom | null = null;
  private welcomeData: WelcomeData | null = null;
  private welcomeResolve: ((data: WelcomeData) => void) | null = null;

  constructor(serverUrl?: string) {
    this.client = new Client(serverUrl ?? getServerUrl());
  }

  /** Type-safe send — payload type is inferred from ClientMessages[T]. */
  private _send<T extends ClientMessageType>(
    type: T,
    payload: ClientMessages[T],
  ): void {
    try {
      this.room?.send(type, payload);
    } catch {
      // ignore if not connected
    }
  }

  public onWarp:
    | ((data: { targetMap: string; targetX: number; targetY: number }) => void)
    | null = null;

  async connect(
    name: string,
    classType: ClassType,
    token?: string,
    mapName?: string,
  ): Promise<ClientRoom> {
    // Send the JWT as an Authorization header (static onAuth reads it as `token`).
    // This avoids passing credentials in the room options payload.
    if (token) {
      this.client.auth.token = token;
    }

    // Passing the GameState class (not just its type) tells the SDK the client
    // already knows the schema shape → server skips sending the full definition,
    // reducing join bandwidth.
    this.room = await this.client.joinOrCreate(
      "arena",
      { name, classType, mapName },
      GameState,
    );

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

    this.room.onMessage(
      ServerMessageType.Warp,
      (data: ServerMessages[ServerMessageType.Warp]) => {
        if (this.onWarp) this.onWarp(data);
      },
    );

    this.room.onMessage(
      ServerMessageType.Audio,
      (data: ServerMessages[ServerMessageType.Audio]) => {
        if (this.onAudioData) this.onAudioData(data.sessionId, data.data);
      },
    );

    await welcomePromise;
    return this.room;
  }

  public onAudioData: ((sessionId: string, data: ArrayBuffer) => void) | null =
    null;

  /** Measures round-trip latency using the built-in SDK ping. */
  ping(onResult: (rtt: number) => void): void {
    this.room?.ping(onResult);
  }

  sendAudio(data: ArrayBuffer) {
    this._send(ClientMessageType.Audio, data);
  }

  getRoom(): ClientRoom {
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
    this._send(ClientMessageType.Move, { direction });
  }

  sendAttack(targetTileX?: number, targetTileY?: number) {
    this._send(ClientMessageType.Attack, { targetTileX, targetTileY });
  }

  sendCast(spellId: string, targetTileX: number, targetTileY: number) {
    this._send(ClientMessageType.Cast, { spellId, targetTileX, targetTileY });
  }

  sendPickup(dropId: string) {
    this._send(ClientMessageType.Pickup, { dropId });
  }

  sendEquip(itemId: string) {
    this._send(ClientMessageType.Equip, { itemId });
  }

  sendUnequip(slot: EquipmentSlot) {
    this._send(ClientMessageType.Unequip, { slot });
  }

  sendUseItem(itemId: string) {
    this._send(ClientMessageType.UseItem, { itemId });
  }

  sendDropItem(itemId: string) {
    this._send(ClientMessageType.DropItem, { itemId });
  }

  sendChat(message: string) {
    this._send(ClientMessageType.Chat, { message });
  }

  // Party System
  sendPartyInvite(targetSessionId: string) {
    this._send(ClientMessageType.PartyInvite, { targetSessionId });
  }

  sendPartyAccept(partyId: string) {
    this._send(ClientMessageType.PartyAccept, { partyId });
  }

  sendPartyLeave() {
    this._send(ClientMessageType.PartyLeave, {});
  }

  sendPartyKick(targetSessionId: string) {
    this._send(ClientMessageType.PartyKick, { targetSessionId });
  }

  // Friend System
  sendFriendRequest(targetName: string) {
    this._send(ClientMessageType.FriendRequest, { targetName });
  }

  sendFriendAccept(requesterId: string) {
    this._send(ClientMessageType.FriendAccept, { requesterId });
  }

  // Interaction
  sendInteract(npcId: string) {
    this._send(ClientMessageType.Interact, { npcId });
  }

  sendBuyItem(itemId: string, quantity: number) {
    this._send(ClientMessageType.BuyItem, { itemId, quantity });
  }

  sendSellItem(itemId: string, quantity: number, npcId?: string) {
    this._send(ClientMessageType.SellItem, { itemId, quantity, npcId });
  }

  disconnect() {
    this.room?.leave();
  }
}

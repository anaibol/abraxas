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
type ClientRoom = Room<unknown, GameState>;

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

  // Buffered messages that arrive before App.tsx registers its handlers
  private _bufferedQuestList: ServerMessages[ServerMessageType.QuestList] | null = null;
  private _bufferedFriendUpdate: ServerMessages[ServerMessageType.FriendUpdate] | null = null;
  private _onFriendUpdate: ((data: ServerMessages[ServerMessageType.FriendUpdate]) => void) | null = null;

  constructor(serverUrl?: string) {
    this.client = new Client(serverUrl ?? getServerUrl());
  }

  /** Type-safe send — payload type is inferred from ClientMessages[T]. */
  private _send<T extends keyof ClientMessages>(
    type: T,
    payload: ClientMessages[T],
  ): void {
    try {
      this.room?.send(type as string, payload);
    } catch {
      // ignore if not connected
    }
  }

  public onWarp:
    | ((data: { targetMap: string; targetX: number; targetY: number }) => void)
    | null = null;

  /** Subscribe to FriendUpdate messages. Setting this flushes any buffered initial message. */
  set onFriendUpdate(cb: ((data: ServerMessages[ServerMessageType.FriendUpdate]) => void) | null) {
    this._onFriendUpdate = cb;
    if (cb && this._bufferedFriendUpdate) {
      cb(this._bufferedFriendUpdate);
      this._bufferedFriendUpdate = null;
    }
  }

  /** Consume the QuestList message that arrived during join (sent before Welcome). */
  getInitialQuestList(): ServerMessages[ServerMessageType.QuestList] | null {
    const data = this._bufferedQuestList;
    this._bufferedQuestList = null;
    return data;
  }

  async connect(
    charId: string,
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
      { charId, classType, mapName },
      GameState,
    );

    const welcomePromise = new Promise<WelcomeData>((resolve) => {
      this.welcomeResolve = resolve;
    });

    // Register handlers for messages the server sends before Welcome so they
    // are buffered and not silently dropped with a "not registered" warning.
    this.room.onMessage(ServerMessageType.QuestList, (data: ServerMessages[ServerMessageType.QuestList]) => {
      this._bufferedQuestList = data;
    });

    // Pre-register no-op handlers for combat/visual messages that are only
    // handled by GameEventHandler (set up after the Phaser scene loads).
    // This prevents "onMessage() not registered" warnings during the preloader
    // phase when the server is already broadcasting these events.
    const noop = () => {};
    this.room.onMessage(ServerMessageType.AttackStart, noop);
    this.room.onMessage(ServerMessageType.AttackHit, noop);
    this.room.onMessage(ServerMessageType.CastStart, noop);
    this.room.onMessage(ServerMessageType.CastHit, noop);
    this.room.onMessage(ServerMessageType.Damage, noop);
    this.room.onMessage(ServerMessageType.Death, noop);
    this.room.onMessage(ServerMessageType.Heal, noop);
    this.room.onMessage(ServerMessageType.Respawn, noop);
    this.room.onMessage(ServerMessageType.BuffApplied, noop);
    this.room.onMessage(ServerMessageType.StunApplied, noop);
    this.room.onMessage(ServerMessageType.StealthApplied, noop);
    this.room.onMessage(ServerMessageType.LevelUp, noop);

    this.room.onMessage(ServerMessageType.FriendUpdate, (data: ServerMessages[ServerMessageType.FriendUpdate]) => {
      if (this._onFriendUpdate) {
        this._onFriendUpdate(data);
      } else {
        this._bufferedFriendUpdate = data;
      }
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

  get sessionId(): string | undefined {
    return this.room?.sessionId;
  }

  get isGM(): boolean {
    const role = this.welcomeData?.role;
    return role === "GM" || role === "ADMIN";
  }

  sendMove(direction: Direction) {
    this._send(ClientMessageType.Move, { direction });
  }

  sendAttack(targetTileX?: number, targetTileY?: number) {
    this._send(ClientMessageType.Attack, { targetTileX, targetTileY });
  }

  sendCast(abilityId: string, targetTileX: number, targetTileY: number) {
    this._send(ClientMessageType.Cast, { abilityId, targetTileX, targetTileY });
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

  sendDropItem(itemId: string, quantity?: number) {
    this._send(ClientMessageType.DropItem, { itemId, quantity });
  }

  sendChat(message: string) {
    this._send(ClientMessageType.Chat, { message });
  }

  // Group System
  sendGroupInvite(targetSessionId: string) {
    this._send(ClientMessageType.GroupInvite, { targetSessionId });
  }

  sendGroupAccept(groupId: string) {
    this._send(ClientMessageType.GroupAccept, { groupId });
  }

  sendGroupLeave() {
    this._send(ClientMessageType.GroupLeave, {});
  }

  sendGroupKick(targetSessionId: string) {
    this._send(ClientMessageType.GroupKick, { targetSessionId });
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

  sendTame(targetSessionId: string) {
    this._send(ClientMessageType.Tame, { targetSessionId });
  }

  sendBuyItem(itemId: string, quantity: number) {
    this._send(ClientMessageType.BuyItem, { itemId, quantity });
  }

  sendSellItem(itemId: string, quantity: number, npcId?: string) {
    this._send(ClientMessageType.SellItem, { itemId, quantity, npcId });
  }

  // Bank System
  sendBankDeposit(itemId: string, quantity: number, slotIndex: number) {
    this._send(ClientMessageType.BankDeposit, { itemId, quantity, slotIndex });
  }

  sendBankWithdraw(itemId: string, quantity: number, bankSlotIndex: number) {
    this._send(ClientMessageType.BankWithdraw, {
      itemId,
      quantity,
      bankSlotIndex,
    });
  }

  sendBankClose() {
    this._send(ClientMessageType.BankClose, {});
  }

  sendMeditate() {
    this._send(ClientMessageType.Meditate, {});
  }

  // Trade System
  sendTradeRequest(targetSessionId: string) {
    this._send(ClientMessageType.TradeRequest, { targetSessionId });
  }

  sendTradeAccept(requesterSessionId: string) {
    this._send(ClientMessageType.TradeAccept, { requesterSessionId });
  }

  sendTradeOfferUpdate(gold: number, items: { itemId: string; quantity: number }[]) {
    this._send(ClientMessageType.TradeOfferUpdate, { gold, items });
  }

  sendTradeConfirm() {
    this._send(ClientMessageType.TradeConfirm, {});
  }

  sendTradeCancel() {
    this._send(ClientMessageType.TradeCancel, {});
  }

  // GM commands
  sendGMTeleport(tileX: number, tileY: number) {
    this._send(ClientMessageType.GMTeleport, { tileX, tileY });
  }

  disconnect() {
    this.room?.leave();
  }
}

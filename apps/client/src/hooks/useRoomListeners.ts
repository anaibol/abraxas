import { useEffect } from "react";
import type { Room } from "@colyseus/sdk";
import { 
  ServerMessageType, 
  ITEMS, 
  type ServerMessages, 
  type PlayerQuestState, 
  type TradeState 
} from "@abraxas/shared";
import type { GameState } from "../../../server/src/schema/GameState";
import { type NetworkManager } from "../network/NetworkManager";
import { type KillStats } from "./ScoreboardOverlay";
import { toaster } from "../ui/toaster";

export type RoomListenerCallbacks = {
  t: (key: string, options?: Record<string, unknown>) => string;
  addConsoleMessage: (text: string, color?: string) => void;
  setShopData: (data: { npcId: string; inventory: string[] } | null) => void;
  setDialogueData: (data: { npcId: string; text: string; options: { text: string; action: string; data?: unknown }[] } | null) => void;
  setQuests: (fn: (prev: PlayerQuestState[]) => PlayerQuestState[]) => void;
  setPartyData: (data: { partyId: string; leaderId: string; members: { sessionId: string; name: string }[] } | null) => void;
  setBankData: (data: { items: { itemId: string; quantity: number; slotIndex: number }[] } | null) => void;
  setTradeData: (data: TradeState | null) => void;
  setKillStats: (fn: (prev: Record<string, KillStats>) => Record<string, KillStats>) => void;
  networkRef: { current: NetworkManager | null };
};

export function useRoomListeners(
  room: Room<GameState> | null,
  network: NetworkManager | null,
  cb: RoomListenerCallbacks,
) {
  useEffect(() => {
    if (!room || !network) return;

    const {
      t, addConsoleMessage,
      setShopData, setDialogueData, setQuests,
      setPartyData, setBankData, setTradeData,
      setKillStats, networkRef,
    } = cb;

    // Collect individual unsubscribers so cleanup only removes these handlers
    // and never touches handlers registered by GameEventHandler or NetworkManager.
    const unsubs: (() => void)[] = [];
    const on = <T extends keyof ServerMessages>(
      type: T,
      handler: (data: ServerMessages[T]) => void,
    ) => {
      unsubs.push(room.onMessage(type, handler));
    };

    on(ServerMessageType.KillFeed, (data) => {
      const isPvp = room.state.players.has(data.victimSessionId);
      if (data.killerName) {
        setKillStats((prev) => {
          const cur = prev[data.killerName] ?? { npcKills: 0, pvpKills: 0 };
          return {
            ...prev,
            [data.killerName]: {
              npcKills: cur.npcKills + (isPvp ? 0 : 1),
              pvpKills: cur.pvpKills + (isPvp ? 1 : 0),
            },
          };
        });
      }
    });

    on(ServerMessageType.Chat, (data) => {
      const color =
        data.channel === "party" ? "#aaaaff"
        : data.channel === "whisper" ? "#ff88ff"
        : "#ffffff";
      addConsoleMessage(`${data.senderName}: ${data.message}`, color);
    });

    on(ServerMessageType.OpenShop, (data) => setShopData(data));

    on(ServerMessageType.OpenDialogue, (data) => {
      setDialogueData({
        ...data,
        text: t(data.text),
        options: data.options.map((opt) => ({ ...opt, text: t(opt.text) })),
      });
    });

    on(ServerMessageType.QuestUpdate, (data) => {
      setQuests((prev) => {
        const idx = prev.findIndex((q) => q.questId === data.quest.questId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = data.quest;
          return next;
        }
        return [...prev, data.quest];
      });
    });

    on(ServerMessageType.PartyInvited, (data) => {
      toaster.create({
        title: t("sidebar.party.tabs.party"),
        description: t("social.invited_to_party", { name: data.inviterName }),
        action: {
          label: t("sidebar.friends.accept"),
          onClick: () => network.sendPartyAccept(data.partyId),
        },
      });
    });

    on(ServerMessageType.PartyUpdate, (data) => {
      setPartyData(data.partyId ? data : null);
    });

    on(ServerMessageType.FriendInvited, (data) => {
      toaster.create({
        title: t("sidebar.tabs.friends"),
        description: t("social.friend_request", { targetName: data.requesterName }),
        type: "info",
        action: {
          label: t("sidebar.friends.accept"),
          onClick: () => networkRef.current?.sendFriendAccept(data.requesterId),
        },
      });
    });

    on(ServerMessageType.BankOpened, () => setBankData({ items: [] }));

    on(ServerMessageType.BankSync, (data) => setBankData({ items: data.items }));

    on(ServerMessageType.TradeRequested, (data) => {
      toaster.create({
        title: t("sidebar.party.trade"),
        description: t("social.trade_requested", { name: data.requesterName }),
        type: "info",
        action: {
          label: t("sidebar.friends.accept"),
          onClick: () => networkRef.current?.sendTradeAccept(data.requesterSessionId),
        },
      });
    });

    on(ServerMessageType.TradeStarted, (_data) => {
      // TradeStateUpdate will immediately follow with the initial state
    });

    on(ServerMessageType.TradeStateUpdate, (data) => setTradeData(data));

    on(ServerMessageType.TradeCompleted, () => {
      setTradeData(null);
      addConsoleMessage(t("game.trade_completed"), "#44ff88");
    });

    on(ServerMessageType.TradeCancelled, (data) => {
      setTradeData(null);
      addConsoleMessage(t("game.trade_cancelled", { reason: t(data.reason) }), "#ff8844");
    });

    on(ServerMessageType.ItemUsed, (data) => {
      const itemName = ITEMS[data.itemId]?.name ?? data.itemId;
      addConsoleMessage(t("game.item_used", { item: itemName }), "#aaffcc");
    });

    on(ServerMessageType.Notification, (data) => {
      addConsoleMessage(t(data.message, data.templateData), "#ffffaa");
    });

    on(ServerMessageType.Error, (data) => {
      addConsoleMessage(t(data.message, data.templateData), "#ffaaaa");
      if (!data.silent) {
        toaster.create({
          title: t("lobby.error.title"),
          description: t(data.message, data.templateData),
          type: "error",
        });
      }
    });

    on(ServerMessageType.InvalidTarget, () => {
      addConsoleMessage(t("game.invalid_target"), "#ff8888");
    });

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [room, network, cb]);
}

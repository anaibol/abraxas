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

    room.onMessage(ServerMessageType.KillFeed, (data: ServerMessages[ServerMessageType.KillFeed]) => {
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

    room.onMessage(ServerMessageType.Chat, (data: ServerMessages[ServerMessageType.Chat]) => {
      const color =
        data.channel === "party" ? "#aaaaff"
        : data.channel === "whisper" ? "#ff88ff"
        : "#ffffff";
      addConsoleMessage(`${data.senderName}: ${data.message}`, color);
    });

    room.onMessage(ServerMessageType.OpenShop, (data: ServerMessages[ServerMessageType.OpenShop]) => {
      setShopData(data);
    });

    room.onMessage(ServerMessageType.OpenDialogue, (data: ServerMessages[ServerMessageType.OpenDialogue]) => {
      setDialogueData({
        ...data,
        text: t(data.text),
        options: data.options.map((opt) => ({ ...opt, text: t(opt.text) })),
      });
    });

    room.onMessage(ServerMessageType.QuestUpdate, (data: ServerMessages[ServerMessageType.QuestUpdate]) => {
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

    room.onMessage(ServerMessageType.PartyInvited, (data: ServerMessages[ServerMessageType.PartyInvited]) => {
      toaster.create({
        title: t("sidebar.party.tabs.party"),
        description: t("social.invited_to_party", { name: data.inviterName }),
        action: {
          label: t("sidebar.friends.accept"),
          onClick: () => network.sendPartyAccept(data.partyId),
        },
      });
    });

    room.onMessage(ServerMessageType.PartyUpdate, (data: ServerMessages[ServerMessageType.PartyUpdate]) => {
      setPartyData(data.partyId ? data : null);
    });

    room.onMessage(ServerMessageType.FriendInvited, (data: ServerMessages[ServerMessageType.FriendInvited]) => {
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

    room.onMessage(ServerMessageType.BankOpened, () => {
      setBankData({ items: [] });
    });

    room.onMessage(ServerMessageType.BankSync, (data: ServerMessages[ServerMessageType.BankSync]) => {
      setBankData({ items: data.items });
    });

    room.onMessage(ServerMessageType.TradeRequested, (data: ServerMessages[ServerMessageType.TradeRequested]) => {
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

    room.onMessage(ServerMessageType.TradeStarted, (_data: ServerMessages[ServerMessageType.TradeStarted]) => {
      // TradeStateUpdate will immediately follow with the initial state
    });

    room.onMessage(ServerMessageType.TradeStateUpdate, (data: ServerMessages[ServerMessageType.TradeStateUpdate]) => {
      setTradeData(data);
    });

    room.onMessage(ServerMessageType.TradeCompleted, () => {
      setTradeData(null);
      addConsoleMessage(t("game.trade_completed"), "#44ff88");
    });

    room.onMessage(ServerMessageType.TradeCancelled, (data: ServerMessages[ServerMessageType.TradeCancelled]) => {
      setTradeData(null);
      addConsoleMessage(t("game.trade_cancelled", { reason: t(data.reason) }), "#ff8844");
    });

    room.onMessage(ServerMessageType.ItemUsed, (data: ServerMessages[ServerMessageType.ItemUsed]) => {
      const itemName = ITEMS[data.itemId]?.name ?? data.itemId;
      addConsoleMessage(t("game.item_used", { item: itemName }), "#aaffcc");
    });

    room.onMessage(ServerMessageType.Notification, (data: ServerMessages[ServerMessageType.Notification]) => {
      addConsoleMessage(t(data.message, data.templateData), "#ffffaa");
    });

    room.onMessage(ServerMessageType.Error, (data: ServerMessages[ServerMessageType.Error]) => {
      addConsoleMessage(t(data.message, data.templateData), "#ffaaaa");
      if (!data.silent) {
        toaster.create({
          title: t("lobby.error.title"),
          description: t(data.message, data.templateData),
          type: "error",
        });
      }
    });

    room.onMessage(ServerMessageType.InvalidTarget, () => {
      addConsoleMessage(t("game.invalid_target"), "#ff8888");
    });

    return () => {
      room.removeAllListeners();
    };
  }, [room, network, cb]);
}

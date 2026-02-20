import {
  ITEMS,
  type PlayerQuestState,
  type ServerMessages,
  ServerMessageType,
  type TradeState,
} from "@abraxas/shared";
import type { Room } from "@colyseus/sdk";
import { useEffect } from "react";
import type { GameState } from "../../../server/src/schema/GameState";
import type { NetworkManager } from "../network/NetworkManager";
import { toaster } from "../ui/toaster";

export type RoomListenerCallbacks = {
  t: (key: string, options?: Record<string, unknown>) => string;
  addConsoleMessage: (
    text: string,
    color?: string,
    channel?: "global" | "group" | "whisper" | "system" | "combat",
  ) => void;
  setShopData: (data: { npcId: string; inventory: string[] } | null) => void;
  setDialogueData: (
    data: {
      npcId: string;
      text: string;
      options: { text: string; action: string; data?: unknown }[];
    } | null,
  ) => void;
  setQuests: (fn: (prev: PlayerQuestState[]) => PlayerQuestState[]) => void;
  setGroupData: (
    data: {
      groupId: string;
      leaderId: string;
      members: { sessionId: string; name: string }[];
    } | null,
  ) => void;
  setGuildData: (
    data: {
      guildId: string;
      name: string;
      members: {
        sessionId?: string;
        name: string;
        role: "LEADER" | "OFFICER" | "MEMBER";
        online: boolean;
      }[];
    } | null,
  ) => void;
  setBankData: (
    data: { items: { itemId: string; quantity: number; slotIndex: number }[] } | null,
  ) => void;
  setTradeData: (data: TradeState | null) => void;
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
      t,
      addConsoleMessage,
      setShopData,
      setDialogueData,
      setQuests,
      setGroupData,
      setGuildData,
      setBankData,
      setTradeData,
      networkRef,
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

    on(ServerMessageType.Chat, (data) => {
      const color =
        data.channel === "group" ? "#aaaaff" : data.channel === "whisper" ? "#ff88ff" : "#ffffff";
      const channel =
        data.channel === "group" ? "group" : data.channel === "whisper" ? "whisper" : "global";
      addConsoleMessage(`${data.senderName}: ${data.message}`, color, channel);
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

    on(ServerMessageType.GroupInvited, (data) => {
      toaster.create({
        title: t("sidebar.tabs.group"),
        description: t("social.invited_to_group", { name: data.inviterName }),
        action: {
          label: t("sidebar.friends.accept"),
          onClick: () => network.sendGroupAccept(data.groupId),
        },
      });
    });

    on(ServerMessageType.GroupUpdate, (data) => {
      setGroupData(data.groupId ? data : null);
    });

    on(ServerMessageType.GuildInvited, (data) => {
      toaster.create({
        title: t("sidebar.tabs.guild", { defaultValue: "Guild" }),
        description: t("social.invited_to_guild", {
          name: data.inviterName,
          guild: data.guildName,
        }),
        action: {
          label: t("sidebar.friends.accept", { defaultValue: "Accept" }),
          onClick: () => network.sendGuildAccept(data.guildId),
        },
      });
    });

    on(ServerMessageType.GuildUpdate, (data) => {
      setGuildData(data.guildId ? data : null);
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
        title: t("trade.title"),
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
      addConsoleMessage(t("game.invalid_target"), "#ff8888", "combat");
    });

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [room, network, cb]);
}

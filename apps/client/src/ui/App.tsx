import {
  ChakraProvider,
  createToaster,
  Toaster,
  ToastRoot,
  ToastTitle,
  ToastDescription,
  ToastCloseTrigger,
} from "@chakra-ui/react";
import { Box, Flex } from "@chakra-ui/react";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useConsoleMessages } from "../hooks/useConsoleMessages";
import { useGameKeyboard } from "../hooks/useGameKeyboard";
import { useTranslation } from "react-i18next";
import { system } from "./theme";
import { T, HEX } from "./tokens";
import { Lobby } from "./Lobby";
import { LoadingScreen } from "./LoadingScreen";
import { Sidebar, type PlayerState } from "./Sidebar";
import { DeathOverlay } from "./DeathOverlay";
import { KillFeed, type KillFeedEntry } from "./KillFeed";
import { Console } from "./Console";
import { Minimap } from "./Minimap";
import { ScoreboardOverlay, type KillStats } from "./ScoreboardOverlay";
import { MerchantShop } from "./MerchantShop";
import { BankWindow } from "./BankWindow";
import { TradeWindow } from "./TradeWindow";
import type {
  ClassType,
  TileMap,
  PlayerQuestState,
  ServerMessages,
  TradeState,
} from "@abraxas/shared";
import { getRandomName, ServerMessageType, ITEMS, CLASS_STATS, SPELLS, type Direction } from "@abraxas/shared";
import { QuestDialogue } from "./QuestDialogue";
import { MobileControls } from "./MobileControls";
import { NetworkManager } from "../network/NetworkManager";
import { Menu, MessageCircle } from "lucide-react";
import { AudioManager } from "../managers/AudioManager";
import Phaser from "phaser";
import { PreloaderScene } from "../scenes/PreloaderScene";
import { GameScene } from "../scenes/GameScene";
import type { GameState } from "../../../server/src/schema/GameState";
import type { Room } from "@colyseus/sdk";

const toaster = createToaster({
  placement: "top",
  pauseOnPageIdle: true,
});

type RoomListenerCallbacks = {
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

function setupRoomListeners(
  room: Room<GameState>,
  network: NetworkManager,
  cb: RoomListenerCallbacks,
): void {
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
}

export function App() {
  const { t } = useTranslation();
  const killFeedIdRef = useRef(0);
  const [phase, setPhase] = useState<"lobby" | "game">("lobby");
  const [connecting, setConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playerState, setPlayerState] = useState<PlayerState>({
    name: getRandomName(),
    classType: "WARRIOR",
    hp: 100,
    maxHp: 100,
    mana: 30,
    maxMana: 30,
    alive: true,
  });
  const [deathTime, setDeathTime] = useState(0);
  const [showDeath, setShowDeath] = useState(false);
  const [killFeed, setKillFeed] = useState<KillFeedEntry[]>([]);
  const { messages: consoleMessages, add: addConsoleMessage, reset: resetConsoleMessages } = useConsoleMessages();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [mapData, setMapData] = useState<TileMap | null>(null);
  const [shopData, setShopData] = useState<{
    npcId: string;
    inventory: string[];
  } | null>(null);
  const [partyData, setPartyData] = useState<{
    partyId: string;
    leaderId: string;
    members: { sessionId: string; name: string }[];
  } | null>(null);
  const [friendsData, setFriendsData] = useState<
    { id: string; name: string; online: boolean }[]
  >([]);
  const [pendingFriendRequests, setPendingFriendRequests] = useState<
    { id: string; name: string }[]
  >([]);
  const [quests, setQuests] = useState<PlayerQuestState[]>([]);
  const [dialogueData, setDialogueData] = useState<{
    npcId: string;
    text: string;
    options: { text: string; action: string; data?: unknown }[];
  } | null>(null);
  const [bankData, setBankData] = useState<{
    items: { itemId: string; quantity: number; slotIndex: number }[];
  } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [dropDialog, setDropDialog] = useState<{
    itemId: string;
    itemName: string;
    maxQty: number;
  } | null>(null);
  const [tradeData, setTradeData] = useState<TradeState | null>(null);
  const [chatPrefill, setChatPrefill] = useState<string | undefined>();
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [killStats, setKillStats] = useState<Record<string, KillStats>>({});
  const [pendingSpellId, setPendingSpellId] = useState<string | null>(null);
  const [isMobile] = useState(() => typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0));
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const gameContainerRef = useRef<HTMLDivElement>(null);
  const phaserGameRef = useRef<Phaser.Game | null>(null);
  const networkRef = useRef<NetworkManager | null>(null);
  const audioManagerRef = useRef<AudioManager | null>(null);
  const wasAliveRef = useRef(true);

  const roomRef = useRef<Room<GameState> | null>(null);

  // Clear selection if the selected item is no longer in inventory
  useEffect(() => {
    if (!selectedItemId) return;
    const exists = playerState.inventory?.some((i) => i.itemId === selectedItemId);
    if (!exists) setSelectedItemId(null);
  }, [playerState.inventory, selectedItemId]);

  useEffect(() => {
    if (!playerState.alive && wasAliveRef.current) {
      setShowDeath(true);
      setDeathTime(Date.now());
    }
    if (playerState.alive && !wasAliveRef.current) {
      setShowDeath(false);
    }
    wasAliveRef.current = playerState.alive;
  }, [playerState.alive]);

  useEffect(() => {
    if (killFeed.length === 0) return;
    const timer = setTimeout(() => {
      setKillFeed((prev) =>
        prev.filter((e) => Date.now() - e.timestamp < 8000),
      );
    }, 8000);
    return () => clearTimeout(timer);
  }, [killFeed]);

  useEffect(() => {
    if (phase !== "game") return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [phase]);


  useEffect(() => {
    const game = phaserGameRef.current;
    if (!game) return;
    game.input.enabled = !isChatOpen;
    if (isChatOpen) {
      game.scene.getScene("GameScene")?.input?.keyboard?.resetKeys();
    }
  }, [isChatOpen]);

  useGameKeyboard({
    phase,
    isChatOpen,
    selectedItemId,
    inventory: playerState.inventory,
    dropDialog,
    networkRef,
    roomRef,
    setIsChatOpen,
    setShowScoreboard,
    setDropDialog,
    setSelectedItemId,
  });

  useEffect(() => {
    return () => {
      audioManagerRef.current?.cleanup();
    };
  }, []);


  const handleJoin = useCallback(
    async (
      charId: string,
      classType: ClassType,
      token: string,
      mapName?: string,
    ) => {
      setConnecting(true);
      if (mapName) setIsLoading(true); // If warping, show loading

      try {
        if (phaserGameRef.current) {
          phaserGameRef.current.destroy(true);
          phaserGameRef.current = null;
        }
        if (networkRef.current) {
          networkRef.current.disconnect();
        }

        const network = new NetworkManager();
        await network.connect(charId, classType, token, mapName);
        networkRef.current = network;
        roomRef.current = network.getRoom();

        const welcome = network.getWelcomeData();

        if (!audioManagerRef.current) {
          audioManagerRef.current = new AudioManager();
        }

        setMapData({
          width: welcome.mapWidth,
          height: welcome.mapHeight,
          tileSize: welcome.tileSize,
          collision: welcome.collision,
          spawns: [],
        });

        setPlayerState((prev) => ({ ...prev, classType }));
        setPhase("game");
        if (!mapName) setIsLoading(true); // Initial join also triggers loading

        // Consume messages buffered during connect() (sent before Welcome)
        const initialQuestList = network.getInitialQuestList();
        if (initialQuestList) setQuests(initialQuestList.quests);

        network.onFriendUpdate = (data: ServerMessages[ServerMessageType.FriendUpdate]) => {
          setFriendsData(data.friends);
          setPendingFriendRequests(data.pendingRequests);
        };

        network.onWarp = (data) => {
          handleJoin(charId, classType, token, data.targetMap);
        };

        resetConsoleMessages({
          id: 0,
          text: mapName ? t("game.traveling", { map: mapName }) : t("game.welcome"),
          color: "#ffff00",
          timestamp: Date.now(),
        });

        setupRoomListeners(network.getRoom(), network, {
          t,
          addConsoleMessage,
          setShopData,
          setDialogueData,
          setQuests,
          setPartyData,
          setBankData,
          setTradeData,
          setKillStats,
          networkRef,
        });

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = gameContainerRef.current;
            if (!el) return;

            const gameScene = new GameScene(
              network,
              audioManagerRef.current ?? new AudioManager(),
              (state: PlayerState) => {
                setPlayerState(state);
              },
              (killerName: string, victimName: string) => {
                setKillFeed((prev) => [
                  ...prev.slice(-9),
                  {
                    id: ++killFeedIdRef.current,
                    killerName,
                    victimName,
                    timestamp: Date.now(),
                  },
                ]);
              },
              addConsoleMessage,
              () => {
                setIsLoading(false);
                setConnecting(false);
              },
              (message: string) => {
                toaster.create({
                  title: "Error",
                  description: message,
                  type: "error",
                  duration: 3000,
                });
                setConnecting(false);
              },
              (recording) => setIsRecording(recording),
            );

            const preloaderScene = new PreloaderScene();

            phaserGameRef.current = new Phaser.Game({
              type: Phaser.AUTO,
              parent: el,
              width: el.clientWidth,
              height: el.clientHeight,
              backgroundColor: HEX.darkest,
              scene: [preloaderScene, gameScene],
              scale: {
                mode: Phaser.Scale.RESIZE,
                autoCenter: Phaser.Scale.CENTER_BOTH,
              },
              pixelArt: true,
            });
          });
        });
      } catch (err) {
        console.error("Failed to connect:", err);
        setConnecting(false);
        setIsLoading(false);
        toaster.create({
          title: "Connection Failed",
          description: "Failed to connect to server. Is it running?",
          type: "error",
        });
      }
    },
    [addConsoleMessage, resetConsoleMessages, t],
  );

  const handleSpellClick = useCallback((spellId: string, rangeTiles: number) => {
    const game = phaserGameRef.current;
    if (!game) return;
    const scene = game.scene.getScene("GameScene") as GameScene | null;
    if (!scene) return;
    scene.startSpellTargeting(spellId, rangeTiles);
    if (rangeTiles > 0) {
      setPendingSpellId(spellId);
      // Clear the pending indicator once the player clicks (or cancels) in the game
      const clearPending = () => setPendingSpellId(null);
      const canvas = game.canvas;
      const onDown = () => { clearPending(); canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("contextmenu", onDown); window.removeEventListener("keydown", onEsc); };
      const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") { clearPending(); canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("contextmenu", onDown); window.removeEventListener("keydown", onEsc); } };
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("contextmenu", onDown);
      window.addEventListener("keydown", onEsc);
    }
  }, []);

  const mobileSpells = useMemo(() => {
    const classStats = CLASS_STATS[playerState.classType?.toUpperCase() ?? "WARRIOR"];
    if (!classStats) return [];
    return classStats.spells
      .map((spellId) => {
        const spell = SPELLS[spellId];
        if (!spell) return null;
        return { key: spell.key, spellId: spell.id, rangeTiles: spell.rangeTiles };
      })
      .filter(Boolean) as { key: string; spellId: string; rangeTiles: number }[];
  }, [playerState.classType]);

  const handleMobileMove = useCallback((direction: Direction) => {
    const game = phaserGameRef.current;
    if (!game) return;
    const scene = game.scene.getScene("GameScene") as GameScene | null;
    scene?.triggerMove(direction);
  }, []);

  const handleMobileAttack = useCallback(() => {
    const game = phaserGameRef.current;
    if (!game) return;
    const scene = game.scene.getScene("GameScene") as GameScene | null;
    scene?.triggerAttack();
  }, []);

  const handleMobileSpell = useCallback((spellId: string, rangeTiles: number) => {
    handleSpellClick(spellId, rangeTiles);
  }, [handleSpellClick]);

  const handleSendChat = (msg: string) => {
    setIsChatOpen(false);

    const trimmed = msg.trim();
    if (!trimmed) return;

    if (trimmed === "/ping") {
      networkRef.current?.ping((rtt) => {
        addConsoleMessage(t("game.pong", { rtt }), "#00ffff");
      });
      return;
    }

    networkRef.current?.sendChat(msg);
  };

  useEffect(() => {
    return () => {
      phaserGameRef.current?.destroy(true);
    };
  }, []);

  return (
    <ChakraProvider value={system}>
      <Toaster toaster={toaster}>
        {(toast) => (
          <ToastRoot
            key={toast.id}
            bg={toast.type === "error" ? T.blood : T.gold}
            p="4"
            borderRadius="md"
          >
            <ToastTitle color="white" fontWeight="bold">
              {toast.title}
            </ToastTitle>
            <ToastDescription color="whiteAlpha.900">
              {toast.description}
            </ToastDescription>
            <ToastCloseTrigger color="white" />
          </ToastRoot>
        )}
      </Toaster>
      {phase === "lobby" && (
        <Lobby onJoin={handleJoin} connecting={connecting} />
      )}
      {phase === "game" && mapData && (
        <>
          {isLoading && <LoadingScreen />}
          <Flex pos="fixed" inset="0" bg={T.darkest}>
            <Box
              ref={gameContainerRef}
              flex="1"
              h="100%"
              minW="0"
              overflow="hidden"
              pos="relative"
            >
              {roomRef.current && (
                <Minimap
                  map={mapData}
                  players={roomRef.current.state?.players}
                  npcs={roomRef.current.state?.npcs}
                  currentPlayerId={roomRef.current.sessionId}
                  isMobile={isMobile}
                />
              )}
              {/* Mobile sidebar toggle button */}
              {isMobile && (
                <Box
                  position="absolute"
                  top="12px"
                  right="12px"
                  zIndex={60}
                  w="44px"
                  h="44px"
                  bg="rgba(10, 8, 20, 0.82)"
                  border="1px solid rgba(212, 168, 67, 0.4)"
                  borderRadius="8px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  color="rgba(212, 168, 67, 0.9)"
                  cursor="pointer"
                  onPointerDown={(e) => { e.preventDefault(); setIsSidebarOpen((v) => !v); }}
                >
                  <Menu size={22} />
                </Box>
              )}
            </Box>
            {(!isMobile || isSidebarOpen) && (
              <Sidebar
                state={playerState}
                isRecording={isRecording}
                quests={quests}
                onEquip={(itemId) => networkRef.current?.sendEquip(itemId)}
                onUnequip={(slot) => networkRef.current?.sendUnequip(slot)}
                onUseItem={(itemId) => networkRef.current?.sendUseItem(itemId)}
                onDropItem={(itemId) => networkRef.current?.sendDropItem(itemId)}
                partyId={partyData?.partyId}
                leaderId={partyData?.leaderId}
                partyMembers={partyData?.members || []}
                onPartyInvite={(sid: string) => networkRef.current?.sendPartyInvite(sid)}
                onPartyLeave={() => networkRef.current?.sendPartyLeave()}
                onPartyKick={(sid: string) => networkRef.current?.sendPartyKick(sid)}
                friends={friendsData}
                pendingFriendRequests={pendingFriendRequests}
                onFriendRequest={(name: string) => networkRef.current?.sendFriendRequest(name)}
                onFriendAccept={(rid: string) => networkRef.current?.sendFriendAccept(rid)}
                onWhisper={(name: string) => { setChatPrefill(`/w ${name} `); setIsChatOpen(true); }}
                onTradeRequest={(sid: string) => networkRef.current?.sendTradeRequest(sid)}
                selectedItemId={selectedItemId}
                onSelectItem={setSelectedItemId}
                onSpellClick={handleSpellClick}
                pendingSpellId={pendingSpellId}
                isMobile={isMobile}
                onClose={isMobile ? () => setIsSidebarOpen(false) : undefined}
              />
            )}
            {shopData && (
              <MerchantShop
                npcId={shopData.npcId}
                merchantInventory={shopData.inventory}
                playerGold={playerState.gold ?? 0}
                playerInventory={playerState.inventory ?? []}
                onBuy={(itemId, qty) =>
                  networkRef.current?.sendBuyItem(itemId, qty)
                }
                onSell={(itemId, qty) =>
                  networkRef.current?.sendSellItem(itemId, qty)
                }
                onClose={() => setShopData(null)}
              />
            )}
            {dialogueData && (
              <QuestDialogue
                npcId={dialogueData.npcId}
                text={dialogueData.text}
                options={dialogueData.options}
                onAction={(action, data) =>
                  networkRef.current?.getRoom().send(action, data)
                }
                onClose={() => setDialogueData(null)}
              />
            )}
            {bankData && (
              <BankWindow
                bankItems={bankData.items}
                playerInventory={(playerState.inventory ?? []).map((it) => ({
                  ...it,
                  slotIndex: it.slotIndex,
                }))}
                onDeposit={(itemId, qty, slot) =>
                  networkRef.current?.sendBankDeposit(itemId, qty, slot)
                }
                onWithdraw={(itemId, qty, slot) =>
                  networkRef.current?.sendBankWithdraw(itemId, qty, slot)
                }
                onClose={() => {
                  networkRef.current?.sendBankClose();
                  setBankData(null);
                }}
              />
            )}
          </Flex>
          <DeathOverlay visible={showDeath} deathTime={deathTime} />
          {roomRef.current && (
            <ScoreboardOverlay
              visible={showScoreboard}
              killStats={killStats}
              onlinePlayers={Array.from(roomRef.current.state?.players?.values() ?? []).map((p) => ({
                name: p.name,
                classType: p.classType,
                alive: p.alive,
              }))}
              myName={playerState.name}
              myLevel={playerState.level ?? 1}
            />
          )}
          <KillFeed entries={killFeed} />
          <Console
            messages={consoleMessages}
            isChatOpen={isChatOpen}
            onSendChat={(msg) => { setChatPrefill(undefined); handleSendChat(msg); }}
            prefillMessage={chatPrefill}
          />
          {/* Mobile chat button */}
          {isMobile && !isChatOpen && (
            <Box
              position="fixed"
              bottom="212px"
              left="16px"
              zIndex={60}
              w="44px"
              h="44px"
              bg="rgba(10, 8, 20, 0.82)"
              border="1px solid rgba(212, 168, 67, 0.4)"
              borderRadius="8px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              color="rgba(212, 168, 67, 0.9)"
              cursor="pointer"
              onPointerDown={(e) => { e.preventDefault(); setIsChatOpen(true); }}
            >
              <MessageCircle size={20} />
            </Box>
          )}
          {/* Mobile movement and action controls */}
          {isMobile && (
            <MobileControls
              onMove={handleMobileMove}
              onAttack={handleMobileAttack}
              onSpell={handleMobileSpell}
              spells={mobileSpells}
            />
          )}
          {tradeData && roomRef.current && (
            <TradeWindow
              trade={tradeData}
              mySessionId={roomRef.current.sessionId}
              playerInventory={playerState.inventory ?? []}
              playerGold={playerState.gold ?? 0}
              onUpdateOffer={(gold, items) => networkRef.current?.sendTradeOfferUpdate(gold, items)}
              onConfirm={() => networkRef.current?.sendTradeConfirm()}
              onCancel={() => networkRef.current?.sendTradeCancel()}
            />
          )}
        </>
      )}

      {/* Drop quantity dialog */}
      {dropDialog && (
        <DropQuantityDialog
          itemName={dropDialog.itemName}
          maxQty={dropDialog.maxQty}
          onConfirm={(qty) => {
            networkRef.current?.sendDropItem(dropDialog.itemId, qty);
            setSelectedItemId(null);
            setDropDialog(null);
          }}
          onCancel={() => setDropDialog(null)}
        />
      )}
    </ChakraProvider>
  );
}

// ── Drop quantity dialog ──────────────────────────────────────────────────────

function DropQuantityDialog({
  itemName,
  maxQty,
  onConfirm,
  onCancel,
}: {
  itemName: string;
  maxQty: number;
  onConfirm: (qty: number) => void;
  onCancel: () => void;
}) {
  const [qty, setQty] = useState(maxQty);
  const clamp = (n: number) => Math.min(Math.max(1, n), maxQty);
  const confirm = () => onConfirm(clamp(qty));

  return (
    <Box
      position="fixed"
      inset="0"
      zIndex={200}
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="rgba(0,0,0,0.65)"
      onClick={onCancel}
    >
      <Box
        bg={T.bg}
        border="2px solid"
        borderColor={T.border}
        borderRadius="4px"
        p="5"
        w="260px"
        fontFamily={T.display}
        onClick={(e) => e.stopPropagation()}
      >
        <Box textStyle={T.sectionLabel} color={T.gold} mb="1" textAlign="center">
          Drop Item
        </Box>
        <Box textStyle={T.bodyText} color={T.goldText} textAlign="center" mb="3">
          {itemName}
        </Box>

        <Box mb="3">
          <Box textStyle={T.statLabel} color={T.goldDark} letterSpacing="2px" mb="1">
            Quantity (1 – {maxQty})
          </Box>
          <input
            // biome-ignore lint/a11y/noAutofocus: dialog input needs immediate focus for keyboard shortcuts
            autoFocus
            type="number"
            min={1}
            max={maxQty}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); onCancel(); }
              if (e.key === "Enter")  { e.preventDefault(); confirm(); }
            }}
            style={{
              width: "100%",
              background: HEX.surface,
              border: `1px solid ${HEX.border}`,
              borderRadius: "2px",
              color: HEX.goldText,
              fontFamily: "var(--chakra-fonts-mono)",
              fontSize: "14px",
              padding: "4px 8px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </Box>

        <Flex gap="2">
          <Box as="button" flex="1" py="1.5" textStyle={T.bodyText} fontWeight="700" letterSpacing="1px" bg={T.raised} border="1px solid" borderColor={T.border} borderRadius="2px" color={T.goldText} cursor="pointer" fontFamily={T.display} onClick={onCancel}>
            Cancel
          </Box>
          <Box as="button" flex="1" py="1.5" textStyle={T.bodyText} fontWeight="700" letterSpacing="1px" bg={T.goldDark} border="1px solid" borderColor={T.gold} borderRadius="2px" color={T.gold} cursor="pointer" fontFamily={T.display} onClick={confirm}>
            Drop
          </Box>
        </Flex>
      </Box>
    </Box>
  );
}

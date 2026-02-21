import type {
  ClassType,
  Direction,
  MinimapMarker,
  PlayerQuestState,
  ServerMessages,
  TileMap,
  TradeState,
} from "@abraxas/shared";
import {
  ABILITIES,
  CLASS_STATS,
  getRandomName,
  ITEMS,
  type ServerMessageType,
} from "@abraxas/shared";
import {
  Box,
  ChakraProvider,
  Flex,
  ToastCloseTrigger,
  ToastDescription,
  Toaster,
  ToastRoot,
  ToastTitle,
} from "@chakra-ui/react";
import type { Room } from "@colyseus/sdk";
import { Menu, MessageCircle } from "lucide-react";
import Phaser from "phaser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GameState } from "../../../server/src/schema/GameState";
import { useAudio } from "../contexts/AudioContext";
import { useConsoleMessages } from "../hooks/useConsoleMessages";
import { useGameKeyboard } from "../hooks/useGameKeyboard";
import { useGameSettings } from "../hooks/useGameSettings";
import { useIsMobile } from "../hooks/useIsMobile";
import { useRoomListeners } from "../hooks/useRoomListeners";
import { AudioManager } from "../managers/AudioManager";
import { NetworkManager } from "../network/NetworkManager";
import { GameScene } from "../scenes/GameScene";
import { PreloaderScene } from "../scenes/PreloaderScene";
import { BankWindow } from "./BankWindow";
import { Console } from "./Console";
import { DeathOverlay } from "./DeathOverlay";
import { DebugOverlay } from "./DebugOverlay";
import { DropQuantityDialog } from "./DropQuantityDialog";
import { FastTravelModal } from "./FastTravelModal";
import { KillFeed, type KillFeedEntry } from "./KillFeed";
import { LoadingScreen } from "./LoadingScreen";
import { Lobby } from "./Lobby";
import { MerchantShop } from "./MerchantShop";
import { Minimap } from "./Minimap";
import { MobileControls } from "./MobileControls";
import { NpcContextMenu, type NpcContextTarget } from "./NpcContextMenu";
import { PlayerContextMenu, type PlayerContextTarget } from "./PlayerContextMenu";
import { QuestDialogue } from "./QuestDialogue";
import { LeaderboardModal } from "./LeaderboardModal";
import { SettingsModal } from "./SettingsModal";
import { Sidebar } from "./Sidebar";
import type { PlayerState } from "./sidebar/types";
import { TradeWindow } from "./TradeWindow";
import { SummonOverlay } from "./SummonOverlay";
import { WorldEventBanner } from "./WorldEventBanner";
import { WorldMapModal } from "./WorldMapModal";
import { system } from "./theme";
import { toaster } from "./toaster";
import { HEX, T } from "./tokens";

export function App() {
  const { setSoundManager } = useAudio();
  const { t } = useTranslation();
  const killFeedIdRef = useRef(0);
  const [phase, setPhase] = useState<"lobby" | "game">("lobby");
  const [connecting, setConnecting] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionLost, setConnectionLost] = useState(false);
  const [playerState, setPlayerState] = useState<PlayerState>({
    name: getRandomName(),
    classType: "WARRIOR",
    hp: 100,
    maxHp: 100,
    mana: 30,
    maxMana: 30,
    alive: true,
    str: 0,
    agi: 0,
    intStat: 0,
    gold: 0,
    level: 1,
    xp: 0,
    maxXp: 100,
  });
  const [deathTime, setDeathTime] = useState(0);
  const [showDeath, setShowDeath] = useState(false);
  const [killFeed, setKillFeed] = useState<KillFeedEntry[]>([]);
  const {
    messages: consoleMessages,
    add: addConsoleMessage,
    reset: resetConsoleMessages,
  } = useConsoleMessages();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [mapData, setMapData] = useState<TileMap | null>(null);
  const [shopData, setShopData] = useState<{
    npcId: string;
    inventory: string[];
  } | null>(null);
  const [groupData, setGroupData] = useState<{
    groupId: string;
    leaderId: string;
    members: { sessionId: string; name: string }[];
  } | null>(null);
  const [friendsData, setFriendsData] = useState<{ id: string; name: string; online: boolean }[]>(
    [],
  );
  const [guildData, setGuildData] = useState<{
    guildId: string;
    name: string;
    members: {
      sessionId?: string;
      name: string;
      role: "LEADER" | "OFFICER" | "MEMBER";
      online: boolean;
    }[];
  } | null>(null);
  const [pendingFriendRequests, setPendingFriendRequests] = useState<
    { id: string; name: string }[]
  >([]);
  const [quests, setQuests] = useState<PlayerQuestState[]>([]);
  const [dialogueData, setDialogueData] = useState<{
    npcId: string;
    npcType: string;
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
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [pendingSpellId, setPendingSpellId] = useState<string | null>(null);
  const [playerContextMenu, setPlayerContextMenu] = useState<PlayerContextTarget | null>(null);
  const [npcContextMenu, setNpcContextMenu] = useState<NpcContextTarget | null>(null);
  const isMobile = useIsMobile();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSummonOverlay, setShowSummonOverlay] = useState(false);
  const [isGM, setIsGM] = useState(false);
  const [showWorldMap, setShowWorldMap] = useState(false);
  const [showFastTravel, setShowFastTravel] = useState(false);
  const [worldEvent, setWorldEvent] = useState<{
    eventId: string;
    name: string;
    description: string;
    endsAt: number;
    totalNpcs: number;
    npcsDead: number;
  } | null>(null);
  const [currentMapName, setCurrentMapName] = useState("arena");
  const { settings: gameSettingsState } = useGameSettings();

  const [room, setRoom] = useState<Room<GameState> | null>(null);
  const roomRef = useRef<Room<GameState> | null>(null);

  const gameContainerRef = useRef<HTMLDivElement>(null);
  const phaserGameRef = useRef<Phaser.Game | null>(null);
  const networkRef = useRef<NetworkManager | null>(null);
  const audioManagerRef = useRef<AudioManager | null>(null);
  const wasAliveRef = useRef(true);

  // Auto-reconnect state
  const lastSessionRef = useRef<{ charId: string; classType: ClassType; token: string } | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useRoomListeners(room, networkRef.current, {
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
  });

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
      setKillFeed((prev) => prev.filter((e) => Date.now() - e.timestamp < 8000));
    }, 8000);
    return () => clearTimeout(timer);
  }, [killFeed]);

  useEffect(() => {
    if (phase !== "game") return;
    if (window.location.hostname === "localhost") return;

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
    setShowLeaderboard,
    setDropDialog,
    setSelectedItemId,
  });

  // L key opens leaderboard
  useEffect(() => {
    if (phase !== "game") return;
    const handler = (e: KeyboardEvent) => {
      if (isChatOpen) return;
      if (e.key === "l" || e.key === "L") {
        setShowLeaderboard((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, isChatOpen]);

  // M key opens World Map
  useEffect(() => {
    if (phase !== "game") return;
    const handler = (e: KeyboardEvent) => {
      if (isChatOpen) return;
      if (e.key === "m" || e.key === "M") {
        setShowWorldMap((v) => !v);
      }
      if (e.key === "f" || e.key === "F") {
        setShowFastTravel((v) => !v);
      }
      if (e.key === "Escape") {
        setShowWorldMap(false);
        setShowFastTravel(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, isChatOpen]);

  useEffect(() => {
    return () => {
      audioManagerRef.current?.cleanup();
    };
  }, []);

  const handleJoin = useCallback(
    async (charId: string, classType: ClassType, token: string, mapName?: string) => {
      // Cancel any pending reconnect timer when a new join starts
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setConnecting(true);
      setJoinError(null);
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
        const room = network.getRoom();
        roomRef.current = room;
        setRoom(room);

        const welcome = network.getWelcomeData();

        setCurrentMapName(welcome.roomMapName ?? "arena");

        if (!audioManagerRef.current) {
          audioManagerRef.current = new AudioManager();
        }

        setMapData({
          width: welcome.mapWidth,
          height: welcome.mapHeight,
          tileSize: welcome.tileSize,
          collision: welcome.collision,
          tileTypes: welcome.tileTypes,
          npcCount: 0,
          spawns: [],
          newbieSpawns: [],
          safeZones: [],
          npcs: [],
          warps: [],
        });

        setPlayerState((prev) => ({ ...prev, classType }));
        setIsGM(network.isGM);
        setPhase("game");
        if (!mapName) setIsLoading(true); // Initial join also triggers loading

        // Store credentials for auto-reconnect
        lastSessionRef.current = { charId, classType, token };

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

        network.onWorldEventStart = (data) => {
          setWorldEvent({
            eventId: data.eventId,
            name: data.name,
            description: data.description,
            endsAt: Date.now() + data.durationMs,
            totalNpcs: data.totalNpcs,
            npcsDead: 0,
          });
        };
        network.onWorldEventEnd = () => {
          setWorldEvent(null);
        };
        network.onDisconnect = () => {
          setConnectionLost(true);

          // Clean up current session state
          networkRef.current = null;
          phaserGameRef.current?.destroy(true);
          phaserGameRef.current = null;
          roomRef.current = null;
          setRoom(null);

          const session = lastSessionRef.current;
          if (!session) {
            // No credentials to reconnect with — go to lobby
            setPhase("lobby");
            setConnectionLost(false);
            setConnecting(false);
            setIsLoading(false);
            return;
          }

          // Auto-reconnect with exponential backoff
          const MAX_RETRIES = 5;
          let attempt = 0;

          const tryReconnect = () => {
            attempt++;
            console.log(`[Abraxas] Reconnect attempt ${attempt}/${MAX_RETRIES}...`);
            handleJoin(session.charId, session.classType, session.token)
              .then(() => {
                // Success — clear the overlay
                setConnectionLost(false);
              })
              .catch((err) => {
                console.warn(`[Abraxas] Reconnect attempt ${attempt} failed:`, err);
                if (attempt < MAX_RETRIES) {
                  const delay = Math.min(2000 * Math.pow(2, attempt - 1), 32000);
                  reconnectTimerRef.current = setTimeout(tryReconnect, delay);
                } else {
                  // Exhausted retries — fall back to lobby
                  console.error("[Abraxas] All reconnect attempts failed, returning to lobby.");
                  lastSessionRef.current = null;
                  setPhase("lobby");
                  setConnectionLost(false);
                  setConnecting(false);
                  setIsLoading(false);
                }
              });
          };

          // Start first attempt after a brief delay
          reconnectTimerRef.current = setTimeout(tryReconnect, 2000);
        };

        network.onWorldEventProgress = (data) => {
          setWorldEvent((prev) =>
            prev ? { ...prev, npcsDead: data.npcsDead } : null,
          );
        };

        resetConsoleMessages({
          id: 0,
          text: mapName ? t("game.traveling", { map: mapName }) : t("game.welcome"),
          color: "#ffff00",
          timestamp: Date.now(),
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
              (sm) => {
                setSoundManager(sm);
                setIsLoading(false);
                setConnecting(false);
              },
              (recording) => setIsRecording(recording),
              (sessionId, name, screenX, screenY) => {
                setPlayerContextMenu({ sessionId, name, screenX, screenY });
              },
              (sessionId, name, type, screenX, screenY) => {
                setNpcContextMenu({ sessionId, name, type, screenX, screenY });
              },
              (tileX, tileY) => {
                networkRef.current?.sendGMTeleport(tileX, tileY);
              },
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
              roundPixels: true,
            });
          });
        });
      } catch (err) {
        console.error("Failed to connect:", err);
        setConnecting(false);
        setIsLoading(false);
        setJoinError(t("game.connection_failed_desc"));
      }
    },
    [addConsoleMessage, resetConsoleMessages, t],
  );

  const handleLogout = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    lastSessionRef.current = null;
    networkRef.current?.disconnect();
    networkRef.current = null;
    phaserGameRef.current?.destroy(true);
    phaserGameRef.current = null;
    roomRef.current = null;
    setRoom(null);
    setConnectionLost(false);
    localStorage.removeItem("abraxas_token");
    setPhase("lobby");
    setIsSidebarOpen(false);
    setShowSettings(false);
  }, []);

  const handleSpellClick = useCallback((spellId: string, rangeTiles: number) => {
    const game = phaserGameRef.current;
    if (!game) return;
    const scene = game.scene.getScene("GameScene");
    if (!(scene instanceof GameScene)) return;
    const ok = scene.startSpellTargeting(spellId, rangeTiles);
    if (ok && rangeTiles > 0) {
      setPendingSpellId(spellId);
      const canvas = game.canvas;
      const cleanup = () => {
        setPendingSpellId(null);
        canvas.removeEventListener("pointerdown", cleanup);
        canvas.removeEventListener("contextmenu", cleanup);
        window.removeEventListener("keydown", onEsc);
        scene.onTargetingCancelled = undefined;
      };
      const onEsc = (e: KeyboardEvent) => {
        if (e.key === "Escape") cleanup();
      };
      canvas.addEventListener("pointerdown", cleanup);
      canvas.addEventListener("contextmenu", cleanup);
      window.addEventListener("keydown", onEsc);
      scene.onTargetingCancelled = cleanup;
    }
  }, []);

  const mobileSpells = useMemo(() => {
    const classStats = CLASS_STATS[playerState.classType?.toUpperCase() ?? "WARRIOR"];
    if (!classStats) return [];
    return classStats.abilities.flatMap((abilityId) => {
      const ability = ABILITIES[abilityId];
      return ability
        ? [{ key: ability.key, spellId: ability.id, rangeTiles: ability.rangeTiles }]
        : [];
    });
  }, [playerState.classType]);

  const handleMobileMove = useCallback((direction: Direction) => {
    const game = phaserGameRef.current;
    if (!game) return;
    const scene = game.scene.getScene("GameScene");
    if (!(scene instanceof GameScene)) return;
    scene?.triggerMove(direction);
  }, []);

  const handleMobileAttack = useCallback(() => {
    const game = phaserGameRef.current;
    if (!game) return;
    const scene = game.scene.getScene("GameScene");
    if (!(scene instanceof GameScene)) return;
    scene?.triggerAttack();
  }, []);

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

    if (trimmed === "/cc" && isGM) {
      setShowSummonOverlay(true);
      return;
    }

    networkRef.current?.sendChat(trimmed);
  };

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
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
            <ToastTitle color="white" fontWeight="700">
              {toast.title}
            </ToastTitle>
            <ToastDescription color="whiteAlpha.900">{toast.description}</ToastDescription>
            <ToastCloseTrigger color="white" />
          </ToastRoot>
        )}
      </Toaster>
      {connectionLost && (
        <Flex
          pos="fixed"
          inset="0"
          zIndex={9999}
          bg="rgba(0, 0, 0, 0.85)"
          align="center"
          justify="center"
          direction="column"
          gap="4"
        >
          <Box fontSize="2xl" fontWeight="700" color="#ff6655">
            {t("game.connection_lost", "Connection Lost")}
          </Box>
          <Box fontSize="md" color="whiteAlpha.700" textAlign="center">
            {t("game.reconnecting", "Reconnecting...")}
          </Box>
        </Flex>
      )}
      {connecting && <LoadingScreen />}
      {phase === "lobby" && !connecting && <Lobby onJoin={handleJoin} connecting={connecting} error={joinError} />}
      {phase === "game" && mapData && (
        <>
          {isLoading && <LoadingScreen />}
          <Flex pos="fixed" inset="0" bg={T.darkest}>
            <Box ref={gameContainerRef} flex="1" h="100%" minW="0" overflow="hidden" pos="relative">
              {roomRef.current && gameSettingsState.showMinimap && (
                <Minimap
                  map={mapData}
                  players={roomRef.current.state?.players}
                  npcs={roomRef.current.state?.npcs}
                  currentPlayerId={roomRef.current.sessionId}
                  isGM={isGM}
                  onGMClick={(tileX, tileY) => networkRef.current?.sendGMTeleport(tileX, tileY)}
                  markers={[
                    // Quest NPCs: show yellow ? pin at quest NPC locations (derived from active quests)
                    ...quests
                      .filter((q) => q.status === "IN_PROGRESS")
                      .flatMap((q): MinimapMarker[] => {
                        const npc = roomRef.current?.state?.npcs
                          ? Array.from(roomRef.current.state.npcs.values()).find(
                              (n) => n.sessionId === q.questId,
                            )
                          : undefined;
                        return npc
                          ? [{ id: `quest-${q.questId}`, tileX: npc.tileX, tileY: npc.tileY, type: "quest" as const }]
                          : [];
                      }),
                    // Waypoints from current map
                    ...(mapData.waypoints ?? []).map((wp): MinimapMarker => ({
                      id: `wp-${wp.id}`,
                      tileX: wp.x,
                      tileY: wp.y,
                      type: "waypoint" as const,
                    })),
                    // Active world event marker (approx center of map)
                    ...(worldEvent
                      ? [{
                          id: "world-event",
                          tileX: Math.floor((mapData.width ?? 80) / 2),
                          tileY: Math.floor((mapData.height ?? 60) / 2),
                          type: "event" as const,
                        } satisfies MinimapMarker]
                      : []),
                  ]}
                />
              )}

              <DebugOverlay />

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
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setIsSidebarOpen((v) => !v);
                  }}
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
                onDropItem={(itemId) => {
                  const item = playerState.inventory?.find(i => i.itemId === itemId);
                  if (item) {
                    setDropDialog({ itemId: item.itemId, itemName: ITEMS[item.itemId]?.name || item.itemId, maxQty: item.quantity });
                  }
                }}
                groupId={groupData?.groupId}
                leaderId={groupData?.leaderId}
                groupMembers={groupData?.members || []}
                onGroupInvite={(sid: string) => networkRef.current?.sendGroupInvite(sid)}
                onGroupLeave={() => networkRef.current?.sendGroupLeave()}
                onGroupKick={(sid: string) => networkRef.current?.sendGroupKick(sid)}
                guildMembers={guildData?.members || []}
                onGuildCreate={(name: string) => networkRef.current?.sendGuildCreate(name)}
                onGuildInvite={(name: string) => networkRef.current?.sendGuildInvite(name)}
                onGuildLeave={() => networkRef.current?.sendGuildLeave()}
                onGuildKick={(name: string) => networkRef.current?.sendGuildKick(name)}
                onGuildPromote={(name: string) => networkRef.current?.sendGuildPromote(name)}
                onGuildDemote={(name: string) => networkRef.current?.sendGuildDemote(name)}
                onTogglePvP={() => networkRef.current?.sendTogglePvP()}
                friends={friendsData}
                pendingFriendRequests={pendingFriendRequests}
                onFriendRequest={(name: string) => networkRef.current?.sendFriendRequest(name)}
                onFriendAccept={(rid: string) => networkRef.current?.sendFriendAccept(rid)}
                onFriendRemove={(fid: string) => networkRef.current?.sendFriendRemove(fid)}
                onWhisper={(name: string) => {
                  setChatPrefill(`/w ${name} `);
                  setIsChatOpen(true);
                }}
                onTradeRequest={(sid: string) => networkRef.current?.sendTradeRequest(sid)}
                selectedItemId={selectedItemId}
                onSelectItem={setSelectedItemId}
                onSpellClick={handleSpellClick}
                pendingSpellId={pendingSpellId}
                onClose={isMobile ? () => setIsSidebarOpen(false) : undefined}
                onSettings={() => setShowSettings(true)}
                onLeaderboard={() => setShowLeaderboard(true)}
                onLogout={handleLogout}
              />
            )}
            {shopData && (
              <MerchantShop
                npcId={shopData.npcId}
                merchantInventory={shopData.inventory}
                playerGold={playerState.gold}
                playerInventory={playerState.inventory ?? []}
                onBuy={(itemId, qty) => networkRef.current?.sendBuyItem(itemId, qty)}
                onSell={(itemId, qty) => networkRef.current?.sendSellItem(itemId, qty)}
                onClose={() => setShopData(null)}
              />
            )}
            {dialogueData && (
              <QuestDialogue
                npcId={dialogueData.npcId}
                npcType={dialogueData.npcType}
                text={dialogueData.text}
                options={dialogueData.options}
                onAction={(action, data) => networkRef.current?.getRoom().send(action, data)}
                onClose={() => setDialogueData(null)}
              />
            )}
            {bankData && (
              <BankWindow
                bankItems={bankData.items}
                playerInventory={(playerState.inventory ?? []).map((it) => ({
                    ...it,
                    slotIndex: 0 // BankWindow might need slotIndex but player inventory items don't have it natively in playerState
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
          <KillFeed entries={killFeed} />
          <Console
            messages={consoleMessages}
            isChatOpen={isChatOpen}
            onSendChat={(msg) => {
              setChatPrefill(undefined);
              handleSendChat(msg);
            }}
            prefillMessage={chatPrefill}
            isGM={isGM}
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
              onPointerDown={(e) => {
                e.preventDefault();
                setIsChatOpen(true);
              }}
            >
              <MessageCircle size={20} />
            </Box>
          )}
          {/* Mobile movement and action controls */}
          {isMobile && (
            <MobileControls
              onMove={handleMobileMove}
              onAttack={handleMobileAttack}
              onSpell={handleSpellClick}
              spells={mobileSpells}
            />
          )}
          {tradeData && roomRef.current && (
            <TradeWindow
              trade={tradeData}
              mySessionId={roomRef.current.sessionId}
              playerInventory={playerState.inventory ?? []}
              playerGold={playerState.gold}
              onUpdateOffer={(gold, items) => {
                const mappedItems = items.map(item => {
                  const invItem = playerState.inventory?.find(i => i.itemId === item.itemId);
                  return {
                    itemId: item.itemId,
                    quantity: item.quantity,
                    slotIndex: invItem?.slotIndex ?? 0,
                  };
                });
                networkRef.current?.sendTradeOfferUpdate(gold, mappedItems);
              }}
              onConfirm={() => networkRef.current?.sendTradeConfirm()}
              onCancel={() => networkRef.current?.sendTradeCancel()}
            />
          )}
          {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
          {showLeaderboard && (
            <LeaderboardModal
              myName={playerState.name}
              onClose={() => setShowLeaderboard(false)}
            />
          )}
          {showSummonOverlay && roomRef.current && (
            <SummonOverlay 
              onSummon={(npcType) => networkRef.current?.sendChat(`/gm spawn ${npcType}`)} 
              onClose={() => setShowSummonOverlay(false)} 
            />
          )}

          {/* Feature 91: World Event Banner */}
          {worldEvent && (
            <WorldEventBanner
              visible
              eventName={worldEvent.name}
              description={worldEvent.description}
              endsAt={worldEvent.endsAt}
              totalNpcs={worldEvent.totalNpcs}
              npcsDead={worldEvent.npcsDead}
            />
          )}

          {/* Feature 88: Fast Travel Modal (F key) */}
          {showFastTravel && (
            <FastTravelModal
              waypoints={mapData.waypoints ?? []}
              currentMapName={currentMapName}
              onTravel={(wpId) => networkRef.current?.sendFastTravel(wpId)}
              onClose={() => setShowFastTravel(false)}
            />
          )}

          {/* Feature 89: World Map Modal (M key) */}
          {showWorldMap && (
            <WorldMapModal
              currentMapName={currentMapName}
              onClose={() => setShowWorldMap(false)}
            />
          )}
        </>
      )}


      {/* Player context menu */}
      {playerContextMenu && (
        <PlayerContextMenu
          target={playerContextMenu}
          onWhisper={(name) => {
            setChatPrefill(`/w ${name} `);
            setIsChatOpen(true);
          }}
          onFriendRequest={(_, name) => networkRef.current?.sendFriendRequest(name)}
          onGroupInvite={(sid) => networkRef.current?.sendGroupInvite(sid)}
          onGuildInvite={
            guildData &&
            guildData.members.find((m) => m.name === playerState.name)?.role !== "MEMBER"
              ? (name) => networkRef.current?.sendGuildInvite(name)
              : undefined
          }
          onTradeRequest={(sid) => networkRef.current?.sendTradeRequest(sid)}
          onClose={() => setPlayerContextMenu(null)}
          onGMTeleportTo={
            isGM
              ? (sid) => {
                  const target = roomRef.current?.state.players.get(sid);
                  if (target) networkRef.current?.sendGMTeleport(target.tileX, target.tileY);
                }
              : undefined
          }
        />
      )}

      {/* NPC context menu */}
      {npcContextMenu && (
        <NpcContextMenu
          target={npcContextMenu}
          onTame={(sid) => networkRef.current?.sendTame(sid)}
          onClose={() => setNpcContextMenu(null)}
        />
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

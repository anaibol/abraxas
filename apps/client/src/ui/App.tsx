import type {
  ClassType,
  Direction,
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
import { type RoomListenerCallbacks, useRoomListeners } from "../hooks/useRoomListeners";
import { AudioManager } from "../managers/AudioManager";
import { NetworkManager } from "../network/NetworkManager";
import { GameScene } from "../scenes/GameScene";
import { PreloaderScene } from "../scenes/PreloaderScene";
import { BankWindow } from "./BankWindow";
import { Console } from "./Console";
import { DeathOverlay } from "./DeathOverlay";
import { DropQuantityDialog } from "./DropQuantityDialog";
import { KillFeed, type KillFeedEntry } from "./KillFeed";
import { LoadingScreen } from "./LoadingScreen";
import { Lobby } from "./Lobby";
import { MerchantShop } from "./MerchantShop";
import { Minimap } from "./Minimap";
import { MobileControls } from "./MobileControls";
import { PlayerContextMenu, type PlayerContextTarget } from "./PlayerContextMenu";
import { QuestDialogue } from "./QuestDialogue";
import { type KillStats, ScoreboardOverlay } from "./ScoreboardOverlay";
import { SettingsModal } from "./SettingsModal";
import { Sidebar } from "./Sidebar";
import type { PlayerState } from "./sidebar/types";
import { TradeWindow } from "./TradeWindow";
import { system } from "./theme";
import { toaster } from "./toaster";
import { HEX, T } from "./tokens";

export function App() {
  const { setSoundManager } = useAudio();
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
  const [playerContextMenu, setPlayerContextMenu] = useState<PlayerContextTarget | null>(null);
  const isMobile = useIsMobile();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isGM, setIsGM] = useState(false);
  const { settings: gameSettingsState } = useGameSettings();

  const [room, setRoom] = useState<Room<GameState> | null>(null);
  const roomRef = useRef<Room<GameState> | null>(null);

  const gameContainerRef = useRef<HTMLDivElement>(null);
  const phaserGameRef = useRef<Phaser.Game | null>(null);
  const networkRef = useRef<NetworkManager | null>(null);
  const audioManagerRef = useRef<AudioManager | null>(null);
  const wasAliveRef = useRef(true);

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
    setKillStats,
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
    async (charId: string, classType: ClassType, token: string, mapName?: string) => {
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
        const room = network.getRoom();
        roomRef.current = room;
        setRoom(room);

        const welcome = network.getWelcomeData();

        if (!audioManagerRef.current) {
          audioManagerRef.current = new AudioManager();
        }

        setMapData({
          width: welcome.mapWidth,
          height: welcome.mapHeight,
          tileSize: welcome.tileSize,
          collision: welcome.collision,
          tileTypes: welcome.tileTypes,
          spawns: [],
        });

        setPlayerState((prev) => ({ ...prev, classType }));
        setIsGM(network.isGM);
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
              pixelArt: true,
            });
          });
        });
      } catch (err) {
        console.error("Failed to connect:", err);
        setConnecting(false);
        setIsLoading(false);
        toaster.create({
          title: t("game.connection_failed"),
          description: t("game.connection_failed_desc"),
          type: "error",
        });
      }
    },
    [addConsoleMessage, resetConsoleMessages, t],
  );

  const handleLogout = useCallback(() => {
    networkRef.current?.disconnect();
    networkRef.current = null;
    phaserGameRef.current?.destroy(true);
    phaserGameRef.current = null;
    roomRef.current = null;
    setRoom(null);
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
    if (!scene) return;
    scene.startSpellTargeting(spellId, rangeTiles);
    if (rangeTiles > 0) {
      setPendingSpellId(spellId);
      const canvas = game.canvas;
      const cleanup = () => {
        setPendingSpellId(null);
        canvas.removeEventListener("pointerdown", cleanup);
        canvas.removeEventListener("contextmenu", cleanup);
        window.removeEventListener("keydown", onEsc);
      };
      const onEsc = (e: KeyboardEvent) => {
        if (e.key === "Escape") cleanup();
      };
      canvas.addEventListener("pointerdown", cleanup);
      canvas.addEventListener("contextmenu", cleanup);
      window.addEventListener("keydown", onEsc);
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
            <ToastDescription color="whiteAlpha.900">{toast.description}</ToastDescription>
            <ToastCloseTrigger color="white" />
          </ToastRoot>
        )}
      </Toaster>
      {phase === "lobby" && <Lobby onJoin={handleJoin} connecting={connecting} />}
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
                />
              )}

              {/* Safe Zone Indicator */}
              {playerState.inSafeZone && (
                <Box
                  position="absolute"
                  top="24px"
                  left="50%"
                  transform="translateX(-50%)"
                  bg="rgba(10, 40, 10, 0.7)"
                  border="1px solid rgba(40, 160, 40, 0.6)"
                  color="#4f4"
                  px="4"
                  py="1.5"
                  borderRadius="full"
                  fontWeight="bold"
                  fontSize="sm"
                  letterSpacing="2px"
                  zIndex={40}
                  textShadow="1px 1px 2px black"
                  pointerEvents="none"
                >
                  {t("game.safe_zone", { defaultValue: "SAFE ZONE" })}
                </Box>
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
                onDropItem={(itemId) => networkRef.current?.sendDropItem(itemId)}
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
                onLogout={handleLogout}
              />
            )}
            {shopData && (
              <MerchantShop
                npcId={shopData.npcId}
                merchantInventory={shopData.inventory}
                playerGold={playerState.gold ?? 0}
                playerInventory={playerState.inventory ?? []}
                onBuy={(itemId, qty) => networkRef.current?.sendBuyItem(itemId, qty)}
                onSell={(itemId, qty) => networkRef.current?.sendSellItem(itemId, qty)}
                onClose={() => setShopData(null)}
              />
            )}
            {dialogueData && (
              <QuestDialogue
                npcId={dialogueData.npcId}
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
              onlinePlayers={Array.from(roomRef.current.state?.players?.values() ?? []).map(
                (p) => ({
                  name: p.name,
                  classType: p.classType,
                  alive: p.alive,
                }),
              )}
              myName={playerState.name}
              myLevel={playerState.level ?? 1}
            />
          )}
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
              playerGold={playerState.gold ?? 0}
              onUpdateOffer={(gold, items) => networkRef.current?.sendTradeOfferUpdate(gold, items)}
              onConfirm={() => networkRef.current?.sendTradeConfirm()}
              onCancel={() => networkRef.current?.sendTradeCancel()}
            />
          )}
          {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
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

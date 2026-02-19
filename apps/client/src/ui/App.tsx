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
import { useState, useRef, useCallback, useEffect } from "react";
import { system } from "./theme";
import { Lobby } from "./Lobby";
import { LoadingScreen } from "./LoadingScreen";
import { Sidebar, type PlayerState } from "./Sidebar";
import { DeathOverlay } from "./DeathOverlay";
import { KillFeed, type KillFeedEntry } from "./KillFeed";
import { Console, type ConsoleMessage } from "./Console";
import { Minimap } from "./Minimap";
import { MerchantShop } from "./MerchantShop";
import { BankWindow } from "./BankWindow";
import type {
  ClassType,
  TileMap,
  PlayerQuestState,
  ServerMessages,
} from "@abraxas/shared";
import { getRandomName, ServerMessageType, ITEMS } from "@abraxas/shared";
import { QuestDialogue } from "./QuestDialogue";
import { NetworkManager } from "../network/NetworkManager";
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

let killFeedId = 0;
let consoleMsgId = 0;

export function App() {
  const [phase, setPhase] = useState<"lobby" | "game">("lobby");
  const [connecting, setConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playerState, setPlayerState] = useState<PlayerState>({
    name: getRandomName(),
    classType: "warrior",
    hp: 100,
    maxHp: 100,
    mana: 30,
    maxMana: 30,
    alive: true,
  });
  const [deathTime, setDeathTime] = useState(0);
  const [showDeath, setShowDeath] = useState(false);
  const [killFeed, setKillFeed] = useState<KillFeedEntry[]>([]);
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
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
    if (phase !== "game") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !isChatOpen) setIsChatOpen(true);
      if (e.key === "Escape" && isChatOpen) setIsChatOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, isChatOpen]);

  useEffect(() => {
    const game = phaserGameRef.current;
    if (!game) return;
    game.input.enabled = !isChatOpen;
    if (isChatOpen) {
      (game.input.keyboard as Phaser.Input.Keyboard.KeyboardPlugin | null)?.resetKeys();
    }
  }, [isChatOpen]);

  useEffect(() => {
    if (phase !== "game" || isChatOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // PTT voice (V)
      if (key === "v") {
        if (e.type === "keydown" && !isRecording) {
          setIsRecording(true);
          if (audioManagerRef.current) {
            audioManagerRef.current.startRecording((buffer) => {
              networkRef.current?.sendAudio(buffer);
            });
          }
        } else if (e.type === "keyup" && isRecording) {
          setIsRecording(false);
          audioManagerRef.current?.stopRecording();
        }
        return;
      }

      if (e.type !== "keydown") return;

      // A — pickup drop under the player
      if (key === "a") {
        const room = roomRef.current;
        const network = networkRef.current;
        if (!room || !network) return;
        const player = room.state.players.get(room.sessionId);
        if (!player?.alive) return;
        for (const [dropId, drop] of room.state.drops) {
          if (drop.tileX === player.tileX && drop.tileY === player.tileY) {
            network.sendPickup(dropId);
            break;
          }
        }
        return;
      }

      // T — drop selected inventory item (with quantity prompt if stackable)
      if (key === "t") {
        if (!selectedItemId || dropDialog) return;
        const inv = playerState.inventory ?? [];
        const slot = inv.find((i) => i.itemId === selectedItemId);
        if (!slot) return;

        if (slot.quantity > 1) {
          const itemName = ITEMS[slot.itemId]?.name ?? slot.itemId;
          setDropDialog({ itemId: slot.itemId, itemName, maxQty: slot.quantity });
        } else {
          networkRef.current?.sendDropItem(slot.itemId, 1);
          setSelectedItemId(null);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKey);
    };
  }, [phase, isChatOpen, isRecording, selectedItemId, playerState.inventory, dropDialog]);

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
          const am = new AudioManager();
          try {
            await am.init();
            audioManagerRef.current = am;
          } catch (err) {
            console.error("AudioManager init failed:", err);
          }
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

        network.onWarp = (data) => {
          handleJoin(charId, classType, token, data.targetMap);
        };

        // Add welcome message
        setConsoleMessages([
          {
            id: ++consoleMsgId,
            text: mapName
              ? `Traveling to ${mapName}...`
              : "Welcome to Abraxas!",
            color: "#ffff00",
            timestamp: Date.now(),
          },
        ]);

        network
          .getRoom()
          .onMessage(
            ServerMessageType.Chat,
            (data: ServerMessages[ServerMessageType.Chat]) => {
              setConsoleMessages((prev) => {
                const newMsg: ConsoleMessage = {
                  id: ++consoleMsgId,
                  text: `${data.senderName}: ${data.message}`,
                  color:
                    data.channel === "party"
                      ? "#aaaaff"
                      : data.channel === "whisper"
                        ? "#ff88ff"
                        : "#ffffff",
                  timestamp: Date.now(),
                  channel: data.channel,
                };
                const next = [...prev, newMsg];
                if (next.length > 50) return next.slice(next.length - 50);
                return next;
              });
            },
          );

        network
          .getRoom()
          .onMessage(
            ServerMessageType.OpenShop,
            (data: ServerMessages[ServerMessageType.OpenShop]) => {
              setShopData(data);
            },
          );

        network
          .getRoom()
          .onMessage(
            ServerMessageType.OpenDialogue,
            (data: ServerMessages[ServerMessageType.OpenDialogue]) => {
              setDialogueData(data);
            },
          );

        network
          .getRoom()
          .onMessage(
            ServerMessageType.QuestList,
            (data: ServerMessages[ServerMessageType.QuestList]) => {
              setQuests(data.quests);
            },
          );

        network
          .getRoom()
          .onMessage(
            ServerMessageType.QuestUpdate,
            (data: ServerMessages[ServerMessageType.QuestUpdate]) => {
              setQuests((prev) => {
                const idx = prev.findIndex(
                  (q) => q.questId === data.quest.questId,
                );
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = data.quest;
                  return next;
                }
                return [...prev, data.quest];
              });
            },
          );

        network
          .getRoom()
          .onMessage(
            ServerMessageType.PartyInvited,
            (data: ServerMessages[ServerMessageType.PartyInvited]) => {
              toaster.create({
                title: "Party Invitation",
                description: `${data.inviterName} invited you to a party. Accept?`,
                action: {
                  label: "Accept",
                  onClick: () => network.sendPartyAccept(data.partyId),
                },
              });
            },
          );

        network
          .getRoom()
          .onMessage(
            ServerMessageType.PartyUpdate,
            (data: ServerMessages[ServerMessageType.PartyUpdate]) => {
              setPartyData(data.partyId ? data : null);
            },
          );

        network
          .getRoom()
          .onMessage(
            ServerMessageType.FriendInvited,
            (data: ServerMessages[ServerMessageType.FriendInvited]) => {
              toaster.create({
                title: "Friend Request",
                description: `${data.requesterName} wants to be your friend.`,
                type: "info",
                action: {
                  label: "Accept",
                  onClick: () =>
                    networkRef.current?.sendFriendAccept(data.requesterId),
                },
              });
            },
          );

        network
          .getRoom()
          .onMessage(
            ServerMessageType.FriendUpdate,
            (data: ServerMessages[ServerMessageType.FriendUpdate]) => {
              setFriendsData(data.friends);
              setPendingFriendRequests(data.pendingRequests);
            },
          );

        network
          .getRoom()
          .onMessage(
            ServerMessageType.BankOpened,
            () => {
              setBankData({ items: [] });
            },
          );

        network
          .getRoom()
          .onMessage(
            ServerMessageType.BankSync,
            (data: ServerMessages[ServerMessageType.BankSync]) => {
              setBankData({ items: data.items });
            },
          );

        network
          .getRoom()
          .onMessage(
            ServerMessageType.Audio,
            (data: ServerMessages[ServerMessageType.Audio]) => {
              audioManagerRef.current?.playAudioChunk(data.data);
            },
          );

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = gameContainerRef.current;
            if (!el) return;

            const gameScene = new GameScene(
              network,
              (state: PlayerState) => {
                setPlayerState(state);
              },
              (killerName: string, victimName: string) => {
                setKillFeed((prev) => [
                  ...prev.slice(-9),
                  {
                    id: ++killFeedId,
                    killerName,
                    victimName,
                    timestamp: Date.now(),
                  },
                ]);
              },
              (text: string, color?: string) => {
                setConsoleMessages((prev) => {
                  const newMsg: ConsoleMessage = {
                    id: ++consoleMsgId,
                    text,
                    color,
                    timestamp: Date.now(),
                  };
                  // Keep last 50 messages
                  const next = [...prev, newMsg];
                  if (next.length > 50) return next.slice(next.length - 50);
                  return next;
                });
              },
              () => {
                setIsLoading(false);
                setConnecting(false);
              }, // onReady
              (message: string) => {
                // onError
                toaster.create({
                  title: "Error",
                  description: message,
                  type: "error",
                  duration: 3000,
                });
                setConnecting(false);
              },
            );

            const preloaderScene = new PreloaderScene();

            phaserGameRef.current = new Phaser.Game({
              type: Phaser.AUTO,
              parent: el,
              width: el.clientWidth,
              height: el.clientHeight,
              backgroundColor: "#08080c",
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
    [],
  );

  const addConsoleMessage = (text: string, color?: string) => {
    setConsoleMessages((prev) => {
      const next = [
        ...prev,
        { id: ++consoleMsgId, text, color, timestamp: Date.now() },
      ];
      return next.length > 50 ? next.slice(next.length - 50) : next;
    });
  };

  const handleSendChat = (msg: string) => {
    const trimmed = msg.trim();

    // Client-side /ping command: measure RTT without sending to server as chat
    if (trimmed === "/ping") {
      networkRef.current?.ping((rtt) => {
        addConsoleMessage(`Pong! ${rtt}ms`, "#00ffff");
      });
      setIsChatOpen(false);
      return;
    }

    networkRef.current?.sendChat(msg);
    setIsChatOpen(false);
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
            bg={toast.type === "error" ? "#770000" : "#d4a843"}
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
          <Flex pos="fixed" inset="0" bg="#08080c">
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
                />
              )}
            </Box>
            <Sidebar
              state={playerState}
              isRecording={isRecording}
              quests={quests}
              onEquip={(itemId) => networkRef.current?.sendEquip(itemId)}
              onUnequip={(slot) => networkRef.current?.sendUnequip(slot)}
              onUseItem={(itemId) => networkRef.current?.sendUseItem(itemId)}
              onDropItem={(itemId) => networkRef.current?.sendDropItem(itemId)}
              partyId={partyData?.partyId ?? ""}
              leaderId={partyData?.leaderId ?? ""}
              partyMembers={partyData?.members || []}
              onPartyInvite={(sid: string) => networkRef.current?.sendPartyInvite(sid)}
              onPartyLeave={() => networkRef.current?.sendPartyLeave()}
              onPartyKick={(sid: string) => networkRef.current?.sendPartyKick(sid)}
              friends={friendsData}
              pendingFriendRequests={pendingFriendRequests}
              onFriendRequest={(name: string) => networkRef.current?.sendFriendRequest(name)}
              onFriendAccept={(rid: string) => networkRef.current?.sendFriendAccept(rid)}
              onWhisper={() => setIsChatOpen(true)}
              selectedItemId={selectedItemId}
              onSelectItem={setSelectedItemId}
            />
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
          <KillFeed entries={killFeed} />
          <Console
            messages={consoleMessages}
            isChatOpen={isChatOpen}
            onSendChat={handleSendChat}
          />
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

const DQ = {
  bg: "#0e0c14",
  surface: "#14111e",
  raised: "#1a1628",
  border: "#2e2840",
  gold: "#d4a843",
  goldDark: "#6e5a18",
  goldText: "#c8b68a",
  font: "'Friz Quadrata', Georgia, serif",
  mono: "'Consolas', monospace",
} as const;

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
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount; Escape cancels, Enter confirms
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm(Math.min(Math.max(1, qty), maxQty));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [qty, maxQty, onConfirm, onCancel]);

  const handleConfirm = () => onConfirm(Math.min(Math.max(1, qty), maxQty));

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
        bg={DQ.bg}
        border={`2px solid ${DQ.border}`}
        borderRadius="4px"
        p="5"
        w="260px"
        fontFamily={DQ.font}
        onClick={(e) => e.stopPropagation()}
      >
        <Box
          fontSize="11px"
          letterSpacing="3px"
          textTransform="uppercase"
          color={DQ.gold}
          fontWeight="700"
          mb="1"
          textAlign="center"
        >
          Drop Item
        </Box>
        <Box
          fontSize="13px"
          color={DQ.goldText}
          textAlign="center"
          mb="3"
        >
          {itemName}
        </Box>

        <Box mb="3">
          <Box fontSize="9px" color={DQ.goldDark} letterSpacing="2px" textTransform="uppercase" mb="1">
            Quantity (1 – {maxQty})
          </Box>
          <input
            ref={inputRef}
            type="number"
            min={1}
            max={maxQty}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            style={{
              width: "100%",
              background: DQ.surface,
              border: `1px solid ${DQ.border}`,
              borderRadius: "2px",
              color: DQ.goldText,
              fontFamily: DQ.mono,
              fontSize: "14px",
              padding: "4px 8px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </Box>

        <Flex gap="2">
          <Box
            as="button"
            flex="1"
            py="1.5"
            fontSize="11px"
            fontWeight="700"
            letterSpacing="1px"
            bg={DQ.raised}
            border={`1px solid ${DQ.border}`}
            borderRadius="2px"
            color={DQ.goldText}
            cursor="pointer"
            fontFamily={DQ.font}
            onClick={onCancel}
            style={{ transition: "background 0.1s" }}
          >
            Cancel
          </Box>
          <Box
            as="button"
            flex="1"
            py="1.5"
            fontSize="11px"
            fontWeight="700"
            letterSpacing="1px"
            bg={DQ.goldDark}
            border={`1px solid ${DQ.gold}`}
            borderRadius="2px"
            color={DQ.gold}
            cursor="pointer"
            fontFamily={DQ.font}
            onClick={handleConfirm}
            style={{ transition: "background 0.1s" }}
          >
            Drop
          </Box>
        </Flex>
      </Box>
    </Box>
  );
}

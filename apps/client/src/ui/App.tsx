import { ChakraProvider } from "@chakra-ui/react";
import { Box, Flex } from "@chakra-ui/react";
import { useState, useRef, useCallback, useEffect } from "react";
import { system } from "./theme";
import { Lobby } from "./Lobby";
import { Sidebar, type PlayerState } from "./Sidebar";
import { DeathOverlay } from "./DeathOverlay";
import { KillFeed, type KillFeedEntry } from "./KillFeed";
import { Console, type ConsoleMessage } from "./Console";
import { Minimap } from "./Minimap";
import type { ClassType, TileMap, EquipmentSlot } from "@abraxas/shared";
import { NetworkManager } from "../network/NetworkManager";
import Phaser from "phaser";
import { PreloaderScene } from "../scenes/PreloaderScene";
import { GameScene } from "../scenes/GameScene";
import { GameState } from "../../../server/src/schema/GameState";
import { Room } from "colyseus.js";

let killFeedId = 0;
let consoleMsgId = 0;

export function App() {
  const [phase, setPhase] = useState<"lobby" | "game">("lobby");
  const [connecting, setConnecting] = useState(false);
  const [playerState, setPlayerState] = useState<PlayerState>({
    name: "Player",
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

  const gameContainerRef = useRef<HTMLDivElement>(null);
  const phaserGameRef = useRef<Phaser.Game | null>(null);
  const networkRef = useRef<NetworkManager<GameState> | null>(null);
  const wasAliveRef = useRef(true);
  
  // Ref to room state for minimap to access latest data without re-rendering App constantly
  const roomRef = useRef<Room<GameState> | null>(null);

  // Track death/respawn
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

  // Auto-remove old kill feed entries
  useEffect(() => {
    if (killFeed.length === 0) return;
    const timer = setTimeout(() => {
      setKillFeed((prev) => prev.filter((e) => Date.now() - e.timestamp < 8000));
    }, 8000);
    return () => clearTimeout(timer);
  }, [killFeed]);

  // Handle Chat Toggle
  useEffect(() => {
    if (phase !== "game") return;

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Enter") {
             if (isChatOpen) {
                 // Close chat (sending handled by Console component if it was focused)
                 // But wait, if we are focused on input, this keydown might fire too?
                 // We should letting Console handle the send, and this just toggles state?
                 // If chat is open, enter sends and closes?
             } else {
                 setIsChatOpen(true);
             }
        }
        if (e.key === "Escape" && isChatOpen) {
            setIsChatOpen(false);
        }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, isChatOpen]);

  // When chat is open, we should probably disable game inputs? 
  // GameScene listens to keys. We might need to tell GameScene to ignore input.
  // Or just rely on input focus stealing events?
  // Phaser input usually keeps working unless we explicitly stop it.

  useEffect(() => {
      const game = phaserGameRef.current;
      if (game) {
          game.input.enabled = !isChatOpen;
          if (isChatOpen) {
              // Reset keys to avoid stuck inputs
              // @ts-ignore
              game.input.keyboard?.resetKeys();
          }
      }
  }, [isChatOpen]);


  const handleJoin = useCallback(async (name: string, classType: ClassType) => {
    setConnecting(true);
    try {
      const network = new NetworkManager<GameState>();
      await network.connect(name, classType);
      networkRef.current = network;
      roomRef.current = network.getRoom();
      
      const welcome = network.getWelcomeData();
      setMapData({
          width: welcome.mapWidth,
          height: welcome.mapHeight,
          tileSize: welcome.tileSize,
          collision: welcome.collision,
          spawns: [] // Not needed for client map display usually
      });

      setPlayerState((prev) => ({ ...prev, name, classType }));
      setPhase("game");
      
      // Add welcome message
      setConsoleMessages([{
        id: ++consoleMsgId,
        text: `Welcome to the game, ${name}!`,
        color: "#ffff00",
        timestamp: Date.now()
      }]);
      
      // Listen for chat
      network.getRoom().onMessage("chat", (data: { senderId: string, senderName: string, message: string }) => {
           setConsoleMessages(prev => {
                const newMsg: ConsoleMessage = {
                    id: ++consoleMsgId,
                    text: `${data.senderName}: ${data.message}`,
                    color: "#ffffff",
                    timestamp: Date.now()
                };
                 const next = [...prev, newMsg];
                 if (next.length > 50) return next.slice(next.length - 50);
                 return next;
           });
      });

      // Listen for notifications
        network.getRoom().onMessage("notification", (data: { message: string }) => {
           setConsoleMessages(prev => {
                const newMsg: ConsoleMessage = {
                    id: ++consoleMsgId,
                    text: data.message,
                    color: "#00ff00",
                    timestamp: Date.now()
                };
                 const next = [...prev, newMsg];
                 if (next.length > 50) return next.slice(next.length - 50);
                 return next;
           });
      });

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
                { id: ++killFeedId, killerName, victimName, timestamp: Date.now() },
              ]);
            },
            (text: string, color?: string) => {
               setConsoleMessages((prev) => {
                 const newMsg: ConsoleMessage = {
                   id: ++consoleMsgId,
                   text,
                   color,
                   timestamp: Date.now()
                 };
                 // Keep last 50 messages
                 const next = [...prev, newMsg];
                 if (next.length > 50) return next.slice(next.length - 50);
                 return next;
               });
            }
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
      alert("Failed to connect to server. Is it running?");
    }
  }, []);

  const handleSendChat = (msg: string) => {
      networkRef.current?.sendChat(msg);
      // Close chat after sending?
      setIsChatOpen(false);
  };

  useEffect(() => {
    return () => {
      phaserGameRef.current?.destroy(true);
    };
  }, []);
  
  // Minimap rendering helper
  // Since Minimap needs live data, we can pass a dummy state that forces re-render or let it handle itself.
  // Actually, React re-renders App on playerState change (HP/Mana) which happens on tick.
  // But players/npcs map changes are not in playerState.
  // We can pass the raw maps from roomRef.current?.state?.players / npcs
  // And force update Minimap every frame?
  // Our Minimap component has a useEffect that triggers on prop change.
  // If we pass the same Map object reference, useEffect won't trigger unless we change something else.
  // We can force re-render of Minimap by passing a tick counter or similar, OR
  // Better: The Minimap component should use requestAnimationFrame loop itself to draw from the mutable map references.
  // let's check Minimap implementation again. It uses useEffect.
  // We should probably modify Minimap to use rAF loop if passed mutable maps.
  // For now, let's pass a tick if we have one. We don't have a tick in App state.
  // Let's rely on React updates for now. App updates on GameScene callbacks?
  // GameScene callback `onStatsUpdate` (setPlayerState) happens on `state.listen`.
  // Wait, `onStatsUpdate` is only called when `me.onChange` fires.
  // Minimap needs all entities positions.
  
  // To make Minimap smooth, we really should have a `useFrame` or similar.
  // Or just let Minimap run its own loop.
  // I will update Minimap.tsx to run a loop.
  // Implemented `Minimap.tsx` currently relies on props.
  // I will leave it as is for now and see if I can pass a `tick` prop from a rAF in App?
  // No, that would re-render App too much.
  
  // Let's modify App to just render Minimap, and in next step modify Minimap to use rAF.

  return (
    <ChakraProvider value={system}>
      {phase === "lobby" && <Lobby onJoin={handleJoin} connecting={connecting} />}
      {phase === "game" && mapData && (
        <>
          <Flex pos="fixed" inset="0" bg="#08080c">
            <Box ref={gameContainerRef} flex="1" h="100%" minW="0" overflow="hidden" />
            <Box pos="absolute" top="20px" right="20px" zIndex={90}>
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
              onEquip={(itemId) => networkRef.current?.sendEquip(itemId)}
              onUnequip={(slot) => networkRef.current?.sendUnequip(slot)}
              onUseItem={(itemId) => networkRef.current?.sendUseItem(itemId)}
              onDropItem={(itemId) => networkRef.current?.sendDropItem(itemId)}
            />
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
    </ChakraProvider>
  );
}

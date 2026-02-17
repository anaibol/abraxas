import { ChakraProvider } from "@chakra-ui/react";
import { Box, Flex } from "@chakra-ui/react";
import { useState, useRef, useCallback, useEffect } from "react";
import { system } from "./theme";
import { Lobby } from "./Lobby";
import { Sidebar, type PlayerState } from "./Sidebar";
import { DeathOverlay } from "./DeathOverlay";
import { KillFeed, type KillFeedEntry } from "./KillFeed";
import { Console, type ConsoleMessage } from "./Console";
import type { ClassType } from "@ao5/shared";
import { NetworkManager } from "../network/NetworkManager";
import Phaser from "phaser";
import { PreloaderScene } from "../scenes/PreloaderScene";
import { GameScene } from "../scenes/GameScene";

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
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const phaserGameRef = useRef<Phaser.Game | null>(null);
  const networkRef = useRef<NetworkManager | null>(null);
  const wasAliveRef = useRef(true);

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

  const handleJoin = useCallback(async (name: string, classType: ClassType) => {
    setConnecting(true);
    try {
      const network = new NetworkManager();
      await network.connect(name, classType);
      networkRef.current = network;

      setPlayerState((prev) => ({ ...prev, name, classType }));
      setPhase("game");
      
      // Add welcome message
      setConsoleMessages([{
        id: ++consoleMsgId,
        text: `Welcome to the game, ${name}!`,
        color: "#ffff00",
        timestamp: Date.now()
      }]);

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

  useEffect(() => {
    return () => {
      phaserGameRef.current?.destroy(true);
    };
  }, []);

  return (
    <ChakraProvider value={system}>
      {phase === "lobby" && <Lobby onJoin={handleJoin} connecting={connecting} />}
      {phase === "game" && (
        <>
          <Flex pos="fixed" inset="0" bg="#08080c">
            <Box ref={gameContainerRef} flex="1" h="100%" minW="0" overflow="hidden" />
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
          <Console messages={consoleMessages} />
        </>
      )}
    </ChakraProvider>
  );
}

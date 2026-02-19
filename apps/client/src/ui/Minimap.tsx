import { useEffect, useRef, type FC } from "react";
import type { TileMap } from "@abraxas/shared";
import type { Player } from "../../../server/src/schema/Player";
import type { Npc } from "../../../server/src/schema/Npc";

type SchemaMap<T> = { forEach: (cb: (value: T, key: string) => void) => void };

type MinimapProps = {
  map: TileMap;
  players: SchemaMap<Player> | undefined;
  npcs: SchemaMap<Npc> | undefined;
  currentPlayerId: string;
};

export const Minimap: FC<MinimapProps> = ({ map, players, npcs, currentPlayerId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: players/npcs are stable mutable MapSchema refs read live by the RAF loop; currentPlayerId never changes during a session
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scaleX = canvas.width / map.width;
    const scaleY = canvas.height / map.height;

    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = canvas.width;
    bgCanvas.height = canvas.height;
    const bgCtx = bgCanvas.getContext("2d");
    if (!bgCtx) return;

    bgCtx.fillStyle = "#222";
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    bgCtx.fillStyle = "#444";
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.collision[y]?.[x] === 0) {
          bgCtx.fillRect(x * scaleX, y * scaleY, scaleX, scaleY);
        }
      }
    }

    let rafId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bgCanvas, 0, 0);

      npcs?.forEach((npc) => {
        if (!npc.alive) return;
        ctx.fillStyle = "red";
        ctx.beginPath();
        ctx.arc(npc.tileX * scaleX, npc.tileY * scaleY, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      players?.forEach((player) => {
        if (!player.alive) return;
        ctx.fillStyle = player.sessionId === currentPlayerId ? "lime" : "blue";
        ctx.beginPath();
        ctx.arc(player.tileX * scaleX, player.tileY * scaleY, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      rafId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(rafId);
  }, [map]);

  return (
    <div
      style={{
        position: "absolute",
        top: "20px",
        right: "20px",
        border: "2px solid #555",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        borderRadius: "4px",
        width: "200px",
        height: "200px",
        zIndex: 100,
        pointerEvents: "none",
      }}
    >
      <canvas ref={canvasRef} width={200} height={200} style={{ display: "block", width: "100%", height: "100%" }} />
    </div>
  );
};

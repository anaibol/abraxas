import React, { useEffect, useRef } from "react";
import { TileMap } from "@abraxas/shared";


import { Player } from "../../../server/src/schema/Player";
import { Npc } from "../../../server/src/schema/Npc";

interface SchemaMap<T> {
    forEach: (cb: (value: T, key: string) => void) => void;
}

interface MinimapProps {
  map: TileMap;
  players: SchemaMap<Player> | undefined; 
  npcs: SchemaMap<Npc> | undefined;
  currentPlayerId: string;
}

export const Minimap: React.FC<MinimapProps> = ({ map, players, npcs, currentPlayerId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw Map Background (Collision)
    const scaleX = canvas.width / map.width;
    const scaleY = canvas.height / map.height;

    if (!bgCanvasRef.current) {
        const bgCanvas = document.createElement("canvas");
        bgCanvas.width = canvas.width;
        bgCanvas.height = canvas.height;
        const bgCtx = bgCanvas.getContext("2d");
        if (bgCtx) {
            // Draw Terrain
            bgCtx.fillStyle = "#222";
            bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

            bgCtx.fillStyle = "#444";
            for (let y = 0; y < map.height; y++) {
                for (let x = 0; x < map.width; x++) {
                    if (map.collision[y]?.[x] === 0) { // Walkable
                        bgCtx.fillRect(x * scaleX, y * scaleY, scaleX, scaleY);
                    }
                }
            }
            bgCanvasRef.current = bgCanvas;
        }
    }

    let animationFrameId: number;

    const render = () => {
        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw cached terrain
        if (bgCanvasRef.current) {
            ctx.drawImage(bgCanvasRef.current, 0, 0);
        }

        // Draw NPCs
        if (npcs) {
            ctx.fillStyle = "red";
            npcs.forEach((npc: Npc) => {
                if (!npc.alive) return;
                ctx.beginPath();
                ctx.arc(npc.tileX * scaleX, npc.tileY * scaleY, 2, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // Draw Players
        if (players) {
            players.forEach((player: Player) => {
                if (!player.alive) return;
                if (player.sessionId === currentPlayerId) {
                    ctx.fillStyle = "lime";
                } else {
                    ctx.fillStyle = "blue";
                }
                ctx.beginPath();
                ctx.arc(player.tileX * scaleX, player.tileY * scaleY, 3, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
        cancelAnimationFrame(animationFrameId);
    };
  }, [map, players, npcs, currentPlayerId]);

  return (
    <div style={{
        position: "absolute",
        top: "20px",
        right: "20px",
        border: "2px solid #555",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        borderRadius: "4px",
        width: "200px",
        height: "200px",
        zIndex: 100,
        pointerEvents: "none", // Let clicks pass through? Or clickable to move? For now pass through.
    }}>
      <canvas 
        ref={canvasRef} 
        width={200} 
        height={200} 
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    </div>
  );
};

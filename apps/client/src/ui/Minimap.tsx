import React, { useEffect, useRef } from "react";
import { TileMap } from "@abraxas/shared";

interface Player {
    tileX: number;
    tileY: number;
    // Add other needed props
}
 
// Ideally we should have shared types or use the schema definition if available to client build. 
// Given the monorepo structure, let's see how other files import Player. 
// GameScene uses it from schema? or just treats as any? 
// Let's check GameScene imports later. For now I'll use `any` or interface for props to be safe.

interface MinimapProps {
  map: TileMap;
  players: Map<string, any>; // using any to avoid import issues for now, or define interface
  npcs: Map<string, any>;
  currentPlayerId: string;
}

export const Minimap: React.FC<MinimapProps> = ({ map, players, npcs, currentPlayerId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw Map Background (Collision)
        // Optimization: Draw background only once? Or use a separate canvas?
        // For 200x200 it's fast enough.
        
        const scaleX = canvas.width / map.width;
        const scaleY = canvas.height / map.height;

        // Draw Terrain
        ctx.fillStyle = "#222";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#444";
        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                if (map.collision[y]?.[x] === 0) { // Walkable
                    ctx.fillRect(x * scaleX, y * scaleY, scaleX, scaleY);
                }
            }
        }

        // Draw NPCs
        if (npcs) {
            ctx.fillStyle = "red";
            npcs.forEach((npc) => {
                if (!npc.alive) return;
                ctx.beginPath();
                ctx.arc(npc.tileX * scaleX, npc.tileY * scaleY, 2, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // Draw Players
        if (players) {
            players.forEach((player) => {
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

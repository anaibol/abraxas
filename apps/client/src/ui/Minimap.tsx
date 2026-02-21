import type { MinimapMarker, TileMap } from "@abraxas/shared";
import { type FC, type MouseEvent, useEffect, useRef } from "react";
import { useIsMobile } from "../hooks/useIsMobile";

/** Minimal shape the minimap needs — avoids importing server schema into the client. */
type MinimapEntity = { tileX: number; tileY: number; alive: boolean; sessionId: string };
type SchemaMap<T> = { forEach: (cb: (value: T, key: string) => void) => void };

type MinimapProps = {
  map: TileMap;
  players: SchemaMap<MinimapEntity> | undefined;
  npcs: SchemaMap<MinimapEntity> | undefined;
  currentPlayerId: string;
  isGM?: boolean;
  onGMClick?: (tileX: number, tileY: number) => void;
  /** Optional static markers: quest pins, waypoints, event locations. */
  markers?: MinimapMarker[];
};

export const Minimap: FC<MinimapProps> = ({
  map,
  players,
  npcs,
  currentPlayerId,
  isGM,
  onGMClick,
  markers = [],
}) => {
  const isMobile = useIsMobile();
  const size = isMobile ? 120 : 200;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const VISIBLE_TILES = 80;

  // biome-ignore lint/correctness/useExhaustiveDependencies: players/npcs are stable mutable MapSchema refs read live by the RAF loop; currentPlayerId never changes during a session
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = map.width;
    bgCanvas.height = map.height;
    const bgCtx = bgCanvas.getContext("2d");
    if (!bgCtx) return;

    // Tile colors mirror the game's bakeMapChunk palette
    const TILE_COLORS: Record<number, string> = {
      0: "#4a8c2a", // grass
      1: "#484848", // wall / stone
      2: "#2a5018", // tree
      3: "#0c2a68", // water
    };
    const VOID_COLOR = "#1a1a1a";

    bgCtx.fillStyle = VOID_COLOR;
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tileType = map.tileTypes?.[y]?.[x] ?? (map.collision[y]?.[x] === 1 ? 1 : 0);
        bgCtx.fillStyle = TILE_COLORS[tileType] ?? TILE_COLORS[0];
        bgCtx.fillRect(x, y, 1, 1);
      }
    }

    let rafId: number;

    const render = () => {
      let cx = map.width / 2;
      let cy = map.height / 2;
      players?.forEach((p) => {
        if (p.sessionId === currentPlayerId) {
          cx = p.tileX;
          cy = p.tileY;
        }
      });

      const TILE_SCALE = size / VISIBLE_TILES;
      const sX = cx - VISIBLE_TILES / 2;
      const sY = cy - VISIBLE_TILES / 2;

      ctx.fillStyle = VOID_COLOR;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.imageSmoothingEnabled = false;

      const sRectX = Math.max(0, sX);
      const sRectY = Math.max(0, sY);
      const sRectW = Math.min(map.width - sRectX, VISIBLE_TILES - (sRectX - sX));
      const sRectH = Math.min(map.height - sRectY, VISIBLE_TILES - (sRectY - sY));

      if (sRectW > 0 && sRectH > 0) {
        const dX = (sRectX - sX) * TILE_SCALE;
        const dY = (sRectY - sY) * TILE_SCALE;
        const dW = sRectW * TILE_SCALE;
        const dH = sRectH * TILE_SCALE;
        ctx.drawImage(bgCanvas, sRectX, sRectY, sRectW, sRectH, dX, dY, dW, dH);
      }

      npcs?.forEach((npc) => {
        if (!npc.alive) return;
        const px = (npc.tileX - sX) * TILE_SCALE;
        const py = (npc.tileY - sY) * TILE_SCALE;
        ctx.fillStyle = "#e03030";
        ctx.beginPath();
        ctx.arc(px + TILE_SCALE / 2, py + TILE_SCALE / 2, Math.max(2, TILE_SCALE), 0, Math.PI * 2);
        ctx.fill();
      });

      players?.forEach((player) => {
        if (!player.alive) return;
        const isSelf = player.sessionId === currentPlayerId;
        const px = (player.tileX - sX) * TILE_SCALE;
        const py = (player.tileY - sY) * TILE_SCALE;

        ctx.fillStyle = isSelf ? "#00ff66" : "#4488ff";
        ctx.beginPath();
        ctx.arc(
          px + TILE_SCALE / 2,
          py + TILE_SCALE / 2,
          Math.max(2.5, TILE_SCALE * 1.5),
          0,
          Math.PI * 2,
        );
        ctx.fill();
        if (isSelf) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = Math.max(0.8, TILE_SCALE * 0.4);
          ctx.stroke();
        }
      });

      // ── Markers (quest pins, waypoints, event) ─────────────────────────────
      for (const marker of markers) {
        const mx = (marker.tileX - sX) * TILE_SCALE;
        const my = (marker.tileY - sY) * TILE_SCALE;
        const r = Math.max(3, TILE_SCALE * 1.2);

        if (marker.type === "quest") {
          // Yellow ? badge
          ctx.fillStyle = "rgba(255,230,0,0.85)";
          ctx.beginPath();
          ctx.arc(mx + TILE_SCALE / 2, my + TILE_SCALE / 2, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#000";
          ctx.font = `bold ${Math.max(6, r)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("?", mx + TILE_SCALE / 2, my + TILE_SCALE / 2);
        } else if (marker.type === "waypoint") {
          // Blue diamond
          const half = r;
          ctx.fillStyle = "rgba(80,160,255,0.85)";
          ctx.beginPath();
          ctx.moveTo(mx + TILE_SCALE / 2, my + TILE_SCALE / 2 - half);
          ctx.lineTo(mx + TILE_SCALE / 2 + half, my + TILE_SCALE / 2);
          ctx.lineTo(mx + TILE_SCALE / 2, my + TILE_SCALE / 2 + half);
          ctx.lineTo(mx + TILE_SCALE / 2 - half, my + TILE_SCALE / 2);
          ctx.closePath();
          ctx.fill();
        } else if (marker.type === "event") {
          // Pulsing red star (just a big glowing dot here for canvas simplicity)
          ctx.fillStyle = `rgba(255,80,80,${0.6 + 0.4 * Math.sin(Date.now() / 300)})`;
          ctx.beginPath();
          ctx.arc(mx + TILE_SCALE / 2, my + TILE_SCALE / 2, r * 1.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(255,200,200,0.8)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      rafId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(rafId);
  }, [map, size, markers]);

  const handleContextMenu = (e: MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isGM || !onGMClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;

    let cx = map.width / 2;
    let cy = map.height / 2;
    players?.forEach((p) => {
      if (p.sessionId === currentPlayerId) {
        cx = p.tileX;
        cy = p.tileY;
      }
    });

    const TILE_SCALE = size / VISIBLE_TILES;
    const sX = cx - VISIBLE_TILES / 2;
    const sY = cy - VISIBLE_TILES / 2;

    const tileX = Math.floor(sX + relX / TILE_SCALE);
    const tileY = Math.floor(sY + relY / TILE_SCALE);
    onGMClick(tileX, tileY);
  };

  return (
    <div
      style={{
        position: "absolute",
        top: isMobile ? "12px" : undefined,
        bottom: isMobile ? undefined : "20px",
        right: isMobile ? "64px" : "20px",
        border: isGM ? "2px solid rgba(212, 168, 67, 0.85)" : "2px solid rgba(212, 168, 67, 0.5)",
        backgroundColor: "rgba(10, 8, 20, 0.85)",
        borderRadius: "50%",
        overflow: "hidden",
        width: `${size}px`,
        height: `${size}px`,
        zIndex: 40,
        pointerEvents: "auto",
        cursor: isGM ? "crosshair" : "default",
      }}
    >
      <canvas
        ref={canvasRef}
        onContextMenu={handleContextMenu}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    </div>
  );
};

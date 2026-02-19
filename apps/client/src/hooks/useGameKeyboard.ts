import { useEffect } from "react";
import { ITEMS } from "@abraxas/shared";
import type { NetworkManager } from "../network/NetworkManager";
import type { Room } from "@colyseus/sdk";
import type { GameState } from "../../../server/src/schema/GameState";
import type { InventorySlot } from "../ui/Sidebar";

type Deps = {
  phase: "lobby" | "game";
  isChatOpen: boolean;
  selectedItemId: string | null;
  inventory: InventorySlot[] | undefined;
  dropDialog: { itemId: string } | null;
  networkRef: React.RefObject<NetworkManager | null>;
  roomRef: React.RefObject<Room<GameState> | null>;
  setIsChatOpen: (open: boolean) => void;
  setShowScoreboard: (show: boolean) => void;
  setDropDialog: (d: { itemId: string; itemName: string; maxQty: number } | null) => void;
  setSelectedItemId: (id: string | null) => void;
};

export function useGameKeyboard({
  phase,
  isChatOpen,
  selectedItemId,
  inventory,
  dropDialog,
  networkRef,
  roomRef,
  setIsChatOpen,
  setShowScoreboard,
  setDropDialog,
  setSelectedItemId,
}: Deps) {
  // Enter / Escape for chat
  useEffect(() => {
    if (phase !== "game") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !isChatOpen) setIsChatOpen(true);
      if (e.key === "Escape" && isChatOpen) setIsChatOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, isChatOpen, setIsChatOpen]);

  // Tab for scoreboard
  useEffect(() => {
    if (phase !== "game") return;
    const down = (e: KeyboardEvent) => { if (e.key === "Tab") { e.preventDefault(); setShowScoreboard(true); } };
    const up   = (e: KeyboardEvent) => { if (e.key === "Tab") { e.preventDefault(); setShowScoreboard(false); } };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [phase, setShowScoreboard]);

  // Game actions: A (pickup), T (drop)
  useEffect(() => {
    if (phase !== "game" || isChatOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.type !== "keydown") return;
      const key = e.key.toLowerCase();

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

      if (key === "t") {
        if (!selectedItemId || dropDialog) return;
        const slot = (inventory ?? []).find((i) => i.itemId === selectedItemId);
        if (!slot) return;
        if (slot.quantity > 1) {
          const itemName = ITEMS[slot.itemId]?.name ?? slot.itemId;
          setDropDialog({ itemId: slot.itemId, itemName, maxQty: slot.quantity });
        } else {
          networkRef.current?.sendDropItem(slot.itemId, 1);
          setSelectedItemId(null);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, isChatOpen, selectedItemId, inventory, dropDialog, networkRef, roomRef, setDropDialog, setSelectedItemId]);
}

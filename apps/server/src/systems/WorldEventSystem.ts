import type { BroadcastFn, TileMap, WorldEvent } from "@abraxas/shared";
import { ServerMessageType, WORLD_EVENTS } from "@abraxas/shared";
import { logger } from "../logger";
import type { GameState } from "../schema/GameState";
import type { NpcSystem } from "./NpcSystem";

interface EventSchedule {
  event: WorldEvent;
  /** Wall-clock ms when the next start is due (0 = not scheduled yet). */
  nextStartAt: number;
  /** Spawn IDs created for the current run, so we can clean them up on end. */
  activeNpcTypes: string[];
}

/**
 * Manages the lifecycle of recurring world events.
 * Events start automatically on a fixed interval, spawn NPC waves,
 * broadcast start/end notifications, and clean up after themselves.
 */
export class WorldEventSystem {
  private schedules: EventSchedule[];

  constructor(
    private state: GameState,
    private npcSystem: NpcSystem,
  ) {
    // Stagger first runs so multiple events don't fire simultaneously on boot.
    const now = Date.now();
    this.schedules = WORLD_EVENTS.map((event: WorldEvent, i: number) => ({
      event,
      // First occurrence: spread out by 10 min per event so they don't all fire at once.
      nextStartAt: now + (i + 1) * 600_000,
      activeNpcTypes: [],
    }));
  }

  /** Called by TickSystem when an event NPC is killed — updates progress counter. */
  onEventNpcDied(npcSessionId: string, broadcast: BroadcastFn): void {
    for (const schedule of this.schedules) {
      const idx = schedule.activeNpcTypes.indexOf(npcSessionId);
      if (idx === -1) continue;
      schedule.activeNpcTypes.splice(idx, 1);

      // Broadcast live progress
      broadcast(ServerMessageType.WorldEventProgress, {
        eventId: schedule.event.id,
        npcsDead:
          schedule.event.spawns.reduce((s, w) => s + w.count, 0) - schedule.activeNpcTypes.length,
        npcsTotalCount: schedule.event.spawns.reduce((s, w) => s + w.count, 0),
      });
      break;
    }
  }

  tick(map: TileMap, now: number, broadcast: BroadcastFn): void {
    for (const schedule of this.schedules) {
      if (schedule.nextStartAt === 0) continue;

      if (now >= schedule.nextStartAt) {
        if (this.state.worldEventId === "") {
          this.startEvent(schedule, map, now, broadcast);
        } else {
          // If another event is running, delay this one slightly instead of skipping entirely
          schedule.nextStartAt = now + 10000; // Check again in 10s
        }
        continue;
      }

      // ── End event ───────────────────────────────────────────────────────────
      if (
        this.state.worldEventId === schedule.event.id &&
        this.state.worldEventEndsAt > 0 &&
        now >= this.state.worldEventEndsAt
      ) {
        this.endEvent(schedule, broadcast, now);
      }
    }
  }

  private startEvent(
    schedule: EventSchedule,
    map: TileMap,
    now: number,
    broadcast: BroadcastFn,
  ): void {
    const { event } = schedule;

    // Spawn NPC waves for this event and track their session IDs
    schedule.activeNpcTypes = [];
    for (const wave of event.spawns) {
      for (let i = 0; i < wave.count; i++) {
        const npc = this.npcSystem.spawnNpc(wave.npcType, map);
        if (npc) schedule.activeNpcTypes.push(npc.sessionId);
      }
    }

    const totalNpcs = event.spawns.reduce((s, w) => s + w.count, 0);

    // Update synced state so clients can show event banners
    this.state.worldEventId = event.id;
    this.state.worldEventEndsAt = now + event.durationMs;

    // Clear the schedule so it won't fire again until re-queued in endEvent
    schedule.nextStartAt = 0;

    broadcast(ServerMessageType.WorldEventStart, {
      eventId: event.id,
      name: event.name,
      description: event.description,
      durationMs: event.durationMs,
      totalNpcs,
    });

    logger.info({
      intent: "world_event_start",
      eventId: event.id,
      endsAt: new Date(this.state.worldEventEndsAt).toISOString(),
    });
  }

  private endEvent(schedule: EventSchedule, broadcast: BroadcastFn, now: number): void {
    const { event } = schedule;

    // Clear synced state
    this.state.worldEventId = "";
    this.state.worldEventEndsAt = 0;

    for (const npcId of schedule.activeNpcTypes) {
      const npc = this.npcSystem.getNpc(npcId);
      if (npc && npc.alive) {
        // We simulate a silent removal (despawn) instead of a death to avoid dropping loot
        this.npcSystem.despawnNpc(npcId);
      }
    }
    schedule.activeNpcTypes = [];

    // Schedule the next occurrence
    schedule.nextStartAt = now + event.intervalMs;

    broadcast(ServerMessageType.WorldEventEnd, { eventId: event.id });

    logger.info({
      intent: "world_event_end",
      eventId: event.id,
      nextAt: new Date(schedule.nextStartAt).toISOString(),
    });
  }
}

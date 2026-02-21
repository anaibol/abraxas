import {
  type BroadcastFn,
  type PlayerBuffState,
  ServerMessageType,
} from "@abraxas/shared";
import type { Entity } from "../utils/SpatialLookup";

export class BuffSystem {
  private state = new Map<string, PlayerBuffState>();

  private getState(sessionId: string): PlayerBuffState {
    let s = this.state.get(sessionId);
    if (!s) {
      s = {
        buffs: [],
        dots: [],
        stunnedUntil: 0,
        stealthedUntil: 0,
        spawnProtectedUntil: 0,
      };
      this.state.set(sessionId, s);
    }
    return s;
  }

  removePlayer(sessionId: string): void {
    this.state.delete(sessionId);
  }
  addBuff(
    sessionId: string,
    id: string,
    stat: string,
    amount: number,
    durationMs: number,
    now: number,
    overrideBodyId?: number,
    overrideHeadId?: number,
  ): void {
    const s = this.getState(sessionId);
    const existing = s.buffs.find((b) => b.id === id);
    if (existing) {
      // Bug #23: Refresh from `now` to prevent infinite extension
      existing.expiresAt = now + durationMs;
    } else {
      s.buffs.push({
        id,
        stat,
        amount,
        expiresAt: now + durationMs,
        overrideBodyId,
        overrideHeadId,
      });
    }
  }

  hasBuff(sessionId: string, id: string, now: number): boolean {
    const s = this.state.get(sessionId);
    return !!s && s.buffs.some((b) => b.id === id && now < b.expiresAt);
  }

  removeBuff(sessionId: string, id: string): void {
    const s = this.state.get(sessionId);
    if (s) {
      s.buffs = s.buffs.filter((b) => b.id !== id);
    }
  }

  addDoT(
    targetSessionId: string,
    sourceSessionId: string,
    id: string,
    damage: number,
    intervalMs: number,
    durationMs: number,
    now: number,
  ): void {
    const s = this.getState(targetSessionId);
    // Replace existing DoT of same id from same source
    s.dots = s.dots.filter((d) => !(d.id === id && d.sourceSessionId === sourceSessionId));
    s.dots.push({
      id,
      sourceSessionId,
      damage,
      intervalMs,
      expiresAt: now + durationMs,
      lastTickAt: now,
    });
  }

  applyStun(sessionId: string, durationMs: number, now: number): void {
    const s = this.getState(sessionId);
    s.stunnedUntil = Math.max(s.stunnedUntil, now + durationMs);
  }

  clearStun(sessionId: string): void {
    const s = this.state.get(sessionId);
    if (s) s.stunnedUntil = 0;
  }

  applyStealth(sessionId: string, durationMs: number, now: number): void {
    const s = this.getState(sessionId);
    s.stealthedUntil = now + durationMs;
  }

  breakStealth(sessionId: string): void {
    const s = this.state.get(sessionId);
    if (s) s.stealthedUntil = 0;
  }

  isStunned(sessionId: string, now: number): boolean {
    const s = this.state.get(sessionId);
    return !!s && now < s.stunnedUntil;
  }

  isStealthed(sessionId: string, now: number): boolean {
    const s = this.state.get(sessionId);
    return !!s && now < s.stealthedUntil;
  }

  isInvulnerable(sessionId: string, now: number): boolean {
    const s = this.state.get(sessionId);
    return (
      !!s &&
      (s.buffs.some((b) => b.stat === "invulnerable" && now < b.expiresAt) ||
        now < s.spawnProtectedUntil)
    );
  }

  isSpawnProtected(sessionId: string, now: number): boolean {
    const s = this.state.get(sessionId);
    return !!s && now < s.spawnProtectedUntil;
  }

  applySpawnProtection(sessionId: string, durationMs: number, now: number): void {
    const s = this.getState(sessionId);
    s.spawnProtectedUntil = now + durationMs;
    // Clear any active DoTs so they don't deal damage during the protection window
    s.dots = [];
  }

  clearSpawnProtection(sessionId: string): void {
    const s = this.state.get(sessionId);
    if (s) s.spawnProtectedUntil = 0;
  }

  /** Remove all active DoTs and debuff buffs (for antidote items). */
  clearDebuffs(sessionId: string): void {
    const s = this.state.get(sessionId);
    if (!s) return;
    s.dots = [];
    s.buffs = s.buffs.filter((b) => b.amount >= 0);
  }

  /** Apply a temporary stat buff from an elixir item. Uses the existing buff slot. */
  applyTempBuff(
    player: { sessionId: string },
    stat: string,
    amount: number,
    durationMs: number,
    now: number = Date.now(),
  ): void {
    // Bug #25: Use authoritative `now` passed from caller
    this.addBuff(player.sessionId, `elixir_${stat}`, stat, amount, durationMs, now);
  }

  getBuffBonus(sessionId: string, stat: string, now: number): number {
    const s = this.state.get(sessionId);
    if (!s) return 0;
    return s.buffs.reduce(
      (sum, b) => (b.stat === stat && now < b.expiresAt ? sum + b.amount : sum),
      0,
    );
  }

  /** Process DoTs and expire buffs/stuns. Call every tick. Works for both Players and NPCs. */
  tick(
    now: number,
    getEntity: (sessionId: string) => Entity | undefined,
    broadcast: BroadcastFn,
    onDeath: (entity: Entity, killerSessionId?: string) => void,
  ): void {
    for (const [sessionId, s] of this.state.entries()) {
      const entity = getEntity(sessionId);
      if (!entity || !entity.alive) continue;

      // Update stunned/stealthed/spawnProtection flags on the schema
      entity.stunned = now < s.stunnedUntil;
      entity.stealthed = now < s.stealthedUntil;
      entity.spawnProtection = now < s.spawnProtectedUntil;

      // Polymorph Healing (special case)
      // Bug #24: Use time-based heal (every 250ms) instead of per-tick to be TPS-independent
      const polyBuff = s.buffs.find((b) => b.id === "polymorph");
      if (polyBuff) {
        const polyInterval = 250; // ms between heals
        const lastPolyHeal = (polyBuff as { lastHealAt?: number }).lastHealAt ?? 0;
        if (now - lastPolyHeal >= polyInterval) {
          const heal = Math.ceil(entity.maxHp * 0.01); // 1% HP per tick interval
          entity.hp = Math.min(entity.maxHp, entity.hp + heal);
          (polyBuff as { lastHealAt?: number }).lastHealAt = now;
        }
      }

      // Expire old buffs
      const buffsBefore = s.buffs.length;
      s.buffs = s.buffs.filter((b) => now < b.expiresAt);

      if (s.buffs.length !== buffsBefore) {
        if (entity.hp > entity.maxHp) entity.hp = entity.maxHp;
        if (
          entity.isPlayer() &&
          entity.mana > entity.maxMana
        ) {
          entity.mana = entity.maxMana;
        }
      }

      // Apply appearance overrides from active buffs (overrideBodyId/HeadId are on Char base)
      let overrideBodyId = 0;
      let overrideHeadId = 0;
      for (const b of s.buffs) {
        if (b.overrideBodyId) overrideBodyId = b.overrideBodyId;
        if (b.overrideHeadId) overrideHeadId = b.overrideHeadId;
      }
      entity.overrideBodyId = overrideBodyId;
      entity.overrideHeadId = overrideHeadId;

      // Process DoTs — expire first, then tick the survivors
      s.dots = s.dots.filter((d) => now < d.expiresAt);
      for (const dot of s.dots) {
        if (now - dot.lastTickAt < dot.intervalMs) continue;
        dot.lastTickAt = now;
        entity.hp -= dot.damage;

        broadcast(ServerMessageType.Damage, {
          targetSessionId: sessionId,
          amount: dot.damage,
          hpAfter: entity.hp,
          type: "dot",
        });

        if (entity.hp <= 0) {
          entity.hp = 0;
          onDeath(entity, dot.sourceSessionId);
          break;
        }
      }
    }
  }
}

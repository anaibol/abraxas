import type { Player } from "../schema/Player";
import {
	Buff,
	BroadcastFn,
	DoT,
	PlayerBuffState,
	ServerMessageType,
} from "@abraxas/shared";

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
	): void {
		const s = this.getState(sessionId);
		const existing = s.buffs.find((b) => b.id === id);
		if (existing) {
			existing.expiresAt = Math.max(existing.expiresAt, now) + durationMs;
			// Optionally update amount if it's stronger? For now just extend.
		} else {
			s.buffs.push({ id, stat, amount, expiresAt: now + durationMs });
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
		s.dots = s.dots.filter(
			(d) => !(d.id === id && d.sourceSessionId === sourceSessionId),
		);
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
		if (!s) return false;
		return (
			s.buffs.some((b) => b.stat === "invulnerable" && now < b.expiresAt) ||
			now < s.spawnProtectedUntil
		);
	}

	isSpawnProtected(sessionId: string, now: number): boolean {
		const s = this.state.get(sessionId);
		return !!s && now < s.spawnProtectedUntil;
	}

	applySpawnProtection(
		sessionId: string,
		durationMs: number,
		now: number,
	): void {
		const s = this.getState(sessionId);
		s.spawnProtectedUntil = now + durationMs;
		// Clear any active DoTs so they don't deal damage during the protection window
		s.dots = [];
	}

	getBuffBonus(sessionId: string, stat: string, now: number): number {
		const s = this.state.get(sessionId);
		if (!s) return 0;
		let total = 0;
		for (const b of s.buffs) {
			if (b.stat === stat && now < b.expiresAt) {
				total += b.amount;
			}
		}
		return total;
	}

	/** Process DoTs and expire buffs/stuns. Call every tick. */
	tick(
		now: number,
		getPlayer: (sessionId: string) => Player | undefined,
		broadcast: BroadcastFn,
		onDeath: (player: Player) => void,
	): void {
		for (const [sessionId, s] of this.state.entries()) {
			const player = getPlayer(sessionId);
			if (!player || !player.alive) continue;

			// Update stunned/stealthed/spawnProtection flags on the schema
			player.stunned = now < s.stunnedUntil;
			player.stealthed = now < s.stealthedUntil;
			player.spawnProtection = now < s.spawnProtectedUntil;

			// Expire old buffs
			s.buffs = s.buffs.filter((b) => now < b.expiresAt);

			// Process DoTs
			const activeDots: DoT[] = [];
			for (const dot of s.dots) {
				if (now >= dot.expiresAt) continue;
				activeDots.push(dot);

				if (now - dot.lastTickAt >= dot.intervalMs) {
					dot.lastTickAt = now;
					player.hp -= dot.damage;

					// Broadcast damage caused by DoT
					broadcast(ServerMessageType.Damage, {
						targetSessionId: sessionId,
						amount: dot.damage,
						hpAfter: player.hp,
						type: "dot",
					});

					if (player.hp <= 0) {
						player.hp = 0;
						player.alive = false;
						broadcast(ServerMessageType.Death, { sessionId });
						onDeath(player);
						break;
					}
				}
			}
			s.dots = activeDots;
		}
	}
}

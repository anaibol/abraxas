import type { Room } from "@colyseus/sdk";
import type { ServerMessages } from "@abraxas/shared";
import { ServerMessageType, SPAWN_PROTECTION_MS, ChatChannel } from "@abraxas/shared";
import type { SpriteManager } from "../managers/SpriteManager";
import type { EffectManager } from "../managers/EffectManager";
import type { SoundManager } from "../assets/SoundManager";
import type { InputHandler } from "../systems/InputHandler";
import type { ConsoleCallback } from "../scenes/GameScene";

export class GameEventHandler {
	private unsubscribers: (() => void)[] = [];

	constructor(
		private room: Room,
		private spriteManager: SpriteManager,
		private effectManager: EffectManager,
		private soundManager: SoundManager,
		private inputHandler: InputHandler,
		private onConsoleMessage?: ConsoleCallback,
		private onKillFeed?: (killer: string, victim: string) => void,
		private onError?: (message: string) => void,
	) {}

	private isSelf(sessionId: string): boolean {
		return sessionId === this.room.sessionId;
	}

	setupListeners() {
		const on = <T extends keyof ServerMessages>(
			type: T,
			handler: (data: ServerMessages[T]) => void,
		) => {
			this.unsubscribers.push(this.room.onMessage(type, handler));
		};

		on(ServerMessageType.Chat, (data) => this.onChat(data));
		on(ServerMessageType.AttackStart, (data) => this.onAttackStart(data));
		on(ServerMessageType.AttackHit, (data) => this.onAttackHit(data));
		on(ServerMessageType.CastStart, (data) => this.onCastStart(data));
		on(ServerMessageType.CastHit, (data) => this.onCastHit(data));
		on(ServerMessageType.Damage, (data) => this.onDamage(data));
		on(ServerMessageType.Death, (data) => this.onDeath(data));
		on(ServerMessageType.Heal, (data) => this.onHeal(data));
		on(ServerMessageType.BuffApplied, (data) => this.onBuffApplied(data));
		on(ServerMessageType.StunApplied, (data) => this.onStunApplied(data));
		on(ServerMessageType.Respawn, (data) => this.onRespawn(data));
		on(ServerMessageType.KillFeed, (data) => this.onKillFeedMessage(data));
		on(ServerMessageType.InvalidTarget, () => this.onInvalidTarget());
		on(ServerMessageType.LevelUp, (data) => this.onLevelUp(data));
		on(ServerMessageType.Notification, (data) => this.onNotification(data));
		on(ServerMessageType.StealthApplied, (data) => this.onStealthApplied(data));
		on(ServerMessageType.Error, (data) => this.onErrorMessage(data));
	}

	destroy() {
		for (const unsub of this.unsubscribers) unsub();
		this.unsubscribers = [];
	}

	private onChat(data: ServerMessages[ServerMessageType.Chat]) {
		if (data.channel === ChatChannel.Whisper || data.channel === ChatChannel.System) return;
		this.spriteManager.showChatBubble(data.senderId, data.message);
	}

	private onErrorMessage(data: { message: string }) {
		this.onError?.(data.message);
		this.onConsoleMessage?.(`Error: ${data.message}`, "#ff0000");
	}

	private onAttackStart(data: ServerMessages["attack_start"]) {
		const sprite = this.spriteManager.getSprite(data.sessionId);
		if (sprite) {
			this.spriteManager.pulseAlpha(data.sessionId, 0.7, 100);
			if (this.isSelf(data.sessionId))
				this.onConsoleMessage?.("You attacked!", "#cccccc");
		}
		this.soundManager.playAttack();
	}

	private onAttackHit(data: ServerMessages["attack_hit"]) {
		if (data.targetSessionId) {
			this.spriteManager.flashSprite(data.targetSessionId);
			this.effectManager.playMeleeHit(data.targetSessionId);
		}
	}

	private onCastStart(data: ServerMessages["cast_start"]) {
		const sprite = this.spriteManager.getSprite(data.sessionId);
		if (sprite) {
			this.spriteManager.pulseAlpha(data.sessionId, 0.8, 140);
			if (this.isSelf(data.sessionId))
				this.onConsoleMessage?.("You cast a spell!", "#aaaaff");
		}
		this.soundManager.playSpell();
	}

	private onCastHit(data: ServerMessages["cast_hit"]) {
		this.effectManager.playSpellEffect(data.spellId, data.targetTileX, data.targetTileY);
	}

	private onDamage(data: ServerMessages["damage"]) {
		this.effectManager.showDamage(data.targetSessionId, data.amount, data.type);
		this.soundManager.playHit();

		if (this.isSelf(data.targetSessionId)) {
			this.onConsoleMessage?.(`You took ${data.amount} damage!`, "#ff4444");
		}
	}

	private onDeath(data: ServerMessages["death"]) {
		const sprite = this.spriteManager.getSprite(data.sessionId);
		if (sprite) {
			this.spriteManager.setAlpha(data.sessionId, 0.3);
		}
		if (this.isSelf(data.sessionId)) {
			this.inputHandler.cancelTargeting();
			this.onConsoleMessage?.("You have died!", "#ff0000");
		}
		this.soundManager.playDeath();
	}

	private onRespawn(data: ServerMessages["respawn"]) {
		const sprite = this.spriteManager.getSprite(data.sessionId);
		if (sprite) {
			sprite.setTilePosition(data.tileX, data.tileY);
			this.spriteManager.startSpawnProtectionEffect(
				data.sessionId,
				SPAWN_PROTECTION_MS,
			);
		}
		if (this.isSelf(data.sessionId)) {
			this.onConsoleMessage?.(
				"You have respawned! (Protected for 5s)",
				"#aaffaa",
			);
		}
	}

	private onHeal(data: ServerMessages["heal"]) {
		this.effectManager.showHeal(data.sessionId, data.amount);
		this.soundManager.playHeal();
		if (this.isSelf(data.sessionId)) {
			this.onConsoleMessage?.(`You healed for ${data.amount}!`, "#33cc33");
		}
	}

	private onBuffApplied(data: ServerMessages["buff_applied"]) {
		this.effectManager.showFloatingText(data.sessionId, "BUFF", "#d4a843");
	}

	private onStunApplied(data: ServerMessages["stun_applied"]) {
		this.effectManager.showFloatingText(
			data.targetSessionId,
			"STUNNED",
			"#cccc33",
		);
		if (this.isSelf(data.targetSessionId)) {
			this.onConsoleMessage?.("You are stunned!", "#cccc33");
		}
	}

	private onStealthApplied(data: ServerMessages["stealth_applied"]) {
		this.effectManager.showFloatingText(data.sessionId, "STEALTH", "#aaddff");
	}

	private onKillFeedMessage(data: ServerMessages["kill_feed"]) {
		this.onKillFeed?.(data.killerName, data.victimName);
	}

	private onInvalidTarget() {
		this.effectManager.showFloatingText(this.room.sessionId, "Invalid target", "#ff8800");
	}

	private onLevelUp(data: ServerMessages["level_up"]) {
		this.effectManager.showFloatingText(data.sessionId, "LEVEL UP!", "#ffff00");
	}

	private onNotification(data: ServerMessages["notification"]) {
		this.onConsoleMessage?.(data.message, "#ffff00");
	}
}

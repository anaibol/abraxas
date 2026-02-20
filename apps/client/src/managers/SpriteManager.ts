import Phaser from "phaser";
import { PlayerSprite } from "../entities/PlayerSprite";
import type { CameraController } from "../systems/CameraController";
import type { GameScene } from "../scenes/GameScene";
import type { PlayerEntityState, NpcEntityState } from "@abraxas/shared";
import { ABILITIES } from "@abraxas/shared";

export class SpriteManager {
	private sprites = new Map<string, PlayerSprite>();
	private spawnProtectionTweens = new Map<string, Phaser.Tweens.Tween>();

	constructor(
		private scene: GameScene,
		private cameraController: CameraController,
		private getSessionId: () => string,
	) {}

	addPlayer(player: PlayerEntityState, sessionId: string) {
		if (this.sprites.has(sessionId)) return;
		const isLocal = sessionId === this.getSessionId();
		const sprite = new PlayerSprite(
			this.scene,
			sessionId,
			player.tileX,
			player.tileY,
			player.classType,
			player.name,
			isLocal,
		);
		this.sprites.set(sessionId, sprite);
		if (isLocal) this.cameraController.follow(sprite);
	}

	syncPlayer(player: PlayerEntityState, sessionId: string) {
		const sprite = this.sprites.get(sessionId);
		if (!sprite) return;
		if (sprite.isLocal) {
			sprite.reconcileServer(player.tileX, player.tileY);
		} else {
			sprite.setTilePosition(player.tileX, player.tileY);
		}
		sprite.setFacing(player.facing);
		sprite.updateHpMana(player.hp, player.mana ?? 0);
		sprite.updateEquipment(
			player.equipWeapon,
			player.equipShield,
			player.equipHelmet,
			player.equipMount ?? "",
		);
		sprite.setMeditating(player.meditating ?? false);
		this.updateAlpha(sprite, player);
	}

	removePlayer(sessionId: string) {
		this.stopSpawnProtectionEffect(sessionId);
		this.removeEntity(sessionId);
	}

	removeNpc(id: string) {
		this.removeEntity(id);
	}

	private removeEntity(id: string) {
		const sprite = this.sprites.get(id);
		if (sprite) {
			this.sprites.delete(id);
			sprite.destroy();
		}
	}

	addNpc(npc: NpcEntityState, id: string) {
		if (this.sprites.has(id)) return;
		const sprite = new PlayerSprite(
			this.scene,
			id,
			npc.tileX,
			npc.tileY,
			npc.type,
			npc.name,
			false,
		);
		this.sprites.set(id, sprite);
	}

	syncNpc(npc: NpcEntityState, id: string) {
		const sprite = this.sprites.get(id);
		if (!sprite) return;
		sprite.setTilePosition(npc.tileX, npc.tileY);
		sprite.setFacing(npc.facing);
		sprite.updateHpMana(npc.hp, 0);
		this.updateAlpha(sprite, npc);
	}

	/** Per-frame interpolation — all state-driven updates happen via syncPlayer/syncNpc. */
	update(delta: number) {
		for (const [, sprite] of this.sprites) {
			sprite.update(delta);
		}
	}

	getSprite(sessionId: string): PlayerSprite | undefined {
		return this.sprites.get(sessionId);
	}

	getAllSprites(): Map<string, PlayerSprite> {
		return this.sprites;
	}

	flashSprite(sessionId: string) {
		this.pulseAlpha(sessionId, 0.5, 80);
	}

	pulseAlpha(sessionId: string, toAlpha: number, durationMs: number) {
		const sprite = this.sprites.get(sessionId);
		if (!sprite) return;
		const prev = sprite.container.alpha;
		sprite.container.setAlpha(toAlpha);
		this.scene.time.delayedCall(durationMs, () => {
			if (sprite?.container) sprite.container.setAlpha(prev);
		});
	}

	setAlpha(sessionId: string, alpha: number) {
		this.sprites.get(sessionId)?.container.setAlpha(alpha);
	}

	showChatBubble(sessionId: string, message: string) {
		this.sprites.get(sessionId)?.showChatBubble(message);
	}

	setSpeaking(sessionId: string, speaking: boolean, durationMs?: number) {
		const sprite = this.sprites.get(sessionId);
		if (!sprite) return;
		sprite.showSpeakingIndicator(speaking);
		if (speaking && durationMs) {
			this.scene.time.delayedCall(durationMs, () =>
				sprite.showSpeakingIndicator(false),
			);
		}
	}

	startSpawnProtectionEffect(sessionId: string, durationMs: number) {
		const sprite = this.sprites.get(sessionId);
		if (!sprite) return;

		this.stopSpawnProtectionEffect(sessionId);

		const tween = this.scene.tweens.add({
			targets: sprite.container,
			alpha: { from: 0.25, to: 0.6 },
			duration: 400,
			yoyo: true,
			repeat: Math.ceil(durationMs / 800),
			onComplete: () => {
				this.spawnProtectionTweens.delete(sessionId);
				if (sprite.container) sprite.container.setAlpha(1);
			},
		});

		this.spawnProtectionTweens.set(sessionId, tween);
	}

	/**
	 * Applies a persistent visual state on the sprite that matches the spell's
	 * effect type (buff, debuff, poison, stun, invulnerable).
	 */
	applySpellStateVisual(
		sessionId: string,
		spellId: string,
		durationMs: number,
	) {
		const sprite = this.sprites.get(sessionId);
		if (!sprite) return;
		const spell = ABILITIES[spellId];
		if (!spell) return;

		switch (spell.effect) {
			case "stun":
				sprite.applyStun(durationMs);
				break;
			case "dot":
				sprite.applyPoison(durationMs);
				break;
			case "buff":
				sprite.applyBuff(durationMs);
				break;
			case "debuff":
				sprite.applyDebuff(durationMs);
				break;
			case "leech":
				sprite.applyDebuff(Math.min(durationMs, 1200));
				break;
			case "stealth":
				sprite.applyBuff(durationMs);
				break;
			default:
				break;
		}
	}

	applyStunVisual(sessionId: string, durationMs: number) {
		this.sprites.get(sessionId)?.applyStun(durationMs);
	}

	applyInvulnerableVisual(sessionId: string, durationMs: number) {
		this.sprites.get(sessionId)?.applyInvulnerable(durationMs);
	}

	/** Squash-and-crumple tween played when an entity dies. */
	playDeathAnimation(sessionId: string) {
		const sprite = this.sprites.get(sessionId);
		if (!sprite?.container) return;
		const container = sprite.container;

		this.scene.tweens.add({
			targets: container,
			scaleX: 1.2,
			scaleY: 0.7,
			angle: Phaser.Math.Between(-14, 14),
			duration: 200,
			ease: "Power2.Out",
			onComplete: () => {
				if (!container.scene) return;
				this.scene.tweens.add({
					targets: container,
					scaleX: 1,
					scaleY: 1,
					angle: 0,
					duration: 180,
					ease: "Back.Out",
				});
			},
		});
	}

	stopSpawnProtectionEffect(sessionId: string) {
		const existing = this.spawnProtectionTweens.get(sessionId);
		if (existing) {
			existing.stop();
			this.spawnProtectionTweens.delete(sessionId);
		}
	}

	private updateAlpha(
		sprite: PlayerSprite,
		entity: { alive: boolean; stealthed: boolean; spawnProtection: boolean },
	) {
		if (this.spawnProtectionTweens.has(sprite.sessionId)) return;

		if (!entity.alive) {
			sprite.container.setAlpha(0.3);
		} else if (entity.stealthed) {
			sprite.container.setAlpha(sprite.isLocal ? 0.5 : 0.15);
		} else {
			sprite.container.setAlpha(1);
		}
	}
}

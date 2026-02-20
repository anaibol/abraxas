import type { NpcEntityState, PlayerEntityState } from "@abraxas/shared";
import { ABILITIES } from "@abraxas/shared";
import Phaser from "phaser";
import { PlayerSprite } from "../entities/PlayerSprite";
import type { GameScene } from "../scenes/GameScene";
import type { CameraController } from "../systems/CameraController";

// ── Item #45: Per-sprite glow tracking ────────────────────────────────────────
interface ActiveGlow {
  glowRef: unknown; // Phaser.FX.Glow as `any` for version compat
  expireAt: number;
  color: number;
}

export class SpriteManager {
  private sprites = new Map<string, PlayerSprite>();
  private spawnProtectionTweens = new Map<string, Phaser.Tweens.Tween>();
  /** Item #45: Track active glow per session for explicit cancel. */
  private activeGlows = new Map<string, ActiveGlow[]>();
  /** Item #50: Track low-HP pulsing tweens */
  private lowHpGlowTweens = new Map<string, Phaser.Tweens.Tween>();
  /** Item #48: Currently-targeted session for outline glow */
  private targetOutlineSession: string | null = null;

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
    sprite.updateAppearance(player.overrideBodyId ?? 0, player.overrideHeadId ?? 0);
    sprite.updateEquipment(
      player.equipWeapon,
      player.equipShield,
      player.equipHelmet,
      player.equipMount ?? "",
    );
    sprite.setMeditating(player.meditating ?? false);
    this.updateAlpha(sprite, player);

    // ── Item #50: Low-HP danger glow on local player ────────────────────────
    if (sprite.isLocal) {
      const hpRatio = player.maxHp > 0 ? player.hp / player.maxHp : 1;
      if (hpRatio < 0.2 && player.alive && !this.lowHpGlowTweens.has(sessionId)) {
        this.startLowHpGlow(sessionId);
      } else if (hpRatio >= 0.2 && this.lowHpGlowTweens.has(sessionId)) {
        this.stopLowHpGlow(sessionId);
      }
    }

    // ── Item #49: Mount glow ───────────────────────────────────────────────────
    if (player.equipMount && player.equipMount !== "") {
      this.applyGlowFx(sessionId, 0xffe066, 3000, 1.5);
    }
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
    sprite.updateAppearance(npc.overrideBodyId ?? 0, npc.overrideHeadId ?? 0);
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
      this.scene.time.delayedCall(durationMs, () => sprite.showSpeakingIndicator(false));
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
  applySpellStateVisual(sessionId: string, spellId: string, durationMs: number) {
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

  /**
   * Apply a Post-FX Glow aura to a sprite for the duration of a buff.
   *
   * Improvements applied:
   *  #41 — Fade-out on expiry (outerStrength tweens to 0 before clear)
   *  #42 — Fade-in on apply  (outerStrength tweens from 0 to target)
   *  #43 — Cancel existing glow before applying a new one
   *  #44 — outerStrength is parameterised so callers can vary intensity
   *  #45 — Tracked per session in activeGlows map
   */
  applyGlowFx(sessionId: string, color: number, durationMs: number, strength = 4) {
    const sprite = this.sprites.get(sessionId);
    if (!sprite?.container) return;

    // ── Item #43: Cancel any existing glow before adding a new one ────────────
    this.clearGlowFx(sessionId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getPreFX = (child: unknown): any => (child as any).preFX;

    const glows: unknown[] = [];
    for (const child of sprite.container.list) {
      try {
        const preFX = getPreFX(child);
        if (!preFX) continue;
        // ── Item #42: Fade-in — start outerStrength at 0, tween up ────────────
        const glow = preFX.addGlow(color, 0, 0, false, 0.1, 16);
        if (!glow) continue;
        glows.push(glow);

        this.scene.tweens.add({
          targets: glow,
          outerStrength: strength,
          duration: 200,
          ease: "Quad.Out",
        });
      } catch (_) { /* preFX not available on this type */ }
    }

    if (glows.length === 0) return;

    // ── Item #45: Track in map ────────────────────────────────────────────────
    const activeList = glows.map(g => ({ glowRef: g, expireAt: Date.now() + durationMs, color }));
    this.activeGlows.set(sessionId, activeList);

    // ── Item #41: Fade-out before expiry ─────────────────────────────────────
    const FADE_OUT_MS = Math.min(500, durationMs * 0.25);
    this.scene.time.delayedCall(durationMs - FADE_OUT_MS, () => {
      if (!sprite.container?.scene) return;
      for (const g of glows) {
        try {
          this.scene.tweens.add({
            targets: g,
            outerStrength: 0,
            duration: FADE_OUT_MS,
            ease: "Quad.In",
            onComplete: () => {
              try { (g as any).destroy?.(); } catch (_) {}
            },
          });
        } catch (_) {}
      }
    });

    this.scene.time.delayedCall(durationMs, () => {
      if (!sprite.container?.scene) return;
      for (const child of sprite.container.list) {
        try { (child as any).preFX?.clear(); } catch (_) {}
      }
      this.activeGlows.delete(sessionId);
    });
  }

  /**
   * Item #47 — Immediately clear all active glows on a sprite.
   * Called on death, target change, etc.
   */
  clearGlowFx(sessionId: string) {
    const sprite = this.sprites.get(sessionId);
    if (!sprite?.container) {
      this.activeGlows.delete(sessionId);
      return;
    }
    for (const child of sprite.container.list) {
      try { (child as any).preFX?.clear(); } catch (_) {}
    }
    this.activeGlows.delete(sessionId);
  }

  /**
   * Item #48 — Outline glow on the currently targeted enemy.
   * Clears the previous target's outline before applying a new one.
   */
  setTargetOutline(sessionId: string | null) {
    // Clear previous outline
    if (this.targetOutlineSession && this.targetOutlineSession !== sessionId) {
      this.clearTargetOutline(this.targetOutlineSession);
    }
    this.targetOutlineSession = sessionId;
    if (!sessionId) return;

    const sprite = this.sprites.get(sessionId);
    if (!sprite?.container) return;
    for (const child of sprite.container.list) {
      try {
        const preFX = (child as any).preFX;
        if (!preFX) continue;
        preFX.addGlow(0xffffff, 2, 2, false, 0.08, 12);
      } catch (_) {}
    }
  }

  private clearTargetOutline(sessionId: string) {
    const sprite = this.sprites.get(sessionId);
    if (!sprite?.container) return;
    for (const child of sprite.container.list) {
      try { (child as any).preFX?.clear(); } catch (_) {}
    }
  }

  // ── Item #50: Low-HP pulsing red glow on local player ────────────────────────
  private startLowHpGlow(sessionId: string) {
    const sprite = this.sprites.get(sessionId);
    if (!sprite?.container) return;

    const glows: unknown[] = [];
    for (const child of sprite.container.list) {
      try {
        const preFX = (child as any).preFX;
        if (!preFX) continue;
        const glow = preFX.addGlow(0xff2200, 0, 0, false, 0.1, 16);
        if (glow) glows.push(glow);
      } catch (_) {}
    }
    if (glows.length === 0) return;

    const tween = this.scene.tweens.add({
      targets: glows,
      outerStrength: { from: 0, to: 8 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
    this.lowHpGlowTweens.set(sessionId, tween);
  }

  private stopLowHpGlow(sessionId: string) {
    const tween = this.lowHpGlowTweens.get(sessionId);
    if (tween) {
      tween.stop();
      this.lowHpGlowTweens.delete(sessionId);
      this.clearGlowFx(sessionId);
    }
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

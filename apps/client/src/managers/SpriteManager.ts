import type { NpcEntityState, PlayerEntityState } from "@abraxas/shared";
import { ABILITIES } from "@abraxas/shared";
import Phaser from "phaser";
import { PlayerSprite } from "../entities/PlayerSprite";
import type { GameScene } from "../scenes/GameScene";


// ── Item #45: Per-sprite glow tracking ────────────────────────────────────────
interface ActiveGlow {
  glowRef: unknown; // Phaser.FX.Glow — no stable public type
  expireAt: number;
  color: number;
}

/** Minimal shape of Phaser's preFX pipeline (no stable public type). */
interface PreFXPipeline {
  addGlow(color: number, outerStrength: number, innerStrength: number, knockout: boolean, quality: number, distance: number): unknown;
  clear(): void;
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
    public scene: GameScene,
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
      player.role,
    );
    // Item #51: Never show health bar for the local player.
    if (isLocal) {
      sprite.setHpBarVisibility(false);
    }
    this.sprites.set(sessionId, sprite);
  }

  syncPlayer(player: PlayerEntityState, sessionId: string) {
    const sprite = this.sprites.get(sessionId);
    if (!sprite) return;
    if (sprite.isLocal) {
      sprite.reconcileServer(player.tileX, player.tileY);
    } else {
      const moved = sprite.setTilePosition(player.tileX, player.tileY);
      if (moved && player.alive) {
        this.scene.soundManager.playStep({ sourceX: sprite.renderX, sourceY: sprite.renderY });
      }
    }
    sprite.setFacing(player.facing);
    sprite.updateHp(player.hp);
    sprite.updateAppearance(player.overrideBodyId ?? 0, player.overrideHeadId ?? 0);
    sprite.updateEquipment(
      player.equipWeaponId,
      player.equipShieldId,
      player.equipHelmetId,
      player.equipMountId ?? "",
    );
    sprite.setMeditating(player.meditating ?? false, player.maxMana ?? 100);
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
    if (player.equipMountId && player.equipMountId !== "") {
      this.applyGlowFx(sessionId, 0xffe066, 3000, 1.5);
    }
  }

  removePlayer(sessionId: string) {
    this.stopSpawnProtectionEffect(sessionId);
    this.removeEntity(sessionId);
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
      npc.npcType,
      npc.name,
      false,
    );
    this.sprites.set(id, sprite);
  }

  syncNpc(npc: NpcEntityState, id: string) {
    const sprite = this.sprites.get(id);
    if (!sprite) return;
    const moved = sprite.setTilePosition(npc.tileX, npc.tileY);
    if (moved && npc.alive) {
      this.scene.soundManager.playStep({ sourceX: sprite.renderX, sourceY: sprite.renderY });
    }
    sprite.setFacing(npc.facing);
    sprite.updateHp(npc.hp);
    sprite.updateAppearance(npc.overrideBodyId ?? 0, npc.overrideHeadId ?? 0);
    this.updateAlpha(sprite, npc);
  }

  /** Per-frame interpolation — all state-driven updates happen via syncPlayer/syncNpc. */
  update(delta: number) {
    for (const [, sprite] of this.sprites) {
      sprite.update(delta);
    }
  }

  /** Update drop-shadow appearance on every entity based on time of day. */
  updateShadows(timeOfDay: number) {
    for (const [, sprite] of this.sprites) {
      sprite.updateShadow(timeOfDay);
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
    sprite.setAlpha(toAlpha);
    this.scene.time.delayedCall(durationMs, () => {
      if (sprite?.container) sprite.setAlpha(prev);
    });
  }

  setAlpha(sessionId: string, alpha: number) {
    this.sprites.get(sessionId)?.setAlpha(alpha);
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

  // ── preFX helpers ─────────────────────────────────────────────────────────────────
  /**
   * Run `fn` against each child's preFX in a sprite container, swallowing
   * errors for objects that don't support preFX (Phaser 3.60+).
   */
  private forEachPreFX(sessionId: string, fn: (preFX: PreFXPipeline) => void) {
    const sprite = this.sprites.get(sessionId);
    if (!sprite?.container) return;
    sprite.container.list.forEach(child => {
      if ('preFX' in child && child.preFX) {
        try { fn(child.preFX as PreFXPipeline); } catch { /* unsupported child type */ }
      }
    });
  }

  /** Add a glow to every child and return the created glow objects. */
  private collectGlows(sessionId: string, color: number, innerStrength = 0): unknown[] {
    const glows: unknown[] = [];
    this.forEachPreFX(sessionId, preFX => {
      const g = preFX.addGlow(color, 0, innerStrength, false, 0.1, 16);
      if (g) glows.push(g);
    });
    return glows;
  }

  applyGlowFx(sessionId: string, color: number, durationMs: number, strength = 4) {
    this.clearGlowFx(sessionId); // cancel-before-apply (#43)
    const glows = this.collectGlows(sessionId, color);
    if (!glows.length) return;

    this.activeGlows.set(sessionId, glows.map(g => ({ glowRef: g, expireAt: Date.now() + durationMs, color })));
    // Fade in (#42)
    this.scene.tweens.add({ targets: glows, outerStrength: strength, duration: 200, ease: "Quad.Out" });
    // Fade out before expiry (#41), then clear (#43/#45)
    const fadeMs = Math.min(500, durationMs * 0.25);
    this.scene.time.delayedCall(durationMs - fadeMs, () =>
      this.scene.tweens.add({ targets: glows, outerStrength: 0, duration: fadeMs, ease: "Quad.In" }),
    );
    this.scene.time.delayedCall(durationMs, () => {
      this.forEachPreFX(sessionId, p => p.clear());
      this.activeGlows.delete(sessionId);
    });
  }

  clearGlowFx(sessionId: string) {
    this.forEachPreFX(sessionId, p => p.clear());
    this.activeGlows.delete(sessionId);
  }

  /** White preFX outline on the targeted enemy; auto-clears previous target (#48). */
  setTargetOutline(sessionId: string | null) {
    if (this.targetOutlineSession && this.targetOutlineSession !== sessionId) {
      this.forEachPreFX(this.targetOutlineSession, p => p.clear());
      this.getSprite(this.targetOutlineSession)?.setHpBarVisibility(false);
    }
    
    this.targetOutlineSession = sessionId;
    
    if (sessionId) {
      this.forEachPreFX(sessionId, p => p.addGlow(0xffffff, 2, 2, false, 0.08, 12));
      const newSprite = this.getSprite(sessionId);
      if (newSprite && !newSprite.isLocal) {
        newSprite.setHpBarVisibility(true);
      }
    }
  }

  get currentTargetId(): string | null {
    return this.targetOutlineSession;
  }

  private startLowHpGlow(sessionId: string) {
    const glows = this.collectGlows(sessionId, 0xff2200);
    if (!glows.length) return;
    const tween = this.scene.tweens.add({
      targets: glows, outerStrength: { from: 0, to: 8 },
      duration: 600, yoyo: true, repeat: -1, ease: "Sine.InOut",
    });
    this.lowHpGlowTweens.set(sessionId, tween);
  }

  private stopLowHpGlow(sessionId: string) {
    this.lowHpGlowTweens.get(sessionId)?.stop();
    this.lowHpGlowTweens.delete(sessionId);
    this.clearGlowFx(sessionId);
  }

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
      sprite.setAlpha(0.3);
    } else if (entity.stealthed) {
      sprite.setAlpha(sprite.isLocal ? 0.5 : 0.15);
    } else {
      sprite.setAlpha(1);
    }
  }
}

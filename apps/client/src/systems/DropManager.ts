import { ITEMS, i18n, TILE_SIZE } from "@abraxas/shared";
import Phaser from "phaser";
import type { Drop } from "../../../server/src/schema/Drop";
import type { EffectManager } from "../managers/EffectManager";
import { FONTS, getGameTextResolution } from "../ui/tokens";

// ─── Texture keys ────────────────────────────────────────────────────────────
const TEX_COIN_GLOW = "drop-coin-glow";
const TEX_SPARK = "drop-spark";
const TEX_STAR = "drop-star";

interface DropVisual {
  container: Phaser.GameObjects.Container;
  tweens: Phaser.Tweens.Tween[];
  emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  glowEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  label: Phaser.GameObjects.Text;
  color: number;
  tileX: number;
  tileY: number;
  isGold: boolean;
}

export class DropManager {
  private visuals = new Map<string, DropVisual>();

  constructor(
    private scene: Phaser.Scene,
    private effectManager?: EffectManager,
  ) {}

  get count(): number {
    return this.visuals.size;
  }

  updateLabels(playerTileX: number, playerTileY: number) {
    for (const [, v] of this.visuals) {
      const dist = Math.abs(v.tileX - playerTileX) + Math.abs(v.tileY - playerTileY);
      v.label.setVisible(dist <= 5);
    }
  }

  addDrop(drop: Drop, id: string) {
    const px = drop.tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = drop.tileY * TILE_SIZE + TILE_SIZE / 2;
    const color = this.dropColor(drop);
    const isGold = drop.itemType === "gold";
    const isRare = drop.itemType === "item" && ITEMS[drop.itemId]?.rarity === "RARE";

    this._ensureTextures();

    // ── Build the visual for this drop ────────────────────────────────────────
    const container = this.scene.add.container(px, py).setDepth(5);
    const tweens: Phaser.Tweens.Tween[] = [];

    if (isGold) {
      container.add(this._buildCoinVisual(drop.goldAmount ?? 1));
    } else {
      // Plain circle for non-gold drops
      const arc = this.scene.add.circle(0, 0, isRare ? 7 : 6, color);
      container.add(arc);
    }

    // ── Bob tween ─────────────────────────────────────────────────────────────
    const bobTween = this.scene.tweens.add({
      targets: container,
      y: py - (isRare || isGold ? 5 : 3),
      duration: isRare ? 700 : 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
    tweens.push(bobTween);

    // ── Coin spin illusion (horizontal scale oscillation) ─────────────────────
    if (isGold) {
      // The coin "spins" by compressing its x-scale toward 0 then back — classic
      // fake 3-D coin flip. We use a two-phase tween (flatten → expand) so it
      // looks like it's tumbling. Offset by a stagger based on drop id hash.
      const stagger = (id.charCodeAt(0) ?? 0) % 600;
      const innerObjects = container.list as Phaser.GameObjects.GameObject[];

      this.scene.time.delayedCall(stagger, () => {
        const spinTween = this.scene.tweens.add({
          targets: innerObjects,
          scaleX: 0,
          duration: 220,
          yoyo: true,
          repeat: -1,
          ease: "Sine.InOut",
          repeatDelay: 800,
        });
        tweens.push(spinTween);
      });
    }

    // ── Particle emitter ──────────────────────────────────────────────────────
    let glowEmitter: Phaser.GameObjects.Particles.ParticleEmitter | undefined;

    if (isGold) {
      // Outer soft golden ambient glow (ADD blend keeps it subtle)
      glowEmitter = this.scene.add.particles(px, py, TEX_COIN_GLOW, {
        tint: [0xffdd44, 0xffaa00, 0xffffff],
        speed: { min: 2, max: 12 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.65, end: 0 },
        alpha: { start: 0.35, end: 0 },
        lifespan: { min: 500, max: 900 },
        quantity: 1,
        frequency: 120,
        blendMode: Phaser.BlendModes.ADD,
        gravityY: -8,
      });
      glowEmitter.setDepth(4);
    }

    const sparkTex = isRare ? TEX_STAR : TEX_SPARK;
    const emitter = this.scene.add.particles(px, py, sparkTex, {
      tint: isGold ? [0xffee44, 0xffcc00, 0xffffff, 0xffaa00] : [color, 0xffffff],
      speed: { min: 8, max: isGold ? 20 : (isRare ? 28 : 22) },
      angle: { min: 0, max: 360 },
      scale: { start: isRare ? 0.45 : (isGold ? 0.39 : 0.36), end: 0 },
      alpha: { start: 0.95, end: 0 },
      lifespan: { min: 380, max: isGold ? 700 : (isRare ? 900 : 780) },
      quantity: isGold ? 2 : (isRare ? 2 : 1),
      frequency: isGold ? 100 : (isRare ? 80 : 180),
      gravityY: isGold ? -18 : -20,
      rotate: isGold ? { start: 0, end: 360 } : (isRare ? { start: 0, end: 360 } : undefined),
      blendMode: isGold ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL,
    });
    emitter.setDepth(6);

    // ── Label ─────────────────────────────────────────────────────────────────
    const labelStr = this.dropLabelText(drop);
    const labelColor = this.dropLabelColor(drop);
    const label = this.scene.add
      .text(px, py + 12, labelStr, {
        fontSize: "10px",
        color: labelColor,
        stroke: "#000000",
        strokeThickness: 3,
        fontFamily: FONTS.mono,
        fontStyle: "normal",
        resolution: getGameTextResolution(),
      })
      .setOrigin(0.5, 0)
      .setDepth(7)
      .setVisible(false);

    // ── Landing effect ────────────────────────────────────────────────────────
    const ageMs = Date.now() - drop.spawnedAt;
    if (ageMs < 3000 && this.effectManager) {
      this.effectManager.playDropLanded(drop.tileX, drop.tileY, color, isGold);
    }

    this.visuals.set(id, {
      container,
      tweens,
      emitter,
      glowEmitter,
      label,
      color,
      tileX: drop.tileX,
      tileY: drop.tileY,
      isGold,
    });
  }

  removeDrop(id: string) {
    const visual = this.visuals.get(id);
    if (!visual) return;

    const { container, tweens, emitter, glowEmitter, label, color, isGold } = visual;

    // ── Pickup burst ──────────────────────────────────────────────────────────
    const px = container.x;
    const py = container.y;

    if (isGold) {
      // Golden coin shower — coins fly up and arc outward
      const burst = this.scene.add.particles(px, py, TEX_STAR, {
        tint: [0xffee44, 0xffcc00, 0xffaa00, 0xffffff],
        speed: { min: 45, max: 130 },
        angle: { min: 220, max: 320 }, // arc upward
        scale: { start: 0.52, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: { min: 280, max: 600 },
        rotate: { start: 0, end: 720 },
        gravityY: 140,
        blendMode: Phaser.BlendModes.ADD,
      });
      burst.setDepth(8);
      burst.explode(22);

      // Soft radial glow flash
      const glow = this.scene.add.particles(px, py, TEX_COIN_GLOW, {
        tint: [0xffee44, 0xffffff],
        speed: { min: 10, max: 40 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.91, end: 0 },
        alpha: { start: 0.7, end: 0 },
        lifespan: { min: 180, max: 380 },
        blendMode: Phaser.BlendModes.ADD,
      });
      glow.setDepth(7);
      glow.explode(14);

      this.scene.time.delayedCall(700, () => {
        burst.destroy();
        glow.destroy();
      });
    } else if (this.scene.textures.exists(TEX_SPARK)) {
      const burstTex = this.scene.textures.exists(TEX_STAR) ? TEX_STAR : TEX_SPARK;
      const burst = this.scene.add.particles(px, py, burstTex, {
        tint: [color, 0xffffff],
        speed: { min: 35, max: 105 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.45, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: { min: 220, max: 500 },
        rotate: { start: 0, end: 360 },
      });
      burst.setDepth(6);
      burst.explode(20);
      this.scene.time.delayedCall(560, () => burst.destroy());
    }

    tweens.forEach((t) => t.stop());
    emitter.destroy();
    glowEmitter?.destroy();
    label.destroy();
    container.destroy(true); // destroys children
    this.visuals.delete(id);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Builds the layered coin graphic added to the container.
   * We use three concentric circles to fake a coin with rim + face shine.
   */
  private _buildCoinVisual(goldAmount: number): Phaser.GameObjects.GameObject[] {
    const size = goldAmount >= 100 ? 8 : goldAmount >= 20 ? 7 : 6;

    // Outer rim (darker gold)
    const rim = this.scene.add.circle(0, 0, size, 0xcc8800);
    // Face (bright gold)
    const face = this.scene.add.circle(0, 0, size - 1.5, 0xffcc00);
    // Inner highlight (near-white glint)
    const shine = this.scene.add.circle(-size * 0.25, -size * 0.25, size * 0.28, 0xffffcc, 0.9);

    return [rim, face, shine];
  }

  private _ensureTextures() {
    if (!this.scene.textures.exists(TEX_SPARK)) {
      const g = this.scene.add.graphics();
      for (let r = 3; r >= 1; r--) {
        g.fillStyle(0xffffff, (1 - (r - 1) / 3) ** 1.8);
        g.fillCircle(3, 3, r);
      }
      g.generateTexture(TEX_SPARK, 6, 6);
      g.destroy();
    }

    if (!this.scene.textures.exists(TEX_STAR)) {
      const g = this.scene.add.graphics();
      // Soft halo
      for (let r = 5; r >= 1; r--) {
        g.fillStyle(0xffffff, (1 - r / 5) ** 1.5 * 0.5);
        g.fillCircle(6, 6, r);
      }
      // 8-point star
      g.fillStyle(0xffffff, 1);
      const outer = 5, inner = 2, cx = 6, cy = 6;
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4 - Math.PI / 2;
        const r = i % 2 === 0 ? outer : inner;
        pts.push(new Phaser.Math.Vector2(cx + r * Math.cos(angle), cy + r * Math.sin(angle)));
      }
      g.fillPoints(pts, true);
      g.generateTexture(TEX_STAR, 12, 12);
      g.destroy();
    }

    if (!this.scene.textures.exists(TEX_COIN_GLOW)) {
      // Soft radial gradient for additive glow blending
      const g = this.scene.add.graphics();
      for (let r = 10; r >= 1; r--) {
        g.fillStyle(0xffffff, ((1 - r / 10) ** 1.8) * 0.9);
        g.fillCircle(10, 10, r);
      }
      g.generateTexture(TEX_COIN_GLOW, 20, 20);
      g.destroy();
    }
  }

  /** Circle color for a drop based on item type and rarity — like Diablo 2. */
  private dropColor(drop: Drop): number {
    if (drop.itemType === "gold") return 0xffcc00;
    const item = ITEMS[drop.itemId];
    if (!item) return 0xffffff;
    if (item.slot === "consumable") {
      const e = item.consumeEffect;
      if (e?.healHp && !e?.healMana) return 0xff3333; // health potion — red
      if (e?.healMana && !e?.healHp) return 0x4466ff; // mana potion — blue
      return 0xaaffaa; // other consumable — green
    }
    switch (item.rarity) {
      case "COMMON":
        return 0xdddddd;
      case "UNCOMMON":
        return 0x4488ff;
      case "RARE":
        return 0xffaa00;
      default:
        return 0xffffff;
    }
  }

  /** CSS color string for the drop name label, matching Diablo 2 rarity conventions. */
  private dropLabelColor(drop: Drop): string {
    if (drop.itemType === "gold") return "#ffcc00";
    const item = ITEMS[drop.itemId];
    if (!item) return "#ffffff";
    if (item.slot === "consumable") {
      const e = item.consumeEffect;
      if (e?.healHp && !e?.healMana) return "#ff6666";
      if (e?.healMana && !e?.healHp) return "#6699ff";
      return "#aaffaa";
    }
    switch (item.rarity) {
      case "COMMON":
        return "#dddddd";
      case "UNCOMMON":
        return "#6699ff";
      case "RARE":
        return "#ffbb44";
      default:
        return "#ffffff";
    }
  }

  /** Human-readable label for a drop — "Iron Sword", "42 Gold", "Health Potion (x3)", etc. */
  private dropLabelText(drop: Drop): string {
    if (drop.itemType === "gold") return `${drop.goldAmount} Gold`;
    const item = ITEMS[drop.itemId];
    if (!item) return drop.itemId;
    // Resolve i18n key → actual name; fall back to humanising the item ID
    let name: string;
    try {
      const translated = i18n.t(item.name);
      name = translated !== item.name ? translated : "";
    } catch {
      name = "";
    }
    if (!name) {
      name = drop.itemId
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
    return drop.quantity > 1 ? `${name} (${drop.quantity})` : name;
  }
}

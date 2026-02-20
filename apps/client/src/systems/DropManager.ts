import { ITEMS, i18n, TILE_SIZE } from "@abraxas/shared";
import Phaser from "phaser";
import type { Drop } from "../../../server/src/schema/Drop";
import type { EffectManager } from "../managers/EffectManager";

export class DropManager {
  private visuals = new Map<
    string,
    {
      arc: Phaser.GameObjects.Arc;
      tween: Phaser.Tweens.Tween;
      emitter: Phaser.GameObjects.Particles.ParticleEmitter;
      label: Phaser.GameObjects.Text;
      color: number;
      tileX: number;
      tileY: number;
    }
  >();

  constructor(
    private scene: Phaser.Scene,
    private effectManager?: EffectManager,
  ) {}

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
    const isRare = drop.itemType === "item" && ITEMS[drop.itemId]?.rarity === "rare";

    const arc = this.scene.add.circle(px, py, isRare ? 7 : 6, color).setDepth(5);

    // Gentle bob — rare items bob a bit more dramatically
    const tween = this.scene.tweens.add({
      targets: arc,
      y: py - (isRare ? 6 : 4),
      duration: isRare ? 700 : 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });

    // Lazy-create sparkle textures
    if (!this.scene.textures.exists("drop-spark")) {
      // Soft radial glow — particle tint colours it per item type
      const g = this.scene.add.graphics();
      for (let r = 3; r >= 1; r--) {
        g.fillStyle(0xffffff, (1 - (r - 1) / 3) ** 1.8);
        g.fillCircle(3, 3, r);
      }
      g.generateTexture("drop-spark", 6, 6);
      g.destroy();
    }
    if (!this.scene.textures.exists("drop-star")) {
      // 8-point star with soft glow halo for rare drops
      const g = this.scene.add.graphics();
      for (let r = 5; r >= 1; r--) {
        g.fillStyle(0xffffff, (1 - r / 5) ** 1.5 * 0.5);
        g.fillCircle(6, 6, r);
      }
      g.fillStyle(0xffffff, 1);
      const outer = 5,
        inner = 2,
        cx = 6,
        cy = 6;
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4 - Math.PI / 2;
        const r = i % 2 === 0 ? outer : inner;
        pts.push(new Phaser.Math.Vector2(cx + r * Math.cos(angle), cy + r * Math.sin(angle)));
      }
      g.fillPoints(pts, true);
      g.generateTexture("drop-star", 12, 12);
      g.destroy();
    }

    const sparkTex = isRare ? "drop-star" : "drop-spark";
    const emitter = this.scene.add.particles(px, py, sparkTex, {
      tint: [color, 0xffffff],
      speed: { min: 8, max: isRare ? 28 : 22 },
      angle: { min: 0, max: 360 },
      scale: { start: isRare ? 0.7 : 0.55, end: 0 },
      alpha: { start: 0.9, end: 0 },
      lifespan: { min: 420, max: isRare ? 900 : 780 },
      quantity: isRare ? 2 : 1,
      frequency: isRare ? 80 : 180,
      gravityY: -20,
      rotate: isRare ? { start: 0, end: 360 } : undefined,
    });
    emitter.setDepth(6);

    // Item name label — hidden until player is within range (shown in update())
    const labelStr = this.dropLabelText(drop);
    const labelColor = this.dropLabelColor(drop);
    const label = this.scene.add
      .text(px, py + 10, labelStr, {
        fontSize: isRare ? "9px" : "8px",
        color: labelColor,
        stroke: "#000000",
        strokeThickness: 3,
        fontFamily: "'Courier New', Courier, monospace",
        fontStyle: isRare ? "bold" : "normal",
      })
      .setOrigin(0.5, 0)
      .setDepth(7)
      .setVisible(false);

    // Landing effect only for freshly spawned drops (not pre-existing when player joins)
    const ageMs = Date.now() - drop.spawnedAt;
    if (ageMs < 3000 && this.effectManager) {
      this.effectManager.playDropLanded(drop.tileX, drop.tileY, color);
    }

    this.visuals.set(id, {
      arc,
      tween,
      emitter,
      label,
      color,
      tileX: drop.tileX,
      tileY: drop.tileY,
    });
  }

  removeDrop(id: string) {
    const visual = this.visuals.get(id);
    if (!visual) return;

    const { arc, tween, emitter, label, color } = visual;

    // Colored pickup burst matching item rarity/type
    if (this.scene.textures.exists("drop-spark")) {
      const burstTex = this.scene.textures.exists("drop-star") ? "drop-star" : "drop-spark";
      const burst = this.scene.add.particles(arc.x, arc.y, burstTex, {
        tint: [color, 0xffffff],
        speed: { min: 35, max: 105 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.7, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: { min: 220, max: 500 },
        rotate: { start: 0, end: 360 },
      });
      burst.setDepth(6);
      burst.explode(20);
      this.scene.time.delayedCall(560, () => burst.destroy());
    }

    tween.stop();
    emitter.destroy();
    label.destroy();
    arc.destroy();
    this.visuals.delete(id);
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
      case "common":
        return 0xdddddd;
      case "uncommon":
        return 0x4488ff;
      case "rare":
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
      case "common":
        return "#dddddd";
      case "uncommon":
        return "#6699ff";
      case "rare":
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

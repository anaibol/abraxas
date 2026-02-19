import type Phaser from "phaser";
import { TILE_SIZE } from "@abraxas/shared";
import type { AoGrhResolver } from "../assets/AoGrhResolver";
import type { SpriteManager } from "./SpriteManager";

export class EffectManager {
  constructor(
    private scene: Phaser.Scene,
    private resolver: AoGrhResolver,
    private spriteManager: SpriteManager,
  ) {}

  playEffect(fxId: number, targetTileX: number, targetTileY: number) {
    if (!this.scene.sys.isActive()) return;

    const fxEntry = this.resolver.getFxEntry(fxId);
    if (!fxEntry) return;

    const animKey = this.resolver.ensureFxAnimation(this.scene, fxEntry.animacion);
    if (!animKey) return;

    const firstStatic = this.resolver.resolveStaticGrh(fxEntry.animacion);
    if (!firstStatic) return;

    const px = targetTileX * TILE_SIZE + TILE_SIZE / 2;
    const py = targetTileY * TILE_SIZE + TILE_SIZE / 2;

    const fxSprite = this.scene.add
      .sprite(px + (fxEntry.offX ?? 0), py + (fxEntry.offY ?? 0), `ao-${firstStatic.grafico}`, `grh-${firstStatic.id}`)
      .setDepth(15)
      .setOrigin(0.5);
    fxSprite.play(animKey);
    fxSprite.once("animationcomplete", () => fxSprite.destroy());
  }

  showDamage(targetSessionId: string, amount: number, type: "physical" | "magic" | "dot") {
    const sprite = this.spriteManager.getSprite(targetSessionId);
    if (!sprite) return;
    const color = type === "magic" ? "#bb44ff" : type === "dot" ? "#44cc44" : "#ff4444";
    this.floatText(sprite.renderX, sprite.renderY - 30, `-${amount}`, color, "14px");
  }

  showHeal(targetSessionId: string, amount: number) {
    const sprite = this.spriteManager.getSprite(targetSessionId);
    if (!sprite) return;
    this.floatText(sprite.renderX, sprite.renderY - 30, `+${amount}`, "#33cc33", "14px");
  }

  showFloatingText(sessionId: string, text: string, color: string) {
    const sprite = this.spriteManager.getSprite(sessionId);
    if (!sprite) return;
    this.floatText(sprite.renderX, sprite.renderY - 40, text, color, "10px");
  }

  showNotification(sessionId: string, text: string, color = "#ffff00") {
    this.showFloatingText(sessionId, text, color);
  }

  private floatText(x: number, y: number, content: string, color: string, fontSize: string) {
    if (!this.scene.sys.isActive()) return;
    try {
      const text = this.scene.add
        .text(x, y, content, { fontSize, color, fontFamily: "'Friz Quadrata', Georgia, serif", fontStyle: "bold" })
        .setOrigin(0.5)
        .setDepth(20);

      this.scene.tweens.add({
        targets: text,
        y: y - 40,
        alpha: 0,
        duration: 1200,
        ease: "Power1",
        onComplete: () => text.destroy(),
      });
    } catch {
      // Scene may be in the process of being destroyed
    }
  }
}

import { TILE_SIZE, VIEWPORT_TILES_X, VIEWPORT_TILES_Y } from "@abraxas/shared";
import type Phaser from "phaser";
import type { PlayerSprite } from "../entities/PlayerSprite";

export class CameraController {
  constructor(private camera: Phaser.Cameras.Scene2D.Camera) {}

  /**
   * Computes and applies a zoom level so that every player sees exactly
   * VIEWPORT_TILES_X × VIEWPORT_TILES_Y tiles regardless of screen size.
   * Call this once on scene create and again whenever the game is resized.
   */
  applyFixedZoom() {
    const { width, height } = this.camera;
    const zoomX = width / (VIEWPORT_TILES_X * TILE_SIZE);
    const zoomY = height / (VIEWPORT_TILES_Y * TILE_SIZE);
    this.camera.setZoom(Math.min(zoomX, zoomY));
  }

  follow(target: PlayerSprite) {
    this.camera.startFollow(target.container, true, 0.15, 0.15);
  }
}

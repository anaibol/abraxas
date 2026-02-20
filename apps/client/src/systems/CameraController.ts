import { TILE_SIZE, VIEWPORT_TILES_X, VIEWPORT_TILES_Y } from "@abraxas/shared";
import type Phaser from "phaser";

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

  /**
   * Instantly centres the camera on a world-space pixel position.
   *
   * Call this every frame from GameScene.update() with the local player's
   * `targetX` / `targetY` (the logical tile destination, not the smoothed
   * render position).  This is frame-rate-independent: at low FPS the sprite
   * renders mid-tile but the camera always locks to the destination tile,
   * preventing the "camera falls behind the player" desync.
   */
  centerOn(x: number, y: number) {
    this.camera.centerOn(x, y);
  }
}

import Phaser from "phaser";
import type { PlayerSprite } from "../entities/PlayerSprite";

export class CameraController {
  private camera: Phaser.Cameras.Scene2D.Camera;
  private smoothing: boolean;

  constructor(
    camera: Phaser.Cameras.Scene2D.Camera,
    _worldWidth: number,
    _worldHeight: number,
    smoothing = true
  ) {
    this.camera = camera;
    this.smoothing = smoothing;

    // No camera bounds — camera always stays centered on player.
    // Border collision tiles prevent the player from reaching the map edge.
  }

  follow(target: PlayerSprite) {
    // Follow the container of the local player sprite
    this.camera.startFollow(target.container, true, 0.15, 0.15);

    if (!this.smoothing) {
      // Disable lerp for instant follow
      this.camera.startFollow(target.container, true, 1, 1);
    }
  }

  update(target: PlayerSprite) {
    // Camera is auto-following via startFollow
    // Container position is already updated by PlayerSprite.update()
    // This method exists for any additional per-frame camera logic
  }
}

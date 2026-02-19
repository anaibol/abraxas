import type Phaser from "phaser";
import type { PlayerSprite } from "../entities/PlayerSprite";

export class CameraController {
  private camera: Phaser.Cameras.Scene2D.Camera;

  constructor(camera: Phaser.Cameras.Scene2D.Camera, smoothing = true) {
    this.camera = camera;
    const lerp = smoothing ? 0.15 : 1;
    this.camera.setLerp(lerp, lerp);
  }

  follow(target: PlayerSprite) {
    this.camera.startFollow(target.container, true);
  }
}

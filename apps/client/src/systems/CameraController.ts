import type Phaser from "phaser";
import type { PlayerSprite } from "../entities/PlayerSprite";

export class CameraController {
  constructor(private camera: Phaser.Cameras.Scene2D.Camera) {}

  follow(target: PlayerSprite) {
    this.camera.startFollow(target.container, true, 0.15, 0.15);
  }
}

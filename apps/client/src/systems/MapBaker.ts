import Phaser from "phaser";
import { WelcomeData } from "@abraxas/shared";

export class MapBaker {
  constructor(private scene: Phaser.Scene, private welcome: WelcomeData) {}

  update() {
    // Stub implementation to fix build.
    // The previous refactoring agent deleted map rendering from GameScene
    // but failed to create this file.
  }
}

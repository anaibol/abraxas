import Phaser from "phaser";
import { CLASS_APPEARANCE, ITEMS } from "@ao5/shared";
import { AoGrhResolver } from "../assets/AoGrhResolver";

export class PreloaderScene extends Phaser.Scene {
  constructor() {
    super({ key: "PreloaderScene" });
  }

  preload() {
    // Loading bar
    const { width, height } = this.cameras.main;
    const barW = 320;
    const barH = 20;
    const barX = (width - barW) / 2;
    const barY = height / 2;

    const bg = this.add.rectangle(width / 2, barY, barW, barH, 0x222222);
    bg.setStrokeStyle(1, 0x666666);
    const fill = this.add.rectangle(barX + 2, barY, 0, barH - 4, 0x44aaff);
    fill.setOrigin(0, 0.5);

    const label = this.add.text(width / 2, barY - 24, "Loading indices...", {
      fontSize: "14px",
      color: "#cccccc",
      fontFamily: "Georgia, serif",
    });
    label.setOrigin(0.5);

    this.load.on("progress", (v: number) => {
      fill.width = (barW - 4) * v;
    });

    // Phase 1: Load index JSONs + tile images + audio
    this.load.json("idx-graficos", "indices/graficos.json");
    this.load.json("idx-cuerpos", "indices/cuerpos.json");
    this.load.json("idx-cabezas", "indices/cabezas.json");
    this.load.json("idx-armas", "indices/armas.json");
    this.load.json("idx-escudos", "indices/escudos.json");
    this.load.json("idx-cascos", "indices/cascos.json");
    this.load.json("idx-fxs", "indices/fxs.json");

    // Tile images
    this.load.image("tile-grass", "graficos/12052.webp");
    this.load.image("tile-wall", "graficos/12046.webp");

    // Audio — original AO file numbering
    this.load.audio("sfx-step1", "audio/sonidos/23.webm");
    this.load.audio("sfx-step2", "audio/sonidos/24.webm");
    this.load.audio("sfx-attack", "audio/sonidos/2.webm");
    this.load.audio("sfx-spell", "audio/sonidos/3.webm");
    this.load.audio("sfx-hit", "audio/sonidos/10.webm");
    this.load.audio("sfx-death", "audio/sonidos/14.webm");
    this.load.audio("sfx-heal", "audio/sonidos/42.webm");
    this.load.audio("sfx-click", "audio/sonidos/5.webm");
    this.load.audio("music-arena", "audio/musica/101.webm");
  }

  create() {
    // Phase 2: Build resolver from loaded indices
    const graficos = this.cache.json.get("idx-graficos");
    const cuerpos = this.cache.json.get("idx-cuerpos");
    const cabezas = this.cache.json.get("idx-cabezas");
    const armas = this.cache.json.get("idx-armas");
    const escudos = this.cache.json.get("idx-escudos");
    const cascos = this.cache.json.get("idx-cascos");
    const fxs = this.cache.json.get("idx-fxs");

    const resolver = new AoGrhResolver(
      graficos, cuerpos, cabezas, armas, escudos, cascos, fxs
    );

    // Collect all body/head IDs from CLASS_APPEARANCE
    const bodyIds = new Set<number>();
    const headIds = new Set<number>();
    for (const cls of Object.values(CLASS_APPEARANCE)) {
      bodyIds.add(cls.bodyId);
      headIds.add(cls.headId);
    }

    // Collect weapon/shield/helmet IDs from items
    const weaponIds = new Set<number>();
    const shieldIds = new Set<number>();
    const helmetIds = new Set<number>();
    for (const item of Object.values(ITEMS)) {
      if (item.aoWeaponId) weaponIds.add(item.aoWeaponId);
      if (item.aoShieldId) shieldIds.add(item.aoShieldId);
      if (item.aoHelmetId) helmetIds.add(item.aoHelmetId);
    }

    // Collect all FX IDs
    const fxIds: number[] = [];
    for (let i = 1; i < fxs.length; i++) {
      if (fxs[i] && typeof fxs[i] === "object") fxIds.push(i);
    }

    // Trace grh chains to find all needed PNGs
    const neededPngs = resolver.collectNeededPngs(
      [...bodyIds],
      [...headIds],
      [...weaponIds],
      [...shieldIds],
      [...helmetIds],
      fxIds
    );

    // Update label
    const label = this.children.list.find(
      (c) => c instanceof Phaser.GameObjects.Text
    ) as Phaser.GameObjects.Text | undefined;
    if (label) label.setText(`Loading ${neededPngs.size} graphics...`);

    // Load all needed PNGs
    for (const pngNum of neededPngs) {
      this.load.image(`ao-${pngNum}`, `graficos/${pngNum}.webp`);
    }

    // Start second load phase
    this.load.once("complete", () => {
      // Register all grh sub-frames on the loaded textures
      resolver.registerFrames(this);

      // Store resolver for GameScene
      this.registry.set("aoResolver", resolver);

      this.scene.start("GameScene");
    });

    this.load.start();
  }
}

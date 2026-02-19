import Phaser from "phaser";
import { CLASS_APPEARANCE, NPC_APPEARANCE, ITEMS } from "@abraxas/shared";
import { AoGrhResolver } from "../assets/AoGrhResolver";

export class PreloaderScene extends Phaser.Scene {
  private label!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "PreloaderScene" });
  }

  preload() {
    const { width, height } = this.cameras.main;
    const barW = 320;
    const barH = 20;
    const barX = (width - barW) / 2;
    const barY = height / 2;

    const bg = this.add.rectangle(width / 2, barY, barW, barH, 0x222222);
    bg.setStrokeStyle(1, 0x666666);
    const fill = this.add.rectangle(barX + 2, barY, 0, barH - 4, 0x44aaff);
    fill.setOrigin(0, 0.5);

    this.label = this.add.text(width / 2, barY - 24, "Loading indices...", {
      fontSize: "14px",
      color: "#cccccc",
      fontFamily: "Georgia, serif",
    });
    this.label.setOrigin(0.5);

    this.load.on("progress", (v: number) => {
      fill.width = (barW - 4) * v;
    });

    this.load.json("idx-graficos", "indices/graficos.json");
    this.load.json("idx-cuerpos", "indices/cuerpos.json");
    this.load.json("idx-cabezas", "indices/cabezas.json");
    this.load.json("idx-armas", "indices/armas.json");
    this.load.json("idx-escudos", "indices/escudos.json");
    this.load.json("idx-cascos", "indices/cascos.json");
    this.load.json("idx-fxs", "indices/fxs.json");

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

    const bodyIds = new Set<number>();
    const headIds = new Set<number>();
    for (const cls of Object.values(CLASS_APPEARANCE)) {
      bodyIds.add(cls.bodyId);
      headIds.add(cls.headId);
    }
    for (const npc of Object.values(NPC_APPEARANCE)) {
      bodyIds.add(npc.bodyId);
      if (npc.headId) headIds.add(npc.headId);
    }

    const weaponIds = new Set<number>();
    const shieldIds = new Set<number>();
    const helmetIds = new Set<number>();
    for (const item of Object.values(ITEMS)) {
      if (item.aoWeaponId) weaponIds.add(item.aoWeaponId);
      if (item.aoShieldId) shieldIds.add(item.aoShieldId);
      if (item.aoHelmetId) helmetIds.add(item.aoHelmetId);
    }

    const fxIds: number[] = [];
    for (let i = 1; i < fxs.length; i++) {
      if (fxs[i] && typeof fxs[i] === "object") fxIds.push(i);
    }

    const neededPngs = resolver.collectNeededPngs(
      [...bodyIds],
      [...headIds],
      [...weaponIds],
      [...shieldIds],
      [...helmetIds],
      fxIds
    );

    this.label.setText(`Loading ${neededPngs.size} graphics...`);

    for (const pngNum of neededPngs) {
      this.load.image(`ao-${pngNum}`, `graficos/${pngNum}.webp`);
    }

    this.load.once("complete", () => {
      resolver.registerFrames(this);
      this.registry.set("aoResolver", resolver);
      this.scene.start("GameScene");
    });

    this.load.start();
  }
}

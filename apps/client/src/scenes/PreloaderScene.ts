import { AudioAssets, CLASS_APPEARANCE, ITEMS, NPC_APPEARANCE } from "@abraxas/shared";
import Phaser from "phaser";
import { AoGrhResolver } from "../assets/AoGrhResolver";
import { FONTS, getGameTextResolution } from "../ui/tokens";
import { TREE_GRH_POOL } from "../systems/MapBaker";

export class PreloaderScene extends Phaser.Scene {
  constructor() {
    super({ key: "PreloaderScene" });
  }

  preload() {
    this.load.on("progress", (v: number) => {
      window.dispatchEvent(new CustomEvent("abraxas-loading", { detail: { progress: v } }));
    });

    this.load.json("idx-graficos", "indices/graficos.json");
    this.load.json("idx-cuerpos", "indices/cuerpos.json");
    this.load.json("idx-cabezas", "indices/cabezas.json");
    this.load.json("idx-armas", "indices/armas.json");
    this.load.json("idx-escudos", "indices/escudos.json");
    this.load.json("idx-cascos", "indices/cascos.json");
    this.load.json("idx-fxs", "indices/fxs.json");

    // Load all audio assets from manifest
    for (const [_key, path] of Object.entries(AudioAssets)) {
      this.load.audio(path, path);
    }
  }

  create() {
    const graficos = this.cache.json.get("idx-graficos");
    const cuerpos = this.cache.json.get("idx-cuerpos");
    const cabezas = this.cache.json.get("idx-cabezas");
    const armas = this.cache.json.get("idx-armas");
    const escudos = this.cache.json.get("idx-escudos");
    const cascos = this.cache.json.get("idx-cascos");
    const fxs = this.cache.json.get("idx-fxs");

    const resolver = new AoGrhResolver(graficos, cuerpos, cabezas, armas, escudos, cascos, fxs);

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
      fxIds,
    );

    for (const treeGrhId of TREE_GRH_POOL) {
      const staticGrh = resolver.resolveStaticGrh(treeGrhId);
      if (staticGrh) neededPngs.add(staticGrh.grafico);
    }

    const count = neededPngs.size;
    const textMsg = `Loading ${count} graphics...`;
    window.dispatchEvent(new CustomEvent("abraxas-loading", { detail: { text: textMsg } }));

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

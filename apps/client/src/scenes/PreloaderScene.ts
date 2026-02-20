import { CLASS_APPEARANCE, ITEMS, NPC_APPEARANCE } from "@abraxas/shared";
import Phaser from "phaser";
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

    // Map existing placeholder sounds to new high-quality assets
    this.load.audio("sfx-step1", "audio/kenney_rpg/Audio/footstep00.ogg");
    this.load.audio("sfx-step2", "audio/kenney_rpg/Audio/footstep01.ogg");
    this.load.audio("sfx-step3", "audio/kenney_rpg/Audio/footstep02.ogg");
    this.load.audio("sfx-step4", "audio/kenney_rpg/Audio/footstep03.ogg");
    this.load.audio("sfx-step5", "audio/kenney_rpg/Audio/footstep04.ogg");

    this.load.audio("sfx-attack1", "audio/kenney_rpg/Audio/drawKnife1.ogg");
    this.load.audio("sfx-attack2", "audio/kenney_rpg/Audio/drawKnife2.ogg");
    this.load.audio("sfx-attack3", "audio/kenney_rpg/Audio/drawKnife3.ogg");

    this.load.audio("sfx-hit1", "audio/kenney_impact/Audio/impactMetal_heavy_000.ogg");
    this.load.audio("sfx-hit2", "audio/kenney_impact/Audio/impactMetal_heavy_001.ogg");
    this.load.audio("sfx-hit3", "audio/kenney_impact/Audio/impactMetal_heavy_002.ogg");

    this.load.audio("sfx-spell", "audio/magic/FX411.mp3");
    this.load.audio("sfx-death", "audio/sonidos/14.webm");
    this.load.audio("sfx-heal", "audio/magic/Replenish.ogg");
    this.load.audio("sfx-buff", "audio/magic/montage-sfx-20130926@031949.ogg");
    this.load.audio("sfx-stealth", "audio/magic/shimmer_1.flac_.mp3");
    this.load.audio("sfx-summon", "audio/magic/ghost_1.flac_.mp3");
    this.load.audio("sfx-magic-hit", "audio/magic/FX261.mp3");
    
    // New SFX
    this.load.audio("sfx-levelup", "audio/kenney_ui/Audio/maximize_006.ogg");
    this.load.audio("sfx-notification", "audio/kenney_ui/Audio/bong_001.ogg");
    this.load.audio("sfx-mount", "audio/kenney_rpg/Audio/clothBelt.ogg");
    this.load.audio("sfx-bow", "audio/misc/Archers-shooting.ogg");
    this.load.audio("sfx-coins", "audio/kenney_rpg/Audio/handleCoins.ogg");
    this.load.audio("sfx-quest-accept", "audio/kenney_ui/Audio/confirmation_001.ogg");
    this.load.audio("sfx-quest-complete", "audio/kenney_ui/Audio/confirmation_002.ogg");

    // UI Sounds
    this.load.audio("sfx-click", "audio/kenney_ui/Audio/click_002.ogg");
    this.load.audio("sfx-click-hover", "audio/kenney_ui/Audio/tick_001.ogg");
    this.load.audio("sfx-click-open", "audio/kenney_ui/Audio/open_001.ogg");
    this.load.audio("sfx-click-close", "audio/kenney_ui/Audio/close_001.ogg");
    this.load.audio("music-arena", "audio/musica/101.webm");

    // Ambiance
    this.load.audio("ambiance-wind", "audio/ambiance/wind.ogg");
    this.load.audio("ambiance-crickets", "audio/ambiance/crickets.mp3");

    // NPC specific
    this.load.audio("npc-skeleton-rattle", "audio/npc/skeleton_rattle.ogg");
    this.load.audio("npc-grunt", "audio/npc/creatures/grunt_01.ogg");
    this.load.audio("npc-roar", "audio/npc/creatures/roar_01.ogg");
    this.load.audio("npc-scream", "audio/npc/creatures/scream_01.ogg");
    this.load.audio("npc-hurt", "audio/npc/creatures/hurt_01.ogg");
    this.load.audio("npc-levelup", "audio/kenney_ui/Audio/triumphant_fanfare_001.ogg"); // Using a placeholder for now
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

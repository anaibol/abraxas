import Phaser from "phaser";

// --- Index JSON types ---

export interface StaticGrh {
  id: number;
  grafico: number;
  offX: number;
  offY: number;
  width: number;
  height: number;
}

export interface AnimGrh {
  id: number;
  frames: number[];
  velocidad: number;
}

type GrhEntry = StaticGrh | AnimGrh | 0;

export interface DirectionEntry {
  id: number;
  down: number;
  up: number;
  left: number;
  right: number;
}

export interface BodyEntry extends DirectionEntry {
  offHeadX: number;
  offHeadY: number;
}

export interface FxEntry {
  id: number;
  animacion: number;
  offX: number;
  offY: number;
}

type IndexEntry = DirectionEntry | BodyEntry | FxEntry | 0;

const DIR_KEYS = ["down", "up", "left", "right"] as const;

function isAnimGrh(entry: GrhEntry): entry is AnimGrh {
  return typeof entry === "object" && "frames" in entry;
}

function isStaticGrh(entry: GrhEntry): entry is StaticGrh {
  return typeof entry === "object" && "grafico" in entry;
}

export class AoGrhResolver {
  private graficos: GrhEntry[];
  private cuerpos: IndexEntry[];
  private cabezas: IndexEntry[];
  private armas: IndexEntry[];
  private escudos: IndexEntry[];
  private cascos: IndexEntry[];
  private fxs: IndexEntry[];

  constructor(
    graficos: GrhEntry[],
    cuerpos: IndexEntry[],
    cabezas: IndexEntry[],
    armas: IndexEntry[],
    escudos: IndexEntry[],
    cascos: IndexEntry[],
    fxs: IndexEntry[]
  ) {
    this.graficos = graficos;
    this.cuerpos = cuerpos;
    this.cabezas = cabezas;
    this.armas = armas;
    this.escudos = escudos;
    this.cascos = cascos;
    this.fxs = fxs;
  }

  /** Resolve a grh ID to its static frame. If it's an animation, returns the first frame. */
  resolveStaticGrh(grhId: number): StaticGrh | null {
    const entry = this.graficos[grhId];
    if (!entry) return null;
    if (isStaticGrh(entry)) return entry;
    if (isAnimGrh(entry) && entry.frames.length > 0) {
      return this.resolveStaticGrh(entry.frames[0]);
    }
    return null;
  }

  /** Resolve a grh ID to its animation data (all frames resolved to static). */
  resolveAnimGrh(grhId: number): { frames: StaticGrh[]; velocidad: number } | null {
    const entry = this.graficos[grhId];
    if (!entry || !isAnimGrh(entry)) return null;
    const frames: StaticGrh[] = [];
    for (const fid of entry.frames) {
      const s = this.resolveStaticGrh(fid);
      if (s) frames.push(s);
    }
    if (frames.length === 0) return null;
    return { frames, velocidad: entry.velocidad };
  }

  getBodyEntry(bodyId: number): BodyEntry | null {
    const entry = this.cuerpos[bodyId];
    if (!entry || typeof entry !== "object") return null;
    return entry as BodyEntry;
  }

  getHeadEntry(headId: number): DirectionEntry | null {
    const entry = this.cabezas[headId];
    if (!entry || typeof entry !== "object") return null;
    return entry as DirectionEntry;
  }

  getWeaponEntry(weaponId: number): DirectionEntry | null {
    const entry = this.armas[weaponId];
    if (!entry || typeof entry !== "object") return null;
    return entry as DirectionEntry;
  }

  getShieldEntry(shieldId: number): DirectionEntry | null {
    const entry = this.escudos[shieldId];
    if (!entry || typeof entry !== "object") return null;
    return entry as DirectionEntry;
  }

  getHelmetEntry(helmetId: number): DirectionEntry | null {
    const entry = this.cascos[helmetId];
    if (!entry || typeof entry !== "object") return null;
    return entry as DirectionEntry;
  }

  getFxEntry(fxId: number): FxEntry | null {
    const entry = this.fxs[fxId];
    if (!entry || typeof entry !== "object") return null;
    return entry as FxEntry;
  }

  /**
   * Trace all grh chains for the given IDs and return the set of PNG file numbers needed.
   */
  collectNeededPngs(
    bodyIds: number[],
    headIds: number[],
    weaponIds: number[],
    shieldIds: number[],
    helmetIds: number[],
    fxIds: number[]
  ): Set<number> {
    const pngs = new Set<number>();
    const visited = new Set<number>();

    const traceGrh = (grhId: number) => {
      if (!grhId || visited.has(grhId)) return;
      visited.add(grhId);
      const entry = this.graficos[grhId];
      if (!entry) return;
      if (isStaticGrh(entry)) {
        pngs.add(entry.grafico);
      } else if (isAnimGrh(entry)) {
        for (const fid of entry.frames) traceGrh(fid);
      }
    };

    const traceDirectionEntry = (entry: DirectionEntry | null) => {
      if (!entry) return;
      for (const dir of DIR_KEYS) traceGrh(entry[dir]);
    };

    for (const id of bodyIds) traceDirectionEntry(this.getBodyEntry(id));
    for (const id of headIds) traceDirectionEntry(this.getHeadEntry(id));
    for (const id of weaponIds) traceDirectionEntry(this.getWeaponEntry(id));
    for (const id of shieldIds) traceDirectionEntry(this.getShieldEntry(id));
    for (const id of helmetIds) traceDirectionEntry(this.getHelmetEntry(id));

    for (const id of fxIds) {
      const fx = this.getFxEntry(id);
      if (fx) traceGrh(fx.animacion);
    }

    return pngs;
  }

  /**
   * After PNGs are loaded as Phaser textures (key "ao-{num}"),
   * register sub-frames for all static grh entries that reference those PNGs.
   */
  registerFrames(scene: Phaser.Scene) {
    const registeredPngs = new Set<number>();
    // Gather which PNGs are loaded
    for (let i = 0; i < this.graficos.length; i++) {
      const entry = this.graficos[i];
      if (entry && isStaticGrh(entry)) {
        registeredPngs.add(entry.grafico);
      }
    }

    for (let i = 0; i < this.graficos.length; i++) {
      const entry = this.graficos[i];
      if (!entry || !isStaticGrh(entry)) continue;
      const texKey = `ao-${entry.grafico}`;
      if (!scene.textures.exists(texKey)) continue;
      const tex = scene.textures.get(texKey);
      // Only add if frame doesn't already exist
      if (!tex.has(`grh-${entry.id}`)) {
        tex.add(`grh-${entry.id}`, 0, entry.offX, entry.offY, entry.width, entry.height);
      }
    }
  }

  /**
   * Create or return an existing Phaser animation from an animation grh.
   * Returns the animation key, or null if grhId is not an animation.
   */
  ensureAnimation(scene: Phaser.Scene, grhId: number, prefix: string): string | null {
    const animKey = `${prefix}-${grhId}`;
    if (scene.anims.exists(animKey)) return animKey;

    const anim = this.resolveAnimGrh(grhId);
    if (!anim) return null;

    const phaserFrames = anim.frames.map((f) => ({
      key: `ao-${f.grafico}`,
      frame: `grh-${f.id}`,
    }));

    // velocidad is total animation time in ms (for all frames)
    const totalMs = anim.velocidad;
    const frameRate = (anim.frames.length / totalMs) * 1000;

    scene.anims.create({
      key: animKey,
      frames: phaserFrames,
      frameRate: Math.max(1, frameRate),
      repeat: -1,
    });

    return animKey;
  }

  /**
   * Create a one-shot FX animation (does not repeat).
   */
  ensureFxAnimation(scene: Phaser.Scene, grhId: number): string | null {
    const animKey = `fx-${grhId}`;
    if (scene.anims.exists(animKey)) return animKey;

    const anim = this.resolveAnimGrh(grhId);
    if (!anim) return null;

    const phaserFrames = anim.frames.map((f) => ({
      key: `ao-${f.grafico}`,
      frame: `grh-${f.id}`,
    }));

    const totalMs = anim.velocidad;
    const frameRate = (anim.frames.length / totalMs) * 1000;

    scene.anims.create({
      key: animKey,
      frames: phaserFrames,
      frameRate: Math.max(1, frameRate),
      repeat: 0,
    });

    return animKey;
  }
}

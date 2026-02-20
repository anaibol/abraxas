export type ParticleQuality = "low" | "medium" | "high";

export type GameSettings = {
  musicVolume: number; // 0–1
  sfxVolume: number; // 0–1
  ambianceVolume: number; // 0–1  (item 79)
  uiVolume: number; // 0–1         (item 79)

  screenShakeEnabled: boolean; // (item 82)
  screenShakeIntensity: number; // 0–1 multiplier (item 82)
  particleQuality: ParticleQuality; // (item 81)
  bloomEnabled: boolean; // (item 83)
  showMinimap: boolean;
};

const DEFAULTS: GameSettings = {
  musicVolume: 0.5,
  sfxVolume: 0.7,
  ambianceVolume: 0.5,
  uiVolume: 0.7,

  screenShakeEnabled: true,
  screenShakeIntensity: 1.0,
  particleQuality: "high",
  bloomEnabled: true,
  showMinimap: true,
};

const STORAGE_KEY = "abraxas-settings";

function load(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return { ...DEFAULTS };
}

let current: GameSettings = load();
const listeners: ((s: GameSettings) => void)[] = [];

export const gameSettings = {
  get(): GameSettings {
    return { ...current };
  },

  set(partial: Partial<GameSettings>) {
    current = { ...current, ...partial };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
      // ignore
    }
    for (const l of listeners) l({ ...current });
  },

  subscribe(fn: (s: GameSettings) => void): () => void {
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  },
};

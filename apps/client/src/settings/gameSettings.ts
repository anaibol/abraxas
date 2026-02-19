export type GameSettings = {
  musicVolume: number; // 0–1
  sfxVolume: number;   // 0–1
  showMinimap: boolean;
};

const DEFAULTS: GameSettings = {
  musicVolume: 0.5,
  sfxVolume: 0.7,
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

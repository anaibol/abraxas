import { useEffect, useState } from "react";
import { type GameSettings, gameSettings } from "../settings/gameSettings";

export function useGameSettings() {
  const [settings, setSettings] = useState<GameSettings>(() => gameSettings.get());

  useEffect(() => {
    return gameSettings.subscribe(setSettings);
  }, []);

  return {
    settings,
    updateSettings: (partial: Partial<GameSettings>) => gameSettings.set(partial),
  };
}

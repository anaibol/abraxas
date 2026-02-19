import { useState, useEffect } from "react";
import { gameSettings, type GameSettings } from "../settings/gameSettings";

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

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import type { SoundManager } from "../assets/SoundManager";

interface AudioContextType {
  setSoundManager: (sm: SoundManager) => void;
  playUIClick: () => void;
  playUIHover: () => void;
  playUIOpen: () => void;
  playUIClose: () => void;
}

const AudioContext = createContext<AudioContextType>({
  setSoundManager: () => {},
  playUIClick: () => {},
  playUIHover: () => {},
  playUIOpen: () => {},
  playUIClose: () => {},
});

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [sm, setSoundManager] = useState<SoundManager | null>(null);

  const playUIClick = useCallback(() => sm?.playUIClick(), [sm]);
  const playUIHover = useCallback(() => sm?.playUIHover(), [sm]);
  const playUIOpen = useCallback(() => sm?.playUIOpen(), [sm]);
  const playUIClose = useCallback(() => sm?.playUIClose(), [sm]);

  const value = useMemo(
    () => ({ setSoundManager, playUIClick, playUIHover, playUIOpen, playUIClose }),
    [playUIClick, playUIHover, playUIOpen, playUIClose]
  );

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function useAudio() {
  return useContext(AudioContext);
}

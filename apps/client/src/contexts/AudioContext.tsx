import type React from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { SoundManager } from "../assets/SoundManager";

interface AudioContextType {
  setSoundManager: (sm: SoundManager) => void;
  playUIClick: () => void;
  playUIHover: () => void;
  playUIOpen: () => void;
  playUIClose: () => void;
  playCoins: () => void;
  playQuestAccept: () => void;
  playQuestComplete: () => void;
}

const AudioContext = createContext<AudioContextType>({
  setSoundManager: () => {},
  playUIClick: () => {},
  playUIHover: () => {},
  playUIOpen: () => {},
  playUIClose: () => {},
  playCoins: () => {},
  playQuestAccept: () => {},
  playQuestComplete: () => {},
});

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [sm, setSoundManager] = useState<SoundManager | null>(null);

  const playUIClick = useCallback(() => sm?.playUIClick(), [sm]);
  const playUIHover = useCallback(() => sm?.playUIHover(), [sm]);
  const playUIOpen = useCallback(() => sm?.playUIOpen(), [sm]);
  const playUIClose = useCallback(() => sm?.playUIClose(), [sm]);
  const playCoins = useCallback(() => sm?.playCoins(), [sm]);
  const playQuestAccept = useCallback(() => sm?.playQuestAccept(), [sm]);
  const playQuestComplete = useCallback(() => sm?.playQuestComplete(), [sm]);

  const value = useMemo(
    () => ({
      setSoundManager,
      playUIClick,
      playUIHover,
      playUIOpen,
      playUIClose,
      playCoins,
      playQuestAccept,
      playQuestComplete,
    }),
    [
      playUIClick,
      playUIHover,
      playUIOpen,
      playUIClose,
      playCoins,
      playQuestAccept,
      playQuestComplete,
    ],
  );

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function useAudio() {
  return useContext(AudioContext);
}

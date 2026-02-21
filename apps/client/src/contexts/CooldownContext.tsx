import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

interface CooldownEntry {
  abilityId: string;
  expiresAt: number;
  totalDuration: number;
}

interface CooldownContextType {
  cooldowns: Record<string, CooldownEntry>;
  addCooldown: (abilityId: string, durationMs: number) => void;
  getCooldownProgress: (abilityId: string) => number; // 0.0 to 1.0 (0 means ready)
}

const CooldownContext = createContext<CooldownContextType | undefined>(undefined);

export function CooldownProvider({ children }: { children: React.ReactNode }) {
  const [cooldowns, setCooldowns] = useState<Record<string, CooldownEntry>>({});

  const addCooldown = useCallback((abilityId: string, durationMs: number) => {
    setCooldowns((prev) => ({
      ...prev,
      [abilityId]: {
        abilityId,
        expiresAt: Date.now() + durationMs,
        totalDuration: durationMs,
      },
    }));
  }, []);

  const getCooldownProgress = useCallback(
    (abilityId: string) => {
      const cd = cooldowns[abilityId];
      if (!cd) return 0;
      const now = Date.now();
      if (now >= cd.expiresAt) return 0;
      return (cd.expiresAt - now) / cd.totalDuration;
    },
    [cooldowns],
  );

  return (
    <CooldownContext.Provider value={{ cooldowns, addCooldown, getCooldownProgress }}>
      {children}
    </CooldownContext.Provider>
  );
}

export function useCooldown() {
  const context = useContext(CooldownContext);
  if (!context) {
    throw new Error("useCooldown must be used within a CooldownProvider");
  }
  return context;
}

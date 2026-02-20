import { useState } from "react";

/**
 * Returns true when the device supports touch input (phone/tablet).
 * Stable across renders — the value is computed once on mount.
 */
export function useIsMobile(): boolean {
  const [isMobile] = useState(
    () =>
      typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0),
  );
  return isMobile;
}

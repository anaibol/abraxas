import { Box } from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import { useGameSettings } from "../hooks/useGameSettings";

export function DebugOverlay() {
  const { settings } = useGameSettings();
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settings.showDebugOverlay) return;

    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (textRef.current) {
        textRef.current.innerText = customEvent.detail;
      }
    };

    window.addEventListener("abraxas-debug-update", handler);
    return () => window.removeEventListener("abraxas-debug-update", handler);
  }, [settings.showDebugOverlay]);

  if (!settings.showDebugOverlay) return null;

  return (
    <Box
      position="absolute"
      top="10px"
      left="10px"
      zIndex={3000}
      color="white"
      fontFamily="'Courier New', Courier, monospace"
      fontSize="sm"
      fontWeight="bold"
      textShadow="-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000"
      pointerEvents="none"
      ref={textRef}
      lineHeight="1.2"
      whiteSpace="pre"
    />
  );
}

import { useState, useEffect } from "react";
import { Flex, Text } from "@chakra-ui/react";
import { PLAYER_RESPAWN_TIME_MS } from "@abraxas/shared";
import { T } from "./tokens";

interface DeathOverlayProps {
  visible: boolean;
  deathTime: number;
}

export function DeathOverlay({ visible, deathTime }: DeathOverlayProps) {
  const [countdown, setCountdown] = useState(Math.ceil(PLAYER_RESPAWN_TIME_MS / 1000));

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - deathTime;
      const remaining = Math.max(0, Math.ceil((PLAYER_RESPAWN_TIME_MS - elapsed) / 1000));
      setCountdown(remaining);
    }, 100);
    return () => clearInterval(interval);
  }, [visible, deathTime]);

  if (!visible) return null;

  return (
    <Flex
      pos="fixed"
      inset="0"
      align="center"
      justify="center"
      bg="rgba(80,0,0,0.6)"
      zIndex="50"
      pointerEvents="none"
      direction="column"
    >
      <Text
        fontSize="64px"
        fontWeight="700"
        color={T.bloodBright}
        fontFamily={T.display}
        letterSpacing="12px"
        textShadow="0 0 40px rgba(200,30,60,0.5)"
      >
        YOU DIED
      </Text>
      <Text
        fontSize="18px"
        color={T.goldMuted}
        fontFamily={T.display}
        letterSpacing="4px"
        mt="4"
      >
        Respawning in {countdown}s
      </Text>
    </Flex>
  );
}

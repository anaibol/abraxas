import { Box, Flex, Text } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HEX, T } from "./tokens";

const pulse = keyframes`
  0% { transform: scale(1); opacity: 0.3; }
  50% { transform: scale(1.1); opacity: 0.8; }
  100% { transform: scale(1); opacity: 0.3; }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

/* ── keep the ::after styles in a stable ref so emotion never remounts ── */
const orbitCss = {
  "&::after": {
    content: '""',
    position: "absolute" as const,
    top: "-3px",
    left: "50%",
    transform: "translateX(-50%)",
    w: "6px",
    h: "6px",
    borderRadius: "full",
    bg: HEX.gold,
    boxShadow: `0 0 8px ${HEX.gold}, 0 0 16px ${HEX.gold}88`,
  },
};

/** Isolated from parent re-renders so the spin animation never restarts. */
const Spinner = memo(function Spinner() {
  return (
    <Box pos="relative" mb="12" w="120px" h="120px">
      {/* Glow backdrop */}
      <Box
        pos="absolute"
        inset="-20px"
        borderRadius="full"
        bg={`radial-gradient(circle, ${HEX.gold}18 0%, transparent 70%)`}
        animation={`${pulse} 4s infinite ease-in-out`}
      />
      {/* Orbiting ring */}
      <Box
        pos="absolute"
        inset="-6px"
        border="1px solid"
        borderColor={`${HEX.gold}44`}
        borderRadius="full"
        animation={`${spin} 2.5s linear infinite`}
        css={orbitCss}
      />
      {/* Inner circle */}
      <Box
        pos="absolute"
        inset="0"
        borderRadius="full"
        border="1px solid"
        borderColor={`${HEX.goldDim}33`}
      />
      {/* Letter */}
      <Box
        pos="absolute"
        inset="0"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Text
          fontSize="54px"
          fontFamily={T.display}
          fontWeight="700"
          color={T.gold}
          textShadow={`0 0 24px ${HEX.gold}aa, 0 0 48px ${HEX.goldDim}66`}
          lineHeight="1"
          userSelect="none"
        >
          A
        </Text>
      </Box>
    </Box>
  );
});

export function LoadingScreen() {
  const { t } = useTranslation();
  const tipsRaw = t("loading.tips", { returnObjects: true });
  const tips = Array.isArray(tipsRaw) ? tipsRaw.map(String) : [];
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * 7));
  const [loadingText, setLoadingText] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex(Math.floor(Math.random() * tips.length));
    }, 4000);
    return () => clearInterval(interval);
  }, [tips.length]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail?.text !== undefined) setLoadingText(ce.detail.text);
      if (ce.detail?.progress !== undefined) setLoadingProgress(ce.detail.progress);
    };
    window.addEventListener("abraxas-loading", handler);
    return () => window.removeEventListener("abraxas-loading", handler);
  }, []);

  return (
    <Flex
      pos="fixed"
      inset="0"
      align="center"
      justify="center"
      bg={T.bg}
      zIndex="9999"
      direction="column"
      overflow="hidden"
    >
      {/* Background Ambience */}
      <Box
        pos="absolute"
        w="600px"
        h="600px"
        bg={`radial-gradient(circle, ${HEX.goldDark}22 0%, transparent 70%)`}
        animation={`${pulse} 8s infinite ease-in-out`}
      />

      <Spinner />

      <Box textAlign="center" zIndex="1" px="10">
        <Text
          fontSize="24px"
          fontWeight="700"
          color={T.gold}
          fontFamily={T.display}
          letterSpacing="8px"
          textShadow={`0 0 20px ${HEX.goldDim}ee`}
          mb="2"
        >
          {t("loading.connecting")}
        </Text>

        <Box
          h="1px"
          w="200px"
          mx="auto"
          bg={`linear-gradient(90deg, transparent, ${HEX.goldDim}, transparent)`}
          mb="8"
        />

        {loadingProgress > 0 && (
          <Box w="300px" h="4px" bg={`${HEX.goldDark}44`} mx="auto" mb="6" borderRadius="full" overflow="hidden">
            <Box h="100%" bg={HEX.gold} w={`${loadingProgress * 100}%`} transition="width 0.1s" />
          </Box>
        )}

        <Flex direction="column" gap="1" maxW="400px">
          <Text
            textStyle={T.formLabel}
            color={T.goldDark}
            fontFamily={T.display}
          >
            {loadingText || t("loading.searching")}
          </Text>
          <Text
            textStyle={T.bodyText}
            color={T.goldDim}
            fontFamily={T.display}
            fontStyle="italic"
            fontWeight="500"
            minH="40px"
            transition="all 0.5s"
          >
            "{tips[tipIndex]}"
          </Text>
        </Flex>
      </Box>

      {/* Corners */}
      <Box pos="absolute" top="40px" left="40px" w="100px" h="1px" bg={T.goldDark} opacity="0.4" />
      <Box pos="absolute" top="40px" left="40px" w="1px" h="100px" bg={T.goldDark} opacity="0.4" />
      <Box
        pos="absolute"
        bottom="40px"
        right="40px"
        w="100px"
        h="1px"
        bg={T.goldDark}
        opacity="0.4"
      />
      <Box
        pos="absolute"
        bottom="40px"
        right="40px"
        w="1px"
        h="100px"
        bg={T.goldDark}
        opacity="0.4"
      />
    </Flex>
  );
}

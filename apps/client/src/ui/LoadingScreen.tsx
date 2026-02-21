import { Box, Flex, Text } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { useEffect, useState } from "react";
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

export function LoadingScreen() {
  const { t } = useTranslation();
  const tipsRaw = t("loading.tips", { returnObjects: true });
  const tips = Array.isArray(tipsRaw) ? tipsRaw.map(String) : [];
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * 7));

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex(Math.floor(Math.random() * tips.length));
    }, 4000);
    return () => clearInterval(interval);
  }, [tips.length]);

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

      <Box pos="relative" mb="12">
        {/* Custom Loading Animation */}
        <Box
          w="100px"
          h="100px"
          border="2px dashed"
          borderColor={T.gold}
          borderRadius="full"
          animation={`${spin} 12s linear infinite`}
        />
        <Box
          pos="absolute"
          top="-10px"
          left="-10px"
          right="-10px"
          bottom="-10px"
          border="1px solid"
          borderColor={T.goldDim}
          opacity="0.3"
          borderRadius="full"
          animation={`${spin} 8s linear infinite reverse`}
        />
        <Box
          pos="absolute"
          inset="0"
          display="flex"
          alignItems="center"
          justifyContent="center"
          animation={`${pulse} 4s infinite ease-in-out`}
        >
          <Text
            fontSize="52px"
            fontFamily={T.display}
            fontWeight="700"
            bgClip="text"
            bgGradient={`linear-gradient(135deg, ${HEX.gold}, #f7e0a3, ${HEX.goldDim})`}
            textShadow={`0 0 20px ${HEX.goldDim}88, 0 0 40px ${HEX.goldDim}44`}
            lineHeight="1"
            userSelect="none"
          >
            A
          </Text>
        </Box>
      </Box>

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

        <Flex direction="column" gap="1" maxW="400px">
          <Text
            fontSize="12px"
            color={T.goldDark}
            fontFamily={T.display}
            letterSpacing="2px"
            textTransform="uppercase"
          >
            {t("loading.searching")}
          </Text>
          <Text
            fontSize="13px"
            color={T.goldDim}
            fontFamily="'Segoe UI', system-ui, sans-serif"
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

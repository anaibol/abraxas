import { Flex, Text, Box } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { T, HEX } from "./tokens";

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
  const tips = t("loading.tips", { returnObjects: true }) as string[];
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
          <svg width="60" height="60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={HEX.gold} />
                <stop offset="50%" stopColor="#f7e0a3" />
                <stop offset="100%" stopColor={HEX.goldDim} />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            {/* Inner "A" Shape */}
            <path 
              d="M50 15L20 85H32L38 70H62L68 85H80L50 15ZM50 35L58 55H42L50 35Z" 
              fill="url(#goldGradient)" 
              filter="url(#glow)"
            />
            {/* Arcane Details */}
            <path 
              d="M35 75L40 68M65 75L60 68M50 25L50 30" 
              stroke={HEX.gold} 
              strokeWidth="2" 
              strokeLinecap="round" 
            />
            {/* Outer Circular Accents */}
            <circle cx="50" cy="50" r="45" stroke={HEX.gold} strokeWidth="0.5" strokeDasharray="4 8" opacity="0.5" />
          </svg>
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
      <Box pos="absolute" bottom="40px" right="40px" w="100px" h="1px" bg={T.goldDark} opacity="0.4" />
      <Box pos="absolute" bottom="40px" right="40px" w="1px" h="100px" bg={T.goldDark} opacity="0.4" />
    </Flex>
  );
}

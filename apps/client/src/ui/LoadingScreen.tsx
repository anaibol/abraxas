import { Flex, Text, Box } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { useEffect, useState } from "react";
import { P } from "./palette";

const pulse = keyframes`
  0% { transform: scale(1); opacity: 0.3; }
  50% { transform: scale(1.1); opacity: 0.8; }
  100% { transform: scale(1); opacity: 0.3; }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const LORE_TIPS = [
  "Abraxas was once a floating citadel of the High Magi.",
  "Ancient runes suggest the Arena was built on a ley line junction.",
  "Never turn your back on a Rogue in the dark corners of the Arena.",
  "Warriors favor strength, but a focused mind can pierce any plate.",
  "Goblins are cowards, but their numbers can overwhelm the unwary.",
  "The Lich of the Depths has not been seen for centuries... until now.",
  "Potions are brewed from the essence of fallen elementals.",
];

export function LoadingScreen() {
  const [tip, setTip] = useState("");

  useEffect(() => {
    setTip(LORE_TIPS[Math.floor(Math.random() * LORE_TIPS.length)]);
    const interval = setInterval(() => {
      setTip(LORE_TIPS[Math.floor(Math.random() * LORE_TIPS.length)]);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Flex
      pos="fixed"
      inset="0"
      align="center"
      justify="center"
      bg={P.bg}
      zIndex="9999"
      direction="column"
      overflow="hidden"
    >
      {/* Background Ambience */}
      <Box
        pos="absolute"
        w="600px"
        h="600px"
        bg={`radial-gradient(circle, ${P.goldDark}22 0%, transparent 70%)`}
        animation={`${pulse} 8s infinite ease-in-out`}
      />

      <Box pos="relative" mb="12">
        {/* Custom Loading Animation */}
        <Box
          w="100px"
          h="100px"
          border="2px dashed"
          borderColor={P.gold}
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
          borderColor={P.goldDim}
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
                <stop offset="0%" stopColor="#d4a843" />
                <stop offset="50%" stopColor="#f7e0a3" />
                <stop offset="100%" stopColor="#b8962e" />
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
              stroke="#d4a843" 
              strokeWidth="2" 
              strokeLinecap="round" 
            />
            {/* Outer Circular Accents */}
            <circle cx="50" cy="50" r="45" stroke="#d4a843" strokeWidth="0.5" strokeDasharray="4 8" opacity="0.5" />
          </svg>
        </Box>
      </Box>

      <Box textAlign="center" zIndex="1" px="10">
        <Text
          fontSize="24px"
          fontWeight="700"
          color={P.gold}
          fontFamily={P.font}
          letterSpacing="8px"
          textShadow={`0 0 20px ${P.goldDim}ee`}
          mb="2"
        >
          CONNECTING TO ABRAXAS
        </Text>
        
        <Box 
          h="1px" 
          w="200px" 
          mx="auto" 
          bg={`linear-gradient(90deg, transparent, ${P.goldDim}, transparent)`}
          mb="8"
        />

        <Flex direction="column" gap="1" maxW="400px">
          <Text 
            fontSize="10px" 
            color={P.goldDark} 
            fontFamily={P.font} 
            letterSpacing="2px"
            textTransform="uppercase"
          >
            Searching for portal...
          </Text>
          <Text 
            fontSize="13px" 
            color={P.goldDim} 
            fontFamily="'Segoe UI', system-ui, sans-serif"
            fontStyle="italic"
            fontWeight="500"
            minH="40px"
            transition="all 0.5s"
          >
            "{tip}"
          </Text>
        </Flex>
      </Box>

      {/* Corners */}
      <Box pos="absolute" top="40px" left="40px" w="100px" h="1px" bg={P.goldDark} opacity="0.4" />
      <Box pos="absolute" top="40px" left="40px" w="1px" h="100px" bg={P.goldDark} opacity="0.4" />
      <Box pos="absolute" bottom="40px" right="40px" w="100px" h="1px" bg={P.goldDark} opacity="0.4" />
      <Box pos="absolute" bottom="40px" right="40px" w="1px" h="100px" bg={P.goldDark} opacity="0.4" />
    </Flex>
  );
}

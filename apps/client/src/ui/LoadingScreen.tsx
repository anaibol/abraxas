import { Flex, Text, Box } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { useEffect, useState } from "react";

const P = {
  bg: "#040408",
  gold: "#d4a843",
  goldDim: "#b8962e",
  goldDark: "#6e5a18",
  font: "'Friz Quadrata', Georgia, serif",
};

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
        <Flex
          pos="absolute"
          inset="0"
          align="center"
          justify="center"
          fontSize="32px"
          color={P.gold}
          textShadow={`0 0 15px ${P.gold}`}
        >
          A
        </Flex>
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

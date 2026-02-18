import { Flex, Text, Box, Spinner } from "@chakra-ui/react";

const P = {
  bg: "#0e0c14",
  gold: "#d4a843",
  goldDim: "#b8962e",
  font: "'Friz Quadrata', Georgia, serif",
};

export function LoadingScreen() {
  return (
    <Flex
      pos="fixed"
      inset="0"
      align="center"
      justify="center"
      bg={P.bg}
      zIndex="9999"
      direction="column"
      gap="4"
    >
      <Spinner size="xl" color={P.gold} thickness="4px" speed="0.8s" />
      <Box textAlign="center">
        <Text
          fontSize="24px"
          fontWeight="700"
          color={P.gold}
          fontFamily={P.font}
          letterSpacing="4px"
          textShadow={`0 0 20px ${P.goldDim}`}
        >
          CONNECTING TO ABRAXAS
        </Text>
        <Text fontSize="12px" color={P.goldDim} mt="2" fontFamily={P.font} letterSpacing="2px">
          PREPARING ARENA...
        </Text>
      </Box>
    </Flex>
  );
}

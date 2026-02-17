import { Box, Text } from "@chakra-ui/react";
import { useEffect, useRef } from "react";

export interface ConsoleMessage {
  id: number;
  text: string;
  color?: string;
  timestamp: number;
}

interface ConsoleProps {
  messages: ConsoleMessage[];
}

export function Console({ messages }: ConsoleProps) {
  // No scroll effect needed if messages are newest-first and overflow handled naturally
  // or maybe scroll to top if content overflows? 
  // For now let's just render reversed.

  return (
    <Box
      pos="fixed"
      bottom="16px"
      left="16px"
      w="300px"
      h="200px"
      bg="rgba(0, 0, 0, 0.25)"
      borderRadius="md"
      p={2}
      overflowY="auto"
      pointerEvents="auto"
      css={{
        "&::-webkit-scrollbar": {
          width: "4px",
        },
        "&::-webkit-scrollbar-track": {
          width: "6px",
        },
        "&::-webkit-scrollbar-thumb": {
          background: "rgba(255, 255, 255, 0.2)",
          borderRadius: "24px",
        },
      }}
    >
      {[...messages].reverse().map((msg) => (
        <Text
          key={msg.id}
          color={msg.color || "white"}
          fontSize="xs"
          fontFamily="'Friz Quadrata', Georgia, serif"
          mb={0.5}
          lineHeight="1.2"
          textShadow="1px 1px 0 #000"
        >
          {msg.text}
        </Text>
      ))}
    </Box>
  );
}

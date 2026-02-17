import { Box, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";

export interface ConsoleMessage {
  id: number;
  text: string;
  color?: string;
  timestamp: number;
}

interface ConsoleProps {
  messages: ConsoleMessage[];
  onSendChat?: (message: string) => void;
  isChatOpen?: boolean;
}

export function Console({ messages, onSendChat, isChatOpen }: ConsoleProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isChatOpen) {
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
        inputRef.current?.blur();
    }
  }, [isChatOpen]);

  // Handle local submit if user presses Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
          if (inputValue.trim()) {
              onSendChat?.(inputValue);
              setInputValue("");
          }
      }
      e.stopPropagation();
  };

  return (
    <Box
      pos="fixed"
      bottom="20px"
      left="20px"
      w="400px"
      h="200px"
      bg="rgba(0, 0, 0, 0.25)"
      borderRadius="8px"
      color="white"
      fontFamily="monospace"
      fontSize="14px"
      overflow="hidden"
      pointerEvents={isChatOpen ? "auto" : "none"}
      zIndex={100}
      display="flex"
      flexDirection="column"
    >
      <Box flex="1" overflowY="auto" p="10px">
        {[...messages].map((msg) => (
            <Text
                key={msg.id}
                color={msg.color || "white"}
                fontSize="xs"
                fontFamily="'Friz Quadrata', Georgia, serif"
                mb={0.5}
                lineHeight="1.2"
                textShadow="1px 1px 0 #000"
            >
            <span style={{ opacity: 0.5 }}>[{new Date(msg.timestamp).toLocaleTimeString()}]</span>{" "}
            {msg.text}
            </Text>
        ))}
        <div ref={bottomRef} />
      </Box>
      
      <Box 
        h={isChatOpen ? "40px" : "0px"} 
        transition="height 0.1s" 
        overflow="hidden"
        bg="rgba(0,0,0,0.5)"
      >
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
                width: "100%",
                height: "100%",
                background: "transparent",
                border: "none",
                color: "white",
                padding: "0 10px",
                outline: "none"
            }}
            placeholder="Type message..."
          />
      </Box>
    </Box>
  );
}

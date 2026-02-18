import { Box, Text, Flex, HStack } from "@chakra-ui/react";
import { useEffect, useRef, useState, useMemo } from "react";

export interface ConsoleMessage {
  id: number;
  text: string;
  color?: string;
  timestamp: number;
  channel?: "global" | "party" | "whisper" | "system";
}

interface ConsoleProps {
  messages: ConsoleMessage[];
  onSendChat?: (message: string) => void;
  isChatOpen?: boolean;
}

type Channel = "all" | "global" | "party" | "whisper" | "system";

export function Console({ messages, onSendChat, isChatOpen }: ConsoleProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [activeChannel, setActiveChannel] = useState<Channel>("all");

  const filteredMessages = useMemo(() => {
    if (activeChannel === "all") return messages;
    return messages.filter(m => m.channel === activeChannel || (activeChannel === "system" && !m.channel));
  }, [messages, activeChannel]);

  useEffect(() => {
    // If we're already near the bottom, scroll to bottom
    const container = bottomRef.current?.parentElement;
    if (container) {
      const isVisible = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
      if (isVisible) {
        bottomRef.current?.scrollIntoView({ behavior: "auto" });
      }
    }
  }, [filteredMessages]);

  useEffect(() => {
    if (isChatOpen) {
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
        inputRef.current?.blur();
    }
  }, [isChatOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
          if (inputValue.trim()) {
              let prefix = "";
              if (activeChannel === "party") prefix = "/p ";
              // Whisper needs a target, so we don't auto-prefix it easily here without more UI
              
              onSendChat?.(prefix + inputValue);
              setInputValue("");
          }
      }
      e.stopPropagation();
  };

  const tabs: { id: Channel; label: string; color: string }[] = [
    { id: "all", label: "ALL", color: "#ccc" },
    { id: "global", label: "GLOBAL", color: "#fff" },
    { id: "party", label: "PARTY", color: "#77f" },
    { id: "whisper", label: "WHISPER", color: "#f7f" },
    { id: "system", label: "SYSTEM", color: "#ff7" },
  ];

  return (
    <Box
      pos="fixed"
      bottom="20px"
      left="20px"
      w="420px"
      h="240px"
      bg="rgba(0, 0, 0, 0.45)"
      border="1px solid rgba(255,255,255,0.1)"
      borderRadius="4px"
      color="white"
      fontFamily="'Friz Quadrata', Georgia, serif"
      fontSize="14px"
      overflow="hidden"
      pointerEvents={isChatOpen ? "auto" : "none"}
      zIndex={100}
      display="flex"
      flexDirection="column"
    >
      {/* Tabs */}
      <HStack gap="0" bg="rgba(0,0,0,0.3)" borderBottom="1px solid rgba(255,255,255,0.1)">
        {tabs.map(tab => (
          <Box
            key={tab.id}
            px="3"
            py="1"
            cursor="pointer"
            fontSize="10px"
            fontWeight="bold"
            letterSpacing="1px"
            bg={activeChannel === tab.id ? "rgba(255,255,255,0.1)" : "transparent"}
            color={activeChannel === tab.id ? tab.color : "#666"}
            borderBottom={activeChannel === tab.id ? `2px solid ${tab.color}` : "none"}
            onClick={() => setActiveChannel(tab.id)}
            pointerEvents="auto"
            _hover={{ color: tab.color }}
          >
            {tab.label}
          </Box>
        ))}
      </HStack>

      <Box flex="1" overflowY="auto" p="10px" css={{
        "&::-webkit-scrollbar": { width: "4px" },
        "&::-webkit-scrollbar-thumb": { background: "rgba(255,255,255,0.2)" }
      }}>
        {filteredMessages.map((msg) => (
            <Text
                key={msg.id}
                color={msg.color || "white"}
                fontSize="xs"
                mb={0.5}
                lineHeight="1.2"
                textShadow="1px 1px 0 #000"
            >
            <span style={{ opacity: 0.4, fontSize: "10px" }}>[{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]</span>{" "}
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
                outline: "none",
                fontSize: "13px"
            }}
            placeholder={activeChannel === "party" ? "Message Party..." : "Type message..."}
          />
      </Box>
    </Box>
  );
}

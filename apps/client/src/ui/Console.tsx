import { Box, HStack, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HEX, T } from "./tokens";

export interface ConsoleMessage {
  id: number;
  text: string;
  color?: string;
  timestamp: number;
  channel?: "global" | "group" | "guild" | "whisper" | "system" | "combat";
}

interface ConsoleProps {
  messages: ConsoleMessage[];
  onSendChat?: (message: string) => void;
  isChatOpen?: boolean;
  prefillMessage?: string;
  isGM?: boolean;
}

const GM_COMMANDS: { usage: string; desc: string }[] = [
  { usage: "/gm heal", desc: "Restore HP & mana to full" },
  { usage: "/gm item <id> [qty]", desc: "Give yourself an item" },
  { usage: "/gm gold <amount>", desc: "Give yourself gold" },
  { usage: "/gm xp <amount>", desc: "Give yourself XP" },
  { usage: "/gm tp <x> <y>", desc: "Teleport to tile coordinates" },
  { usage: "/gm goto <name>", desc: "Teleport to a player" },
  { usage: "/gm spawn <npcType>", desc: "Spawn an NPC in front of you" },
  { usage: "/gm announce <msg>", desc: "Broadcast a server message" },
];

type Channel = "all" | "global" | "group" | "guild" | "whisper" | "system" | "combat";

const TABS: { id: Channel; labelKey: string; color: string }[] = [
  { id: "all", labelKey: "console.tab_all", color: "#ccc" },
  { id: "global", labelKey: "console.tab_global", color: "#fff" },
  { id: "group", labelKey: "console.tab_group", color: "#77f" },
  { id: "guild", labelKey: "console.tab_guild", color: "#a78bfa" },
  { id: "whisper", labelKey: "console.tab_whisper", color: "#f7f" },
  { id: "system", labelKey: "console.tab_system", color: "#ff7" },
  { id: "combat", labelKey: "console.tab_combat", color: "#f84" },
];

export function Console({ messages, onSendChat, isChatOpen, prefillMessage, isGM }: ConsoleProps) {
  const { t } = useTranslation();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [activeChannel, setActiveChannel] = useState<Channel>("all");
  const [tabIndex, setTabIndex] = useState(-1);

  const gmHints = useMemo(() => {
    if (!isGM || !inputValue.startsWith("/gm")) return [];
    const sub = inputValue.slice(3).trimStart().split(" ")[0].toLowerCase();
    return GM_COMMANDS.filter((c) => sub === "" || c.usage.split(" ")[1]?.startsWith(sub));
  }, [isGM, inputValue]);

  useEffect(() => {
    if (prefillMessage && isChatOpen) {
      setInputValue(prefillMessage);
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
    }
  }, [prefillMessage, isChatOpen]);

  const filteredMessages = useMemo(() => {
    if (activeChannel === "all") return messages;
    return messages.filter(
      (m) => m.channel === activeChannel || (activeChannel === "system" && !m.channel),
    );
  }, [messages, activeChannel]);

  useEffect(() => {
    if (filteredMessages.length === 0) return;
    const container = bottomRef.current?.parentElement;
    if (container) {
      const isVisible =
        container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
      if (isVisible) {
        bottomRef.current?.scrollIntoView({ behavior: "auto" });
      }
    }
  }, [filteredMessages]);

  useEffect(() => {
    if (isChatOpen) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => inputRef.current?.focus());
      });
    } else {
      inputRef.current?.blur();
    }
  }, [isChatOpen]);

  useEffect(() => {
    if (!isChatOpen) return;

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [isChatOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab" && isGM && gmHints.length > 0) {
      e.preventDefault();
      const nextIndex = (tabIndex + 1) % gmHints.length;
      setTabIndex(nextIndex);
      const cmd = gmHints[nextIndex].usage;
      // Fill up to the first placeholder (strip < ... > args)
      const base = cmd
        .replace(/<[^>]+>/g, "")
        .replace(/\[[^\]]+\]/g, "")
        .trimEnd();
      setInputValue(base);
      return;
    }
    if (e.key !== "Tab") setTabIndex(-1);
    if (e.key === "Enter") {
      const prefix = activeChannel === "group" ? "/p " : "";
      onSendChat?.(prefix + inputValue);
      setInputValue("");
      setTabIndex(-1);
    }
    e.stopPropagation();
  };

  return (
    <Box
      pos="fixed"
      bottom={{ base: "210px", md: "20px" }}
      left="20px"
      w={{ base: "55vw", md: "420px" }}
      maxW={{ base: "240px", md: "420px" }}
      h={{ base: "130px", md: "240px" }}
      bg="rgba(12, 10, 18, 0.5)"
      backdropFilter="blur(8px)"
      borderWidth="1px"
      borderStyle="solid"
      borderColor="var(--chakra-colors-game-goldDim)"
      borderRadius="12px"
      boxShadow={`0 10px 50px rgba(0,0,0,0.8), 0 0 0 1px ${HEX.border}`}
      color="white"
      fontFamily={T.display}
      fontSize="14px"
      overflow="hidden"
      pointerEvents={isChatOpen ? "auto" : "none"}
      zIndex={100}
      display="flex"
      flexDirection="column"
    >
      {/* Tabs */}
      <HStack
        gap="0"
        bg="rgba(0,0,0,0.3)"
        borderBottom="1px solid var(--chakra-colors-game-goldDim)"
        overflow="hidden"
      >
        {TABS.map((tab) => (
          <Box
            key={tab.id}
            px={{ base: "2", md: "3" }}
            py="1"
            cursor="pointer"
            fontSize={{ base: "10px", md: "12px" }}
            fontWeight="700"
            letterSpacing={{ base: "0", md: "1px" }}
            bg={activeChannel === tab.id ? "rgba(255,255,255,0.1)" : "transparent"}
            color={activeChannel === tab.id ? tab.color : "#666"}
            borderBottom={activeChannel === tab.id ? `2px solid ${tab.color}` : "2px solid transparent"}
            onClick={() => setActiveChannel(tab.id)}
            pointerEvents="auto"
            _hover={{ color: tab.color }}
            flexShrink={0}
          >
            {t(tab.labelKey)}
          </Box>
        ))}
      </HStack>

      <Box
        flex="1"
        overflowY="auto"
        p="10px"
        css={{
          "&::-webkit-scrollbar": { width: "4px" },
          "&::-webkit-scrollbar-thumb": { background: "rgba(255,255,255,0.2)" },
        }}
      >
        {filteredMessages.map((msg) => (
          <Text
            key={msg.id}
            color={msg.color || "white"}
            fontSize="13px"
            mb={0.5}
            lineHeight="1.2"
            textShadow="1px 1px 0 #000"
          >
            <span style={{ opacity: 0.4, fontSize: "11px" }}>
              [
              {new Date(msg.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
              ]
            </span>{" "}
            {msg.text}
          </Text>
        ))}
        <div ref={bottomRef} />
      </Box>

      {isChatOpen && gmHints.length > 0 && (
        <Box
          bg="rgba(8, 6, 18, 0.96)"
          borderTop="1px solid var(--chakra-colors-game-goldDim)"
          px="10px"
          py="4px"
        >
          {gmHints.map((hint, i) => (
            <HStack key={hint.usage} gap="2" py="1px">
              <Text
                fontSize="11px"
                fontWeight="700"
                color={i === tabIndex ? "#ffaa33" : "#d4a843"}
                fontFamily="'Courier New', monospace"
                flexShrink={0}
              >
                {hint.usage}
              </Text>
              <Text fontSize="11px" color="rgba(255,255,255,0.45)" lineClamp={1}>
                {hint.desc}
              </Text>
            </HStack>
          ))}
          <Text fontSize="10px" color="rgba(255,255,255,0.25)" mt="2px">
            Tab to cycle
          </Text>
        </Box>
      )}
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
          onChange={(e) => {
            setInputValue(e.target.value);
            setTabIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          style={{
            width: "100%",
            height: "100%",
            background: "transparent",
            border: "none",
            color: "white",
            padding: "0 10px",
            outline: "none",
            fontSize: "13px",
          }}
          placeholder={
            activeChannel === "group"
              ? t("console.placeholder_group")
              : t("console.placeholder_default")
          }
        />
      </Box>
    </Box>
  );
}

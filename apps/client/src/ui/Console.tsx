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
  { usage: "/gm spawn <npcId>", desc: "Spawn an NPC in front of you" },
  { usage: "/gm announce <msg>", desc: "Broadcast a server message" },
];

type Channel = "all" | "global" | "group" | "guild" | "whisper" | "system" | "combat";

const TABS: { id: Channel; icon: string; labelKey: string; color: string }[] = [
  { id: "all", icon: "💬", labelKey: "console.tab_all", color: "#ccc" },
  { id: "global", icon: "🌍", labelKey: "console.tab_global", color: "#fff" },
  { id: "group", icon: "👥", labelKey: "console.tab_group", color: "#77f" },
  { id: "guild", icon: "🛡️", labelKey: "console.tab_guild", color: "#a78bfa" },
  { id: "whisper", icon: "✉️", labelKey: "console.tab_whisper", color: "#f7f" },
  { id: "system", icon: "⚙️", labelKey: "console.tab_system", color: "#ff7" },
  { id: "combat", icon: "⚔️", labelKey: "console.tab_combat", color: "#f84" },
];

const CHANNEL_COLORS: Record<string, string> = {
  global: "#ddd",
  group: "#7799ff",
  guild: "#a78bfa",
  whisper: "#ff77ff",
  system: "#ffff77",
  combat: "#ff8844",
};

const CHANNEL_PREFIXES: Record<string, string> = {
  group: "Party",
  guild: "Guild",
  whisper: "Whisper",
  system: "System",
  combat: "Combat",
};

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
      flex="1"
      h="100%"
      bg="rgba(12, 10, 18, 0.65)"
      backdropFilter="blur(6px)"
      borderWidth="0"
      borderBottom="1px solid rgba(255,255,255,0.06)"
      borderRight="1px solid rgba(255,255,255,0.06)"
      borderRadius="0"
      boxShadow="0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)"
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
        borderBottom="1px solid rgba(255,255,255,0.06)"
        overflow="hidden"
      >
        {TABS.map((tab) => (
          <Box
            key={tab.id}
            px={{ base: "2", md: "4" }}
            py="1.5"
            cursor="pointer"
            fontSize={{ base: "14px", md: "16px" }}
            lineHeight="1"
            bg={activeChannel === tab.id ? "rgba(255,255,255,0.08)" : "transparent"}
            borderBottom={activeChannel === tab.id ? `2px solid ${tab.color}` : "2px solid transparent"}
            onClick={() => setActiveChannel(tab.id)}
            pointerEvents="auto"
            _hover={{ bg: "rgba(255,255,255,0.12)" }}
            transition="all 0.2s"
            flexShrink={0}
            display="flex"
            alignItems="center"
            justifyContent="center"
            opacity={activeChannel === tab.id ? 1 : 0.4}
            filter={activeChannel === tab.id ? "drop-shadow(0 0 6px " + tab.color + "40)" : "grayscale(100%)"}
            title={t(tab.labelKey)}
          >
            {tab.icon}
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
        {filteredMessages.map((msg) => {
          const channelColor = msg.channel ? CHANNEL_COLORS[msg.channel] : undefined;
          const prefix = msg.channel ? CHANNEL_PREFIXES[msg.channel] : undefined;
          return (
          <Text
            key={msg.id}
            color={msg.color || channelColor || "white"}
            textStyle={T.bodyText}
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
            {prefix && (
              <span style={{ color: channelColor, opacity: 0.7, fontSize: "11px", fontWeight: 700 }}>
                [{prefix}]{" "}
              </span>
            )}
            {msg.text}
          </Text>
          );
        })}
        <div ref={bottomRef} />
      </Box>

      {isChatOpen && gmHints.length > 0 && (
        <Box
          bg="rgba(8, 6, 18, 0.96)"
          borderTop="1px solid rgba(255,255,255,0.06)"
          px="10px"
          py="4px"
        >
          {gmHints.map((hint, i) => (
            <HStack key={hint.usage} gap="2" py="1px">
              <Text
                textStyle={T.statLabel}
                fontWeight="700"
                color={i === tabIndex ? "#ffaa33" : "#d4a843"}
                fontFamily={T.mono}
                flexShrink={0}
              >
                {hint.usage}
              </Text>
              <Text textStyle={T.statLabel} color="rgba(255,255,255,0.45)" lineClamp={1}>
                {hint.desc}
              </Text>
            </HStack>
          ))}
          <Text textStyle={T.badgeText} color="rgba(255,255,255,0.25)" mt="2px">
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
            lineHeight: "40px",
            background: "transparent",
            border: "none",
            color: "white",
            padding: "0 10px",
            outline: "none",
            fontSize: "13px",
            fontFamily: "inherit",
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

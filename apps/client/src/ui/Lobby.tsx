import { useState, useEffect } from "react";
import {
  Box, Flex, Text, Input, Button, Grid,
  IconButton, Badge,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { type ClassType, getRandomName } from "@abraxas/shared";
import { P } from "./palette";
import { useTranslation } from "react-i18next";

type LobbyProps = {
  onJoin: (charId: string, classType: ClassType, token: string) => void;
  connecting: boolean;
};

type CharacterSummary = {
  id: string;
  name: string;
  class: ClassType;
  level: number;
};

type Mode = "login" | "register" | "character_select" | "character_create";


const CLASS_TYPES: readonly ClassType[] = [
  "WARRIOR",
  "MAGE",
  "RANGER",
  "ROGUE",
  "CLERIC",
  "PALADIN",
];

const CLASS_INFO: Record<
  ClassType,
  { icon: string; color: string }
> = {
  WARRIOR: {
    icon: "\u2694\uFE0F",
    color: "#e63946",
  },
  MAGE: {
    icon: "\u2728",
    color: "#4895ef",
  },
  RANGER: {
    icon: "\uD83C\uDFF9",
    color: "#4caf50",
  },
  ROGUE: {
    icon: "\uD83D\uDDE1\uFE0F",
    color: "#9d4edd",
  },
  CLERIC: {
    icon: "\uD83D\uDEE1\uFE0F",
    color: "#ffca3a",
  },
  PALADIN: {
    icon: "\u2728",
    color: "#f8f9fa",
  },
};

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const entrance = keyframes`
  from { opacity: 0; transform: translateY(10px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

const titleGlow = keyframes`
  0% { text-shadow: 0 0 10px rgba(212, 168, 67, 0.2); }
  50% { text-shadow: 0 0 25px rgba(212, 168, 67, 0.6); }
  100% { text-shadow: 0 0 10px rgba(212, 168, 67, 0.2); }
`;

const inputStyle = {
  bg: "rgba(8, 8, 12, 0.8)",
  border: "1px solid",
  borderRadius: "4px",
  color: P.goldText,
  fontFamily: P.font,
  fontSize: "14px",
  p: "2.5",
  outline: "none",
  transition: "all 0.2s",
  _focus: { borderColor: P.gold, boxShadow: `0 0 10px ${P.gold}44` },
} as const;

const CHAR_NAME_REGEX = /^[A-Z][a-z]*( [A-Z][a-z]*)*$/;

function sanitizeCharName(raw: string): string {
  return raw.replace(/[^a-zA-Z ]/g, "").replace(/ {2,}/g, " ");
}

function formatCharName(raw: string): string {
  return raw
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

const MAX_CHARACTERS = 5;

export function Lobby({ onJoin, connecting }: LobbyProps) {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [charName, setCharName] = useState("");
  const [classType, setClassType] = useState<ClassType>("WARRIOR");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const [token, setToken] = useState("");
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("abraxas_token");
    if (!stored) return;

    fetch("/api/me", {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("invalid");
        return res.json();
      })
      .then((data) => {
        setToken(stored);
        setCharacters(data.characters ?? []);
        setMode("character_select");
      })
      .catch(() => {
        localStorage.removeItem("abraxas_token");
      });
  }, []);

  const labelStyle = {
    fontSize: "12px",
    color: P.goldMuted,
    letterSpacing: "2px",
    textTransform: "uppercase" as const,
    mb: "1.5",
    fontWeight: "600",
  };

  const handleAuth = async () => {
    setError("");
    const url = mode === "login" ? "/api/login" : "/api/register";
    const body = mode === "login"
      ? { email, password }
      : { email, password };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("lobby.error.auth_failed"));
        return;
      }

      localStorage.setItem("abraxas_token", data.token);
      setToken(data.token);
      setCharacters(data.characters ?? []);
      setMode("character_select");
    } catch {
      setError(t("lobby.error.network_error"));
    }
  };

  const handleCreateCharacter = async () => {
    setError("");
    const trimmed = charName.trim();
    if (!trimmed) {
      setError(t("lobby.error.char_name_required"));
      return;
    }
    if (!CHAR_NAME_REGEX.test(trimmed)) {
      setError(t("lobby.error.char_name_invalid"));
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ charName: trimmed, classType }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("lobby.error.auth_failed"));
        return;
      }

      setCharacters((prev) => [...prev, data as CharacterSummary]);
      setCharName("");
      setClassType("WARRIOR");
      setMode("character_select");
    } catch {
      setError(t("lobby.error.network_error"));
    } finally {
      setCreating(false);
    }
  };

  const handleRandomName = () => {
    setCharName(getRandomName());
  };

  const resetToLogin = () => {
    localStorage.removeItem("abraxas_token");
    setMode("login");
    setToken("");
    setCharacters([]);
    setEmail("");
    setPassword("");
    setError("");
  };

  const isCharSelectWide = mode === "character_select" || mode === "character_create";

  return (
    <Flex
      pos="fixed"
      inset="0"
      align="center"
      justify="center"
      bg="rgba(2, 2, 4, 0.9)"
      zIndex="100"
      backdropFilter="blur(8px)"
      animation={`${entrance} 0.5s ease-out`}
    >
      <Box
        bg={P.bg}
        border="1px solid"
        borderColor={P.goldDim}
        backdropFilter="blur(20px)"
        borderRadius="12px"
        p="12"
        minW={isCharSelectWide ? "540px" : "460px"}
        maxW="600px"
        w="100%"
        boxShadow={`0 10px 50px rgba(0,0,0,0.8), 0 0 0 1px ${P.border}`}
        fontFamily={P.font}
        position="relative"
        overflow="hidden"
        transition="min-width 0.3s ease"
      >
        {/* Language Selector */}
        <Flex position="absolute" top="12px" left="12px" gap="2" zIndex={10}>
          {[
            { code: "en", label: "🇺🇸" },
            { code: "es", label: "🇪🇸" },
            { code: "fr", label: "🇫🇷" },
            { code: "it", label: "🇮🇹" },
          ].map((lang) => (
            <Box
              key={lang.code}
              cursor="pointer"
              fontSize="18px"
              opacity={i18n.language === lang.code ? 1 : 0.4}
              filter={i18n.language === lang.code ? "none" : "grayscale(80%)"}
              _hover={{ opacity: 1, filter: "none", transform: "scale(1.1)" }}
              transition="all 0.2s"
              onClick={() => {
                i18n.changeLanguage(lang.code);
                localStorage.setItem("abraxas_lang", lang.code);
              }}
              title={lang.code.toUpperCase()}
            >
              {lang.label}
            </Box>
          ))}
        </Flex>

        {/* Shimmer Effect */}
        <Box
          position="absolute"
          top="0"
          left="0"
          right="0"
          h="1px"
          bg={`linear-gradient(90deg, transparent, ${P.gold}, transparent)`}
          backgroundSize="200% 100%"
          animation={`${shimmer} 3s linear infinite`}
        />

        <Text
          textAlign="center"
          fontSize="40px"
          fontWeight="900"
          color={P.gold}
          letterSpacing="10px"
          textTransform="uppercase"
          animation={`${titleGlow} 4s infinite ease-in-out`}
          mb="1"
        >
          {t("lobby.title")}
        </Text>
        <Text
          textAlign="center"
          fontSize="12px"
          color={P.goldDark}
          letterSpacing="12px"
          textTransform="uppercase"
          mb="8"
          ml="12px"
        >
          {t("lobby.subtitle")}
        </Text>

        <Box
          h="1px"
          bg={`linear-gradient(90deg, transparent, ${P.border}, transparent)`}
          mb="8"
        />

        {/* ── Account Auth ── */}
        {(mode === "login" || mode === "register") && (
          <Flex
            as="form"
            direction="column"
            gap="4"
            animation={`${entrance} 0.4s ease-out`}
            onSubmit={(e) => {
              e.preventDefault();
              handleAuth();
            }}
          >
            <Box>
              <Text {...labelStyle}>{t("lobby.email_address")}</Text>
              <Input
                type="email"
                autoComplete="username"
                placeholder="knight@abraxas.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                {...inputStyle}
              />
            </Box>

            <Box>
              <Text {...labelStyle}>{t("lobby.secret_key")}</Text>
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                {...inputStyle}
              />
            </Box>

            {error && (
              <Text color={P.bloodBright} fontSize="12px" textAlign="center" py="2" fontWeight="600">
                {error}
              </Text>
            )}

            <Button
              mt="2"
              w="100%"
              h="50px"
              bg={P.goldDim}
              color="#08080c"
              type="submit"
              fontFamily={P.font}
              fontWeight="900"
              fontSize="16px"
              letterSpacing="4px"
              textTransform="uppercase"
              transition="all 0.2s"
              _hover={{ bg: P.gold, transform: "translateY(-2px)", boxShadow: `0 5px 20px ${P.gold}44` }}
              _active={{ transform: "translateY(0)" }}
            >
              {mode === "login" ? t("lobby.login") : t("lobby.register")}
            </Button>

            <Flex justify="center" gap="2" mt="2">
              <Text fontSize="12px" color={P.goldMuted}>
                {mode === "login" ? t("lobby.new_to_arena") : t("lobby.already_combatant")}
              </Text>
              <Text
                fontSize="12px"
                color={P.gold}
                fontWeight="700"
                cursor="pointer"
                borderBottom="1px solid transparent"
                _hover={{ borderBottomColor: P.gold }}
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setError("");
                }}
              >
                {mode === "login" ? t("lobby.create_account") : t("lobby.sign_in")}
              </Text>
            </Flex>
          </Flex>
        )}

        {/* ── Character Select ── */}
        {mode === "character_select" && (
          <Box animation={`${entrance} 0.4s ease-out`}>
            <Flex justify="space-between" align="center" mb="5">
              <Text {...labelStyle} mb="0">{t("lobby.choose_champion")}</Text>
              <Text fontSize="11px" color={P.goldDark}>
                {t("lobby.characters_count", { count: characters.length, max: MAX_CHARACTERS })}
              </Text>
            </Flex>

            {characters.length === 0 ? (
              <Flex
                direction="column"
                align="center"
                justify="center"
                py="10"
                gap="3"
              >
                <Text fontSize="32px" opacity="0.4">⚔️</Text>
                <Text fontSize="13px" color={P.goldMuted} textAlign="center">
                  {t("lobby.no_champions")}
                </Text>
              </Flex>
            ) : (
              <Grid templateColumns="repeat(1, 1fr)" gap="3" mb="5">
                {characters.map((char) => {
                  const info = CLASS_INFO[char.class];
                  return (
                    <Box
                      key={char.id}
                      p="4"
                      bg="rgba(8, 8, 12, 0.4)"
                      border="1px solid"
                      borderColor={P.border}
                      borderRadius="8px"
                      cursor="pointer"
                      transition="all 0.2s"
                      onClick={() => onJoin(char.id, char.class, token)}
                      _hover={{
                        bg: `${info.color}11`,
                        borderColor: info.color,
                        transform: "translateX(4px)",
                      }}
                    >
                      <Flex align="center" gap="4">
                        <Box
                          fontSize="26px"
                          w="40px"
                          textAlign="center"
                          flexShrink={0}
                        >
                          {info.icon}
                        </Box>
                        <Box flex="1">
                          <Text
                            fontSize="15px"
                            fontWeight="900"
                            color={P.goldText}
                            letterSpacing="1px"
                          >
                            {char.name}
                          </Text>
                          <Text fontSize="12px" color={P.goldDark} textTransform="uppercase" letterSpacing="1px">
                            {t(`classes.${char.class}.name`)}
                          </Text>
                        </Box>
                        <Badge
                          px="2"
                          py="0.5"
                          borderRadius="4px"
                          bg={`${info.color}22`}
                          color={info.color}
                          border="1px solid"
                          borderColor={`${info.color}44`}
                          fontSize="11px"
                          fontFamily={P.font}
                          fontWeight="700"
                        >
                          Lv {char.level}
                        </Badge>
                      </Flex>
                    </Box>
                  );
                })}
              </Grid>
            )}

            <Button
              w="100%"
              h="44px"
              bg={characters.length >= MAX_CHARACTERS ? P.goldDark : "transparent"}
              border="1px solid"
              borderColor={characters.length >= MAX_CHARACTERS ? "transparent" : P.border}
              color={characters.length >= MAX_CHARACTERS ? P.goldDark : P.goldMuted}
              fontFamily={P.font}
              fontWeight="700"
              fontSize="13px"
              letterSpacing="3px"
              textTransform="uppercase"
              disabled={characters.length >= MAX_CHARACTERS}
              onClick={() => {
                setError("");
                setMode("character_create");
              }}
              _hover={
                characters.length < MAX_CHARACTERS
                  ? { borderColor: P.gold, color: P.goldText }
                  : {}
              }
            >
              + {t("lobby.new_character")}
            </Button>

            {connecting && (
              <Text fontSize="11px" color={P.goldMuted} textAlign="center" mt="3">
                {t("lobby.connecting")}
              </Text>
            )}

            <Button
              mt="3"
              bg="transparent"
              variant="ghost"
              w="100%"
              color={P.goldDark}
              fontSize="11px"
              letterSpacing="2px"
              textTransform="uppercase"
              onClick={resetToLogin}
              _hover={{ color: P.goldMuted }}
            >
              {t("lobby.sign_out")}
            </Button>
          </Box>
        )}

        {/* ── Character Create ── */}
        {mode === "character_create" && (
          <Box animation={`${entrance} 0.4s ease-out`}>
            <Flex justify="space-between" align="baseline" mb="5">
              <Text {...labelStyle} mb="0">{t("lobby.new_character")}</Text>
            </Flex>

            <Box mb="4">
              <Text {...labelStyle}>{t("lobby.character_name")}</Text>
              <Flex gap="2">
                <Input
                  value={charName}
                  onChange={(e) => setCharName(sanitizeCharName(e.target.value))}
                  onBlur={() => setCharName((n: string) => formatCharName(n))}
                  placeholder={t("lobby.character_name_placeholder")}
                  maxLength={20}
                  {...inputStyle}
                />
                <IconButton
                  aria-label="Random Name"
                  type="button"
                  variant="ghost"
                  color={P.goldDim}
                  onClick={handleRandomName}
                  _hover={{ bg: "transparent", color: P.gold, transform: "rotate(15deg) scale(1.1)" }}
                  _active={{ transform: "scale(0.95)" }}
                >
                  <Text fontSize="20px">🎲</Text>
                </IconButton>
              </Flex>
            </Box>

            <Text {...labelStyle} mb="3">{t("lobby.select_path")}</Text>
            <Grid templateColumns="repeat(1, 1fr)" gap="2" mb="6">
              {CLASS_TYPES.map((cls) => {
                const sel = classType === cls;
                const info = CLASS_INFO[cls];
                return (
                  <Box
                    key={cls}
                    p="3"
                    bg={sel ? `${info.color}11` : "rgba(8, 8, 12, 0.4)"}
                    border="1px solid"
                    borderColor={sel ? info.color : P.border}
                    borderRadius="8px"
                    cursor="pointer"
                    transition="all 0.2s"
                    onClick={() => setClassType(cls)}
                    _hover={{
                      bg: sel ? `${info.color}22` : "rgba(20, 17, 30, 0.6)",
                      transform: "translateX(4px)",
                    }}
                  >
                    <Flex align="center" gap="3">
                      <Box
                        fontSize="24px"
                        filter={sel ? "none" : "grayscale(100%)"}
                        transition="all 0.3s"
                        w="32px"
                        textAlign="center"
                        flexShrink={0}
                      >
                        {info.icon}
                      </Box>
                      <Box flex="1">
                        <Text
                          fontSize="13px"
                          fontWeight="900"
                          color={sel ? P.goldText : P.goldMuted}
                          letterSpacing="2px"
                          textTransform="uppercase"
                        >
                          {t(`classes.${cls}.name`)}
                        </Text>
                        <Text fontSize="12px" color={P.goldDark}>
                          {t(`classes.${cls}.desc`)}
                        </Text>
                      </Box>
                      {sel && (
                        <Box
                          boxSize="8px"
                          bg={info.color}
                          borderRadius="full"
                          boxShadow={`0 0 10px ${info.color}`}
                          flexShrink={0}
                        />
                      )}
                    </Flex>
                    {sel && (
                      <Text mt="2" fontSize="11px" color={P.goldText} opacity="0.8" pl="35px">
                        {t(`classes.${cls}.longDesc`)}
                      </Text>
                    )}
                  </Box>
                );
              })}
            </Grid>

            {error && (
              <Text color={P.bloodBright} fontSize="12px" textAlign="center" py="2" fontWeight="600" mb="2">
                {error}
              </Text>
            )}

            <Button
              w="100%"
              h="50px"
              bg={creating ? P.goldDark : P.goldDim}
              color="#08080c"
              loading={creating}
              onClick={handleCreateCharacter}
              fontFamily={P.font}
              fontWeight="900"
              fontSize="16px"
              letterSpacing="4px"
              textTransform="uppercase"
              _hover={{ bg: P.gold, transform: "translateY(-2px)", boxShadow: `0 5px 20px ${P.gold}44` }}
            >
              {t("lobby.create_character")}
            </Button>

            <Button
              mt="3"
              bg="transparent"
              variant="ghost"
              w="100%"
              color={P.goldMuted}
              fontSize="12px"
              onClick={() => {
                setError("");
                setMode("character_select");
              }}
            >
              {t("lobby.back")}
            </Button>
          </Box>
        )}
      </Box>
    </Flex>
  );
}

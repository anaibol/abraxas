import { type ClassType, getRandomName } from "@abraxas/shared";
import { Badge, Box, Button, Flex, Grid, IconButton, Input, Spinner, Text } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HEX, T } from "./tokens";

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

type AdminCharacterSummary = CharacterSummary & {
  ownerEmail: string;
};

type Mode = "login" | "register" | "character_select" | "character_create";

const CLASS_TYPES: readonly ClassType[] = [
  "WARRIOR",
  "MAGE",
  "RANGER",
  "ROGUE",
  "CLERIC",
  "PALADIN",
  "NECROMANCER",
  "DRUID",
];

const CLASS_INFO: Record<ClassType, { icon: string; color: string }> = {
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
    icon: "✨",
    color: "#f8f9fa",
  },
  NECROMANCER: {
    icon: "💀",
    color: "#8a2be2",
  },
  DRUID: {
    icon: "🌿",
    color: "#2e8b57",
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
  color: T.goldText,
  fontFamily: T.display,
  fontSize: "14px",
  p: "2.5",
  outline: "none",
  transition: "all 0.2s",
  _focus: { borderColor: T.gold, boxShadow: `0 0 10px ${HEX.gold}44` },
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
  const [isCheckingToken, setIsCheckingToken] = useState(() => !!localStorage.getItem("abraxas_token"));
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCharacters, setAdminCharacters] = useState<AdminCharacterSummary[]>([]);
  const [charSearch, setCharSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingCharId, setDeletingCharId] = useState<string | null>(null);

  const [token, setToken] = useState("");
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);

  const fetchAdminCharacters = async (tok: string) => {
    const res = await fetch("/api/admin/characters", {
      headers: { Authorization: `Bearer ${tok}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    setAdminCharacters(
      (data.characters ?? []).map((c: { id: string; name: string; class: ClassType; level: number; account?: { email?: string } }) => ({
        id: c.id,
        name: c.name,
        class: c.class,
        level: c.level,
        ownerEmail: c.account?.email ?? "",
      }))
    );
  };

  useEffect(() => {
    const stored = localStorage.getItem("abraxas_token");
    if (!stored) {
      setIsCheckingToken(false);
      return;
    }

    fetch("/api/me", {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("invalid");
        return res.json();
      })
      .then((data) => {
        const admin = data.role === "ADMIN";
        setToken(stored);
        setIsAdmin(admin);
        setCharacters(data.characters ?? []);
        setMode("character_select");
        if (admin) fetchAdminCharacters(stored);
      })
      .catch(() => {
        localStorage.removeItem("abraxas_token");
      })
      .finally(() => {
        setIsCheckingToken(false);
      });
  }, []);

  const labelStyle = {
    fontSize: "12px",
    color: T.goldMuted,
    letterSpacing: "2px",
    textTransform: "uppercase" as const,
    mb: "1.5",
    fontWeight: "600",
  };

  const handleAuth = async () => {
    setError("");
    const url = mode === "login" ? "/api/login" : "/api/register";
    const body = mode === "login" ? { email, password } : { email, password };

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

      const admin = data.role === "ADMIN";
      localStorage.setItem("abraxas_token", data.token);
      setToken(data.token);
      setIsAdmin(admin);
      setCharacters(data.characters ?? []);
      setMode("character_select");
      if (admin) fetchAdminCharacters(data.token);
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

      const newCharacter: CharacterSummary = {
        id: data.id,
        name: data.name,
        class: data.class,
        level: data.level,
      };
      setCharacters((prev) => [...prev, newCharacter]);
      setCharName("");
      setClassType("WARRIOR");
      setMode("character_select");
    } catch {
      setError(t("lobby.error.network_error"));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCharacter = async (charId: string) => {
    setDeletingCharId(charId);
    setError("");
    try {
      const res = await fetch("/api/characters", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ charId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t("lobby.delete_failed"));
        return;
      }
      setCharacters((prev) => prev.filter((c) => c.id !== charId));
      setConfirmDeleteId(null);
    } catch {
      setError(t("lobby.delete_failed"));
    } finally {
      setDeletingCharId(null);
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
    setIsAdmin(false);
    setAdminCharacters([]);
    setCharSearch("");
    setEmail("");
    setPassword("");
    setError("");
  };

  const isCharSelectWide = mode === "character_select" || mode === "character_create" || isAdmin;

  const filteredAdminChars = adminCharacters.filter((c) => {
    const q = charSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.ownerEmail.toLowerCase().includes(q);
  });

  return (
    <Flex
      pos="fixed"
      inset="0"
      align={{ base: "flex-start", md: "center" }}
      justify="center"
      bg="rgba(2, 2, 4, 0.9)"
      zIndex="100"
      backdropFilter="blur(8px)"
      animation={`${entrance} 0.5s ease-out`}
      overflowY="auto"
      py={{ base: "4", md: "0" }}
    >
      <Box
        bg={T.bg}
        border="1px solid"
        borderColor={T.goldDim}
        backdropFilter="blur(20px)"
        borderRadius="12px"
        p={{ base: "6", md: "12" }}
        w={{ base: "calc(100vw - 32px)", md: isCharSelectWide ? (isAdmin ? "600px" : "540px") : "460px" }}
        maxW={{ base: "100%", md: "600px" }}
        boxShadow={`0 10px 50px rgba(0,0,0,0.8), 0 0 0 1px ${HEX.border}`}
        fontFamily={T.display}
        position="relative"
        overflow="hidden"
        transition="width 0.3s ease"
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
          bg={`linear-gradient(90deg, transparent, ${HEX.gold}, transparent)`}
          backgroundSize="200% 100%"
          animation={`${shimmer} 3s linear infinite`}
        />

        <Text
          textAlign="center"
          fontSize={{ base: "28px", md: "40px" }}
          fontWeight="900"
          color={T.gold}
          letterSpacing={{ base: "6px", md: "10px" }}
          textTransform="uppercase"
          animation={`${titleGlow} 4s infinite ease-in-out`}
          mb="1"
        >
          {t("lobby.title")}
        </Text>
        <Text
          textAlign="center"
          fontSize="12px"
          color={T.goldDark}
          letterSpacing={{ base: "4px", md: "12px" }}
          textTransform="uppercase"
          mb="8"
          ml={{ base: "4px", md: "12px" }}
        >
          {t("lobby.subtitle")}
        </Text>

        <Box
          h="1px"
          bg={`linear-gradient(90deg, transparent, ${HEX.border}, transparent)`}
          mb="8"
        />

        {/* ── Token Validation ── */}
        {isCheckingToken && (
          <Flex direction="column" align="center" justify="center" py="10" gap="4" animation={`${entrance} 0.4s ease-out`}>
            <Spinner color={T.gold} size="xl" borderWidth="3px" />
            <Text fontSize="12px" color={T.goldMuted} letterSpacing="2px" textTransform="uppercase">
              {t("lobby.connecting")}
            </Text>
          </Flex>
        )}

        {/* ── Account Auth ── */}
        {(mode === "login" || mode === "register") && !isCheckingToken && (
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
              <Text
                color={T.bloodBright}
                fontSize="12px"
                textAlign="center"
                py="2"
                fontWeight="600"
              >
                {error}
              </Text>
            )}

            <Button
              mt="2"
              w="100%"
              h="50px"
              bg={T.goldDim}
              color={T.darkest}
              type="submit"
              fontFamily={T.display}
              fontWeight="900"
              fontSize="16px"
              letterSpacing="4px"
              textTransform="uppercase"
              transition="all 0.2s"
              _hover={{
                bg: T.gold,
                transform: "translateY(-2px)",
                boxShadow: `0 5px 20px ${HEX.gold}44`,
              }}
              _active={{ transform: "translateY(0)" }}
            >
              {mode === "login" ? t("lobby.login") : t("lobby.register")}
            </Button>

            <Flex justify="center" gap="2" mt="2">
              <Text fontSize="12px" color={T.goldMuted}>
                {mode === "login" ? t("lobby.new_to_arena") : t("lobby.already_combatant")}
              </Text>
              <Text
                fontSize="12px"
                color={T.gold}
                fontWeight="700"
                cursor="pointer"
                borderBottom="1px solid transparent"
                _hover={{ borderBottomColor: T.gold }}
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
            {/* Admin header */}
            {isAdmin && (
              <Flex
                align="center"
                gap="2"
                mb="4"
                px="3"
                py="2"
                bg="rgba(180, 60, 20, 0.12)"
                border="1px solid rgba(180, 60, 20, 0.35)"
                borderRadius="6px"
              >
                <Text fontSize="14px">🛡️</Text>
                <Text fontSize="11px" color="#e07050" letterSpacing="2px" textTransform="uppercase" fontWeight="700">
                  Admin — All Characters
                </Text>
                <Text fontSize="10px" color="rgba(180,90,60,0.7)" ml="auto">
                  {adminCharacters.length} total
                </Text>
              </Flex>
            )}

            <Flex justify="space-between" align="center" mb={isAdmin ? "3" : "5"}>
              <Text {...labelStyle} mb="0">
                {isAdmin ? "Select Character" : t("lobby.choose_champion")}
              </Text>
              {!isAdmin && (
                <Text fontSize="11px" color={T.goldDark}>
                  {t("lobby.characters_count", { count: characters.length, max: MAX_CHARACTERS })}
                </Text>
              )}
            </Flex>

            {/* Admin search bar */}
            {isAdmin && (
              <Box mb="3" position="relative">
                <Box
                  position="absolute"
                  left="10px"
                  top="50%"
                  transform="translateY(-50%)"
                  color={T.goldDark}
                  pointerEvents="none"
                  zIndex={1}
                >
                  <Search size={14} />
                </Box>
                <Input
                  pl="32px"
                  value={charSearch}
                  onChange={(e) => setCharSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  {...inputStyle}
                />
              </Box>
            )}

            {/* Character list */}
            {(isAdmin ? filteredAdminChars.length === 0 : characters.length === 0) ? (
              <Flex direction="column" align="center" justify="center" py="10" gap="3">
                <Text fontSize="32px" opacity="0.4">
                  ⚔️
                </Text>
                <Text fontSize="13px" color={T.goldMuted} textAlign="center">
                  {isAdmin && charSearch ? "No characters match your search." : t("lobby.no_champions")}
                </Text>
              </Flex>
            ) : (
              <Box maxH="400px" overflowY="auto" pr="1" mb="4"
                css={{
                  "&::-webkit-scrollbar": { width: "4px" },
                  "&::-webkit-scrollbar-track": { background: "transparent" },
                  "&::-webkit-scrollbar-thumb": { background: `${HEX.border}`, borderRadius: "2px" },
                }}
              >
                <Grid templateColumns="repeat(1, 1fr)" gap="2">
                  {(isAdmin ? filteredAdminChars : characters).map((char) => {
                    const info = CLASS_INFO[char.class];
                    const adminChar = char as AdminCharacterSummary;
                    const isConfirming = confirmDeleteId === char.id;
                    const isDeleting = deletingCharId === char.id;
                    return (
                      <Box
                        key={char.id}
                        p="3"
                        bg={isConfirming ? "rgba(180, 40, 40, 0.12)" : "rgba(8, 8, 12, 0.4)"}
                        border="1px solid"
                        borderColor={isConfirming ? "rgba(180, 40, 40, 0.4)" : T.border}
                        borderRadius="8px"
                        cursor={isConfirming ? "default" : "pointer"}
                        transition="all 0.2s"
                        onClick={() => !isConfirming && onJoin(char.id, char.class, token)}
                        _hover={
                          isConfirming
                            ? {}
                            : {
                                bg: `${info.color}11`,
                                borderColor: info.color,
                                transform: "translateX(4px)",
                              }
                        }
                      >
                        {isConfirming ? (
                          <Flex align="center" justify="space-between" gap="3">
                            <Text fontSize="13px" color={T.goldText} fontWeight="600">
                              {t("lobby.delete_confirm", { name: char.name })}
                            </Text>
                            <Flex gap="2" flexShrink={0}>
                              <Button
                                size="xs"
                                bg="rgba(180, 40, 40, 0.6)"
                                color="white"
                                fontFamily={T.display}
                                fontWeight="700"
                                fontSize="11px"
                                letterSpacing="1px"
                                loading={isDeleting}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteCharacter(char.id);
                                }}
                                _hover={{ bg: "rgba(200, 40, 40, 0.8)" }}
                              >
                                {t("lobby.delete_yes")}
                              </Button>
                              <Button
                                size="xs"
                                bg="transparent"
                                border="1px solid"
                                borderColor={T.border}
                                color={T.goldMuted}
                                fontFamily={T.display}
                                fontWeight="700"
                                fontSize="11px"
                                letterSpacing="1px"
                                disabled={isDeleting}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(null);
                                }}
                                _hover={{ borderColor: T.goldDim, color: T.goldText }}
                              >
                                {t("lobby.delete_no")}
                              </Button>
                            </Flex>
                          </Flex>
                        ) : (
                        <Flex align="center" gap="3">
                          <Box fontSize="22px" w="32px" textAlign="center" flexShrink={0}>
                            {info.icon}
                          </Box>
                          <Box flex="1" minW={0}>
                            <Flex align="center" gap="2">
                            <Text
                              fontSize="14px"
                              fontWeight="900"
                              color={isAdmin ? "#4ade80" : T.goldText}
                              letterSpacing="1px"
                            >
                              {char.name}
                            </Text>
                            {isAdmin && (
                              <Badge
                                px="1.5"
                                py="0"
                                borderRadius="4px"
                                bg="rgba(74, 222, 128, 0.15)"
                                color="#4ade80"
                                border="1px solid rgba(74, 222, 128, 0.3)"
                                fontSize="10px"
                                fontFamily={T.display}
                                fontWeight="700"
                                flexShrink={0}
                              >
                                🛡️ GM
                              </Badge>
                            )}
                            </Flex>
                            <Flex align="center" gap="2">
                              <Text
                                fontSize="11px"
                                color={T.goldDark}
                                textTransform="uppercase"
                                letterSpacing="1px"
                              >
                                {t(`classes.${char.class}.name`)}
                              </Text>
                              {isAdmin && adminChar.ownerEmail && (
                                <Text fontSize="10px" color="rgba(180,100,60,0.7)" truncate>
                                  · {adminChar.ownerEmail}
                                </Text>
                              )}
                            </Flex>
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
                            fontFamily={T.display}
                            fontWeight="700"
                            flexShrink={0}
                          >
                            {t("sidebar.inventory.level")} {char.level}
                          </Badge>
                          {!isAdmin && (
                            <Box
                              flexShrink={0}
                              color={T.goldDark}
                              opacity={0.4}
                              cursor="pointer"
                              transition="all 0.2s"
                              _hover={{ opacity: 1, color: "#e63946" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(char.id);
                              }}
                            >
                              <Trash2 size={14} />
                            </Box>
                          )}
                        </Flex>
                        )}
                      </Box>
                    );
                  })}
                </Grid>
              </Box>
            )}

            {!isAdmin && (
              <Button
                w="100%"
                h="44px"
                bg={characters.length >= MAX_CHARACTERS ? T.goldDark : "transparent"}
                border="1px solid"
                borderColor={characters.length >= MAX_CHARACTERS ? "transparent" : T.border}
                color={characters.length >= MAX_CHARACTERS ? T.goldDark : T.goldMuted}
                fontFamily={T.display}
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
                  characters.length < MAX_CHARACTERS ? { borderColor: T.gold, color: T.goldText } : {}
                }
              >
                + {t("lobby.new_character")}
              </Button>
            )}

            {connecting && (
              <Text fontSize="11px" color={T.goldMuted} textAlign="center" mt="3">
                {t("lobby.connecting")}
              </Text>
            )}

            <Button
              mt="3"
              bg="transparent"
              variant="ghost"
              w="100%"
              color={T.goldDark}
              fontSize="11px"
              letterSpacing="2px"
              textTransform="uppercase"
              onClick={resetToLogin}
              _hover={{ color: T.goldMuted }}
            >
              {t("lobby.sign_out")}
            </Button>
          </Box>
        )}

        {/* ── Character Create ── */}
        {mode === "character_create" && (
          <Box animation={`${entrance} 0.4s ease-out`}>
            <Flex justify="space-between" align="baseline" mb="5">
              <Text {...labelStyle} mb="0">
                {t("lobby.new_character")}
              </Text>
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
                  color={T.goldDim}
                  onClick={handleRandomName}
                  _hover={{
                    bg: "transparent",
                    color: T.gold,
                    transform: "rotate(15deg) scale(1.1)",
                  }}
                  _active={{ transform: "scale(0.95)" }}
                >
                  <Text fontSize="20px">🎲</Text>
                </IconButton>
              </Flex>
            </Box>

            <Text {...labelStyle} mb="3">
              {t("lobby.select_path")}
            </Text>
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
                    borderColor={sel ? info.color : T.border}
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
                          color={sel ? T.goldText : T.goldMuted}
                          letterSpacing="2px"
                          textTransform="uppercase"
                        >
                          {t(`classes.${cls}.name`)}
                        </Text>
                        <Text fontSize="12px" color={T.goldDark}>
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
                      <Text mt="2" fontSize="11px" color={T.goldText} opacity="0.8" pl="35px">
                        {t(`classes.${cls}.longDesc`)}
                      </Text>
                    )}
                  </Box>
                );
              })}
            </Grid>

            {error && (
              <Text
                color={T.bloodBright}
                fontSize="12px"
                textAlign="center"
                py="2"
                fontWeight="600"
                mb="2"
              >
                {error}
              </Text>
            )}

            <Button
              w="100%"
              h="50px"
              bg={creating ? T.goldDark : T.goldDim}
              color={T.darkest}
              loading={creating}
              onClick={handleCreateCharacter}
              fontFamily={T.display}
              fontWeight="900"
              fontSize="16px"
              letterSpacing="4px"
              textTransform="uppercase"
              _hover={{
                bg: T.gold,
                transform: "translateY(-2px)",
                boxShadow: `0 5px 20px ${HEX.gold}44`,
              }}
            >
              {t("lobby.create_character")}
            </Button>

            <Button
              mt="3"
              bg="transparent"
              variant="ghost"
              w="100%"
              color={T.goldMuted}
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

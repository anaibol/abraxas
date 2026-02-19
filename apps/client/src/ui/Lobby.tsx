import { useState } from "react";
import { 
  Box, Flex, Text, Input, Button, Grid, 
  IconButton, 
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { type ClassType, getRandomName } from "@abraxas/shared";

interface LobbyProps {
  onJoin: (charId: string, classType: ClassType, token: string) => void;
  connecting: boolean;
}

const P = {
  bg: "#0e0c14dd", // Semitransparent for glassmorphism
  surface: "#14111ecc",
  raised: "#1a1628",
  border: "#2e2840",
  gold: "#d4a843",
  goldDim: "#b8962e",
  goldDark: "#6e5a18",
  goldMuted: "#8a7a60",
  goldText: "#c8b68a",
  blood: "#c41e3a",
  font: "'Friz Quadrata', Georgia, serif",
};

const CLASS_TYPES: readonly ClassType[] = [
  "WARRIOR",
  "MAGE",
  "RANGER",
  "ROGUE",
  "CLERIC",
];

const CLASS_INFO: Record<
  ClassType,
  { icon: string; color: string; desc: string; longDesc: string }
> = {
  WARRIOR: { 
    icon: "\u2694\uFE0F", 
    color: "#e63946", 
    desc: "HP:180 STR:25", 
    longDesc: "A master of close-quarters combat with high survivability." 
  },
  MAGE: { 
    icon: "\u2728", 
    color: "#4895ef", 
    desc: "INT:28 Mana:150", 
    longDesc: "Wields destructive arcane power from a distance." 
  },
  RANGER: { 
    icon: "\uD83C\uDFF9", 
    color: "#4caf50", 
    desc: "AGI:26 Range:5", 
    longDesc: "Swift and precise, striking foes before they can react." 
  },
  ROGUE: { 
    icon: "\uD83D\uDDE1\uFE0F", 
    color: "#9d4edd", 
    desc: "AGI:24 SPD:8", 
    longDesc: "A shadowy assassin specializing in speed and critical strikes." 
  },
  CLERIC: { 
    icon: "\uD83D\uDEE1\uFE0F", 
    color: "#ffca3a", 
    desc: "HP:160 STR:20", 
    longDesc: "A holy defender who blends combat with divine protection." 
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

export function Lobby({ onJoin, connecting }: LobbyProps) {
  const [mode, setMode] = useState<"login" | "register" | "class_select">(
    "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [charName, setCharName] = useState("");
  const [classType, setClassType] = useState<ClassType>("WARRIOR");
  const [error, setError] = useState("");

  const [resolvedCharName, setResolvedCharName] = useState("");
  const [resolvedCharId, setResolvedCharId] = useState("");
  const [token, setToken] = useState("");

  const handleAuth = async () => {
    setError("");

    if (mode === "register") {
      const trimmed = charName.trim();
      if (!trimmed) {
        setError("Character name is required");
        return;
      }
      if (!CHAR_NAME_REGEX.test(trimmed)) {
        setError("Each word must start with a capital letter and contain only letters (e.g. Dark Knight)");
        return;
      }
    }

    const url = mode === "login" ? "/api/login" : "/api/register";

    const body =
      mode === "login"
        ? { email, password }
        : {
            email,
            password,
            charName: charName.trim(),
            classType,
          };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Authentication failed");
        return;
      }

      setToken(data.token);
      setResolvedCharId(data.charId ?? "");

      if (mode === "login") {
        const name: string = data.charName ?? "";
        const cls: ClassType = data.classType ?? "WARRIOR";
        setResolvedCharName(name);
        setClassType(cls);
        onJoin(data.charId, cls, data.token);
      } else {
        setResolvedCharName(charName.trim());
        setMode("class_select");
      }
    } catch {
      setError("Network error");
    }
  };

  const handleRandomName = () => {
    setCharName(getRandomName());
  };

  const labelStyle = {
    fontSize: "10px",
    color: P.goldMuted,
    letterSpacing: "2px",
    textTransform: "uppercase" as const,
    mb: "1.5",
    fontWeight: "600",
  };

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
        minW="460px"
        boxShadow={`0 10px 50px rgba(0,0,0,0.8), 0 0 0 1px ${P.border}`}
        fontFamily={P.font}
        position="relative"
        overflow="hidden"
      >
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
          Abraxas
        </Text>
        <Text
          textAlign="center"
          fontSize="12px"
          color={P.goldDark}
          letterSpacing="12px"
          textTransform="uppercase"
          mb="8"
          ml="12px" // To balance the letter spacing
        >
          Arena
        </Text>

        <Box
          h="1px"
          bg={`linear-gradient(90deg, transparent, ${P.border}, transparent)`}
          mb="8"
        />

        {mode !== "class_select" ? (
            <Flex 
              as="form"
              direction="column" 
              gap="4"
              onSubmit={(e) => {
                e.preventDefault();
                handleAuth();
              }}
            >
              <Box>
                <Text {...labelStyle}>Email Address</Text>
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
                <Text {...labelStyle}>Secret Key</Text>
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  {...inputStyle}
                />
              </Box>

              <Box>
                <Text {...labelStyle}>Character Name</Text>
                <Flex gap="2">
                  <Input
                    value={charName}
                    onChange={(e) => setCharName(sanitizeCharName(e.target.value))}
                    onBlur={() => setCharName((n: string) => formatCharName(n))}
                    placeholder="E.g. Valerius the Bold"
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

              {error && (
                <Text color={P.blood} fontSize="12px" textAlign="center" py="2" fontWeight="600">
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
                {mode === "login" ? "Login" : "Register"}
              </Button>

              <Flex justify="center" gap="2" mt="2">
                <Text fontSize="12px" color={P.goldMuted}>
                  {mode === "login" ? "New to the Arena?" : "Already a combatant?"}
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
                  {mode === "login" ? "Create Account" : "Sign In"}
                </Text>
              </Flex>
            </Flex>
        ) : (
          <Box animation={`${entrance} 0.4s ease-out`}>
            <Flex justify="space-between" align="baseline" mb="4">
              <Text {...labelStyle} mb="0">Select Your Path</Text>
              <Text fontSize="12px" color={P.goldText} fontWeight="700">
                {resolvedCharName}
              </Text>
            </Flex>
            
            <Grid templateColumns="repeat(1, 1fr)" gap="3" mb="8">
              {CLASS_TYPES.map((cls) => {
                const sel = classType === cls;
                const info = CLASS_INFO[cls];
                return (
                  <Box
                    key={cls}
                    p="4"
                    bg={sel ? `${info.color}11` : "rgba(8, 8, 12, 0.4)"}
                    border="1px solid"
                    borderColor={sel ? info.color : P.border}
                    borderRadius="8px"
                    cursor="pointer"
                    transition="all 0.2s"
                    onClick={() => setClassType(cls)}
                    _hover={{ 
                      bg: sel ? `${info.color}22` : "rgba(20, 17, 30, 0.6)",
                      transform: "translateX(4px)"
                    }}
                    role="group"
                  >
                    <Flex align="center" gap="4">
                      <Box 
                        fontSize="28px" 
                        filter={sel ? "none" : "grayscale(100%)"}
                        transition="all 0.3s"
                      >
                        {info.icon}
                      </Box>
                      <Box flex="1">
                        <Text
                          fontSize="14px"
                          fontWeight="900"
                          color={sel ? P.goldText : P.goldMuted}
                          letterSpacing="2px"
                          textTransform="uppercase"
                        >
                          {cls}
                        </Text>
                        <Text fontSize="11px" color={P.goldDark}>
                          {info.desc}
                        </Text>
                      </Box>
                      {sel && (
                        <Box boxSize="8px" bg={info.color} borderRadius="full" boxShadow={`0 0 10px ${info.color}`} />
                      )}
                    </Flex>
                    {sel && (
                      <Text mt="2" fontSize="12px" color={P.goldText} opacity="0.8">
                        {info.longDesc}
                      </Text>
                    )}
                  </Box>
                );
              })}
            </Grid>

            <Button
              w="100%"
              h="50px"
              bg={connecting ? P.goldDark : P.goldDim}
              color="#08080c"
              loading={connecting}
              onClick={() => onJoin(resolvedCharId, classType, token)}
              fontFamily={P.font}
              fontWeight="900"
              fontSize="16px"
              letterSpacing="4px"
              textTransform="uppercase"
              _hover={{ bg: P.gold, transform: "translateY(-2px)", boxShadow: `0 5px 20px ${P.gold}44` }}
            >
              Enter Arena
            </Button>
            
            <Button
              mt="3"
              bg="transparent"
              variant="ghost"
              w="100%"
              color={P.goldMuted}
              fontSize="12px"
              onClick={() => setMode("register")}
            >
              Go Back
            </Button>
          </Box>
        )}
      </Box>
    </Flex>
  );
}

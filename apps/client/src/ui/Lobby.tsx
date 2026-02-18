import { useState } from "react";
import { Box, Flex, Text, Input, Button, Grid } from "@chakra-ui/react";
import type { ClassType } from "@abraxas/shared";

interface LobbyProps {
  onJoin: (name: string, classType: ClassType, token: string) => void;
  connecting: boolean;
}

const P = {
  bg: "#0e0c14",
  surface: "#14111e",
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

const CLASS_TYPES: readonly ClassType[] = ["warrior", "wizard", "archer", "assassin", "paladin", "druid"];

const CLASS_INFO: Record<ClassType, { icon: string; color: string; desc: string }> = {
  warrior:  { icon: "\u2694\uFE0F", color: "#c41e3a", desc: "HP:180 STR:25" },
  wizard:   { icon: "\u2728",   color: "#3355cc", desc: "INT:28 Mana:150" },
  archer:   { icon: "\uD83C\uDFF9", color: "#33aa44", desc: "AGI:26 Range:5" },
  assassin: { icon: "\uD83D\uDDE1\uFE0F", color: "#9944cc", desc: "AGI:24 SPD:8" },
  paladin:  { icon: "\uD83D\uDEE1\uFE0F", color: "#d4a843", desc: "HP:160 STR:20" },
  druid:    { icon: "\uD83C\uDF3F", color: "#886633", desc: "INT:24 Mana:130" },
};

export function Lobby({ onJoin, connecting }: LobbyProps) {
  const [mode, setMode] = useState<"login" | "register" | "class_select">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [classType, setClassType] = useState<ClassType>("warrior");
  const [error, setError] = useState("");

  const handleAuth = async () => {
    setError("");
    const url = mode === "login" ? "/api/login" : "/api/register";
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setMode("class_select");
      } else {
        setError(data.error || "Authentication failed");
      }
    } catch (e) {
      setError("Network error");
    }
  };

  return (
    <Flex pos="fixed" inset="0" align="center" justify="center" bg="rgba(4,4,8,0.96)" zIndex="100">
      <Box
        bg={P.bg}
        border="2px solid"
        borderColor={P.gold}
        borderRadius="4px"
        p="10"
        minW="420px"
        boxShadow={`0 0 60px rgba(180,140,50,0.12), inset 0 0 40px rgba(0,0,0,0.5)`}
        fontFamily={P.font}
      >
        <Text textAlign="center" fontSize="32px" fontWeight="700" color={P.gold} letterSpacing="6px" textShadow="0 0 24px rgba(180,140,50,0.35)" mb="0.5">
          Abraxas
        </Text>
        <Text textAlign="center" fontSize="11px" color={P.goldDark} letterSpacing="8px" textTransform="uppercase" mb="7">
          Arena
        </Text>
        <Box h="1px" bg={`linear-gradient(90deg, transparent, ${P.gold}, transparent)`} mb="7" />

        {mode !== "class_select" ? (
          <>
            <Text fontSize="10px" color={P.goldMuted} letterSpacing="2px" textTransform="uppercase" mb="1.5">Username</Text>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={16}
              bg="#08080c"
              border="1px solid"
              borderColor={P.border}
              borderRadius="2px"
              color={P.goldText}
              fontFamily={P.font}
              fontSize="14px"
              p="2.5"
              mb="4"
              outline="none"
              _focus={{ borderColor: P.gold }}
            />

            <Text fontSize="10px" color={P.goldMuted} letterSpacing="2px" textTransform="uppercase" mb="1.5">Password</Text>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              bg="#08080c"
              border="1px solid"
              borderColor={P.border}
              borderRadius="2px"
              color={P.goldText}
              fontFamily={P.font}
              fontSize="14px"
              p="2.5"
              mb="5"
              outline="none"
              _focus={{ borderColor: P.gold }}
            />

            {error && <Text color={P.blood} fontSize="11px" mb="4" textAlign="center">{error}</Text>}

            <Button
              w="100%"
              mb="4"
              bg={P.goldDim}
              color="#08080c"
              onClick={handleAuth}
              fontFamily={P.font}
              fontWeight="700"
              fontSize="13px"
              letterSpacing="3px"
              textTransform="uppercase"
              _hover={{ bg: P.gold }}
            >
              {mode === "login" ? "Login" : "Register"}
            </Button>

            <Text
              textAlign="center"
              fontSize="11px"
              color={P.goldDark}
              cursor="pointer"
              _hover={{ color: P.goldText }}
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "Need an account? Register" : "Have an account? Login"}
            </Text>
          </>
        ) : (
          <>
            <Text fontSize="10px" color={P.goldMuted} letterSpacing="2px" textTransform="uppercase" mb="2">Select Class</Text>
            <Grid templateColumns="repeat(3, 1fr)" gap="2.5" mb="7">
              {CLASS_TYPES.map((cls) => {
                const sel = classType === cls;
                const info = CLASS_INFO[cls];
                return (
                  <Box
                    key={cls}
                    textAlign="center"
                    p="3"
                    bg={sel ? P.raised : "#08080c"}
                    border="1px solid"
                    borderColor={sel ? info.color : P.border}
                    borderRadius="2px"
                    cursor="pointer"
                    transition="all 0.15s"
                    onClick={() => setClassType(cls)}
                    _hover={{ bg: P.raised }}
                  >
                    <Text fontSize="24px" mb="1">{info.icon}</Text>
                    <Text fontSize="9px" fontWeight="700" color={sel ? P.goldText : P.goldMuted}>{cls.toUpperCase()}</Text>
                    <Text fontSize="8px" color={P.goldDark}>{info.desc}</Text>
                  </Box>
                );
              })}
            </Grid>

            <Button
              w="100%"
              bg={connecting ? P.goldDark : P.goldDim}
              color="#08080c"
              disabled={connecting}
              onClick={() => onJoin(username, classType, token)}
              fontFamily={P.font}
              fontWeight="700"
              fontSize="13px"
              letterSpacing="3px"
              textTransform="uppercase"
              _hover={{ bg: P.gold }}
            >
              {connecting ? "Connecting..." : "Enter Arena"}
            </Button>
          </>
        )}
      </Box>
    </Flex>
  );
}

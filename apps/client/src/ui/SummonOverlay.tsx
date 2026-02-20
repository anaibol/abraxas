import { NPC_TYPES } from "@abraxas/shared";
import { Box, HStack, SimpleGrid, Text } from "@chakra-ui/react";
import { useState, useEffect, useRef } from "react";
import { Button } from "./components/Button";
import { T } from "./tokens";

interface SummonOverlayProps {
  onSummon: (npcType: string) => void;
  onClose: () => void;
}

export function SummonOverlay({ onSummon, onClose }: SummonOverlayProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the search input on mount
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const filtered = NPC_TYPES.filter((type) =>
    type.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <Box
      pos="fixed"
      inset="0"
      bg="rgba(0,0,0,0.6)"
      zIndex="400"
      display="flex"
      alignItems="center"
      justifyContent="center"
      onClick={onClose}
    >
      <Box
        layerStyle={T.panelGlass}
        animation="popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards"
        p={{ base: "4", md: "6" }}
        w={{ base: "calc(100vw - 32px)", md: "560px" }}
        maxH="80dvh"
        display="flex"
        flexDirection="column"
        fontFamily={T.display}
        onClick={(e) => e.stopPropagation()}
      >
        <HStack justify="space-between" mb="4">
          <Text fontSize="xl" fontWeight="bold" color={T.goldText} textShadow="1px 1px 0 #000">
            Summon Creature
          </Text>
          <Button
            size="sm"
            variant="ghost"
            color="#ff4444"
            onClick={onClose}
            _hover={{ bg: "rgba(255,0,0,0.2)" }}
          >
            ✕
          </Button>
        </HStack>

        <Box mb="4">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search creatures..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              background: "rgba(0,0,0,0.5)",
              border: `1px solid ${T.borderLight}`,
              padding: "10px 12px",
              color: "white",
              borderRadius: "4px",
              outline: "none",
            }}
          />
        </Box>

        <Box overflowY="auto" flex="1" pr="2">
          <SimpleGrid columns={{ base: 2, md: 3 }} gap="3">
            {filtered.map((type) => (
              <Button
                key={type}
                size="sm"
                bg={T.surface}
                color={T.gold}
                border="1px solid"
                borderColor="transparent"
                _hover={{
                  borderColor: T.gold,
                  bg: T.darkest,
                  transform: "translateY(-1px) scale(1.02)",
                }}
                onClick={() => {
                  onSummon(type);
                  onClose();
                }}
              >
                {type.replace(/_/g, " ")}
              </Button>
            ))}
          </SimpleGrid>

          {filtered.length === 0 && (
            <Text color="#888" textAlign="center" py="6">
              No creatures found.
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
}

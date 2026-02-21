import { NPC_TYPES } from "@abraxas/shared";
import { Box, SimpleGrid, Text } from "@chakra-ui/react";
import { useState, useEffect, useRef } from "react";
import { Button } from "./components/Button";
import { ModalOverlay } from "./components/ModalOverlay";
import { PanelHeader } from "./components/PanelHeader";
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
    <ModalOverlay
      zIndex={400}
      onClose={onClose}
      panelProps={{
        p: { base: "4", md: "6" },
        w: { base: "calc(100vw - 32px)", md: "560px" },
        maxH: "80dvh",
        display: "flex",
        flexDirection: "column",
      }}
    >
        <PanelHeader title="Summon Creature" onClose={onClose} />

        <Box mb="4">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search creatures..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              height: "32px",
              lineHeight: "32px",
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: "2px",
              color: T.goldText,
              fontFamily: "var(--chakra-fonts-mono)",
              fontSize: "14px",
              padding: "0 8px",
              outline: "none",
              boxSizing: "border-box",
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
      </ModalOverlay>
  );
}

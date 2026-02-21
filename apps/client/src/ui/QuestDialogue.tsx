import { Box, Text, VStack } from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAudio } from "../contexts/AudioContext";
import { Button } from "./components/Button";
import { ModalOverlay } from "./components/ModalOverlay";
import { T } from "./tokens";

interface DialogueOption {
  text: string;
  action: string;
  data?: unknown;
}

interface QuestDialogueProps {
  npcId: string;
  text: string;
  options: DialogueOption[];
  onAction: (action: string, data?: unknown) => void;
  onClose: () => void;
}

export function QuestDialogue({ npcId, text, options, onAction, onClose }: QuestDialogueProps) {
  const { t } = useTranslation();
  const { playQuestAccept, playQuestComplete, playUIClick, playUIHover } = useAudio();

  // Local state so hint responses can replace the displayed text
  const [displayText, setDisplayText] = useState(text);
  const [displayOptions, setDisplayOptions] = useState(options);

  return (
    <ModalOverlay
      onClose={onClose}
      panelProps={{
        w: { base: "calc(100vw - 32px)", md: "450px" },
        bg: T.bg,
        border: "1px solid",
        borderColor: T.border,
        boxShadow: "0 0 30px rgba(0,0,0,0.8)",
        borderRadius: "4px",
        overflow: "hidden",
        layerStyle: undefined,
      }}
    >
        {/* Header */}
        <Box bg={T.surface} px="4" py="2" borderBottom="2px solid" borderColor={T.border}>
          <Text
            color={T.gold}
            fontWeight="700"
            textStyle={T.heading}
            textTransform="uppercase"
          >
            {t("npcs." + npcId)}
          </Text>
        </Box>

        {/* Body */}
        <Box p="6">
          {/* NPC speech */}
          <Text color="whiteAlpha.800" fontSize="14px" mb="4" fontStyle="italic">
            &ldquo;{displayText}&rdquo;
          </Text>

          <VStack align="stretch" gap="2">
            {displayOptions.map((opt, i) => (
              <Button
                key={i}
                disableSound={true}
                onMouseEnter={() => playUIHover?.()}
                variant="outline"
                borderColor={T.goldDark}
                color={T.gold}
                _hover={{ bg: T.surface, borderColor: T.gold }}
                onClick={() => {
                  if (opt.action === "quest_accept") {
                    playQuestAccept?.();
                  } else if (opt.action === "quest_complete") {
                    playQuestComplete?.();
                  } else {
                    playUIClick?.();
                  }

                  if (opt.action === "close") {
                    onClose();
                  } else if (opt.action === "hint") {
                    // Show the NPC response text in-place, swap to Goodbye only
                    const response = (opt.data as { response?: string })?.response;
                    if (response) {
                      setDisplayText(t(response));
                      setDisplayOptions([{ text: t("ui.dialogue.goodbye"), action: "close" }]);
                    } else {
                      onClose();
                    }
                  } else {
                    onAction(opt.action, opt.data);
                    onClose();
                  }
                }}
                justifyContent="flex-start"
                h="auto"
                py="3"
                px="4"
                fontSize="14px"
                textAlign="left"
                whiteSpace="normal"
              >
                {opt.text}
              </Button>
            ))}
          </VStack>
        </Box>
    </ModalOverlay>
  );
}


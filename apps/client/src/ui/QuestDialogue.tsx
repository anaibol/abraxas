import { Box, Flex, Text, VStack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useAudio } from "../contexts/AudioContext";
import { Button } from "./components/Button";
import { T } from "./tokens";

interface DialogueOption {
  text: string;
  action: string;
  data?: unknown;
}

interface QuestDialogueProps {
  npcId: string;
  npcType: string;
  text: string;
  options: DialogueOption[];
  onAction: (action: string, data?: unknown) => void;
  onClose: () => void;
}

export function QuestDialogue({ npcId: _npcId, npcType, text, options, onAction, onClose }: QuestDialogueProps) {
  const { t } = useTranslation();
  const { playQuestAccept, playQuestComplete, playUIClick, playUIHover } = useAudio();
  return (
    <Flex
      pos="fixed"
      inset="0"
      align="center"
      justify="center"
      bg="rgba(0,0,0,0.7)"
      zIndex={200}
      fontFamily={T.display}
    >
      <Box
        w={{ base: "calc(100vw - 32px)", md: "450px" }}
        bg={T.bg}
        border="1px solid"
        borderColor={T.border}
        boxShadow="0 0 30px rgba(0,0,0,0.8)"
        borderRadius="4px"
        overflow="hidden"
      >
        {/* Header */}
        <Box bg={T.surface} px="4" py="2" borderBottom="2px solid" borderColor={T.border}>
          <Text
            color={T.gold}
            fontWeight="bold"
            fontSize="18px"
            textTransform="uppercase"
            letterSpacing="2px"
          >
            {t("npcs." + npcType)}
          </Text>
        </Box>

        {/* Body */}
        <Box p="6">
          <Text color="white" fontSize="15px" lineHeight="1.6" mb="6">
            {text}
          </Text>

          <VStack align="stretch" gap="2">
            {options.map((opt, i) => (
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
      </Box>
    </Flex>
  );
}

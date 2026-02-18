import { Box, Flex, Text, Button, VStack } from "@chakra-ui/react";

interface DialogueOption {
    text: string;
    action: string;
    data?: any;
}

interface QuestDialogueProps {
    npcId: string;
    text: string;
    options: DialogueOption[];
    onAction: (action: string, data?: any) => void;
    onClose: () => void;
}

const COLORS = {
  bg: "#0e0c14",
  surface: "#14111e",
  border: "#2e2840",
  gold: "#d4a843",
  goldDark: "#6e5a18",
  font: "'Friz Quadrata', Georgia, serif",
};

export function QuestDialogue({ npcId, text, options, onAction, onClose }: QuestDialogueProps) {
    return (
        <Flex
            pos="fixed"
            inset="0"
            align="center"
            justify="center"
            bg="rgba(0,0,0,0.7)"
            zIndex={200}
            fontFamily={COLORS.font}
        >
            <Box
                w="450px"
                bg={COLORS.bg}
                border="3px solid"
                borderColor={COLORS.border}
                boxShadow="0 0 30px rgba(0,0,0,0.8)"
                borderRadius="4px"
                overflow="hidden"
            >
                {/* Header */}
                <Box bg={COLORS.surface} px="4" py="2" borderBottom="2px solid" borderColor={COLORS.border}>
                    <Text color={COLORS.gold} fontWeight="bold" fontSize="18px" textTransform="uppercase" letterSpacing="2px">
                        {npcId.replace(/_/g, " ")}
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
                                variant="outline"
                                borderColor={COLORS.goldDark}
                                color={COLORS.gold}
                                _hover={{ bg: COLORS.surface, borderColor: COLORS.gold }}
                                onClick={() => {
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

import { Box, Flex, Text, VStack } from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAudio } from "../contexts/AudioContext";
import { T } from "./tokens";

export type NpcContextTarget = {
  sessionId: string;
  name: string;
  type: string;
  screenX: number;
  screenY: number;
};

type NpcContextMenuProps = {
  target: NpcContextTarget;
  onTame?: (sessionId: string) => void;
  onClose: () => void;
};

export function NpcContextMenu({ target, onTame, onClose }: NpcContextMenuProps) {
  const { t } = useTranslation();
  const { playUIClick, playUIHover } = useAudio();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && e.target instanceof Node && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const TAMEABLE_TYPES = ["horse", "elephant", "dragon", "bear"];

  const actions = [];
  if (TAMEABLE_TYPES.includes(target.type) && onTame) {
    actions.push({
      label: t("context_menu.tame", "Tame"),
      color: "#ffaa33",
      onClick: () => {
        onTame(target.sessionId);
        onClose();
      },
    });
  }

  // If no actions, close immediately.
  // This effect must be at the top level to respect React rules-of-hooks.
  useEffect(() => {
    if (actions.length === 0) onClose();
  }, [actions.length, onClose]);

  if (actions.length === 0) return null;

  const MENU_W = 160;
  const MENU_H = actions.length * 32 + 44;
  const left = Math.min(target.screenX, window.innerWidth - MENU_W - 8);
  const top = Math.min(target.screenY, window.innerHeight - MENU_H - 8);

  return (
    <Box
      ref={menuRef}
      position="fixed"
      left={`${left}px`}
      top={`${top}px`}
      zIndex={300}
      bg="rgba(8, 6, 18, 0.96)"
      border="1px solid"
      borderColor={T.border}
      borderRadius="4px"
      boxShadow="0 4px 24px rgba(0,0,0,0.8)"
      fontFamily={T.display}
      minW={`${MENU_W}px`}
      overflow="hidden"
      animation="fadeIn 0.1s ease-out"
    >
      <Flex
        bg={T.surface}
        px="3"
        py="2"
        borderBottom="1px solid"
        borderBottomColor={T.border}
        align="center"
        gap="2"
      >
        <Box w="6px" h="6px" borderRadius="full" bg="yellow.400" flexShrink={0} />
        <Text fontSize="13px" fontWeight="700" color={T.gold} letterSpacing="1px">
          {target.name}
        </Text>
      </Flex>
      <VStack align="stretch" gap="0" py="1">
        {actions.map((action) => (
          <Box
            key={action.label}
            px="3"
            py="1.5"
            cursor="pointer"
            color={action.color}
            fontSize="12px"
            fontWeight="600"
            letterSpacing="0.5px"
            transition="all 0.1s"
            _hover={{ bg: T.raised }}
            onMouseEnter={() => playUIHover?.()}
            onClick={() => {
              playUIClick?.();
              action.onClick();
            }}
          >
            {action.label}
          </Box>
        ))}
      </VStack>
    </Box>
  );
}

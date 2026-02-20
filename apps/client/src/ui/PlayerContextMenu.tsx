import { useEffect, useRef } from "react";
import { Box, Flex, Text, VStack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { T } from "./tokens";

export type PlayerContextTarget = {
  sessionId: string;
  name: string;
  screenX: number;
  screenY: number;
};

type PlayerContextMenuProps = {
  target: PlayerContextTarget;
  onWhisper: (name: string) => void;
  onFriendRequest: (sessionId: string, name: string) => void;
  onGroupInvite: (sessionId: string) => void;
  onTradeRequest: (sessionId: string) => void;
  onClose: () => void;
  onGMTeleportTo?: (sessionId: string) => void;
};

export function PlayerContextMenu({
  target,
  onWhisper,
  onFriendRequest,
  onGroupInvite,
  onTradeRequest,
  onClose,
  onGMTeleportTo,
}: PlayerContextMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
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

  // Keep menu within viewport
  const MENU_W = 180;
  const baseActions = 4;
  const gmActions = onGMTeleportTo ? 1 : 0;
  const MENU_H = (baseActions + gmActions) * 32 + 44; // 32px per action row + 44px header
  const left = Math.min(target.screenX, window.innerWidth - MENU_W - 8);
  const top = Math.min(target.screenY, window.innerHeight - MENU_H - 8);

  const actions = [
    {
      label: t("context_menu.whisper"),
      color: "#cc88ff",
      onClick: () => { onWhisper(target.name); onClose(); },
    },
    {
      label: t("context_menu.add_friend"),
      color: T.gold,
      onClick: () => { onFriendRequest(target.sessionId, target.name); onClose(); },
    },
    {
      label: t("context_menu.group_invite"),
      color: "#88aaff",
      onClick: () => { onGroupInvite(target.sessionId); onClose(); },
    },
    {
      label: t("context_menu.trade"),
      color: "#88ffcc",
      onClick: () => { onTradeRequest(target.sessionId); onClose(); },
    },
    ...(onGMTeleportTo
      ? [{
          label: "⬡ Teleport to",
          color: "#ffaa33",
          onClick: () => { onGMTeleportTo(target.sessionId); onClose(); },
        }]
      : []),
  ];

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
      {/* Header */}
      <Flex
        bg={T.surface}
        px="3"
        py="2"
        borderBottom="1px solid"
        borderBottomColor={T.border}
        align="center"
        gap="2"
      >
        <Box w="6px" h="6px" borderRadius="full" bg="green.400" flexShrink={0} />
        <Text fontSize="13px" fontWeight="700" color={T.gold} letterSpacing="1px">
          {target.name}
        </Text>
      </Flex>

      {/* Actions */}
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
            onClick={action.onClick}
          >
            {action.label}
          </Box>
        ))}
      </VStack>
    </Box>
  );
}

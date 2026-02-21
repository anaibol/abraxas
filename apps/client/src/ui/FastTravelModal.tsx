import { type FC } from "react";
import type { FastTravelWaypoint } from "@abraxas/shared";
import { Box, Flex, Text, VStack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useAudio } from "../contexts/AudioContext";
import { HEX, T } from "./tokens";

interface FastTravelModalProps {
  waypoints: FastTravelWaypoint[];
  currentMapName: string;
  onTravel: (waypointId: string) => void;
  onClose: () => void;
}

export const FastTravelModal: FC<FastTravelModalProps> = ({
  waypoints,
  currentMapName,
  onTravel,
  onClose,
}) => {
  const { t } = useTranslation();
  const { playUIClick, playUIHover } = useAudio();

  return (
    <Flex
      pos="fixed"
      inset="0"
      zIndex={70}
      align="center"
      justify="center"
      bg="rgba(0,0,0,0.65)"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Box
        bg={T.bg}
        border="1px solid"
        borderColor={T.border}
        borderRadius="4px"
        p="7"
        minW="320px"
        maxW="420px"
        boxShadow="0 8px 48px rgba(0,0,0,0.85)"
        fontFamily={T.display}
        animation="popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <Flex align="center" justify="space-between" mb="5">
          <Box>
            <Text
              color={T.gold}
              fontWeight="bold"
              fontSize="15px"
              letterSpacing="3px"
              textTransform="uppercase"
              textShadow={`0 0 8px ${HEX.goldDark}`}
            >
              ✦ {t("fast_travel.title", "Fast Travel")}
            </Text>
            <Text color={T.goldDark} fontSize="11px" mt="0.5">
              {currentMapName}
            </Text>
          </Box>
          <Box
            as="button"
            bg="transparent"
            border="none"
            color={T.goldDark}
            fontSize="20px"
            cursor="pointer"
            p="1"
            lineHeight="1"
            _hover={{ color: T.gold }}
            onClick={onClose}
          >
            ✕
          </Box>
        </Flex>

        {/* Waypoint list */}
        {waypoints.length === 0 ? (
          <Text
            color={T.goldDark}
            textAlign="center"
            fontSize="13px"
            py="4"
            fontStyle="italic"
          >
            {t("fast_travel.no_waypoints", "No waypoints discovered on this map.")}
          </Text>
        ) : (
          <VStack align="stretch" gap="2.5">
            {waypoints.map((wp) => (
              <Flex
                key={wp.id}
                as="button"
                bg={T.darkest}
                border="1px solid"
                borderColor={T.border}
                borderRadius="4px"
                p="3"
                cursor="pointer"
                align="center"
                gap="3"
                transition="all 0.15s ease"
                color={T.goldText}
                fontSize="14px"
                fontWeight="500"
                textAlign="left"
                w="100%"
                fontFamily={T.display}
                _hover={{ borderColor: T.gold, bg: T.surface }}
                onMouseEnter={() => playUIHover?.()}
                onClick={() => {
                  playUIClick?.();
                  onTravel(wp.id);
                  onClose();
                }}
              >
                <Text fontSize="20px" flexShrink={0}>🌀</Text>
                <Box>
                  <Text fontSize="13px" fontWeight="700" color={T.goldText}>
                    {wp.label}
                  </Text>
                  <Text fontSize="11px" color={T.goldDark} mt="0.5">
                    ({wp.x}, {wp.y})
                  </Text>
                </Box>
              </Flex>
            ))}
          </VStack>
        )}

        <Text
          mt="5"
          color={T.goldDark}
          fontSize="11px"
          textAlign="center"
          letterSpacing="1px"
        >
          {t("fast_travel.esc_hint", "Press ESC to close")}
        </Text>
      </Box>
    </Flex>
  );
};

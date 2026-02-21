import { Box, Flex, Text } from "@chakra-ui/react";
import { X } from "lucide-react";
import { HEX, T } from "../tokens";

type PanelHeaderProps = {
  /** Title text displayed in gold uppercase */
  title: string;
  /** Optional subtitle displayed below the title */
  subtitle?: string;
  /** Called when the close button is clicked */
  onClose: () => void;
};

/**
 * Standardised panel header with a gold title and a close (✕) button.
 * Includes the gold gradient divider below.
 */
export function PanelHeader({ title, subtitle, onClose }: PanelHeaderProps) {
  return (
    <>
      <Flex align="center" justify="space-between" px="5" py="3.5" borderBottom="1px solid" borderBottomColor={T.border} bg={T.darkest}>
        <Box>
          <Text
            fontFamily={T.display}
            fontSize="15px"
            fontWeight="700"
            letterSpacing="3px"
            textTransform="uppercase"
            color={T.gold}
            textShadow={`0 0 10px ${HEX.goldDark}`}
          >
            {title}
          </Text>
          {subtitle && (
            <Text color={T.goldDark} fontSize="11px" letterSpacing="2px" textTransform="uppercase" mt="0.5">
              {subtitle}
            </Text>
          )}
        </Box>
        <Box
          w="28px"
          h="28px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          color={T.goldDark}
          cursor="pointer"
          borderRadius="4px"
          _hover={{ color: T.gold, bg: T.raised }}
          onClick={onClose}
        >
          <X size={16} />
        </Box>
      </Flex>
      <GoldDivider />
    </>
  );
}

/**
 * A thin horizontal gold gradient line, used as a section separator.
 */
export function GoldDivider() {
  return <Box h="1px" bg={`linear-gradient(90deg, transparent, ${HEX.gold}, transparent)`} />;
}

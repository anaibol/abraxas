import { Box, type BoxProps } from "@chakra-ui/react";
import type React from "react";
import { T } from "../tokens";

type ModalOverlayProps = {
  /** z-index of the overlay, default 200 */
  zIndex?: number;
  /** Called when the backdrop (not the panel) is clicked */
  onClose?: () => void;
  /** Props forwarded to the inner panel Box */
  panelProps?: BoxProps;
  children: React.ReactNode;
};

/**
 * Full-screen backdrop with a centered `panelGlass` panel.
 * Click outside the panel → `onClose`.
 */
export function ModalOverlay({ zIndex = 200, onClose, panelProps, children }: ModalOverlayProps) {
  return (
    <Box
      pos="fixed"
      inset="0"
      zIndex={zIndex}
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="rgba(0,0,0,0.65)"
      onClick={onClose}
    >
      <Box
        layerStyle={T.panelGlass}
        animation="popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards"
        fontFamily={T.display}
        onClick={(e) => e.stopPropagation()}
        {...panelProps}
      >
        {children}
      </Box>
    </Box>
  );
}

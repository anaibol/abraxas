import { Box, Flex } from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ModalOverlay } from "./components/ModalOverlay";
import { HEX, T } from "./tokens";

interface DropQuantityDialogProps {
  itemName: string;
  maxQty: number;
  onConfirm: (qty: number) => void;
  onCancel: () => void;
}

export function DropQuantityDialog({
  itemName,
  maxQty,
  onConfirm,
  onCancel,
}: DropQuantityDialogProps) {
  const { t } = useTranslation();
  const [qty, setQty] = useState(maxQty);
  const clamp = (n: number) => Math.min(Math.max(1, n), maxQty);
  const confirm = () => onConfirm(clamp(qty));

  return (
    <ModalOverlay
      onClose={onCancel}
      panelProps={{
        bg: T.bg,
        border: "1px solid",
        borderColor: T.border,
        borderRadius: "4px",
        p: "5",
        w: "260px",
        layerStyle: undefined,
      }}
    >
        <Box textStyle={T.sectionLabel} color={T.gold} mb="1" textAlign="center" fontSize="18px">
          {t("drop_dialog.title")}
        </Box>
        <Box textStyle={T.bodyText} color={T.goldText} textAlign="center" mb="3">
          {itemName}
        </Box>

        <Box mb="3">
          <Box
            textStyle={T.statLabel}
            color={T.goldDark}
            letterSpacing="2px"
            mb="1"
            fontSize="14px"
          >
            {t("drop_dialog.quantity", { max: maxQty })}
          </Box>
          <input
            // biome-ignore lint/a11y/noAutofocus: dialog input needs immediate focus for keyboard shortcuts
            autoFocus
            type="number"
            min={1}
            max={maxQty}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
              if (e.key === "Enter") {
                e.preventDefault();
                confirm();
              }
            }}
            style={{
              width: "100%",
              height: "32px",
              lineHeight: "32px",
              background: HEX.surface,
              border: `1px solid ${HEX.border}`,
              borderRadius: "2px",
              color: HEX.goldText,
              fontFamily: "var(--chakra-fonts-mono)",
              fontSize: "14px",
              padding: "0 8px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </Box>

        <Flex gap="2">
          <Box
            as="button"
            flex="1"
            py="1.5"
            textStyle={T.bodyText}
            fontWeight="700"
            letterSpacing="1px"
            bg={T.raised}
            border="1px solid"
            borderColor={T.border}
            borderRadius="2px"
            color={T.goldText}
            cursor="pointer"
            fontFamily={T.display}
            onClick={onCancel}
            fontSize="14px"
          >
            {t("drop_dialog.cancel")}
          </Box>
          <Box
            as="button"
            flex="1"
            py="1.5"
            textStyle={T.bodyText}
            fontWeight="700"
            letterSpacing="1px"
            bg={T.goldDark}
            border="1px solid"
            borderColor={T.gold}
            borderRadius="2px"
            color={T.gold}
            cursor="pointer"
            fontFamily={T.display}
            onClick={confirm}
            fontSize="14px"
          >
            {t("drop_dialog.drop")}
          </Box>
        </Flex>
    </ModalOverlay>
  );
}

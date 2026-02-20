import { CLASS_STATS } from "@abraxas/shared";
import { Box, Flex, Text } from "@chakra-ui/react";
import { LogOut, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HEX, T } from "../tokens";
import type { PlayerState } from "./types";

type SidebarFooterProps = {
  state: PlayerState;
  onSettings?: () => void;
  onLogout?: () => void;
};

export function SidebarFooter({ state, onSettings, onLogout }: SidebarFooterProps) {
  const { t } = useTranslation();
  const hpPct = state.maxHp > 0 ? Math.max(0, (state.hp / state.maxHp) * 100) : 0;
  const manaPct = state.maxMana > 0 ? Math.max(0, (state.mana / state.maxMana) * 100) : 0;
  const hpColor = hpPct > 50 ? T.blood : hpPct > 25 ? "#8b5a1a" : "#5a0e0e";
  const stats = CLASS_STATS[state.classType];

  return (
    <Box mt="auto" flexShrink={0} borderTop="2px solid" borderTopColor={T.border} bg={T.darkest}>
      <Box h="1px" bg={`linear-gradient(90deg, transparent, ${HEX.gold}, transparent)`} />
      <Flex
        justify="space-around"
        py="2.5"
        px="3"
        borderBottom="1px solid"
        borderBottomColor={T.raised}
      >
        <StatChip label={t("sidebar.stats.str")} value={state.str ?? stats?.str ?? 0} />
        <StatChip label={t("sidebar.stats.agi")} value={state.agi ?? stats?.agi ?? 0} />
        <StatChip label={t("sidebar.stats.int")} value={state.intStat ?? stats?.int ?? 0} />
      </Flex>

      {/* HP bar */}
      <Box px="3.5" pt="2.5" pb="1">
        <Text
          textStyle={T.statLabel}
          color={T.goldDark}
          textAlign="center"
          letterSpacing="3px"
          mb="0.5"
        >
          {t("status.health")}
        </Text>
        <Box
          pos="relative"
          h="22px"
          bg="#0a0810"
          border="1px solid"
          borderColor={T.border}
          borderRadius="2px"
          overflow="hidden"
        >
          <Box h="100%" w={`${hpPct}%`} bg={hpColor} transition="width 0.2s" />
          <Flex
            pos="absolute"
            inset="0"
            align="center"
            justify="center"
            textStyle={T.codeText}
            fontWeight="700"
            color="#fff"
            textShadow="1px 1px 3px #000"
          >
            {state.hp}/{state.maxHp}
          </Flex>
        </Box>
      </Box>

      {/* Mana bar */}
      <Box px="3.5" pt="1.5" pb="2">
        <Text
          textStyle={T.statLabel}
          color={T.goldDark}
          textAlign="center"
          letterSpacing="3px"
          mb="0.5"
        >
          {t("status.mana")}
        </Text>
        <Box
          pos="relative"
          h="22px"
          bg="#080818"
          border="1px solid"
          borderColor={T.border}
          borderRadius="2px"
          overflow="hidden"
        >
          <Box h="100%" w={`${manaPct}%`} bg={T.arcane} transition="width 0.2s" />
          <Flex
            pos="absolute"
            inset="0"
            align="center"
            justify="center"
            textStyle={T.codeText}
            fontWeight="700"
            color="#fff"
            textShadow="1px 1px 3px #000"
          >
            {state.mana}/{state.maxMana}
          </Flex>
        </Box>
      </Box>

      {/* Settings + Logout row */}
      <Flex borderTop="1px solid" borderTopColor={T.border} px="2" py="2" gap="2">
        <FooterButton
          icon={<Settings size={14} />}
          label={t("sidebar.settings")}
          onClick={onSettings}
        />
        <FooterButton
          icon={<LogOut size={14} />}
          label={t("sidebar.logout")}
          onClick={onLogout}
          danger
        />
      </Flex>
    </Box>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <Box textAlign="center">
      <Text textStyle={T.statLabel} color={T.goldDark} letterSpacing="1px">
        {label}
      </Text>
      <Text fontSize="20px" fontWeight="700" color={T.gold} mt="0.5">
        {value}
      </Text>
    </Box>
  );
}

type FooterButtonProps = {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  danger?: boolean;
};

function FooterButton({ icon, label, onClick, danger }: FooterButtonProps) {
  return (
    <Flex
      flex="1"
      align="center"
      justify="center"
      gap="1.5"
      py="1.5"
      px="2"
      borderRadius="6px"
      border="1px solid"
      borderColor={danger ? "rgba(180,30,30,0.4)" : T.border}
      bg={danger ? "rgba(140,20,20,0.15)" : T.raised}
      color={danger ? "#c05050" : T.goldDark}
      cursor="pointer"
      fontFamily={T.display}
      fontSize="10px"
      fontWeight="700"
      letterSpacing="0.5px"
      textTransform="uppercase"
      transition="all 0.12s"
      _hover={{
        borderColor: danger ? "rgba(200,40,40,0.7)" : T.gold,
        color: danger ? "#e06060" : T.gold,
        bg: danger ? "rgba(160,30,30,0.25)" : T.surface,
      }}
      onClick={onClick}
    >
      {icon}
      {label}
    </Flex>
  );
}

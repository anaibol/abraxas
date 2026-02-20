import { Box, Flex, Text } from "@chakra-ui/react";
import { Languages, Map as MapIcon, Music, Volume2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGameSettings } from "../hooks/useGameSettings";
import { HEX, T } from "./tokens";

const LANGUAGES: { code: string; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
];

type SettingsModalProps = {
  onClose: () => void;
};

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { t, i18n } = useTranslation();
  const { settings, updateSettings } = useGameSettings();

  return (
    <>
      <style>{`
        .abraxas-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${HEX.gold};
          border: 2px solid ${HEX.goldDark};
          cursor: pointer;
        }
        .abraxas-range::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${HEX.gold};
          border: 2px solid ${HEX.goldDark};
          cursor: pointer;
          border-style: solid;
        }
      `}</style>
      <Box
        pos="fixed"
        inset="0"
        zIndex={200}
        display="flex"
        alignItems="center"
        justifyContent="center"
        bg="rgba(0,0,0,0.65)"
        backdropFilter="blur(4px)"
        onClick={onClose}
      >
        <Box
          layerStyle={T.panelGlass}
          animation="popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards"
          w={{ base: "calc(100vw - 32px)", md: "420px" }}
          overflow="hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <Flex
            align="center"
            justify="space-between"
            px="5"
            py="3.5"
            borderBottom="1px solid"
            borderBottomColor={T.border}
            bg={T.darkest}
          >
            <Text
              fontFamily={T.display}
              fontSize="15px"
              fontWeight="700"
              letterSpacing="2px"
              textTransform="uppercase"
              color={T.gold}
            >
              {t("settings.title")}
            </Text>
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

          {/* Gold separator */}
          <Box h="1px" bg={`linear-gradient(90deg, transparent, ${HEX.gold}, transparent)`} />

          {/* Body */}
          <Box px="5" py="5" display="flex" flexDirection="column" gap="6">
            {/* Section: Audio */}
            <Box>
              <Text
                textStyle={T.sectionLabel}
                color={T.goldDark}
                letterSpacing="2px"
                mb="4"
                fontSize="10px"
                textTransform="uppercase"
              >
                {t("settings.section.audio")}
              </Text>

              <Flex direction="column" gap="5">
                {/* Music volume */}
                <VolumeSetting
                  icon={<Music size={15} />}
                  label={t("settings.music_volume")}
                  value={settings.musicVolume}
                  onChange={(v) => updateSettings({ musicVolume: v })}
                />

                {/* SFX volume */}
                <VolumeSetting
                  icon={<Volume2 size={15} />}
                  label={t("settings.sfx_volume")}
                  value={settings.sfxVolume}
                  onChange={(v) => updateSettings({ sfxVolume: v })}
                />
              </Flex>
            </Box>

            {/* Divider */}
            <Box h="1px" bg={T.border} />

            {/* Section: Language */}
            <Box>
              <Flex align="center" gap="2" mb="3">
                <Box color={T.goldDark}>
                  <Languages size={13} />
                </Box>
                <Text
                  textStyle={T.sectionLabel}
                  color={T.goldDark}
                  letterSpacing="2px"
                  fontSize="10px"
                  textTransform="uppercase"
                >
                  {t("settings.section.language")}
                </Text>
              </Flex>

              <Flex gap="2" flexWrap="wrap">
                {LANGUAGES.map(({ code, label, flag }) => {
                  const isActive = i18n.language === code || i18n.language.startsWith(code);
                  return (
                    <Box
                      key={code}
                      as="button"
                      px="3"
                      py="1.5"
                      borderRadius="6px"
                      border="1px solid"
                      borderColor={isActive ? T.gold : T.border}
                      bg={isActive ? T.surface : T.raised}
                      color={isActive ? T.gold : T.goldDark}
                      fontFamily={T.display}
                      fontSize="11px"
                      fontWeight="700"
                      letterSpacing="0.5px"
                      cursor="pointer"
                      transition="all 0.12s"
                      _hover={{ borderColor: T.gold, color: T.goldText }}
                      onClick={() => {
                        i18n.changeLanguage(code);
                        localStorage.setItem("abraxas_lang", code);
                      }}
                    >
                      {flag} {label}
                    </Box>
                  );
                })}
              </Flex>
            </Box>

            {/* Divider */}
            <Box h="1px" bg={T.border} />

            {/* Section: Interface */}
            <Box>
              <Text
                textStyle={T.sectionLabel}
                color={T.goldDark}
                letterSpacing="2px"
                mb="4"
                fontSize="10px"
                textTransform="uppercase"
              >
                {t("settings.section.interface")}
              </Text>

              <Flex direction="column" gap="4">
                {/* Show minimap */}
                <ToggleSetting
                  icon={<MapIcon size={15} />}
                  label={t("settings.show_minimap")}
                  value={settings.showMinimap}
                  onChange={(v) => updateSettings({ showMinimap: v })}
                />
              </Flex>
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

type VolumeSettingProps = {
  icon: React.ReactNode;
  label: string;
  value: number;
  onChange: (v: number) => void;
};

function VolumeSetting({ icon, label, value, onChange }: VolumeSettingProps) {
  const pct = Math.round(value * 100);

  return (
    <Flex direction="column" gap="2">
      <Flex align="center" justify="space-between">
        <Flex align="center" gap="2" color={T.goldText}>
          <Box color={T.goldDark}>{icon}</Box>
          <Text fontFamily={T.display} fontSize="12px" fontWeight="600" letterSpacing="0.5px">
            {label}
          </Text>
        </Flex>
        <Text
          fontFamily="mono"
          fontSize="11px"
          color={T.gold}
          fontWeight="700"
          minW="34px"
          textAlign="right"
        >
          {pct}%
        </Text>
      </Flex>

      {/* Slider track */}
      <Box pos="relative" h="20px" display="flex" alignItems="center" w="100%">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={pct}
          onChange={(e) => onChange(parseInt(e.target.value, 10) / 100)}
          className="abraxas-range"
          style={{
            width: "100%",
            height: "4px",
            cursor: "pointer",
            appearance: "none",
            WebkitAppearance: "none",
            background: `linear-gradient(to right, ${HEX.gold} 0%, ${HEX.gold} ${pct}%, ${HEX.raised} ${pct}%, ${HEX.raised} 100%)`,
            borderRadius: "2px",
            outline: "none",
            border: "none",
          }}
        />
      </Box>
    </Flex>
  );
}

type ToggleSettingProps = {
  icon: React.ReactNode;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
};

function ToggleSetting({ icon, label, value, onChange }: ToggleSettingProps) {
  return (
    <Flex align="center" justify="space-between" cursor="pointer" onClick={() => onChange(!value)}>
      <Flex align="center" gap="2" color={T.goldText}>
        <Box color={T.goldDark}>{icon}</Box>
        <Text fontFamily={T.display} fontSize="12px" fontWeight="600" letterSpacing="0.5px">
          {label}
        </Text>
      </Flex>

      {/* Toggle pill */}
      <Box
        w="40px"
        h="20px"
        borderRadius="10px"
        bg={value ? T.gold : T.raised}
        border="1px solid"
        borderColor={value ? T.gold : T.border}
        pos="relative"
        transition="all 0.18s"
        flexShrink={0}
      >
        <Box
          pos="absolute"
          top="2px"
          left={value ? "22px" : "2px"}
          w="14px"
          h="14px"
          borderRadius="50%"
          bg={value ? T.darkest : T.goldDark}
          transition="left 0.18s"
        />
      </Box>
    </Flex>
  );
}

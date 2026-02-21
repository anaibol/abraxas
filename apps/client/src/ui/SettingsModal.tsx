import { Box, Flex, Text } from "@chakra-ui/react";
import { Bug, Camera, Languages, Map as MapIcon, Music, Sparkles, Volume2, VolumeX, Waves, Wind } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useGameSettings } from "../hooks/useGameSettings";
import type { ParticleQuality } from "../settings/gameSettings";
import { ModalOverlay } from "./components/ModalOverlay";
import { PanelHeader } from "./components/PanelHeader";
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
      <ModalOverlay
        onClose={onClose}
        panelProps={{
          w: { base: "calc(100vw - 32px)", md: "420px" },
          maxH: "90dvh",
          overflowY: "auto",
        }}
      >
          <PanelHeader title={t("settings.title")} onClose={onClose} />

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

                {/* Ambiance volume (item 79) */}
                <VolumeSetting
                  icon={<Wind size={15} />}
                  label={t("settings.ambiance_volume", "Ambiance Volume")}
                  value={settings.ambianceVolume}
                  onChange={(v) => updateSettings({ ambianceVolume: v })}
                />

                {/* UI volume (item 79) */}
                <VolumeSetting
                  icon={<Waves size={15} />}
                  label={t("settings.ui_volume", "UI Volume")}
                  value={settings.uiVolume}
                  onChange={(v) => updateSettings({ uiVolume: v })}
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

            {/* Section: Visual (items 81‑83) */}
            <Box>
              <Text
                textStyle={T.sectionLabel}
                color={T.goldDark}
                letterSpacing="2px"
                mb="4"
                fontSize="10px"
                textTransform="uppercase"
              >
                {t("settings.section.visual", "Visual")}
              </Text>

              <Flex direction="column" gap="4">
                {/* Screen Shake toggle (item 82) */}
                <ToggleSetting
                  icon={<Camera size={15} />}
                  label={t("settings.screen_shake", "Screen Shake")}
                  value={settings.screenShakeEnabled}
                  onChange={(v) => updateSettings({ screenShakeEnabled: v })}
                />

                {/* Screen Shake intensity slider, only visible when enabled */}
                {settings.screenShakeEnabled && (
                  <VolumeSetting
                    icon={<Camera size={15} />}
                    label={t("settings.shake_intensity", "Shake Intensity")}
                    value={settings.screenShakeIntensity}
                    onChange={(v) => updateSettings({ screenShakeIntensity: v })}
                  />
                )}

                {/* Bloom / glow toggle (item 83) */}
                <ToggleSetting
                  icon={<Sparkles size={15} />}
                  label={t("settings.bloom", "Bloom / Glow")}
                  value={settings.bloomEnabled}
                  onChange={(v) => updateSettings({ bloomEnabled: v })}
                />

                {/* Particle quality (item 81) */}
                <ParticleQualitySelector
                  value={settings.particleQuality}
                  onChange={(v) => updateSettings({ particleQuality: v })}
                />
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

                {/* Debug overlay (FPS, object counts, etc.) — toggle with F3 */}
                <ToggleSetting
                  icon={<Bug size={15} />}
                  label={t("settings.show_debug_overlay", "Debug Overlay (F3)")}
                  value={settings.showDebugOverlay}
                  onChange={(v) => updateSettings({ showDebugOverlay: v })}
                />
              </Flex>
            </Box>
          </Box>
        </ModalOverlay>
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
  const prevRef = useRef(value || 0.5);
  const isMuted = value === 0;

  // Keep the ref updated when user drags the slider to a non-zero value
  if (value > 0) prevRef.current = value;

  const toggleMute = () => {
    if (isMuted) {
      onChange(prevRef.current || 0.5);
    } else {
      onChange(0);
    }
  };

  return (
    <Flex direction="column" gap="2">
      <Flex align="center" justify="space-between">
        <Flex align="center" gap="2" color={isMuted ? T.goldDark : T.goldText}>
          <Box
            color={isMuted ? T.goldDark : T.goldDark}
            cursor="pointer"
            onClick={toggleMute}
            _hover={{ color: T.gold }}
            transition="color 0.12s"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX size={15} /> : icon}
          </Box>
          <Text
            fontFamily={T.display}
            fontSize="12px"
            fontWeight="600"
            letterSpacing="0.5px"
            textDecoration={isMuted ? "line-through" : "none"}
            opacity={isMuted ? 0.5 : 1}
          >
            {label}
          </Text>
        </Flex>
        <Text
          fontFamily={T.mono}
          fontSize="11px"
          color={isMuted ? T.goldDark : T.gold}
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

// ── ParticleQualitySelector ───────────────────────────────────────────────────

type ParticleQualitySelectorProps = {
  value: ParticleQuality;
  onChange: (v: ParticleQuality) => void;
};

const QUALITY_OPTIONS: { key: ParticleQuality; label: string }[] = [
  { key: "low",    label: "Low" },
  { key: "medium", label: "Med" },
  { key: "high",   label: "High" },
];

function ParticleQualitySelector({ value, onChange }: ParticleQualitySelectorProps) {
  const { t } = useTranslation();
  return (
    <Flex align="center" justify="space-between">
      <Flex align="center" gap="2" color={T.goldText}>
        <Box color={T.goldDark}><Sparkles size={15} /></Box>
        <Text fontFamily={T.display} fontSize="12px" fontWeight="600" letterSpacing="0.5px">
          {t("settings.particle_quality", "Particle Quality")}
        </Text>
      </Flex>
      <Flex gap="1">
        {QUALITY_OPTIONS.map(({ key, label }) => {
          const active = value === key;
          return (
            <Box
              key={key}
              as="button"
              px="2.5"
              py="1"
              borderRadius="5px"
              border="1px solid"
              borderColor={active ? T.gold : T.border}
              bg={active ? T.surface : T.raised}
              color={active ? T.gold : T.goldDark}
              fontFamily={T.display}
              fontSize="10px"
              fontWeight="700"
              cursor="pointer"
              transition="all 0.12s"
              _hover={{ borderColor: T.gold, color: T.goldText }}
              onClick={() => onChange(key)}
            >
              {label}
            </Box>
          );
        })}
      </Flex>
    </Flex>
  );
}

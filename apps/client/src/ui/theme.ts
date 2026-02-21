import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const customConfig = defineConfig({
  globalCss: {
    "html, body, #root": {
      height: "100%",
      width: "100%",
      margin: 0,
      padding: 0,
      overflow: "hidden",
      background: "#08080c",
    },
  },
  theme: {
    tokens: {
      animations: {
        pulse: { value: "pulse 1s infinite" },
      },
      colors: {
        game: {
          bg: { value: "#0e0c14" },
          surface: { value: "#14111e" },
          raised: { value: "#1a1628" },
          darkest: { value: "#08080c" },
          border: { value: "#2e2840" },
          borderLight: { value: "#3e3555" },
          gold: { value: "#d4a843" },
          goldDim: { value: "#b8962e" },
          goldDark: { value: "#6e5a18" },
          goldText: { value: "#c8b68a" },
          goldMuted: { value: "#8a7a60" },
          blood: { value: "#8b1a1a" },
          bloodBright: { value: "#c41e3a" },
          arcane: { value: "#1e3a8a" },
        },
      },
      fonts: {
        display: { value: "'Friz Quadrata', Georgia, serif" },
        mono: { value: "'Consolas', monospace" },
      },
      shadows: {
        deepBox: { value: "0 20px 60px rgba(0, 0, 0, 0.95), inset 0 0 40px rgba(212, 168, 67, 0.05)" },
        goldGlow: { value: "0 0 15px var(--chakra-colors-game-goldDark)" },
        subtleInset: { value: "inset 0 2px 10px rgba(0, 0, 0, 0.5)" },
      },
    },
    keyframes: {
      pulse: {
        "0%, 100%": { opacity: "1", transform: "scale(1)" },
        "50%": { opacity: "0.5", transform: "scale(1.2)" },
      },
      popIn: {
        "0%": { opacity: "0", transform: "translate(-50%, -48%) scale(0.96)" },
        "100%": { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
      },
      fadeIn: {
        "0%": { opacity: "0" },
        "100%": { opacity: "1" },
      },
    },
    textStyles: {
      // Section / panel titles — small uppercase gold labels
      sectionLabel: {
        value: {
          fontFamily: "display",
          fontSize: "11px",
          fontWeight: "700",
          letterSpacing: "3px",
          textTransform: "uppercase",
        },
      },
      // Form / sidebar section labels
      formLabel: {
        value: {
          fontFamily: "display",
          fontSize: "12px",
          fontWeight: "600",
          letterSpacing: "2px",
          textTransform: "uppercase",
        },
      },
      // Stat bar captions (HEALTH, MANA, STR…)
      statLabel: {
        value: {
          fontFamily: "display",
          fontSize: "11px",
          letterSpacing: "1px",
          textTransform: "uppercase",
        },
      },
      // Standard readable body copy
      bodyText: {
        value: {
          fontFamily: "display",
          fontSize: "13px",
        },
      },
      // Dimmer secondary body copy
      bodyMuted: {
        value: {
          fontFamily: "display",
          fontSize: "12px",
        },
      },
      // Tab bar labels (INV / SPELLS / ALL / GROUP…)
      tabLabel: {
        value: {
          fontFamily: "display",
          fontSize: "12px",
          fontWeight: "700",
          letterSpacing: "1px",
          textTransform: "uppercase",
        },
      },
      // Numeric / monospaced values (HP 120/200, 500g…)
      codeText: {
        value: {
          fontFamily: "mono",
          fontSize: "13px",
        },
      },
      // Tiny badges — spell keybind, effect type labels
      badgeText: {
        value: {
          fontFamily: "mono",
          fontSize: "10px",
          fontWeight: "700",
        },
      },
    },
    layerStyles: {
      // Darkest inset panel (inventory slots, stat rows)
      panel: {
        value: {
          background: "var(--chakra-colors-game-darkest)",
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: "var(--chakra-colors-game-border)",
          borderRadius: "2px",
        },
      },
      // Surface-level panel (spell cards, form areas)
      panelSurface: {
        value: {
          background: "var(--chakra-colors-game-surface)",
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: "var(--chakra-colors-game-border)",
          borderRadius: "2px",
        },
      },
      // Raised panel (selected items, active states)
      panelRaised: {
        value: {
          background: "var(--chakra-colors-game-raised)",
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: "var(--chakra-colors-game-border)",
          borderRadius: "2px",
        },
      },
      // List rows with built-in padding
      rowItem: {
        value: {
          padding: "8px",
          background: "var(--chakra-colors-game-darkest)",
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: "var(--chakra-colors-game-border)",
          borderRadius: "2px",
        },
      },
      // Tiny inline badges (keybind key caps, effect type)
      goldBadge: {
        value: {
          paddingInline: "4px",
          paddingBlock: "2px",
          background: "var(--chakra-colors-game-raised)",
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: "var(--chakra-colors-game-border)",
          borderRadius: "2px",
        },
      },
      // Raw glass panel for Modals and Windows
      panelGlass: {
        value: {
          background: "rgba(12, 10, 18, 0.75)",
          backdropFilter: "blur(16px)",
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: "var(--chakra-colors-game-border)",
          borderRadius: "4px",
          boxShadow: "var(--chakra-shadows-deepBox)",
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, customConfig);

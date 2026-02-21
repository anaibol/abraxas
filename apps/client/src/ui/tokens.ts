/**
 * Design system token names and raw hex values.
 *
 * T  — Chakra token names/paths. Use in Chakra JSX props:
 *        <Box bg={T.bg} color={T.gold} fontFamily={T.display} textStyle={T.sectionLabel} layerStyle={T.panel} />
 *
 * HEX — Raw hex strings. Use only in template literals, CSS functions,
 *        or other non-Chakra contexts where a token path won't work:
 *        boxShadow={`0 0 20px ${HEX.goldDark}22`}
 */

export const T = {
  // ─── Color token paths ────────────────────────────────────────────────────
  bg: "game.bg",
  surface: "game.surface",
  raised: "game.raised",
  darkest: "game.darkest",
  border: "game.border",
  borderLight: "game.borderLight",
  gold: "game.gold",
  goldDim: "game.goldDim",
  goldDark: "game.goldDark",
  goldText: "game.goldText",
  goldMuted: "game.goldMuted",
  blood: "game.blood",
  bloodBright: "game.bloodBright",
  arcane: "game.arcane",

  // ─── Font token names ─────────────────────────────────────────────────────
  display: "display",
  mono: "mono",

  // ─── textStyle names ──────────────────────────────────────────────────────
  sectionLabel: "sectionLabel",
  formLabel: "formLabel",
  statLabel: "statLabel",
  bodyText: "bodyText",
  bodyMuted: "bodyMuted",
  heading: "heading",
  headingLg: "headingLg",
  tabLabel: "tabLabel",
  codeText: "codeText",
  badgeText: "badgeText",

  // ─── layerStyle names ─────────────────────────────────────────────────────
  panel: "panel",
  panelSurface: "panelSurface",
  panelRaised: "panelRaised",
  panelGlass: "panelGlass",
  rowItem: "rowItem",
  goldBadge: "goldBadge",
} as const;

// Raw font family strings — for Phaser text styles and inline `style` objects
export const FONTS = {
  display: "'Friz Quadrata', Georgia, serif",
  mono: "'Consolas', monospace",
} as const;

// Raw hex values — only for string interpolation and non-Chakra CSS contexts
export const HEX = {
  bg: "#0e0c14",
  surface: "#14111e",
  raised: "#1a1628",
  darkest: "#08080c",
  border: "#2e2840",
  borderLight: "#3e3555",
  gold: "#d4a843",
  goldDim: "#b8962e",
  goldDark: "#6e5a18",
  goldText: "#c8b68a",
  goldMuted: "#8a7a60",
  blood: "#8b1a1a",
  bloodBright: "#c41e3a",
  arcane: "#1e3a8a",
} as const;

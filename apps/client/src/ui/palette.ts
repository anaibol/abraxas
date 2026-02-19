/**
 * Shared design tokens for all game UI components.
 * Import this instead of declaring a local `const P = { ... }` in each file.
 */
export const P = {
  // Backgrounds
  bg: "#0e0c14",
  surface: "#14111e",
  raised: "#1a1628",
  darkest: "#08080c",

  // Borders
  border: "#2e2840",
  borderLight: "#3e3555",

  // Gold / text
  gold: "#d4a843",
  goldDim: "#b8962e",
  goldDark: "#6e5a18",
  goldText: "#c8b68a",
  goldMuted: "#8a7a60",

  // Status
  blood: "#8b1a1a",
  bloodBright: "#c41e3a",
  arcane: "#1e3a8a",

  // Fonts
  font: "'Friz Quadrata', Georgia, serif",
  mono: "'Consolas', monospace",
} as const;

const lightColors = {
  "color.bg": "#FCFBF9",
  "color.surface": "#FFFFFF",
  "color.surface2": "#F5F2EC",
  "color.border": "#E9E4DD",
  "color.border.strong": "#D7CFC2",
  "color.fg": "#1A1714",
  "color.fg2": "#4C4741",
  "color.fg3": "#8A837A",
  "color.accent": "#E85526",
  "color.accent.hover": "#D3470F",
  "color.accent.soft": "#FFE7DD",
  "color.accent.contrast": "#FFFFFF",
  "color.success": "#2E9A5E",
  "color.success.soft": "#E3F4EA",
  "color.warning": "#C98A10",
  "color.warning.soft": "#FBF0D7",
  "color.danger": "#C4361E",
  "color.danger.soft": "#FBE4E0",
  "color.chip.auto.bg": "#EEF5FF",
  "color.chip.auto.fg": "#1D4E89",
  "color.chip.manual.bg": "#F2EEE8",
  "color.chip.manual.fg": "#59503F",
  // Overlay scrim behind modal sheets. Light theme uses a softer tint so
  // the underlying UI stays partially visible; dark theme bumps opacity.
  "color.scrim": "rgba(0,0,0,0.32)",
  // Shadow color used by Card + Sheet. Light mode picks a dark-brown tint
  // consistent with the brand palette; dark mode uses pure black so the
  // shadow reads against the deep background.
  "color.shadow": "#110D09",
} as const;

const darkColors = {
  "color.bg": "#0E0E0D",
  "color.surface": "#1A1917",
  "color.surface2": "#242320",
  "color.border": "#2A2824",
  "color.border.strong": "#3B3833",
  "color.fg": "#F2EFEA",
  "color.fg2": "#B8B1A6",
  "color.fg3": "#7A7368",
  "color.accent": "#F36433",
  "color.accent.hover": "#E85526",
  "color.accent.soft": "#3A1E14",
  "color.accent.contrast": "#FFFFFF",
  "color.success": "#2E9A5E",
  "color.success.soft": "#13321F",
  "color.warning": "#F5B041",
  "color.warning.soft": "#3A2B0C",
  "color.danger": "#F87171",
  "color.danger.soft": "#3A1812",
  "color.chip.auto.bg": "#13243A",
  "color.chip.auto.fg": "#8FB6E6",
  "color.chip.manual.bg": "#2A2620",
  "color.chip.manual.fg": "#B8B1A6",
  "color.scrim": "rgba(0,0,0,0.5)",
  "color.shadow": "#000000",
} as const;

export type ColorTokenKey = keyof typeof lightColors;

// Place colors users can choose from. 8 swatches, each WCAG AA vs both
// surface colors (light + dark).
export const PLACE_COLORS = [
  "#FF6A3D",
  "#2E9A5E",
  "#1D7FD1",
  "#9C46C2",
  "#C98A10",
  "#C4361E",
  "#4C4741",
  "#17867F",
] as const;

export const tokens = {
  light: lightColors,
  dark: darkColors,
  type: {
    // Type scale: 11/13/15/17/20/24/32. Never render text below 11px.
    size: { xs: 11, s: 13, body: 15, m: 17, l: 20, xl: 24, display: 32 },
    weight: { regular: "400", medium: "500", semibold: "600", bold: "700" },
    lineHeight: { tight: 1.15, snug: 1.3, body: 1.5 },
    family: {
      // Loaded via @expo-google-fonts/inter + @expo-google-fonts/jetbrains-mono in _layout.
      sans: "Inter",
      mono: "JetBrainsMono",
    },
    tabularNums: { fontVariant: ["tabular-nums" as const] },
  },
  // 4px grid per design system
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 14: 56 },
  radius: { sm: 6, md: 12, lg: 20, pill: 9999 },
  motion: {
    duration: { fast: 120, base: 200, slow: 320 },
    easing: "cubic-bezier(0.2, 0, 0, 1)",
    easingIos: "cubic-bezier(0.32, 0.72, 0, 1)",
  },
  minTouchTarget: 44,
} as const;

export type Tokens = typeof tokens;

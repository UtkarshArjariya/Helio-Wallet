import { HELIO_THEME_TOKENS } from "@helio/ui";

export const theme = {
  colors: {
    background: HELIO_THEME_TOKENS.colors.background,
    backgroundCanvas: HELIO_THEME_TOKENS.colors.backgroundCanvas,
    surfaceLowest: HELIO_THEME_TOKENS.colors.surfaceLowest,
    surfaceLow: HELIO_THEME_TOKENS.colors.surfaceLow,
    surface: HELIO_THEME_TOKENS.colors.surfaceMid,
    surfaceHigh: HELIO_THEME_TOKENS.colors.surfaceHigh,
    surfaceHighest: HELIO_THEME_TOKENS.colors.surfaceHighest,
    card: HELIO_THEME_TOKENS.colors.backgroundGlass,
    cardStrong: "rgba(49, 53, 63, 0.92)",
    textPrimary: HELIO_THEME_TOKENS.colors.textPrimary,
    textSecondary: HELIO_THEME_TOKENS.colors.textSecondary,
    textMuted: HELIO_THEME_TOKENS.colors.textMuted,
    accent: HELIO_THEME_TOKENS.colors.accentPrimary,
    accentSoft: HELIO_THEME_TOKENS.colors.accentPrimarySoft,
    accentMuted: HELIO_THEME_TOKENS.colors.accentSecondary,
    accentSecondarySoft: HELIO_THEME_TOKENS.colors.accentSecondarySoft,
    positive: HELIO_THEME_TOKENS.colors.success,
    warning: HELIO_THEME_TOKENS.colors.warning,
    danger: HELIO_THEME_TOKENS.colors.danger,
    stroke: HELIO_THEME_TOKENS.colors.borderSubtle,
    ghostStroke: HELIO_THEME_TOKENS.colors.borderGhost,
  },
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 28,
    xxl: 36,
    xxxl: 48,
  },
  radius: {
    sm: 10,
    md: HELIO_THEME_TOKENS.radii.button,
    lg: HELIO_THEME_TOKENS.radii.card,
    xl: HELIO_THEME_TOKENS.radii.sheet,
    pill: 999,
  },
  typography: HELIO_THEME_TOKENS.typography,
} as const;

export type Theme = typeof theme;

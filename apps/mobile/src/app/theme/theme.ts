import { HELIO_THEME_TOKENS } from "@helio/ui";

export const theme = {
  colors: {
    background: HELIO_THEME_TOKENS.colors.background,
    surface: HELIO_THEME_TOKENS.colors.backgroundElevated,
    card: HELIO_THEME_TOKENS.colors.backgroundGlass,
    textPrimary: HELIO_THEME_TOKENS.colors.textPrimary,
    textSecondary: HELIO_THEME_TOKENS.colors.textSecondary,
    accent: HELIO_THEME_TOKENS.colors.accentPrimary,
    accentMuted: HELIO_THEME_TOKENS.colors.accentSecondary,
    positive: HELIO_THEME_TOKENS.colors.success,
    warning: HELIO_THEME_TOKENS.colors.warning,
    danger: HELIO_THEME_TOKENS.colors.danger,
    stroke: HELIO_THEME_TOKENS.colors.borderSubtle,
  },
  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 28,
    xxl: 36,
  },
  radius: {
    sm: 10,
    md: HELIO_THEME_TOKENS.radii.button,
    lg: HELIO_THEME_TOKENS.radii.card,
    pill: 999,
  },
} as const;

export type Theme = typeof theme;

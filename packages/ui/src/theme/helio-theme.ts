export interface HelioThemeTokens {
  readonly colors: {
    readonly background: string;
    readonly backgroundElevated: string;
    readonly backgroundGlass: string;
    readonly textPrimary: string;
    readonly textSecondary: string;
    readonly textMuted: string;
    readonly borderSubtle: string;
    readonly accentPrimary: string;
    readonly accentSecondary: string;
    readonly success: string;
    readonly warning: string;
    readonly danger: string;
  };
  readonly radii: {
    readonly card: number;
    readonly button: number;
    readonly sheet: number;
  };
  readonly typography: {
    readonly display: string;
    readonly body: string;
    readonly mono: string;
  };
}

export const HELIO_THEME_TOKENS: HelioThemeTokens = {
  colors: {
    background: "#0A0E17",
    backgroundElevated: "#181B25",
    backgroundGlass: "rgba(49, 53, 63, 0.76)",
    textPrimary: "#DFE2EF",
    textSecondary: "#CCC3D7",
    textMuted: "#958DA1",
    borderSubtle: "rgba(74, 68, 85, 0.3)",
    accentPrimary: "#6D28D9",
    accentSecondary: "#4CD7F6",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
  },
  radii: {
    card: 20,
    button: 12,
    sheet: 24,
  },
  typography: {
    display: "Manrope",
    body: "Inter",
    mono: "Space Grotesk",
  },
};

export interface HelioThemeTokens {
  readonly colors: {
    readonly background: string;
    readonly backgroundCanvas: string;
    readonly surfaceLowest: string;
    readonly surfaceLow: string;
    readonly surfaceMid: string;
    readonly surfaceHigh: string;
    readonly surfaceHighest: string;
    readonly backgroundElevated: string;
    readonly backgroundGlass: string;
    readonly textPrimary: string;
    readonly textSecondary: string;
    readonly textMuted: string;
    readonly borderSubtle: string;
    readonly borderGhost: string;
    readonly accentPrimary: string;
    readonly accentPrimarySoft: string;
    readonly accentSecondary: string;
    readonly accentSecondarySoft: string;
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
    background: "#0F131C",
    backgroundCanvas: "#0A0E17",
    surfaceLowest: "#0A0E17",
    surfaceLow: "#181B25",
    surfaceMid: "#1C1F29",
    surfaceHigh: "#262A34",
    surfaceHighest: "#31353F",
    backgroundElevated: "#181B25",
    backgroundGlass: "rgba(49, 53, 63, 0.76)",
    textPrimary: "#DFE2EF",
    textSecondary: "#CCC3D7",
    textMuted: "#958DA1",
    borderSubtle: "rgba(74, 68, 85, 0.3)",
    borderGhost: "rgba(149, 141, 161, 0.15)",
    accentPrimary: "#6D28D9",
    accentPrimarySoft: "#D3BBFF",
    accentSecondary: "#4CD7F6",
    accentSecondarySoft: "#ACEDFF",
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

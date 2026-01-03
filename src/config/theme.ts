export type ThemeName = "themeA" | "themeB";

export const themes = {
  themeA: {
    name: "Modern editorial",
    colors: {
      background: "#faf6f1",
      surface: "#ffffff",
      ink: "#111827",
      muted: "#475569",
      accent: "#1f2f76",
      accent2: "#c48a1c",
      border: "#e6e0d7",
      shadow: "rgba(17,24,39,0.12)"
    },
    fonts: {
      heading: "'Cormorant Garamond', serif",
      body: "'Inter', system-ui, -apple-system, sans-serif"
    }
  },
  themeB: {
    name: "Night gallery",
    colors: {
      background: "#0f172a",
      surface: "#111827",
      ink: "#f8fafc",
      muted: "#cbd5e1",
      accent: "#0ea5e9",
      accent2: "#f59e0b",
      border: "#1f2937",
      shadow: "rgba(0,0,0,0.4)"
    },
    fonts: {
      heading: "'Cormorant Garamond', serif",
      body: "'Inter', system-ui, -apple-system, sans-serif"
    }
  }
} as const;

export const activeTheme: ThemeName = "themeA";

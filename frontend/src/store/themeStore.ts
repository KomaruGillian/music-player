interface ThemeState {
  preset: "light" | "dark" | "custom";
  accentColor: string | null;
  bgColor: string | null;
  cardColor: string | null;
  textColor: string | null;
  isPremium: boolean;
  setTheme: (theme: Partial<ThemeState>) => void;
}

const defaultDark = {
  preset: "dark" as const,
  accentColor: "#fc3c44",
  bgColor: "#0a0a0a",
  cardColor: "#1a1a1a",
  textColor: "#ffffff",
  isPremium: false,
};

export const themeStore: ThemeState = {
  ...defaultDark,
  setTheme: (theme) => Object.assign(themeStore, theme),
};

export function getThemeCSS(): Record<string, string> {
  const t = themeStore;
  return {
    "--accent": t.accentColor || "#fc3c44",
    "--bg": t.bgColor || (t.preset === "light" ? "#f5f5f7" : "#0a0a0a"),
    "--card": t.cardColor || (t.preset === "light" ? "#ffffff" : "#1a1a1a"),
    "--text": t.textColor || (t.preset === "light" ? "#1d1d1f" : "#ffffff"),
    "--text-secondary": t.preset === "light" ? "#6e6e73" : "#a1a1a6",
  };
}

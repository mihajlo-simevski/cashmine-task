import { DefaultTheme, type Theme } from "expo-router";

// Web only: navigation colours point at the CSS variables in global.css, so they
// follow light/dark mode on their own and stay in one place.
export const NAV_THEME: Theme = {
  ...DefaultTheme,
  colors: {
    background: "var(--color-background)",
    border: "var(--color-border)",
    card: "var(--color-card)",
    notification: "var(--color-destructive)",
    primary: "var(--color-primary)",
    text: "var(--color-foreground)",
  },
};

import { createContext, useContext } from "react";
import { tokens, type ColorTokenKey, type Tokens } from "./tokens";

export type Scheme = "light" | "dark";

export type Theme = {
  scheme: Scheme;
  color: (key: ColorTokenKey) => string;
  type: Tokens["type"];
  space: Tokens["space"];
  radius: Tokens["radius"];
  minTouchTarget: number;
};

export const ThemeContext = createContext<Theme | null>(null);

export function useTheme(): Theme {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}

import React, { useMemo } from "react";
import { useColorScheme } from "react-native";
import { tokens } from "./tokens";
import { ThemeContext, type Scheme, type Theme } from "./useTheme";

type Props = {
  children: React.ReactNode;
  schemeOverride?: Scheme; // for tests + user override
};

export function ThemeProvider({ children, schemeOverride }: Props) {
  const systemScheme = useColorScheme();
  const scheme: Scheme = schemeOverride ?? (systemScheme === "dark" ? "dark" : "light");

  const value = useMemo<Theme>(() => {
    const palette = tokens[scheme];
    return {
      scheme,
      color: (key) => palette[key],
      type: tokens.type,
      space: tokens.space,
      radius: tokens.radius,
      motion: tokens.motion,
      minTouchTarget: tokens.minTouchTarget,
    };
  }, [scheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

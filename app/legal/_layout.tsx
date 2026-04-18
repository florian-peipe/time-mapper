import React from "react";
import { Stack } from "expo-router";
import { useTheme } from "@/theme/useTheme";

/**
 * Legal stack (privacy / terms / impressum). A headerless `<Stack>` so every
 * legal screen can draw its own `Sheet`-styled header inside the body. We
 * inherit the root theme — these are primarily long-form text and need a
 * high-contrast background.
 */
export default function LegalLayout() {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: t.color("color.bg") },
      }}
    />
  );
}

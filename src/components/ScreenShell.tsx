import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/useTheme";

type Props = {
  children: React.ReactNode;
  /** Wrap in ScrollView (default false). */
  scroll?: boolean;
  /** Apply horizontal+top padding (default true). */
  padding?: boolean;
};

/**
 * Wraps every screen with safe-area top + theme bg + 20px horizontal padding
 * (per design-system "Spacing" rule: screen horizontal padding is 20px).
 *
 * Set `padding={false}` for screens whose own content owns the inset (e.g.
 * full-bleed map). Set `scroll` for vertically scrollable content.
 */
export function ScreenShell({ children, scroll = false, padding = true }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pad = padding
    ? { paddingTop: insets.top + t.space[2], paddingHorizontal: t.space[5] }
    : { paddingTop: insets.top, paddingHorizontal: 0 };

  const style = [styles.root, { backgroundColor: t.color("color.bg") }, pad];

  if (scroll) {
    return (
      <ScrollView style={style} contentContainerStyle={{ paddingBottom: t.space[8] }}>
        {children}
      </ScrollView>
    );
  }
  return <View style={style}>{children}</View>;
}

const styles = StyleSheet.create({ root: { flex: 1 } });

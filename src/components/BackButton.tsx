import React from "react";
import { Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/useTheme";
import { Icon } from "@/components";
import { i18n } from "@/lib/i18n";

/**
 * Top-left back button for onboarding screens 2-6. Positions itself
 * absolutely inside the parent container's safe-area top padding; the
 * parent doesn't need to reserve layout. Hidden when there's nothing
 * to go back to (`router.canGoBack()` false) so the Welcome screen
 * can render it unconditionally without a stray button.
 */
export function BackButton({ topInset, testID }: { topInset: number; testID?: string }) {
  const t = useTheme();
  const router = useRouter();
  if (!router.canGoBack()) return null;
  return (
    <Pressable
      testID={testID}
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel={i18n.t("onboarding.back")}
      hitSlop={t.space[2]}
      style={{
        position: "absolute",
        top: topInset + t.space[3],
        left: t.space[3],
        width: t.minTouchTarget,
        height: t.minTouchTarget,
        borderRadius: t.radius.pill,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name="chevron-left" size={22} color={t.color("color.fg2")} />
    </Pressable>
  );
}

import React, { useCallback } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";
import { Button, Rings } from "@/components";

/**
 * Onboarding 1 / 3 — big Rings hero, product name, one-line pitch, primary CTA.
 * The hero Rings sits absolute-positioned behind the copy so the eye is drawn
 * to the signature radius motif on first launch. Layout mirrors the
 * design-system hero template (centered column, display type, 48dp button).
 */
export function WelcomeScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleContinue = useCallback(() => {
    router.push("/(onboarding)/permissions");
  }, [router]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.color("color.bg"),
        paddingTop: insets.top + t.space[10],
        paddingBottom: insets.bottom + t.space[6],
        paddingHorizontal: t.space[6],
      }}
      testID="onboarding-welcome-screen"
    >
      {/* Decorative Rings, centered behind the headline. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: insets.top + t.space[10],
          left: 0,
          right: 0,
          alignItems: "center",
        }}
      >
        <Rings size={320} opacity={0.1} />
      </View>

      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: t.space[4],
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            fontSize: t.type.size.display,
            fontWeight: t.type.weight.bold,
            color: t.color("color.fg"),
            fontFamily: t.type.family.sans,
            textAlign: "center",
            letterSpacing: -0.5,
          }}
        >
          {i18n.t("onboarding.welcome.title")}
        </Text>
        <Text
          style={{
            fontSize: t.type.size.m,
            color: t.color("color.fg2"),
            fontFamily: t.type.family.sans,
            textAlign: "center",
            maxWidth: 320,
            lineHeight: t.type.size.m * t.type.lineHeight.body,
          }}
        >
          {i18n.t("onboarding.welcome.body")}
        </Text>
      </View>

      <Button
        variant="primary"
        size="md"
        full
        onPress={handleContinue}
        testID="onboarding-welcome-continue"
      >
        {i18n.t("onboarding.welcome.cta")}
      </Button>
    </View>
  );
}

import React, { useCallback } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";
import { onboardingRoute } from "@/lib/routes";
import { BackButton, Button, Rings, StepIndicator } from "@/components";

/**
 * Onboarding 2 / 6 — explains the geofence model. One sentence + a
 * single concentric-rings illustration. Pushes to the Goals + Stats
 * tour slide on CTA.
 */
export function HowItWorksScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleContinue = useCallback(() => {
    router.push(onboardingRoute("/(onboarding)/goals-and-stats"));
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
      testID="onboarding-howitworks-screen"
    >
      <BackButton topInset={insets.top} testID="onboarding-howitworks-back" />
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
        <Rings size={260} opacity={0.12} />
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
            fontSize: t.type.size.xl,
            fontWeight: t.type.weight.bold,
            color: t.color("color.fg"),
            fontFamily: t.type.family.sans,
            textAlign: "center",
            letterSpacing: -0.4,
          }}
        >
          {i18n.t("onboarding.howItWorks.title")}
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
          {i18n.t("onboarding.howItWorks.body")}
        </Text>
      </View>

      <View style={{ gap: t.space[4] }}>
        <Button
          variant="primary"
          size="md"
          full
          onPress={handleContinue}
          testID="onboarding-howitworks-continue"
        >
          {i18n.t("onboarding.howItWorks.cta")}
        </Button>
        <StepIndicator current={2} total={6} testID="onboarding-steps" />
      </View>
    </View>
  );
}

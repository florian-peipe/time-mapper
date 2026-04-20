import React, { useCallback } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";
import { onboardingRoute } from "@/lib/routes";
import { Button, Icon } from "@/components";
import { BackButton } from "./BackButton";
import { StepIndicator } from "./StepIndicator";

/**
 * Onboarding 4 / 6 — privacy posture. Reassures the user that
 * location never leaves the device before we ask for the permission
 * on the next step.
 */
export function PrivacyScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleContinue = useCallback(() => {
    router.push(onboardingRoute("/(onboarding)/permissions"));
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
      testID="onboarding-privacy-screen"
    >
      <BackButton topInset={insets.top} testID="onboarding-privacy-back" />
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: t.space[5],
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: t.radius.pill,
            backgroundColor: t.color("color.accent.soft"),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="lock" size={36} color={t.color("color.accent")} />
        </View>
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
          {i18n.t("onboarding.privacy.title")}
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
          {i18n.t("onboarding.privacy.body")}
        </Text>
      </View>

      <View style={{ gap: t.space[4] }}>
        <Button
          variant="primary"
          size="md"
          full
          onPress={handleContinue}
          testID="onboarding-privacy-continue"
        >
          {i18n.t("onboarding.privacy.cta")}
        </Button>
        <StepIndicator current={4} total={6} testID="onboarding-steps" />
      </View>
    </View>
  );
}

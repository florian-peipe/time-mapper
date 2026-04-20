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
 * Onboarding 3 / 6 — introduces goals + stats. Uses a compact stack
 * of two icon-and-label rows so the concept is visible at a glance.
 * CTA advances to the privacy slide.
 */
export function GoalsAndStatsScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleContinue = useCallback(() => {
    router.push(onboardingRoute("/(onboarding)/privacy"));
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
      testID="onboarding-goals-screen"
    >
      <BackButton topInset={insets.top} testID="onboarding-goals-back" />
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: t.space[5],
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
          {i18n.t("onboarding.goalsAndStats.title")}
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
          {i18n.t("onboarding.goalsAndStats.body")}
        </Text>
        <View style={{ gap: t.space[3], marginTop: t.space[4] }}>
          <Row icon="check" label={i18n.t("onboarding.goalsAndStats.bullet1")} />
          <Row icon="bar-chart" label={i18n.t("onboarding.goalsAndStats.bullet2")} />
          <Row icon="bell" label={i18n.t("onboarding.goalsAndStats.bullet3")} />
        </View>
      </View>

      <View style={{ gap: t.space[4] }}>
        <Button
          variant="primary"
          size="md"
          full
          onPress={handleContinue}
          testID="onboarding-goals-continue"
        >
          {i18n.t("onboarding.goalsAndStats.cta")}
        </Button>
        <StepIndicator current={3} total={6} testID="onboarding-steps" />
      </View>
    </View>
  );
}

function Row({ icon, label }: { icon: "check" | "bar-chart" | "bell"; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: t.space[3] }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: t.radius.pill,
          backgroundColor: t.color("color.accent.soft"),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={18} color={t.color("color.accent")} />
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: t.type.size.s,
          color: t.color("color.fg"),
          fontFamily: t.type.family.sans,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

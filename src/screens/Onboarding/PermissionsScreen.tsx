import React, { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";
import { Button, Icon } from "@/components";
import {
  requestForegroundLocation,
  requestBackgroundLocation,
  requestNotifications,
} from "@/features/permissions";
import { StepIndicator } from "./StepIndicator";

/**
 * Onboarding 2 / 3 — real permission request flow. This is the "primer"
 * *and* the OS prompt trigger, consolidated per design feedback: users
 * were dropping off when the primer implied the prompt would come later.
 *
 * Flow on the primary CTA:
 *   1. requestForegroundLocation()
 *   2. if granted → requestBackgroundLocation()
 *   3. requestNotifications() regardless
 *
 * Any denial still advances to the first-place screen — a partial setup
 * is still useful (manual tracking works), and the Timeline surfaces a
 * recovery banner with a "Change in Settings" deep-link.
 */
export function PermissionsScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const advance = useCallback(() => {
    router.push("/(onboarding)/first-place");
  }, [router]);

  const handleEnable = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const fg = await requestForegroundLocation();
      if (fg === "foreground-only") {
        await requestBackgroundLocation();
      }
      await requestNotifications();
    } finally {
      setBusy(false);
      advance();
    }
  }, [advance, busy]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.color("color.bg"),
        paddingTop: insets.top + t.space[10],
        paddingBottom: insets.bottom + t.space[6],
        paddingHorizontal: t.space[6],
      }}
      testID="onboarding-permissions-screen"
    >
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: t.space[5],
        }}
      >
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={i18n.t("onboarding.permissions.title")}
          style={{
            width: 96,
            height: 96,
            borderRadius: t.radius.pill,
            backgroundColor: t.color("color.accent.soft"),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="map-pin" size={44} color={t.color("color.accent")} />
        </View>
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
          {i18n.t("onboarding.permissions.title")}
        </Text>
        <Text
          style={{
            fontSize: t.type.size.m,
            color: t.color("color.fg2"),
            fontFamily: t.type.family.sans,
            textAlign: "center",
            maxWidth: 340,
            lineHeight: t.type.size.m * t.type.lineHeight.body,
          }}
        >
          {i18n.t("onboarding.permissions.body")}
        </Text>
        {/*
          Privacy callout — reassure on every permission screen. Uses
          accent-soft surface + lock glyph to signal "on-device" without
          reaching for a Banner primitive (Banner is reserved for actionable
          warnings).
        */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: t.space[2],
            paddingHorizontal: t.space[3],
            paddingVertical: t.space[2],
            borderRadius: t.radius.pill,
            backgroundColor: t.color("color.accent.soft"),
          }}
        >
          <Icon name="lock" size={14} color={t.color("color.accent")} />
          <Text
            style={{
              fontSize: t.type.size.s,
              color: t.color("color.accent"),
              fontFamily: t.type.family.sans,
              fontWeight: t.type.weight.medium,
            }}
          >
            {i18n.t("onboarding.permissions.privacy")}
          </Text>
        </View>
      </View>

      <View style={{ gap: t.space[4] }}>
        <View style={{ gap: t.space[2] }}>
          <Button
            variant="primary"
            size="md"
            full
            loading={busy}
            onPress={handleEnable}
            testID="onboarding-permissions-enable"
          >
            {i18n.t("onboarding.permissions.cta")}
          </Button>
          <Button
            variant="tertiary"
            size="md"
            full
            onPress={advance}
            testID="onboarding-permissions-skip"
          >
            {i18n.t("onboarding.permissions.skip")}
          </Button>
        </View>
        <StepIndicator current={5} total={6} testID="onboarding-steps" />
      </View>
    </View>
  );
}

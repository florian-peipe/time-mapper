import React, { useCallback } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";
import { Button, Icon } from "@/components";

/**
 * Onboarding 2 / 3 — "primer" before the OS permission prompt. Explains why
 * Time Mapper needs Always location and what data stays on-device. The primer
 * pattern is essential: users double-tap Deny when a bare OS prompt appears
 * out of context. Both CTAs route to the same next screen — the OS prompt
 * itself is triggered by the tracking feature later, not here.
 */
export function PermissionsScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleContinue = useCallback(() => {
    router.push("/(onboarding)/first-place");
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
      </View>

      <View style={{ gap: t.space[2] }}>
        <Button
          variant="primary"
          size="md"
          full
          onPress={handleContinue}
          testID="onboarding-permissions-enable"
        >
          {i18n.t("onboarding.permissions.cta")}
        </Button>
        <Button
          variant="tertiary"
          size="md"
          full
          onPress={handleContinue}
          testID="onboarding-permissions-skip"
        >
          {i18n.t("onboarding.permissions.skip")}
        </Button>
      </View>
    </View>
  );
}

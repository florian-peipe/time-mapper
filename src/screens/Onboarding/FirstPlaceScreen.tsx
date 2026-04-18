import React, { useCallback } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";
import { Button, Rings } from "@/components";
import { useSheetStore } from "@/state/sheetStore";
import { useOnboardingGate } from "@/features/onboarding/useOnboardingGate";

/**
 * Onboarding 3 / 3 — final screen, primary CTA opens the AddPlaceSheet with
 * `source: "onboarding"` so the sheet's save handler marks onboarding complete
 * and routes to the main tabs. "Skip for now" marks complete without adding
 * a place (the user can still add one from Settings or the Timeline empty
 * state later).
 */
export function FirstPlaceScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const openSheet = useSheetStore((s) => s.openSheet);
  const { markComplete } = useOnboardingGate();

  const handleAddFirst = useCallback(() => {
    openSheet("addPlace", { placeId: null, source: "onboarding" });
  }, [openSheet]);

  const handleSkip = useCallback(() => {
    markComplete();
    router.replace("/(tabs)");
  }, [markComplete, router]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.color("color.bg"),
        paddingTop: insets.top + t.space[10],
        paddingBottom: insets.bottom + t.space[6],
        paddingHorizontal: t.space[6],
      }}
      testID="onboarding-first-place-screen"
    >
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
          style={{
            fontSize: t.type.size.display,
            fontWeight: t.type.weight.bold,
            color: t.color("color.fg"),
            fontFamily: t.type.family.sans,
            textAlign: "center",
            letterSpacing: -0.5,
          }}
        >
          {i18n.t("onboarding.firstPlace.title")}
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
          {i18n.t("onboarding.firstPlace.body")}
        </Text>
      </View>

      <View style={{ gap: t.space[2] }}>
        <Button
          variant="primary"
          size="md"
          full
          onPress={handleAddFirst}
          testID="onboarding-first-place-add"
        >
          {i18n.t("onboarding.firstPlace.cta")}
        </Button>
        <Button
          variant="tertiary"
          size="md"
          full
          onPress={handleSkip}
          testID="onboarding-first-place-skip"
        >
          {i18n.t("onboarding.firstPlace.skip")}
        </Button>
      </View>
    </View>
  );
}

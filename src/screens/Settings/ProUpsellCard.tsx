import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Rings } from "@/components";
import { i18n } from "@/lib/i18n";

type Props = {
  /** Tap handler — opens the paywall sheet via the global sheetStore. */
  onPress: () => void;
  testID?: string;
};

/**
 * Dark "Time Mapper Pro" upsell banner shown at the top of Settings when
 * the user is not Pro. Visual recipe:
 * - background `color.fg` (dark tile inverted from `color.bg`)
 * - text `color.bg` so it reads on the dark tile
 * - `Rings size={220} opacity={0.1}` absolutely positioned top-right,
 *   slightly off-canvas so only ~3/4 of the rings show
 * - Accent uppercase eyebrow + headline + accent pill button.
 */
export function ProUpsellCard({ onPress, testID }: Props) {
  const t = useTheme();

  return (
    <View
      testID={testID}
      style={{
        // 16px horizontal margin aligns with the Section cards below.
        marginHorizontal: t.space[4],
        marginBottom: t.space[5],
        padding: t.space[4] + 2, // 18 — between space[4] (16) and space[5] (20)
        backgroundColor: t.color("color.fg"),
        borderRadius: t.radius.md + 4, // 16 — larger than md to signal premium tile
        position: "relative",
        overflow: "hidden",
        // Shadow-md — same as Card's `elevated` variant so the dark tile
        // lifts off the Settings background.
        shadowColor: t.color("color.shadow"),
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
      }}
    >
      {/* Concentric-ring decoration peeking off the top-right corner. The
          design positions the rings at top:-50, right:-50 (the SVG canvas is
          220px), pulling roughly 1/4 of the art off-canvas. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -50,
          right: -50,
        }}
      >
        <Rings size={220} opacity={0.1} color={t.color("color.accent")} />
      </View>

      <View style={{ position: "relative" }}>
        <Text
          style={{
            fontSize: t.type.size.xs + 1, // 12 — eyebrow, tighter than body
            fontWeight: t.type.weight.bold,
            color: t.color("color.accent"),
            fontFamily: t.type.family.sans,
            letterSpacing: 0.5,
          }}
        >
          {i18n.t("proUpsell.eyebrow")}
        </Text>
        <Text
          style={{
            fontSize: t.type.size.m + 1, // 18 — headline above the CTA pill
            fontWeight: t.type.weight.semibold,
            color: t.color("color.bg"),
            fontFamily: t.type.family.sans,
            marginTop: t.space[1],
          }}
        >
          {i18n.t("proUpsell.headline")}
        </Text>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={i18n.t("proUpsell.cta")}
          testID={testID ? `${testID}-cta` : undefined}
          style={({ pressed }) => ({
            marginTop: t.space[3] + 2,
            paddingVertical: t.space[2] + 2,
            paddingHorizontal: t.space[4] + 2,
            backgroundColor: t.color("color.accent"),
            borderRadius: t.radius.pill,
            alignSelf: "flex-start",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              color: t.color("color.accent.contrast"),
              fontSize: t.type.size.s + 1, // 14 — button label
              fontWeight: t.type.weight.semibold,
              fontFamily: t.type.family.sans,
            }}
          >
            {i18n.t("proUpsell.cta")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

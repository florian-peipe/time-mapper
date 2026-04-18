import React, { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Button, Icon, Rings, Sheet } from "@/components";
import { useProMock } from "@/features/billing/useProMock";
import { PlanPicker, type PlanId } from "./PlanPicker";

export type PaywallScreenProps = {
  /** Caller closes the host sheet — usually `useSheetStore.closeSheet`. */
  onClose: () => void;
  /**
   * Optional analytics breadcrumb so the screen knows where the user came
   * from (e.g. "settings", "export", "history", "2nd-place"). Currently
   * unused — wired up in Plan 4 alongside RevenueCat.
   */
  source?: string;
};

const FEATURES: readonly string[] = [
  "Unlimited places",
  "Full history (no 14-day limit)",
  "Weekly reports for past weeks",
  "CSV export",
  "Place categories",
] as const;

/**
 * Paywall sheet — full-bleed (92%) height-bottom-sheet that pitches Time
 * Mapper Pro. Source: Screens.jsx Paywall lines 433-499.
 *
 * Composition:
 *   1. Hero — concentric Rings backdrop + 72×72 accent square with star
 *      icon, large headline, and subhead.
 *   2. Feature list — five bulleted lines with an accent check icon.
 *   3. PlanPicker — yearly (default) + monthly cards.
 *   4. Sticky footer (rendered via the shared Sheet's `footer` slot) —
 *      primary CTA whose label depends on the selected plan, plus a small
 *      "Restore purchases · Terms · Privacy" caption.
 *
 * In Plan 2 the CTA simply calls `useProMock().grant()` and dismisses the
 * sheet so we can exercise the Pro entitlement state across the rest of
 * the app. Plan 4 swaps this for a real RevenueCat purchase flow.
 */
export function PaywallScreen({ onClose, source: _source }: PaywallScreenProps) {
  const t = useTheme();
  const { grant } = useProMock();
  const [plan, setPlan] = useState<PlanId>("year");

  const ctaLabel = plan === "year" ? "Start free trial" : "Subscribe";

  const handleSubscribe = useCallback(() => {
    grant();
    onClose();
  }, [grant, onClose]);

  return (
    <Sheet
      visible
      onClose={onClose}
      heightPercent={92}
      testID="paywall-sheet"
      footer={
        <View>
          <Button variant="primary" size="md" full onPress={handleSubscribe} testID="paywall-cta">
            {ctaLabel}
          </Button>
          <Text
            style={{
              textAlign: "center",
              fontSize: t.type.size.xs,
              color: t.color("color.fg3"),
              fontFamily: t.type.family.sans,
              marginTop: t.space[2] + 2, // design-source: marginTop 10
            }}
          >
            Restore purchases · Terms · Privacy
          </Text>
        </View>
      }
    >
      {/* Hero */}
      <View style={{ alignItems: "center", position: "relative" }}>
        {/* Rings backdrop, behind the accent star square. */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            // design-source: top: -20, the Rings sit BEHIND the icon and
            // bleed into the surrounding negative space.
            top: -20,
            alignItems: "center",
            alignSelf: "stretch",
          }}
        >
          <Rings size={320} opacity={0.14} />
        </View>

        <View
          style={{
            // design-source: width 72 / height 72 / borderRadius 18
            width: 72,
            height: 72,
            borderRadius: t.radius.md + 6,
            backgroundColor: t.color("color.accent"),
            alignItems: "center",
            justifyContent: "center",
            // Accent drop-shadow under the square. Design uses
            // rgba(255,106,61,0.3); we tint the shadow with the live
            // accent token instead so it tracks dark mode.
            shadowColor: t.color("color.accent"),
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.3,
            shadowRadius: 32,
            elevation: 8,
          }}
        >
          <Icon name="star" size={32} color={t.color("color.accent.contrast")} />
        </View>
      </View>

      <Text
        accessibilityRole="header"
        style={{
          fontSize: t.type.size.xl + 2, // design-source: fontSize 26
          fontWeight: t.type.weight.bold,
          color: t.color("color.fg"),
          fontFamily: t.type.family.sans,
          letterSpacing: -0.4,
          textAlign: "center",
          marginTop: t.space[6],
          // design-source: lineHeight 1.15 — keeps the two-line headline tight
          lineHeight: (t.type.size.xl + 2) * t.type.lineHeight.tight,
        }}
      >
        Track every place that matters.
      </Text>
      <Text
        style={{
          fontSize: t.type.size.body,
          color: t.color("color.fg2"),
          fontFamily: t.type.family.sans,
          marginTop: t.space[2] + 2, // design-source: marginTop 10
          textAlign: "center",
        }}
      >
        Pro gives you unlimited places, full history, CSV export, and categories.
      </Text>

      {/* Feature list */}
      <View
        testID="paywall-feature-list"
        style={{
          flexDirection: "column",
          gap: t.space[3] - 2, // design-source: gap 10
          marginTop: t.space[6],
        }}
      >
        {FEATURES.map((label) => (
          <View
            key={label}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: t.space[3] - 2, // design-source: gap 10
            }}
          >
            <Icon name="check" size={20} color={t.color("color.accent")} />
            <Text
              style={{
                fontSize: t.type.size.body,
                color: t.color("color.fg"),
                fontFamily: t.type.family.sans,
              }}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>

      <PlanPicker selected={plan} onSelect={setPlan} testID="plan-picker" />
    </Sheet>
  );
}

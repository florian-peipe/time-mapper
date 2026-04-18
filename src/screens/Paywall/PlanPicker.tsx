import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";

export type PlanId = "year" | "month";

type PlanRow = {
  id: PlanId;
  label: string;
  price: string;
  sub: string;
  badge?: string;
};

/**
 * Default prices used when no live RevenueCat offering is available
 * (network failure, products not yet configured, dev-mock mode). Real
 * runs replace these with `product.priceString` from the store so the
 * user sees their local-currency price.
 */
const DEFAULT_YEARLY: PlanRow = {
  id: "year",
  label: "Yearly",
  price: "€29.99",
  sub: "7-day free trial · €2.50/mo",
  badge: "Save 50%",
};

const DEFAULT_MONTHLY: PlanRow = {
  id: "month",
  label: "Monthly",
  price: "€4.99",
  sub: "Billed monthly",
};

type Props = {
  selected: PlanId;
  onSelect: (id: PlanId) => void;
  /**
   * Live prices from the loaded RevenueCat offering. When undefined, we
   * render the hardcoded fallbacks above so the screen never shows a
   * blank price even if offerings haven't loaded yet.
   */
  yearlyPrice?: string;
  monthlyPrice?: string;
  testID?: string;
};

/**
 * Two-card vertical plan picker for the Paywall sheet.
 * Source: Screens.jsx Paywall lines 469-489.
 *
 * Visual recipe per card:
 * - 16px padding, 14 radius, 2px border.
 * - Selected: `accent` border + `accent.soft` background.
 * - Unselected: `border` border + `surface` background.
 * - Layout: label + price on opposite ends; the label row carries an
 *   optional pill badge (e.g. "Save 50%").
 */
export function PlanPicker({ selected, onSelect, yearlyPrice, monthlyPrice, testID }: Props) {
  const t = useTheme();

  // Build the rendered plan list each render — cheap (two rows) and lets
  // a price update from the SDK propagate without remounting the picker.
  const plans: readonly PlanRow[] = [
    yearlyPrice ? { ...DEFAULT_YEARLY, price: yearlyPrice } : DEFAULT_YEARLY,
    monthlyPrice ? { ...DEFAULT_MONTHLY, price: monthlyPrice } : DEFAULT_MONTHLY,
  ];

  return (
    <View
      testID={testID}
      style={{
        flexDirection: "column",
        gap: t.space[3] - 2, // design-source: gap 10
        marginTop: t.space[6],
      }}
    >
      {plans.map((p) => {
        const isSelected = selected === p.id;
        return (
          <Pressable
            key={p.id}
            onPress={() => onSelect(p.id)}
            accessibilityRole="button"
            accessibilityLabel={`${p.label} ${p.price}`}
            accessibilityState={{ selected: isSelected }}
            testID={`plan-card-${p.id}`}
            style={{
              padding: t.space[4],
              borderRadius: t.radius.md + 2, // design-source: borderRadius 14
              borderWidth: 2,
              borderColor: isSelected ? t.color("color.accent") : t.color("color.border"),
              backgroundColor: isSelected ? t.color("color.accent.soft") : t.color("color.surface"),
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: t.space[2],
                }}
              >
                <Text
                  style={{
                    fontSize: t.type.size.body,
                    fontWeight: t.type.weight.semibold,
                    color: t.color("color.fg"),
                    fontFamily: t.type.family.sans,
                  }}
                >
                  {p.label}
                </Text>
                {p.badge ? <PlanBadge label={p.badge} /> : null}
              </View>
              <Text
                style={{
                  fontSize: t.type.size.xs + 1, // design-source: fontSize 12
                  color: t.color("color.fg2"),
                  fontFamily: t.type.family.sans,
                  marginTop: 2,
                }}
              >
                {p.sub}
              </Text>
            </View>
            <Text
              style={{
                fontSize: t.type.size.m + 1, // design-source: fontSize 18
                fontWeight: t.type.weight.bold,
                color: t.color("color.fg"),
                fontFamily: t.type.family.sans,
                fontVariant: ["tabular-nums"],
              }}
            >
              {p.price}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * "Save 50%" style pill rendered next to the plan label. Uses the accent
 * palette regardless of selection state — the badge is itself a sales
 * signal, not a selection indicator.
 */
function PlanBadge({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        // design-source: padding '2px 7px', borderRadius 9999
        paddingVertical: 2,
        paddingHorizontal: t.space[2] - 1,
        backgroundColor: t.color("color.accent"),
        borderRadius: t.radius.pill,
      }}
    >
      <Text
        style={{
          fontSize: t.type.size.xs - 1, // design-source: fontSize 10
          color: t.color("color.accent.contrast"),
          fontWeight: t.type.weight.bold,
          fontFamily: t.type.family.sans,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

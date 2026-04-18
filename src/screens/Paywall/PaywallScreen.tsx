import React, { useCallback, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Banner, Button, Icon, Rings, Sheet } from "@/components";
import { usePro } from "@/features/billing/usePro";
import { PlanPicker, type PlanId } from "./PlanPicker";

export type PaywallScreenProps = {
  /**
   * Whether the sheet is open. Defaults to `true` so existing test callers
   * (and any direct embedder) keep working; the global `SheetHost` passes
   * the live `active === "paywall"` value so the underlying Modal can stay
   * mounted and hide natively without mount/unmount churn.
   */
  visible?: boolean;
  /** Caller closes the host sheet — usually `useSheetStore.closeSheet`. */
  onClose: () => void;
  /**
   * Optional analytics breadcrumb so the screen knows where the user came
   * from (e.g. "settings", "export", "history", "2nd-place"). Plan 4
   * keeps the prop for downstream analytics; the screen itself doesn't
   * branch on it (the value is forwarded to RevenueCat via the offering's
   * `presentedOfferingContext` automatically).
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
 *   3. PlanPicker — yearly (default) + monthly cards, prices read from
 *      the live RevenueCat offering when available, hardcoded €/$ fallback
 *      otherwise.
 *   4. Sticky footer (rendered via the shared Sheet's `footer` slot) —
 *      primary CTA whose label depends on the selected plan, plus a
 *      "Restore purchases" link and small Terms/Privacy caption.
 *
 * In Plan 4 the CTA invokes the real RevenueCat `purchase(pkg)` flow.
 * On user cancel / network error we surface a `Banner` tone="danger"
 * with a "Try again" action so the user isn't stranded.
 */
export function PaywallScreen({ visible = true, onClose, source: _source }: PaywallScreenProps) {
  const t = useTheme();
  const { offerings, purchase, restore } = usePro();
  const [plan, setPlan] = useState<PlanId>("year");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoreState, setRestoreState] = useState<"idle" | "busy" | "done">("idle");

  // The currently-selected RevenueCat package (annual vs monthly). Null
  // when the offering hasn't loaded — in that case the CTA falls back to
  // the older "show paywall, kick to store later" path; for now we just
  // surface a friendly error.
  const selectedPackage = useMemo(() => {
    if (!offerings) return null;
    return plan === "year" ? offerings.annual : offerings.monthly;
  }, [offerings, plan]);

  const yearlyPrice = offerings?.annual?.product.priceString;
  const monthlyPrice = offerings?.monthly?.product.priceString;

  const ctaLabel = busy ? "Processing…" : plan === "year" ? "Start free trial" : "Subscribe";

  const handleSubscribe = useCallback(async () => {
    setError(null);
    if (!selectedPackage) {
      setError("Pricing isn't loaded yet. Please try again in a moment.");
      return;
    }
    setBusy(true);
    try {
      await purchase(selectedPackage);
      // Success — the SDK has already updated isPro via its listener.
      onClose();
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }, [selectedPackage, purchase, onClose]);

  const handleRestore = useCallback(async () => {
    setError(null);
    setRestoreState("busy");
    try {
      await restore();
      setRestoreState("done");
    } catch (err) {
      setRestoreState("idle");
      setError(messageFor(err));
    }
  }, [restore]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      heightPercent={92}
      testID="paywall-sheet"
      footer={
        <View style={{ gap: t.space[2] }}>
          {error ? (
            <Banner
              tone="danger"
              title="Purchase failed"
              body={error}
              action={{ label: "Try again", onPress: handleSubscribe }}
              testID="paywall-error"
            />
          ) : null}
          <Button
            variant="primary"
            size="md"
            full
            onPress={handleSubscribe}
            loading={busy}
            testID="paywall-cta"
          >
            {ctaLabel}
          </Button>
          <Pressable
            onPress={handleRestore}
            disabled={restoreState === "busy"}
            accessibilityRole="button"
            hitSlop={8}
            testID="paywall-restore"
          >
            <Text
              style={{
                textAlign: "center",
                fontSize: t.type.size.s,
                color: t.color("color.fg2"),
                fontFamily: t.type.family.sans,
                fontWeight: t.type.weight.medium,
                marginTop: t.space[1],
              }}
            >
              {restoreLabel(restoreState)}
            </Text>
          </Pressable>
          <Text
            style={{
              textAlign: "center",
              fontSize: t.type.size.xs,
              color: t.color("color.fg3"),
              fontFamily: t.type.family.sans,
              marginTop: t.space[1],
            }}
          >
            Terms · Privacy
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

      <PlanPicker
        selected={plan}
        onSelect={setPlan}
        yearlyPrice={yearlyPrice}
        monthlyPrice={monthlyPrice}
        testID="plan-picker"
      />
    </Sheet>
  );
}

/**
 * Map a thrown SDK error to copy a human reads. RevenueCat throws errors
 * that include a userCancelled flag — we soften that to a friendlier
 * message and treat genuine failures as "try again".
 */
function messageFor(err: unknown): string {
  if (
    err &&
    typeof err === "object" &&
    "userCancelled" in err &&
    (err as { userCancelled?: boolean }).userCancelled
  ) {
    return "Purchase was cancelled.";
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}

function restoreLabel(state: "idle" | "busy" | "done"): string {
  if (state === "busy") return "Restoring…";
  if (state === "done") return "Purchases restored";
  return "Restore purchases";
}

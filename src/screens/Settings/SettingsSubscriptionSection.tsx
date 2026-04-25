import React from "react";
import { Platform } from "react-native";
import { ListRow, Section } from "@/components";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";
import { restoreLabel, planLabel, changePlanCtaLabel } from "./SettingsLabels";
import type { CurrentPlan } from "@/features/billing/usePro";

type Props = {
  isPro: boolean;
  currentPlan: CurrentPlan | null;
  productIdentifier: string | null;
  willRenew: boolean;
  expirationDate: string | null;
  /** Formatted price string for the monthly package (e.g. "€4.99"). */
  monthlyPriceLabel: string | null;
  /** Pre-calculated integer savings percent for the annual vs monthly comparison. */
  annualSavingsPercent: number;
  restoreState: "idle" | "busy" | "done" | "error";
  onManagePlan: () => void;
  onChangePlan: (target: "monthly" | "annual") => void;
  onRestore: () => void;
};

/**
 * Subscription section — surfaces the current plan, a plan-switch row, and
 * the restore row. Extracted from `SettingsScreen.tsx` to keep the
 * orchestrator under 350 lines.
 */
export function SettingsSubscriptionSection({
  isPro,
  currentPlan,
  productIdentifier,
  willRenew,
  expirationDate,
  monthlyPriceLabel,
  annualSavingsPercent,
  restoreState,
  onManagePlan,
  onChangePlan,
  onRestore,
}: Props) {
  const t = useTheme();

  const manageDetail = Platform.OS === "ios"
    ? i18n.t("settings.subscription.manage.detail.ios")
    : i18n.t("settings.subscription.manage.detail.android");

  const changeCta = changePlanCtaLabel(currentPlan, annualSavingsPercent);
  const changeTarget: "monthly" | "annual" = currentPlan === "monthly" ? "annual" : "monthly";

  const changeDetail = currentPlan === "monthly" && monthlyPriceLabel
    ? i18n.t("settings.subscription.upgrade.detail", { price: monthlyPriceLabel })
    : currentPlan === "annual" && monthlyPriceLabel
      ? i18n.t("settings.subscription.downgrade.detail", { price: monthlyPriceLabel })
      : undefined;

  return (
    <Section title={i18n.t("settings.section.subscription")} testID="settings-section-subscription">
      {isPro ? (
        <>
          <ListRow
            icon="star"
            iconBg={t.color("color.accent.soft")}
            iconColor={t.color("color.accent")}
            title={i18n.t("settings.subscription.active")}
            detail={planLabel(currentPlan, willRenew, expirationDate)}
            onPress={onManagePlan}
            testID="settings-row-pro-active"
            accessibilityHint={manageDetail}
          />
          {!willRenew ? (
            <ListRow
              icon="repeat"
              title={i18n.t("settings.subscription.resubscribe")}
              onPress={onManagePlan}
              testID="settings-row-resubscribe"
            />
          ) : changeCta && productIdentifier ? (
            <ListRow
              icon={currentPlan === "monthly" ? "star" : "clock"}
              title={changeCta}
              detail={changeDetail}
              onPress={() => onChangePlan(changeTarget)}
              testID="settings-row-change-plan"
            />
          ) : null}
        </>
      ) : null}
      <ListRow
        icon="repeat"
        title={i18n.t("settings.subscription.restore")}
        detail={restoreLabel(restoreState)}
        onPress={onRestore}
        last
        testID="settings-row-restore"
        accessibilityState={{ busy: restoreState === "busy" }}
      />
    </Section>
  );
}

import React from "react";
import { ListRow, Section } from "@/components";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";
import { restoreLabel } from "./SettingsLabels";

type Props = {
  isPro: boolean;
  restoreState: "idle" | "busy" | "done" | "error";
  onManageSubscription: () => void;
  onRestore: () => void;
};

/**
 * Subscription section — shows the active-Pro row when entitled (deep-
 * links to RevenueCat Customer Center) plus the always-visible Restore
 * purchases row. Extracted from `SettingsScreen.tsx` to keep the
 * orchestrator file under 350 lines.
 */
export function SettingsSubscriptionSection({
  isPro,
  restoreState,
  onManageSubscription,
  onRestore,
}: Props) {
  const t = useTheme();

  return (
    <Section title={i18n.t("settings.section.subscription")} testID="settings-section-subscription">
      {isPro ? (
        <ListRow
          icon="star"
          iconBg={t.color("color.accent.soft")}
          iconColor={t.color("color.accent")}
          title={i18n.t("settings.subscription.active")}
          detail={i18n.t("settings.subscription.active.detail")}
          onPress={onManageSubscription}
          testID="settings-row-pro-active"
        />
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

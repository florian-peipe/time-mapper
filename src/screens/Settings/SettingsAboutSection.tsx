import React from "react";
import { ListRow, Section } from "@/components";
import { i18n } from "@/lib/i18n";

type Props = {
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  onOpenImpressum: () => void;
  onSupport: () => void;
  onRate: () => void;
};

/**
 * About section — privacy, terms, impressum, support, and rate rows.
 * Extracted from `SettingsScreen.tsx` to keep the orchestrator file
 * under 350 lines.
 */
export function SettingsAboutSection({
  onOpenPrivacy,
  onOpenTerms,
  onOpenImpressum,
  onSupport,
  onRate,
}: Props) {
  return (
    <Section title={i18n.t("settings.section.about")} testID="settings-section-about">
      <ListRow
        icon="heart"
        title={i18n.t("settings.about.privacy")}
        onPress={onOpenPrivacy}
        testID="settings-row-privacy"
      />
      <ListRow
        icon="book-open"
        title={i18n.t("settings.about.terms")}
        onPress={onOpenTerms}
        testID="settings-row-terms"
      />
      <ListRow
        icon="info"
        title={i18n.t("settings.about.impressum")}
        onPress={onOpenImpressum}
        testID="settings-row-impressum"
      />
      <ListRow
        icon="bell"
        title={i18n.t("settings.about.support")}
        detail={i18n.t("settings.about.support.detail")}
        onPress={onSupport}
        testID="settings-row-support"
      />
      <ListRow
        icon="star"
        title={i18n.t("settings.about.rate")}
        onPress={onRate}
        last
        testID="settings-row-rate"
      />
    </Section>
  );
}

import React from "react";
import { ListRow, Section } from "@/components";
import { i18n } from "@/lib/i18n";
import type { ThemeOverride } from "@/state/uiStore";
import { themeLabel, languageLabel } from "./SettingsLabels";

type Props = {
  themeOverride: ThemeOverride;
  localeOverride: string | null;
  onCycleTheme: () => void;
  onCycleLanguage: () => void;
};

/**
 * Appearance section — theme + language rows. Both are cycled on press
 * (System → Light → Dark → System; System → English → Deutsch → System).
 * Extracted from `SettingsScreen.tsx` to keep the orchestrator file
 * under 350 lines.
 */
export function SettingsAppearanceSection({
  themeOverride,
  localeOverride,
  onCycleTheme,
  onCycleLanguage,
}: Props) {
  return (
    <Section title={i18n.t("settings.section.appearance")} testID="settings-section-appearance">
      <ListRow
        icon="moon"
        title={i18n.t("settings.appearance.theme")}
        detail={themeLabel(themeOverride)}
        onPress={onCycleTheme}
        accessibilityHint={i18n.t("settings.theme.hint")}
        testID="settings-row-theme"
      />
      <ListRow
        icon="globe"
        title={i18n.t("settings.appearance.language")}
        detail={languageLabel(localeOverride)}
        onPress={onCycleLanguage}
        accessibilityHint={i18n.t("settings.language.hint")}
        last
        testID="settings-row-language"
      />
    </Section>
  );
}

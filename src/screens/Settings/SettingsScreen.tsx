import React, { useCallback } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/useTheme";
import { ListRow, Section } from "@/components";
import { useProMock } from "@/features/billing/useProMock";
import { useSheetStore } from "@/state/sheetStore";
import { useUiStore, type ThemeOverride } from "@/state/uiStore";
import { i18n } from "@/lib/i18n";
import { PlacesRepo } from "@/db/repository/places";
import { EntriesRepo } from "@/db/repository/entries";
import { KvRepo } from "@/db/repository/kv";
import { resetAndSeed } from "@/db/seed";
import type * as DbClientModule from "@/db/client";
import { ProUpsellCard } from "./ProUpsellCard";

/**
 * Settings tab — vertical list of grouped sections, with a Pro upsell banner
 * pinned at the top when the user is on the free plan. Source: Screens.jsx
 * SettingsScreen lines 271-325.
 *
 * Each section is a `Section` shell wrapping `ListRow`s. Tap handlers either:
 *   1. flip a piece of UI state (`themeOverride`),
 *   2. open a sheet (`paywall` — for the Pro-gated Export row), or
 *   3. fire a stub side-effect (`Linking.openURL`, dev-only console.log).
 *
 * The "Developer" section is gated behind `__DEV__` so it never ships in
 * production builds. It exposes mock-Pro toggles plus stubs for Plan-3
 * data-management actions (re-seed, clear).
 */
export function SettingsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const { isPro, grant, revoke } = useProMock();
  const openSheet = useSheetStore((s) => s.openSheet);
  const themeOverride = useUiStore((s) => s.themeOverride);
  const setThemeOverride = useUiStore((s) => s.setThemeOverride);

  const handleOpenPaywall = useCallback(
    (source: "settings" | "export") => {
      openSheet("paywall", { source });
    },
    [openSheet],
  );

  const handleCycleTheme = useCallback(() => {
    setThemeOverride(nextTheme(themeOverride));
  }, [themeOverride, setThemeOverride]);

  const handleOpenPrivacy = useCallback(() => {
    void Linking.openURL("https://timemapper.app/privacy");
  }, []);

  const handleExport = useCallback(() => {
    if (!isPro) {
      handleOpenPaywall("export");
      return;
    }
    // Real CSV export lands in Plan 5 polish; intentional no-op for now.
  }, [isPro, handleOpenPaywall]);

  const handleToggleProMock = useCallback(() => {
    if (isPro) revoke();
    else grant();
  }, [isPro, grant, revoke]);

  const handleReseedDemo = useCallback(() => {
    // Dev-only action — wipes every user-facing table and replays
    // `seedDemoData`. The `db` client is `require()`-d lazily so the test
    // import graph stays free of the `expo-sqlite` native binding until the
    // button is actually pressed on-device. Repos are constructed inline
    // (rather than via `usePlacesRepo`/`useEntriesRepo`) so mounting the
    // Settings screen in Jest doesn't trigger the device binding eagerly.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { db } = require("@/db/client") as typeof DbClientModule;
    resetAndSeed(db, new PlacesRepo(db), new EntriesRepo(db), new KvRepo(db));
  }, []);

  const handleClearAll = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log("[settings] clear all data");
  }, []);

  return (
    <ScrollView
      testID="settings-screen"
      style={{ flex: 1, backgroundColor: t.color("color.bg") }}
      contentContainerStyle={{
        paddingTop: insets.top + t.space[3],
        paddingBottom: insets.bottom + t.space[8],
      }}
    >
      {/* Heading */}
      <View
        style={{
          paddingHorizontal: t.space[5],
          paddingBottom: t.space[5],
        }}
      >
        <Text
          style={{
            fontSize: t.type.size.xl,
            fontWeight: t.type.weight.bold,
            color: t.color("color.fg"),
            fontFamily: t.type.family.sans,
            letterSpacing: -0.5,
          }}
        >
          {i18n.t("settings.title")}
        </Text>
      </View>

      {!isPro ? (
        <ProUpsellCard onPress={() => handleOpenPaywall("settings")} testID="settings-pro-upsell" />
      ) : null}

      <Section title="Tracking" testID="settings-section-tracking">
        <ListRow
          icon="map-pin"
          iconBg={t.color("color.success.soft")}
          iconColor={t.color("color.success")}
          title="Location"
          detail="Always"
          testID="settings-row-location"
        />
        <ListRow
          icon="bell"
          iconBg={t.color("color.accent.soft")}
          iconColor={t.color("color.accent")}
          title="Notifications"
          detail="On"
          testID="settings-row-notifications"
        />
        <ListRow
          icon="clock"
          title="Default buffers"
          detail="5 / 3 min"
          last
          testID="settings-row-buffers"
        />
      </Section>

      <Section title="Appearance" testID="settings-section-appearance">
        <ListRow
          icon="moon"
          title="Theme"
          detail={themeLabel(themeOverride)}
          onPress={handleCycleTheme}
          testID="settings-row-theme"
        />
        <ListRow
          icon="globe"
          title="Language"
          detail={localeLabel(i18n.locale)}
          last
          testID="settings-row-language"
        />
      </Section>

      <Section title="Data" testID="settings-section-data">
        <ListRow
          icon="download"
          iconBg={isPro ? t.color("color.accent.soft") : t.color("color.surface2")}
          iconColor={isPro ? t.color("color.accent") : t.color("color.fg3")}
          title="Export CSV"
          detail={!isPro ? <ProChip /> : undefined}
          onPress={handleExport}
          testID="settings-row-export"
        />
        <ListRow
          icon="clock"
          title="History retention"
          detail="14 days"
          last
          testID="settings-row-retention"
        />
      </Section>

      <Section title="About" testID="settings-section-about">
        <ListRow
          icon="heart"
          title="Privacy policy"
          onPress={handleOpenPrivacy}
          testID="settings-row-privacy"
        />
        <ListRow icon="star" title="Rate Time Mapper" last testID="settings-row-rate" />
      </Section>

      {__DEV__ ? (
        <Section title="Developer" testID="settings-section-dev">
          <ListRow
            icon="settings"
            title="Toggle Pro (mock)"
            detail={isPro ? "On" : "Off"}
            onPress={handleToggleProMock}
            testID="settings-row-toggle-pro"
          />
          <ListRow
            icon="repeat"
            title="Re-seed demo data"
            onPress={handleReseedDemo}
            testID="settings-row-reseed"
          />
          <ListRow
            icon="trash-2"
            title="Clear all data"
            last
            onPress={handleClearAll}
            testID="settings-row-clear"
          />
        </Section>
      ) : null}
    </ScrollView>
  );
}

/** Cycle order: System (null) → Light → Dark → System. */
function nextTheme(current: ThemeOverride): ThemeOverride {
  if (current === null) return "light";
  if (current === "light") return "dark";
  return null;
}

/** Human label for the Theme row's right-side detail string. */
function themeLabel(current: ThemeOverride): string {
  if (current === null) return "System";
  if (current === "light") return "Light";
  return "Dark";
}

/** Human label for the Language row. Plan 2 only ships English + German. */
function localeLabel(locale: string): string {
  if (locale.startsWith("de")) return "Deutsch";
  return "English";
}

/**
 * Small "Pro" badge rendered in the Export CSV row's detail slot when the
 * user is on the free plan. Looks like a `Chip` (accent palette) but stays
 * inline-typed inside `ListRow.detail`, so we render it as a flat View+Text
 * rather than reaching for the heavier `Chip` primitive (which has its own
 * Pressable + accessibility role and would be incorrect inside a row's
 * trailing accessory area).
 */
function ProChip() {
  const t = useTheme();
  return (
    <View
      style={{
        // design-source: padding '2px 7px', radius 9999, accent bg
        paddingVertical: 2,
        paddingHorizontal: t.space[2] - 1,
        backgroundColor: t.color("color.accent.soft"),
        borderRadius: t.radius.pill,
      }}
    >
      <Text
        style={{
          fontSize: t.type.size.xs,
          fontWeight: t.type.weight.bold,
          color: t.color("color.accent"),
          fontFamily: t.type.family.sans,
        }}
      >
        Pro
      </Text>
    </View>
  );
}

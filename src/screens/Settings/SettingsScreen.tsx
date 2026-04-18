import React, { useCallback, useState } from "react";
import { Alert, Linking, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/useTheme";
import { ListRow, Section, type IconName } from "@/components";
import { usePlaces } from "@/features/places/usePlaces";
import { usePro } from "@/features/billing/usePro";
import { useSheetStore } from "@/state/sheetStore";
import { useUiStore, type ThemeOverride } from "@/state/uiStore";
import { i18n } from "@/lib/i18n";
import { ProUpsellCard } from "./ProUpsellCard";
import { simulatePassage } from "@/features/tracking/devSim";
import { exportDiagnosticLog } from "@/features/diagnostics/exportLog";

/**
 * Deep-link to the platform-specific subscription management page. iOS
 * uses the `itms-apps://` scheme that opens the App Store directly into
 * the user's subscriptions list. Android opens Play Store via web URL —
 * the Play Store app intercepts and routes accordingly.
 */
const SUBSCRIPTION_MANAGEMENT_URL =
  Platform.OS === "ios"
    ? "itms-apps://apps.apple.com/account/subscriptions"
    : "https://play.google.com/store/account/subscriptions";

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
  const router = useRouter();

  const { isPro, grant, revoke, restore } = usePro();
  const [restoreState, setRestoreState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const { places } = usePlaces();
  const openSheet = useSheetStore((s) => s.openSheet);
  const themeOverride = useUiStore((s) => s.themeOverride);
  const setThemeOverride = useUiStore((s) => s.setThemeOverride);

  const handleAddPlace = useCallback(() => {
    openSheet("addPlace", { placeId: null, source: "settings-places" });
  }, [openSheet]);

  const handleEditPlace = useCallback(
    (placeId: string) => {
      openSheet("addPlace", { placeId, source: "settings-places" });
    },
    [openSheet],
  );

  const handleOpenPaywall = useCallback(
    (source: "settings" | "export") => {
      openSheet("paywall", { source });
    },
    [openSheet],
  );

  const handleCycleTheme = useCallback(() => {
    setThemeOverride(nextTheme(themeOverride));
  }, [themeOverride, setThemeOverride]);

  // Legal routes live under `app/legal/*` — the typed-routes generator runs
  // at `expo start` time, so the string-literal types for these paths aren't
  // visible during `tsc --noEmit`. Cast the union until the generator catches
  // up; the runtime still resolves correctly.
  const handleOpenPrivacy = useCallback(() => {
    router.push("/legal/privacy" as unknown as Parameters<typeof router.push>[0]);
  }, [router]);

  const handleOpenTerms = useCallback(() => {
    router.push("/legal/terms" as unknown as Parameters<typeof router.push>[0]);
  }, [router]);

  const handleOpenImpressum = useCallback(() => {
    router.push("/legal/impressum" as unknown as Parameters<typeof router.push>[0]);
  }, [router]);

  const handleExportDiagnostics = useCallback(() => {
    void exportDiagnosticLog().catch((err) => {
      console.warn("Failed to export diagnostic log", err);
    });
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

  const handleManageSubscription = useCallback(() => {
    void Linking.openURL(SUBSCRIPTION_MANAGEMENT_URL);
  }, []);

  const handleRestore = useCallback(async () => {
    setRestoreState("busy");
    try {
      await restore();
      setRestoreState("done");
    } catch (err) {
      console.warn("settings: restore failed", err);
      setRestoreState("error");
    }
  }, [restore]);

  const handleSimulateVisit = useCallback(() => {
    if (places.length === 0) {
      Alert.alert(
        i18n.t("settings.dev.simulate.empty.title"),
        i18n.t("settings.dev.simulate.empty.body"),
        [{ text: i18n.t("common.ok") }],
      );
      return;
    }
    // Show a picker via Alert buttons — good enough for dev-only UI. Each
    // button triggers a 30-second passage through that place, so the
    // Timeline updates twice (started + stopped) in quick succession.
    const buttons = places.slice(0, 10).map((p) => ({
      text: p.name,
      onPress: () => {
        void simulatePassage(p.id, 30);
      },
    }));
    Alert.alert(
      i18n.t("settings.dev.simulate.picker.title"),
      i18n.t("settings.dev.simulate.picker.body"),
      [...buttons, { text: i18n.t("common.cancel"), style: "cancel" as const }],
    );
  }, [places]);

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

      <Section title={i18n.t("settings.section.places")} testID="settings-section-places">
        {places.length === 0 ? (
          <ListRow
            icon="map-pin"
            iconBg={t.color("color.accent.soft")}
            iconColor={t.color("color.accent")}
            title={i18n.t("settings.places.addFirst")}
            onPress={handleAddPlace}
            last
            testID="settings-row-add-first-place"
          />
        ) : (
          <>
            {places.map((p) => (
              <ListRow
                key={p.id}
                icon={toIconName(p.icon)}
                iconBg={p.color}
                iconColor={t.color("color.accent.contrast")}
                title={p.name}
                detail={p.address || undefined}
                onPress={() => handleEditPlace(p.id)}
                testID={`settings-row-place-${p.id}`}
                accessibilityHint={i18n.t("common.edit")}
              />
            ))}
            <ListRow
              icon="plus"
              title={i18n.t("settings.places.addAnother")}
              onPress={handleAddPlace}
              last
              testID="settings-row-add-place"
            />
          </>
        )}
      </Section>

      <Section title={i18n.t("settings.section.tracking")} testID="settings-section-tracking">
        <ListRow
          icon="map-pin"
          iconBg={t.color("color.success.soft")}
          iconColor={t.color("color.success")}
          title={i18n.t("settings.tracking.location")}
          detail={i18n.t("settings.tracking.location.detail")}
          testID="settings-row-location"
        />
        <ListRow
          icon="bell"
          iconBg={t.color("color.accent.soft")}
          iconColor={t.color("color.accent")}
          title={i18n.t("settings.tracking.notifications")}
          detail={i18n.t("settings.tracking.notifications.detail")}
          testID="settings-row-notifications"
        />
        <ListRow
          icon="clock"
          title={i18n.t("settings.tracking.buffers")}
          detail={i18n.t("settings.tracking.buffers.detail")}
          last
          testID="settings-row-buffers"
        />
      </Section>

      <Section title={i18n.t("settings.section.appearance")} testID="settings-section-appearance">
        <ListRow
          icon="moon"
          title={i18n.t("settings.appearance.theme")}
          detail={themeLabel(themeOverride)}
          onPress={handleCycleTheme}
          testID="settings-row-theme"
        />
        <ListRow
          icon="globe"
          title={i18n.t("settings.appearance.language")}
          detail={localeLabel(i18n.locale)}
          last
          testID="settings-row-language"
        />
      </Section>

      <Section
        title={i18n.t("settings.section.subscription")}
        testID="settings-section-subscription"
      >
        {isPro ? (
          <ListRow
            icon="star"
            iconBg={t.color("color.accent.soft")}
            iconColor={t.color("color.accent")}
            title={i18n.t("settings.subscription.active")}
            detail={i18n.t("settings.subscription.active.detail")}
            onPress={handleManageSubscription}
            testID="settings-row-pro-active"
          />
        ) : null}
        <ListRow
          icon="repeat"
          title={i18n.t("settings.subscription.restore")}
          detail={restoreLabel(restoreState)}
          onPress={handleRestore}
          last
          testID="settings-row-restore"
          accessibilityState={{ busy: restoreState === "busy" }}
        />
      </Section>

      <Section title={i18n.t("settings.section.data")} testID="settings-section-data">
        <ListRow
          icon="download"
          iconBg={isPro ? t.color("color.accent.soft") : t.color("color.surface2")}
          iconColor={isPro ? t.color("color.accent") : t.color("color.fg3")}
          title={i18n.t("settings.data.export")}
          detail={!isPro ? <ProChip /> : undefined}
          onPress={handleExport}
          testID="settings-row-export"
        />
        <ListRow
          icon="clock"
          title={i18n.t("settings.data.retention")}
          detail={i18n.t("settings.data.retention.detail")}
          last
          testID="settings-row-retention"
        />
      </Section>

      <Section title={i18n.t("settings.section.about")} testID="settings-section-about">
        <ListRow
          icon="heart"
          title={i18n.t("settings.about.privacy")}
          onPress={handleOpenPrivacy}
          testID="settings-row-privacy"
        />
        <ListRow
          icon="book-open"
          title={i18n.t("settings.about.terms")}
          onPress={handleOpenTerms}
          testID="settings-row-terms"
        />
        <ListRow
          icon="info"
          title={i18n.t("settings.about.impressum")}
          onPress={handleOpenImpressum}
          testID="settings-row-impressum"
        />
        <ListRow
          icon="star"
          title={i18n.t("settings.about.rate")}
          last
          testID="settings-row-rate"
        />
      </Section>

      {__DEV__ ? (
        <Section title={i18n.t("settings.section.dev")} testID="settings-section-dev">
          <ListRow
            icon="settings"
            title={i18n.t("settings.dev.togglePro")}
            detail={
              isPro ? i18n.t("settings.dev.togglePro.on") : i18n.t("settings.dev.togglePro.off")
            }
            onPress={handleToggleProMock}
            testID="settings-row-toggle-pro"
            accessibilityState={{ checked: isPro }}
          />
          <ListRow
            icon="repeat"
            title={i18n.t("settings.dev.simulate")}
            detail={i18n.t("settings.dev.simulate.detail")}
            onPress={handleSimulateVisit}
            testID="settings-row-simulate-visit"
          />
          <ListRow
            icon="download"
            title={i18n.t("settings.data.diagnostics")}
            detail={i18n.t("settings.data.diagnostics.detail")}
            onPress={handleExportDiagnostics}
            last
            testID="settings-row-diagnostics"
          />
        </Section>
      ) : null}
    </ScrollView>
  );
}

/**
 * Right-side label for the Restore purchases row. Reflects the in-flight
 * + post-completion state so the user knows their tap was acknowledged.
 */
function restoreLabel(state: "idle" | "busy" | "done" | "error"): string | undefined {
  if (state === "busy") return i18n.t("settings.subscription.restore.busy");
  if (state === "done") return i18n.t("settings.subscription.restore.done");
  if (state === "error") return i18n.t("settings.subscription.restore.error");
  return undefined;
}

/** Cycle order: System (null) → Light → Dark → System. */
function nextTheme(current: ThemeOverride): ThemeOverride {
  if (current === null) return "light";
  if (current === "light") return "dark";
  return null;
}

/** Human label for the Theme row's right-side detail string. */
function themeLabel(current: ThemeOverride): string {
  if (current === null) return i18n.t("settings.appearance.theme.system");
  if (current === "light") return i18n.t("settings.appearance.theme.light");
  return i18n.t("settings.appearance.theme.dark");
}

/** Human label for the Language row. Plan 2 only ships English + German. */
function localeLabel(locale: string): string {
  if (locale.startsWith("de")) return i18n.t("settings.appearance.language.de");
  return i18n.t("settings.appearance.language.en");
}

/**
 * Known places-repo icon names (superset of the `AddPlaceSheet` picker).
 * Anything else we observe in the DB — including the legacy default "pin"
 * from older Place rows — falls back to `"map-pin"` so we never pass an
 * unregistered name into `<Icon>` (which would throw at render time).
 */
const KNOWN_PLACE_ICONS: readonly IconName[] = [
  "home",
  "briefcase",
  "dumbbell",
  "coffee",
  "book-open",
  "shopping-bag",
  "plane",
  "car",
  "heart",
  "music",
  "utensils",
  "bed",
  "baby",
  "tree-pine",
  "waves",
  "mountain",
  "map-pin",
  "star",
];

function toIconName(raw: string | undefined): IconName {
  if (!raw) return "map-pin";
  return (KNOWN_PLACE_ICONS as readonly string[]).includes(raw) ? (raw as IconName) : "map-pin";
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
      accessibilityRole="text"
      accessibilityLabel={i18n.t("settings.proChip")}
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
        {i18n.t("settings.proChip")}
      </Text>
    </View>
  );
}

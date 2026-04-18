import React, { useCallback, useState } from "react";
import { Alert, Linking, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/useTheme";
import { ListRow, Section, type IconName } from "@/components";
import { usePlaces } from "@/features/places/usePlaces";
import { usePro } from "@/features/billing/usePro";
import { useSheetStore } from "@/state/sheetStore";
import { useUiStore, type ThemeOverride } from "@/state/uiStore";
import { i18n } from "@/lib/i18n";
import { ProUpsellCard } from "./ProUpsellCard";
import { simulatePassage } from "@/features/tracking/devSim";

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
      Alert.alert("No places yet", "Add a place first, then come back to simulate a visit.", [
        { text: "OK" },
      ]);
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
    Alert.alert("Simulate a 30s visit", "Pick a place", [
      ...buttons,
      { text: "Cancel", style: "cancel" as const },
    ]);
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

      <Section title="Places" testID="settings-section-places">
        {places.length === 0 ? (
          <ListRow
            icon="map-pin"
            iconBg={t.color("color.accent.soft")}
            iconColor={t.color("color.accent")}
            title="Add your first place"
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
              />
            ))}
            <ListRow
              icon="plus"
              title="Add place"
              onPress={handleAddPlace}
              last
              testID="settings-row-add-place"
            />
          </>
        )}
      </Section>

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

      <Section title="Subscription" testID="settings-section-subscription">
        {isPro ? (
          <ListRow
            icon="star"
            iconBg={t.color("color.accent.soft")}
            iconColor={t.color("color.accent")}
            title="Time Mapper Pro"
            detail="Active"
            onPress={handleManageSubscription}
            testID="settings-row-pro-active"
          />
        ) : null}
        <ListRow
          icon="repeat"
          title="Restore purchases"
          detail={restoreLabel(restoreState)}
          onPress={handleRestore}
          last
          testID="settings-row-restore"
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
            title="Simulate visit"
            detail="30s passage"
            last
            onPress={handleSimulateVisit}
            testID="settings-row-simulate-visit"
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
  if (state === "busy") return "Restoring…";
  if (state === "done") return "Restored";
  if (state === "error") return "Try again";
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

// CRITICAL: this polyfill MUST be the very first import — it installs
// `crypto.getRandomValues` on the Hermes global before any module touches
// `uuid()` (PlacesRepo, seedDemoData, etc.). Without it, Hermes throws
// "Property 'crypto' doesn't exist" on iOS/Android and the app fails to boot.
import "react-native-get-random-values";
import React, { useEffect, useRef, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { getLocales } from "expo-localization";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  useFonts as useInter,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from "@expo-google-fonts/jetbrains-mono";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { ErrorBoundary } from "@/components";
import { useHydrateUiStoreFromKv, useUiStore } from "@/state/uiStore";
import { initI18n } from "@/lib/i18n";
import { captureException, initCrashReporting } from "@/lib/crash";
import { runMigrations } from "@/db/client";
import { useOnboardingGate } from "@/features/onboarding/useOnboardingGate";
import { SheetHost } from "@/screens/SheetHost";
// Side-effect import: registers the geofence task at module-eval time, which
// is a hard requirement of expo-task-manager (OS cold-wakes run only JS
// module init, not React render). Must come before bootstrapTracking().
import "@/background/tasks";
import { bootstrapTracking } from "@/features/tracking/bootstrap";

function pickInitialLocale(override: string | null): string {
  if (override) return override;
  const system = getLocales()[0]?.languageCode ?? "en";
  return system === "de" ? "de" : "en";
}

export default function RootLayout() {
  // Must be called unconditionally — hydrates persisted theme/locale
  // overrides from the KV store on first mount. Runs once even across
  // re-renders triggered by locale changes below.
  useHydrateUiStoreFromKv();

  const themeOverride = useUiStore((s) => s.themeOverride);
  const localeOverride = useUiStore((s) => s.localeOverride);
  const [dbReady, setDbReady] = useState(false);
  const [fontsLoaded] = useInter({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  useEffect(() => {
    // v0.6: crash reporting initializes first so even a migration failure
    // below lands in Sentry (when DSN configured). No-op when disabled.
    initCrashReporting();
    (async () => {
      initI18n(pickInitialLocale(localeOverride));
      await runMigrations();
      // v0.3: no auto-seed on boot. The app now starts empty so first-run
      // feels like a real install (onboarding takes the user straight to
      // "add your first place"). `seedDemoData` still exists in `db/seed.ts`
      // for manual dev use, just nobody calls it from the boot path.
      setDbReady(true);
      // v0.4: tracking engine bootstrap runs post-migrations.
      // Fire-and-forget — the UI is already releasing. Bootstrapping
      // reconciles OS geofences with our DB and catches up any pending
      // transition left behind from a previous app session.
      void bootstrapTracking();
    })().catch((err) => {
      console.error("Boot failure", err);
      captureException(err, { stage: "boot" });
      setDbReady(true); // fail-open rather than hang — UI can show error later
    });
  }, [localeOverride]);

  if (!fontsLoaded || !dbReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider schemeOverride={themeOverride ?? undefined}>
          <StatusBar style="auto" />
          {/*
            Top-level ErrorBoundary. Catches any uncaught render-phase
            exception from the Stack + SheetHost subtree and shows a
            "Restart" fallback rather than leaving the user on a blank or
            frozen screen. Goes below ThemeProvider so the fallback uses
            plain styles and can't crash if theme was the thing that threw.
          */}
          <ErrorBoundary>
            <Stack screenOptions={{ headerShown: false }} />
            <OnboardingGate />
            {/*
              Global sheet host — any screen can call
              `useSheetStore.openSheet(...)` to summon Paywall, EntryEdit, or
              AddPlace. Lives inside ThemeProvider so sheets pick up the live
              scheme, below <Stack> so Modal z-indexes above the tab bar.
            */}
            <SheetHost />
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Route guard for first-run. Sits inside the ThemeProvider so it has router
 * + navigation context, but renders nothing of its own — it's a side-effect
 * component. When the KV flag says the user hasn't finished onboarding and
 * they're not already on an `(onboarding)` route, we redirect once. The
 * `redirectedRef` guard prevents a replace-loop if the KV write + re-read
 * race in an unexpected order.
 */
function OnboardingGate(): null {
  const router = useRouter();
  const segments = useSegments();
  const { hydrated, needsOnboarding } = useOnboardingGate();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    const inOnboarding = segments[0] === "(onboarding)";
    if (needsOnboarding && !inOnboarding && !redirectedRef.current) {
      redirectedRef.current = true;
      router.replace("/(onboarding)/welcome");
    }
  }, [hydrated, needsOnboarding, router, segments]);

  return null;
}

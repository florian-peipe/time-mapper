// CRITICAL: this polyfill MUST be the very first import — it installs
// `crypto.getRandomValues` on the Hermes global before any module touches
// `uuid()` (PlacesRepo, seedDemoData, etc.). Without it, Hermes throws
// "Property 'crypto' doesn't exist" on iOS/Android and the app fails to boot.
import "react-native-get-random-values";
import React, { useEffect, useState } from "react";
import { Stack } from "expo-router";
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
import { useUiStore } from "@/state/uiStore";
import { initI18n } from "@/lib/i18n";
import { db, runMigrations } from "@/db/client";
import { PlacesRepo } from "@/db/repository/places";
import { EntriesRepo } from "@/db/repository/entries";
import { KvRepo } from "@/db/repository/kv";
import { seedDemoData } from "@/db/seed";
import { SheetHost } from "@/screens/SheetHost";

function pickInitialLocale(override: string | null): string {
  if (override) return override;
  const system = getLocales()[0]?.languageCode ?? "en";
  return system === "de" ? "de" : "en";
}

export default function RootLayout() {
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
    (async () => {
      initI18n(pickInitialLocale(localeOverride));
      await runMigrations();
      // Seed once, guarded by `kv.onboarding.seeded` — makes the first
      // launch feel alive instead of empty-state everywhere.
      seedDemoData(new PlacesRepo(db), new EntriesRepo(db), new KvRepo(db));
      setDbReady(true);
    })().catch((err) => {
      console.error("Boot failure", err);
      setDbReady(true); // fail-open rather than hang — UI can show error later
    });
  }, [localeOverride]);

  if (!fontsLoaded || !dbReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider schemeOverride={themeOverride ?? undefined}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }} />
          {/*
            Global sheet host — any screen can call
            `useSheetStore.openSheet(...)` to summon Paywall, EntryEdit, or
            AddPlace. Lives inside ThemeProvider so sheets pick up the live
            scheme, below <Stack> so Modal z-indexes above the tab bar.
          */}
          <SheetHost />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

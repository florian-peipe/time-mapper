import React from "react";
import { Stack } from "expo-router";

/**
 * Onboarding group layout. `headerShown: false` keeps the hero copy
 * front-and-center (no navbar chrome). Edge-swipe back is enabled so
 * iOS gesture users can retreat to the previous slide naturally; each
 * slide (except Welcome) also renders an explicit `<BackButton>` in
 * its top-left corner. Users still need the primary CTA / Skip to
 * leave the flow entirely — they can only go back to earlier slides,
 * not forward past the flow.
 */
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: true }} />;
}

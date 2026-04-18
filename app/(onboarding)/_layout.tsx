import React from "react";
import { Stack } from "expo-router";

/**
 * Onboarding group layout. `headerShown: false` keeps the hero copy
 * front-and-center (no navbar chrome). `gestureEnabled: false` prevents the
 * user from edge-swiping back to the previous onboarding screen or off the
 * flow entirely before it completes — their only escape routes are the
 * primary CTA or the explicit "Skip" on the final screen.
 */
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />;
}

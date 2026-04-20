import type { useRouter } from "expo-router";

/**
 * Typed helper for legal routes. `app/legal/*` lives outside the
 * Expo-Router typed-routes generator output (the generator runs at
 * `expo start`), so strict string-literal types aren't available during
 * `tsc --noEmit` — we'd otherwise have to cast at every call site. This
 * helper centralizes the cast with an allowlist so a typo in the route
 * string fails loudly.
 */
export type LegalRoute = "/legal/privacy" | "/legal/terms" | "/legal/impressum";

type RouterPushArg = Parameters<ReturnType<typeof useRouter>["push"]>[0];

export function legalRoute(key: LegalRoute): RouterPushArg {
  return key as unknown as RouterPushArg;
}

/**
 * Typed helper for onboarding routes. Same story as `legalRoute` — newly
 * added `app/(onboarding)/*` route files aren't in the Expo-Router
 * generator output until the next `expo start`, so we centralize the
 * cast behind an allowlist.
 */
export type OnboardingRoute =
  | "/(onboarding)/welcome"
  | "/(onboarding)/how-it-works"
  | "/(onboarding)/goals-and-stats"
  | "/(onboarding)/privacy"
  | "/(onboarding)/permissions"
  | "/(onboarding)/first-place";

export function onboardingRoute(key: OnboardingRoute): RouterPushArg {
  return key as unknown as RouterPushArg;
}

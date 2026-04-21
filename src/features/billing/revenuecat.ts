/**
 * Thin functional wrapper around `react-native-purchases` (RevenueCat). The
 * SDK is statically imported but never touched until `configureRevenueCat`
 * runs — we keep that behind a sync entry so callers don't accidentally fire
 * native methods before configure-time (which would throw at runtime).
 *
 * Two modes:
 *   1. **Real mode** — the matching `EXPO_PUBLIC_REVENUECAT_<PLATFORM>_KEY`
 *      env var is set. We forward to the SDK as-is.
 *   2. **Mock mode** — env var missing. We log once and short-circuit every
 *      method to a free-tier stub so the app stays runnable in dev without
 *      a configured RevenueCat dashboard. `usePro` flips to `useProMock`
 *      when this mode is detected.
 *
 * No side-effects at module load. `configureRevenueCat` is idempotent so
 * `_layout.tsx` calling it on every mount is harmless.
 */
import { Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";

export { PAYWALL_RESULT } from "react-native-purchases-ui";

/**
 * The entitlement identifier set in the RevenueCat dashboard. Both the
 * monthly + yearly products link to it. Must match the dashboard byte-for-
 * byte — `Purchases.getCustomerInfo()` returns entitlements keyed by this
 * string and a mismatch silently produces `isPro = false`.
 */
export const PRO_ENTITLEMENT_ID = "Time Mapper Pro";

/**
 * The offering identifier we expose on the dashboard. RC's `getOfferings()`
 * returns the "current" offering by default which is whichever offering is
 * marked current in the dashboard — but we read `all["default"]` explicitly
 * in case the user marks a different one current later.
 */
export const DEFAULT_OFFERING_ID = "default";

type RcMode = "real" | "mock" | "uninitialized";

let mode: RcMode = "uninitialized";

function platformKey(): string | undefined {
  if (Platform.OS === "android") {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  }
  // iOS is the default. Web (in case Expo's web build runs) also lands here
  // and gets the iOS key — RC's web SDK reads its own key but we don't
  // ship web, so this is fine.
  return process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
}

/**
 * Initialise the SDK with the platform-appropriate API key. Idempotent:
 * subsequent calls are no-ops once a mode has been chosen, so wiring this
 * into a React effect is safe.
 *
 * @param appUserID Optional — pass a stable anon UUID so entitlements survive
 *                  a reinstall on the same Apple/Google account. Without it,
 *                  RevenueCat assigns a fresh anon ID per install.
 */
export function configureRevenueCat(appUserID?: string): void {
  if (mode !== "uninitialized") return;

  const apiKey = platformKey();
  if (!apiKey || apiKey.length === 0) {
    console.warn(
      "RevenueCat API key missing — billing disabled, falling back to mock mode. " +
        "Set EXPO_PUBLIC_REVENUECAT_IOS_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_KEY to enable.",
    );
    mode = "mock";
    return;
  }

  // The SDK's Configuration type includes appUserID as optional. Only pass
  // it through when the caller provides one — RC's "anonymous mode" assigns
  // its own ID otherwise.
  Purchases.configure(appUserID ? { apiKey, appUserID } : { apiKey });
  mode = "real";
}

/** Test-only — resets the cached mode so each test starts fresh. */
export function _resetForTest(): void {
  mode = "uninitialized";
}

/** Whether the SDK is in mock mode (no API keys present at boot). */
export function isMockMode(): boolean {
  return mode === "mock";
}

/**
 * Free-tier stub returned from every wrapper while in mock mode. The shape
 * matches the bits of `CustomerInfo` we actually read — entitlements only,
 * with no active entries.
 */
function freeStubCustomerInfo(): CustomerInfo {
  return {
    entitlements: { all: {}, active: {}, verification: "NOT_REQUESTED" },
  } as unknown as CustomerInfo;
}

/** Promise-returning getter for the current customer info. */
export async function getCustomerInfo(): Promise<CustomerInfo> {
  if (mode === "mock") return freeStubCustomerInfo();
  return Purchases.getCustomerInfo();
}

/**
 * Returns the default offering, or null if RevenueCat hasn't loaded one
 * (no products configured yet, or store reachability issue). Callers fall
 * back to hardcoded prices when this is null.
 */
export async function getOfferings() {
  if (mode === "mock") return null;
  const all = await Purchases.getOfferings();
  return all.all[DEFAULT_OFFERING_ID] ?? all.current ?? null;
}

/**
 * Execute a purchase. Resolves with the updated customerInfo on success.
 * Rejects when:
 *   - the user cancels the system purchase sheet,
 *   - the store is unreachable / the device is offline,
 *   - mock mode is active (we explicitly throw because there's nothing to buy).
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  if (mode === "mock") {
    throw new Error("RevenueCat is in mock mode — purchase not available without API keys.");
  }
  const result = await Purchases.purchasePackage(pkg);
  return result.customerInfo;
}

/** Restores prior purchases for the current Apple/Google account. */
export async function restorePurchases(): Promise<CustomerInfo> {
  if (mode === "mock") return freeStubCustomerInfo();
  return Purchases.restorePurchases();
}

/** True when the `pro` entitlement is in `entitlements.active`. */
export function isProActive(info: CustomerInfo): boolean {
  return info.entitlements.active[PRO_ENTITLEMENT_ID] != null;
}

/**
 * Subscribe to customer-info updates (e.g. an out-of-band renewal or a
 * RevenueCat-driven entitlement change). Returns an unsubscribe function so
 * effect cleanup is ergonomic.
 */
export function onCustomerInfoUpdate(cb: (info: CustomerInfo) => void): () => void {
  if (mode === "mock") {
    // No-op subscription — we still return a callable unsubscribe.
    return () => undefined;
  }
  Purchases.addCustomerInfoUpdateListener(cb);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(cb);
  };
}

/**
 * Present the RevenueCat-hosted paywall UI. The paywall is configured in
 * the RC dashboard ("Paywalls" tab → attach to an offering) and shown as a
 * native modal — Apple / Google styling on each platform, localized, and
 * A/B-testable without a rebuild.
 *
 * In mock mode this resolves to `NOT_PRESENTED` so callers can fall back
 * to the custom sheet paywall used for dev without keys.
 */
export async function presentPaywall(offering?: PurchasesOffering): Promise<PAYWALL_RESULT> {
  if (mode === "mock") return PAYWALL_RESULT.NOT_PRESENTED;
  return RevenueCatUI.presentPaywall(offering ? { offering } : undefined);
}

/**
 * Present the paywall only if the user lacks the `Time Mapper Pro`
 * entitlement. Short-circuits to `NOT_PRESENTED` when the user is already
 * Pro — cheaper than reading customerInfo + guarding on the caller side.
 */
export async function presentPaywallIfNeeded(
  offering?: PurchasesOffering,
): Promise<PAYWALL_RESULT> {
  if (mode === "mock") return PAYWALL_RESULT.NOT_PRESENTED;
  return RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: PRO_ENTITLEMENT_ID,
    ...(offering ? { offering } : {}),
  });
}

/**
 * Callback bag forwarded to the native Customer Center. Shape is the SDK's
 * own — re-export so call sites don't need to import from the UI package
 * directly.
 */
export type CustomerCenterCallbacks = NonNullable<
  Parameters<typeof RevenueCatUI.presentCustomerCenter>[0]
>["callbacks"];

/**
 * Present the RevenueCat Customer Center — self-service UI where users
 * cancel, restore, request a refund (iOS), change plans, and view
 * subscription status. Replaces the platform deep-link ("Manage
 * subscription" → itms-apps / Google Play subscriptions) with an in-app
 * flow that's consistent across platforms and surfaces RC-side changes
 * immediately.
 *
 * No-op in mock mode — callers should fall back to the OS deep-link.
 */
export async function presentCustomerCenter(callbacks?: CustomerCenterCallbacks): Promise<void> {
  if (mode === "mock") return;
  await RevenueCatUI.presentCustomerCenter(callbacks ? { callbacks } : undefined);
}

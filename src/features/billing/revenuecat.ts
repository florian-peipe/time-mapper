/**
 * Thin functional wrapper around `react-native-purchases` (RevenueCat).
 * The SDK is statically imported but never touched until
 * `configureRevenueCat` runs — that single entry point means callers never
 * accidentally fire native methods before configure-time (which would throw
 * at runtime).
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
import type { PAYWALL_RESULT } from "react-native-purchases-ui";
import RevenueCatUI from "react-native-purchases-ui";

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

let configured = false;

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
 * subsequent calls are no-ops once the SDK is configured, so wiring this
 * into a React effect is safe.
 *
 * Throws if the platform API key is missing — production builds require
 * `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
 * to be set. Dev builds must set these locally (see `.env.example`).
 */
export function configureRevenueCat(appUserID?: string): void {
  if (configured) return;

  const apiKey = platformKey();
  if (!apiKey || apiKey.length === 0) {
    throw new Error(
      "RevenueCat API key missing. Set EXPO_PUBLIC_REVENUECAT_IOS_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_KEY.",
    );
  }

  Purchases.configure(appUserID ? { apiKey, appUserID } : { apiKey });
  configured = true;
}

/** Test-only — resets the cached configured flag so each test starts fresh. */
export function _resetForTest(): void {
  configured = false;
}

/** Promise-returning getter for the current customer info. */
export async function getCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}

/**
 * Returns the default offering, or null if RevenueCat hasn't loaded one
 * (no products configured yet, or store reachability issue). Callers fall
 * back to hardcoded prices when this is null.
 */
export async function getOfferings() {
  const all = await Purchases.getOfferings();
  return all.all[DEFAULT_OFFERING_ID] ?? all.current ?? null;
}

/**
 * Execute a purchase. Resolves with the updated customerInfo on success.
 * Rejects when the user cancels the system purchase sheet, or the store is
 * unreachable / the device is offline.
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const result = await Purchases.purchasePackage(pkg);
  return result.customerInfo;
}

/** Restores prior purchases for the current Apple/Google account. */
export async function restorePurchases(): Promise<CustomerInfo> {
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
 */
export async function presentPaywall(offering?: PurchasesOffering): Promise<PAYWALL_RESULT> {
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
 * subscription status.
 */
export async function presentCustomerCenter(callbacks?: CustomerCenterCallbacks): Promise<void> {
  await RevenueCatUI.presentCustomerCenter(callbacks ? { callbacks } : undefined);
}

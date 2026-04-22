/**
 * SDK wrapper tests. We mock react-native-purchases entirely so we can drive
 * the wrapper synchronously and assert on its calls without an actual native
 * module. The wrapper's job is to:
 *   - read API keys from EXPO_PUBLIC_REVENUECAT_* env vars (per platform);
 *   - throw when keys are missing (fail loudly in dev + CI);
 *   - expose thin promise-returning helpers for getCustomerInfo,
 *     getOfferings, purchasePackage, restorePurchases;
 *   - read pro state from `customerInfo.entitlements.active["Time Mapper Pro"]`;
 *   - subscribe + unsubscribe to customer-info update notifications.
 */
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";
import type * as RevenuecatModule from "./revenuecat";

const mockPlatform: { OS: "ios" | "android" } = { OS: "ios" };

jest.mock("react-native", () => ({
  Platform: mockPlatform,
}));

const mockPurchases = {
  configure: jest.fn(),
  getCustomerInfo: jest.fn(),
  getOfferings: jest.fn(),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
  addCustomerInfoUpdateListener: jest.fn(),
  removeCustomerInfoUpdateListener: jest.fn(() => true),
};

jest.mock("react-native-purchases", () => ({
  __esModule: true,
  default: mockPurchases,
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockPlatform.OS = "ios";
  process.env = { ...ORIGINAL_ENV };
  delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  delete process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

function loadModule(): typeof RevenuecatModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./revenuecat") as typeof RevenuecatModule;
}

function makeCustomerInfo(active: Record<string, unknown>): CustomerInfo {
  return {
    entitlements: {
      all: active,
      active,
      verification: "NOT_REQUESTED",
    },
  } as unknown as CustomerInfo;
}

describe("revenuecat — configureRevenueCat", () => {
  it("reads the iOS key on iOS and calls Purchases.configure once", () => {
    mockPlatform.OS = "ios";
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = "appl_TESTKEY";
    const { configureRevenueCat } = loadModule();
    configureRevenueCat();
    expect(mockPurchases.configure).toHaveBeenCalledTimes(1);
    expect(mockPurchases.configure).toHaveBeenCalledWith({ apiKey: "appl_TESTKEY" });
  });

  it("reads the Android key on Android", () => {
    mockPlatform.OS = "android";
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = "goog_TESTKEY";
    const { configureRevenueCat } = loadModule();
    configureRevenueCat();
    expect(mockPurchases.configure).toHaveBeenCalledWith({ apiKey: "goog_TESTKEY" });
  });

  it("forwards the appUserID when provided", () => {
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = "appl_TESTKEY";
    const { configureRevenueCat } = loadModule();
    configureRevenueCat("user-123");
    expect(mockPurchases.configure).toHaveBeenCalledWith({
      apiKey: "appl_TESTKEY",
      appUserID: "user-123",
    });
  });

  it("throws when the platform key is missing", () => {
    const { configureRevenueCat } = loadModule();
    expect(() => configureRevenueCat()).toThrow(/API key missing/);
    expect(mockPurchases.configure).not.toHaveBeenCalled();
  });

  it("is idempotent — repeat configure calls only invoke Purchases.configure once", () => {
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = "appl_TESTKEY";
    const { configureRevenueCat } = loadModule();
    configureRevenueCat();
    configureRevenueCat();
    configureRevenueCat();
    expect(mockPurchases.configure).toHaveBeenCalledTimes(1);
  });
});

describe("revenuecat — wrappers", () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = "appl_TESTKEY";
  });

  it("getCustomerInfo proxies to Purchases.getCustomerInfo", async () => {
    const info = makeCustomerInfo({});
    mockPurchases.getCustomerInfo.mockResolvedValueOnce(info);
    const { getCustomerInfo } = loadModule();
    await expect(getCustomerInfo()).resolves.toBe(info);
    expect(mockPurchases.getCustomerInfo).toHaveBeenCalledTimes(1);
  });

  it("getOfferings returns the current offering or null", async () => {
    const offering = { identifier: "default", monthly: null, annual: null } as unknown;
    mockPurchases.getOfferings.mockResolvedValueOnce({
      all: { default: offering },
      current: offering,
    });
    const { getOfferings } = loadModule();
    await expect(getOfferings()).resolves.toBe(offering);
  });

  it("getOfferings returns null when no current offering exists", async () => {
    mockPurchases.getOfferings.mockResolvedValueOnce({ all: {}, current: null });
    const { getOfferings } = loadModule();
    await expect(getOfferings()).resolves.toBeNull();
  });

  it("purchasePackage proxies to Purchases.purchasePackage and unwraps the customerInfo", async () => {
    const info = makeCustomerInfo({ pro: { isActive: true } });
    mockPurchases.purchasePackage.mockResolvedValueOnce({
      customerInfo: info,
      productIdentifier: "tm_pro_monthly",
    });
    const pkg = { identifier: "$rc_monthly" } as unknown as PurchasesPackage;
    const { purchasePackage } = loadModule();
    await expect(purchasePackage(pkg)).resolves.toBe(info);
    expect(mockPurchases.purchasePackage).toHaveBeenCalledWith(pkg);
  });

  it("restorePurchases proxies to Purchases.restorePurchases", async () => {
    const info = makeCustomerInfo({ pro: { isActive: true } });
    mockPurchases.restorePurchases.mockResolvedValueOnce(info);
    const { restorePurchases } = loadModule();
    await expect(restorePurchases()).resolves.toBe(info);
  });

  it("isProActive reads the `Time Mapper Pro` entitlement", () => {
    const { isProActive } = loadModule();
    expect(isProActive(makeCustomerInfo({}))).toBe(false);
    expect(isProActive(makeCustomerInfo({ "Time Mapper Pro": { isActive: true } }))).toBe(true);
    expect(isProActive(makeCustomerInfo({ otherEntitlement: { isActive: true } }))).toBe(false);
  });

  it("onCustomerInfoUpdate registers the listener and returns an unsubscribe", () => {
    const cb = jest.fn();
    const { onCustomerInfoUpdate } = loadModule();
    const unsub = onCustomerInfoUpdate(cb);
    expect(mockPurchases.addCustomerInfoUpdateListener).toHaveBeenCalledWith(cb);
    unsub();
    expect(mockPurchases.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(cb);
  });
});

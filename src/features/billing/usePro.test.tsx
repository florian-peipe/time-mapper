/**
 * Tests for the production `usePro` hook.
 *
 * The hook delegates to two distinct backends:
 *   1. `useProMock` when the RevenueCat wrapper reports `isMockMode()` —
 *      same `{isPro, grant, revoke}` shape we shipped in Plan 2.
 *   2. The real RevenueCat wrapper otherwise: configures the SDK on mount,
 *      subscribes to customer-info updates, derives `isPro` from
 *      `entitlements.active.pro`, and exposes a `purchase(pkg)` method.
 *
 * We mock `./revenuecat` for both arms and use the existing `useProMock`
 * unmodified for the dev-fallback arm.
 */
import React from "react";
import { Text, View } from "react-native";
import { act, render, renderHook, waitFor } from "@testing-library/react-native";
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from "react-native-purchases";

import { resetProMock, useProMock } from "./useProMock";
// Import the mocked module up-top (not after `jest.mock`) so eslint's
// `import/first` is happy. Jest hoists `jest.mock(...)` above all imports
// at compile time, so the order on disk doesn't affect the runtime mock.
import {
  configureRevenueCat as mockConfigure,
  purchasePackage as mockPurchasePackage,
  restorePurchases as mockRestorePurchases,
} from "./revenuecat";
import { usePro } from "./usePro";

// We control the RevenueCat wrapper entirely. Each test toggles `isMockMode`
// + the resolved customer info / offerings to drive the hook through its
// branches.
const mockState: {
  mockMode: boolean;
  configureCalls: { args: unknown[] }[];
  customerInfo: CustomerInfo;
  offering: PurchasesOffering | null;
  purchaseResult: CustomerInfo | Error;
  restoreResult: CustomerInfo | Error;
  listeners: ((info: CustomerInfo) => void)[];
} = {
  mockMode: false,
  configureCalls: [],
  customerInfo: makeInfo({}),
  offering: null,
  purchaseResult: makeInfo({}),
  restoreResult: makeInfo({}),
  listeners: [],
};

function makeInfo(active: Record<string, unknown>): CustomerInfo {
  return {
    entitlements: { all: active, active, verification: "NOT_REQUESTED" },
  } as unknown as CustomerInfo;
}

// Mock the appUserId resolver too — the real one reaches into the device
// KV repo (via @/db/client) which we don't want to spin up in unit tests.
// usePro should still pass the resolved id through to configureRevenueCat,
// which we assert below via the configureCalls log.
jest.mock("./appUserId", () => ({
  REVENUECAT_USER_ID_KEY: "revenuecat.user_id",
  getOrCreateRevenueCatUserId: jest.fn(() => "test-user-uuid"),
  getOrCreateRevenueCatUserIdFromDevice: jest.fn(() => "test-user-uuid"),
  _resetDeviceKvCacheForTest: jest.fn(),
}));

jest.mock("./revenuecat", () => ({
  PRO_ENTITLEMENT_ID: "pro",
  configureRevenueCat: jest.fn((userId?: string) => {
    mockState.configureCalls.push({ args: userId === undefined ? [] : [userId] });
  }),
  isMockMode: jest.fn(() => mockState.mockMode),
  getCustomerInfo: jest.fn(async () => mockState.customerInfo),
  getOfferings: jest.fn(async () => mockState.offering),
  purchasePackage: jest.fn(async (_: PurchasesPackage) => {
    if (mockState.purchaseResult instanceof Error) throw mockState.purchaseResult;
    return mockState.purchaseResult;
  }),
  restorePurchases: jest.fn(async () => {
    if (mockState.restoreResult instanceof Error) throw mockState.restoreResult;
    return mockState.restoreResult;
  }),
  isProActive: jest.fn(
    (info: CustomerInfo) => (info?.entitlements?.active as Record<string, unknown>)?.pro != null,
  ),
  onCustomerInfoUpdate: jest.fn((cb: (info: CustomerInfo) => void) => {
    mockState.listeners.push(cb);
    return () => {
      mockState.listeners = mockState.listeners.filter((l) => l !== cb);
    };
  }),
}));

beforeEach(() => {
  mockState.mockMode = false;
  mockState.configureCalls = [];
  mockState.customerInfo = makeInfo({});
  mockState.offering = null;
  mockState.purchaseResult = makeInfo({ pro: { isActive: true } });
  mockState.restoreResult = makeInfo({});
  mockState.listeners = [];
  jest.clearAllMocks();
  resetProMock();
});

describe("usePro — real mode (SDK keys present)", () => {
  it("calls configureRevenueCat() once on mount", async () => {
    renderHook(() => usePro());
    await waitFor(() => expect(mockConfigure).toHaveBeenCalledTimes(1));
  });

  it("forwards the persisted anon user-id to configureRevenueCat", async () => {
    renderHook(() => usePro());
    await waitFor(() => expect(mockState.configureCalls).toEqual([{ args: ["test-user-uuid"] }]));
  });

  it("derives isPro=false from a free CustomerInfo", async () => {
    const { result } = renderHook(() => usePro());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isPro).toBe(false);
  });

  it("derives isPro=true when the pro entitlement is active", async () => {
    mockState.customerInfo = makeInfo({ pro: { isActive: true } });
    const { result } = renderHook(() => usePro());
    await waitFor(() => expect(result.current.isPro).toBe(true));
  });

  it("loading flips false once initial fetch settles", async () => {
    const { result } = renderHook(() => usePro());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("exposes the loaded offering", async () => {
    const offering = { identifier: "default" } as unknown as PurchasesOffering;
    mockState.offering = offering;
    const { result } = renderHook(() => usePro());
    await waitFor(() => expect(result.current.offerings).toBe(offering));
  });

  it("purchase(pkg) calls the SDK and updates isPro on success", async () => {
    mockState.purchaseResult = makeInfo({ pro: { isActive: true } });
    const { result } = renderHook(() => usePro());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isPro).toBe(false);

    const pkg = { identifier: "$rc_monthly" } as unknown as PurchasesPackage;
    await act(async () => {
      await result.current.purchase(pkg);
    });
    expect(mockPurchasePackage).toHaveBeenCalledWith(pkg);
    expect(result.current.isPro).toBe(true);
  });

  it("purchase(pkg) propagates errors so the screen can render a Banner", async () => {
    mockState.purchaseResult = new Error("user cancelled");
    const { result } = renderHook(() => usePro());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const pkg = { identifier: "$rc_monthly" } as unknown as PurchasesPackage;
    await expect(result.current.purchase(pkg)).rejects.toThrow("user cancelled");
    expect(result.current.isPro).toBe(false);
  });

  it("restore() calls the SDK and updates isPro on success", async () => {
    mockState.restoreResult = makeInfo({ pro: { isActive: true } });
    const { result } = renderHook(() => usePro());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.restore();
    });
    expect(mockRestorePurchases).toHaveBeenCalledTimes(1);
    expect(result.current.isPro).toBe(true);
  });

  it("customer-info update listener flips isPro live", async () => {
    const { result } = renderHook(() => usePro());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isPro).toBe(false);
    act(() => {
      mockState.listeners.forEach((cb) => cb(makeInfo({ pro: { isActive: true } })));
    });
    expect(result.current.isPro).toBe(true);
  });

  it("grant() and revoke() are no-ops in real mode (warns)", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const { result } = renderHook(() => usePro());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.grant());
    expect(result.current.isPro).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("usePro — mock mode (SDK keys missing)", () => {
  beforeEach(() => {
    mockState.mockMode = true;
  });

  it("returns the same shape as useProMock with isPro=false initially", () => {
    const { result } = renderHook(() => usePro());
    expect(result.current.isPro).toBe(false);
    expect(typeof result.current.grant).toBe("function");
    expect(typeof result.current.revoke).toBe("function");
    expect(typeof result.current.purchase).toBe("function");
    expect(typeof result.current.restore).toBe("function");
    expect(result.current.offerings).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("grant() flips isPro to true (delegates to useProMock store)", () => {
    const { result } = renderHook(() => usePro());
    act(() => result.current.grant());
    expect(result.current.isPro).toBe(true);
  });

  it("revoke() flips isPro back to false", () => {
    const { result } = renderHook(() => usePro());
    act(() => result.current.grant());
    expect(result.current.isPro).toBe(true);
    act(() => result.current.revoke());
    expect(result.current.isPro).toBe(false);
  });

  it("shares state with useProMock hook calls (so test helpers still work)", () => {
    const { result: pro } = renderHook(() => usePro());
    const { result: mock } = renderHook(() => useProMock());
    act(() => mock.current.grant());
    expect(pro.current.isPro).toBe(true);
  });

  it("purchase() rejects in mock mode (no SDK to drive it)", async () => {
    const { result } = renderHook(() => usePro());
    const pkg = { identifier: "$rc_monthly" } as unknown as PurchasesPackage;
    await expect(result.current.purchase(pkg)).rejects.toThrow(/mock mode/i);
  });

  it("restore() resolves to the no-op free stub in mock mode", async () => {
    const { result } = renderHook(() => usePro());
    await expect(result.current.restore()).resolves.toBeUndefined();
    expect(result.current.isPro).toBe(false);
  });
});

describe("usePro — multi-consumer reactivity", () => {
  it("two consumers see the same isPro after a customer-info update", async () => {
    function TwoConsumers() {
      const a = usePro();
      const b = usePro();
      return (
        <View>
          <Text testID="a">{a.isPro ? "pro" : "free"}</Text>
          <Text testID="b">{b.isPro ? "pro" : "free"}</Text>
        </View>
      );
    }

    const { findByTestId } = render(<TwoConsumers />);
    expect((await findByTestId("a")).props.children).toBe("free");
    expect((await findByTestId("b")).props.children).toBe("free");

    act(() => {
      mockState.listeners.forEach((cb) => cb(makeInfo({ pro: { isActive: true } })));
    });

    expect((await findByTestId("a")).props.children).toBe("pro");
    expect((await findByTestId("b")).props.children).toBe("pro");
  });
});

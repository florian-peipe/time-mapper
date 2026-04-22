/**
 * Tests for the production `usePro` hook. `usePro` is a single-path
 * RevenueCat-backed implementation: configure on mount, fetch customer info
 * + offerings, subscribe to live updates. `__setProForTests` provides a
 * synchronous test override that bypasses the SDK.
 */
import React from "react";
import { Text, View } from "react-native";
import { act, render, renderHook, waitFor } from "@testing-library/react-native";
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from "react-native-purchases";

import {
  configureRevenueCat as mockConfigure,
  purchasePackage as mockPurchasePackage,
  restorePurchases as mockRestorePurchases,
} from "./revenuecat";
import { __setProForTests, usePro } from "./usePro";

const mockState: {
  configureCalls: { args: unknown[] }[];
  customerInfo: CustomerInfo;
  offering: PurchasesOffering | null;
  purchaseResult: CustomerInfo | Error;
  restoreResult: CustomerInfo | Error;
  listeners: ((info: CustomerInfo) => void)[];
} = {
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

jest.mock("./appUserId", () => ({
  REVENUECAT_USER_ID_KEY: "revenuecat.user_id",
  getOrCreateRevenueCatUserId: jest.fn(() => "test-user-uuid"),
  getOrCreateRevenueCatUserIdFromDevice: jest.fn(() => "test-user-uuid"),
}));

jest.mock("./revenuecat", () => ({
  PRO_ENTITLEMENT_ID: "pro",
  configureRevenueCat: jest.fn((userId?: string) => {
    mockState.configureCalls.push({ args: userId === undefined ? [] : [userId] });
  }),
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
  mockState.configureCalls = [];
  mockState.customerInfo = makeInfo({});
  mockState.offering = null;
  mockState.purchaseResult = makeInfo({ pro: { isActive: true } });
  mockState.restoreResult = makeInfo({});
  mockState.listeners = [];
  jest.clearAllMocks();
  __setProForTests(null);
});

describe("usePro", () => {
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
});

describe("usePro — test override", () => {
  it("__setProForTests(true) forces isPro=true regardless of SDK state", async () => {
    const { result } = renderHook(() => usePro());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isPro).toBe(false);

    act(() => __setProForTests(true));
    expect(result.current.isPro).toBe(true);

    act(() => __setProForTests(null));
    expect(result.current.isPro).toBe(false);
  });

  it("__setProForTests(false) forces isPro=false even after purchase", async () => {
    mockState.customerInfo = makeInfo({ pro: { isActive: true } });
    const { result } = renderHook(() => usePro());
    await waitFor(() => expect(result.current.isPro).toBe(true));
    act(() => __setProForTests(false));
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

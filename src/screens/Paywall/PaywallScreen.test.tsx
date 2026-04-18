import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { PurchasesOffering } from "react-native-purchases";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { resetProMock } from "@/features/billing/useProMock";
import { PaywallScreen } from "./PaywallScreen";

// We mock the production `usePro` hook because the real implementation pulls
// in the RevenueCat wrapper and goes through an effect-based fetch cycle —
// not what we want to test here. The hook's own coverage lives in
// `usePro.test.tsx`. Here we focus on what the screen does with the values
// the hook hands it.
const mockPro = {
  isPro: false,
  loading: false,
  offerings: null as PurchasesOffering | null,
  purchase: jest.fn<Promise<void>, [unknown]>(),
  restore: jest.fn<Promise<void>, []>(),
  grant: jest.fn(),
  revoke: jest.fn(),
};

jest.mock("@/features/billing/usePro", () => ({
  usePro: () => mockPro,
}));

const wrap = (ui: React.ReactNode) => <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>;

function makePackage(id: string, priceString: string) {
  return {
    identifier: id,
    product: { priceString },
  } as unknown as NonNullable<PurchasesOffering["annual"]>;
}

beforeEach(() => {
  resetProMock();
  mockPro.isPro = false;
  mockPro.loading = false;
  mockPro.offerings = null;
  mockPro.purchase = jest.fn().mockResolvedValue(undefined);
  mockPro.restore = jest.fn().mockResolvedValue(undefined);
  mockPro.grant = jest.fn();
  mockPro.revoke = jest.fn();
});

describe("PaywallScreen — content", () => {
  it("renders the headline and subhead", () => {
    render(wrap(<PaywallScreen onClose={() => {}} />));
    expect(screen.getByText("Track every place that matters.")).toBeTruthy();
    expect(
      screen.getByText("Pro gives you unlimited places, full history, CSV export, and categories."),
    ).toBeTruthy();
  });

  it("renders all five feature bullets", () => {
    render(wrap(<PaywallScreen onClose={() => {}} />));
    expect(screen.getByText("Unlimited places")).toBeTruthy();
    expect(screen.getByText("Full history (no 14-day limit)")).toBeTruthy();
    expect(screen.getByText("Weekly reports for past weeks")).toBeTruthy();
    expect(screen.getByText("CSV export")).toBeTruthy();
    expect(screen.getByText("Place categories")).toBeTruthy();
  });

  it("renders both plan cards with their default fallback prices and the yearly badge", () => {
    render(wrap(<PaywallScreen onClose={() => {}} />));
    expect(screen.getByTestId("plan-card-year")).toBeTruthy();
    expect(screen.getByTestId("plan-card-month")).toBeTruthy();
    expect(screen.getByText("Yearly")).toBeTruthy();
    expect(screen.getByText("Monthly")).toBeTruthy();
    expect(screen.getByText("€29.99")).toBeTruthy();
    expect(screen.getByText("€4.99")).toBeTruthy();
    expect(screen.getByText("Save 50%")).toBeTruthy();
  });

  it("yearly is selected by default", () => {
    render(wrap(<PaywallScreen onClose={() => {}} />));
    const yearCard = screen.getByTestId("plan-card-year");
    const monthCard = screen.getByTestId("plan-card-month");
    expect(yearCard.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(monthCard.props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });

  it("CTA reads 'Start free trial' when yearly is selected", () => {
    render(wrap(<PaywallScreen onClose={() => {}} />));
    expect(screen.getByText("Start free trial")).toBeTruthy();
  });

  it("tapping Monthly switches the selection and re-labels the CTA", () => {
    render(wrap(<PaywallScreen onClose={() => {}} />));
    fireEvent.press(screen.getByTestId("plan-card-month"));
    expect(screen.getByText("Subscribe")).toBeTruthy();
  });

  it("renders the Restore purchases link and Terms · Privacy caption", () => {
    render(wrap(<PaywallScreen onClose={() => {}} />));
    expect(screen.getByTestId("paywall-restore")).toBeTruthy();
    expect(screen.getByText("Restore purchases")).toBeTruthy();
    expect(screen.getByText("Terms · Privacy")).toBeTruthy();
  });
});

describe("PaywallScreen — live offering prices", () => {
  it("renders product.priceString from the offering when available", () => {
    mockPro.offerings = {
      annual: makePackage("$rc_annual", "$24.99"),
      monthly: makePackage("$rc_monthly", "$3.99"),
    } as unknown as PurchasesOffering;
    render(wrap(<PaywallScreen onClose={() => {}} />));
    expect(screen.getByText("$24.99")).toBeTruthy();
    expect(screen.getByText("$3.99")).toBeTruthy();
    // Fallback prices are not present.
    expect(screen.queryByText("€29.99")).toBeNull();
    expect(screen.queryByText("€4.99")).toBeNull();
  });

  it("falls back to hardcoded prices when offering has no annual/monthly packages", () => {
    mockPro.offerings = { annual: null, monthly: null } as unknown as PurchasesOffering;
    render(wrap(<PaywallScreen onClose={() => {}} />));
    expect(screen.getByText("€29.99")).toBeTruthy();
    expect(screen.getByText("€4.99")).toBeTruthy();
  });
});

describe("PaywallScreen — purchase flow", () => {
  it("tapping CTA without a loaded offering surfaces a 'pricing not loaded' banner", async () => {
    render(wrap(<PaywallScreen onClose={() => {}} />));
    fireEvent.press(screen.getByTestId("paywall-cta"));
    await waitFor(() => expect(screen.getByTestId("paywall-error")).toBeTruthy());
    expect(screen.getByText(/pricing isn't loaded/i)).toBeTruthy();
    expect(mockPro.purchase).not.toHaveBeenCalled();
  });

  it("tapping CTA with the yearly plan calls purchase(annualPkg) and closes on success", async () => {
    const annualPkg = makePackage("$rc_annual", "€29.99");
    mockPro.offerings = {
      annual: annualPkg,
      monthly: makePackage("$rc_monthly", "€4.99"),
    } as unknown as PurchasesOffering;
    const onClose = jest.fn();
    render(wrap(<PaywallScreen onClose={onClose} />));
    await act(async () => {
      fireEvent.press(screen.getByTestId("paywall-cta"));
    });
    expect(mockPro.purchase).toHaveBeenCalledWith(annualPkg);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("switching to Monthly then tapping CTA calls purchase(monthlyPkg)", async () => {
    const monthlyPkg = makePackage("$rc_monthly", "€4.99");
    mockPro.offerings = {
      annual: makePackage("$rc_annual", "€29.99"),
      monthly: monthlyPkg,
    } as unknown as PurchasesOffering;
    const onClose = jest.fn();
    render(wrap(<PaywallScreen onClose={onClose} />));
    fireEvent.press(screen.getByTestId("plan-card-month"));
    await act(async () => {
      fireEvent.press(screen.getByTestId("paywall-cta"));
    });
    expect(mockPro.purchase).toHaveBeenCalledWith(monthlyPkg);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("renders an error banner when purchase rejects, does not close", async () => {
    mockPro.offerings = {
      annual: makePackage("$rc_annual", "€29.99"),
      monthly: makePackage("$rc_monthly", "€4.99"),
    } as unknown as PurchasesOffering;
    mockPro.purchase = jest.fn().mockRejectedValue(new Error("Network error"));
    const onClose = jest.fn();
    render(wrap(<PaywallScreen onClose={onClose} />));
    await act(async () => {
      fireEvent.press(screen.getByTestId("paywall-cta"));
    });
    await waitFor(() => expect(screen.getByTestId("paywall-error")).toBeTruthy());
    expect(screen.getByText("Network error")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("user-cancelled error reads as a friendlier 'cancelled' message", async () => {
    mockPro.offerings = {
      annual: makePackage("$rc_annual", "€29.99"),
      monthly: makePackage("$rc_monthly", "€4.99"),
    } as unknown as PurchasesOffering;
    mockPro.purchase = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error("Cancelled"), { userCancelled: true }));
    render(wrap(<PaywallScreen onClose={() => {}} />));
    await act(async () => {
      fireEvent.press(screen.getByTestId("paywall-cta"));
    });
    await waitFor(() => expect(screen.getByTestId("paywall-error")).toBeTruthy());
    expect(screen.getByText(/cancelled/i)).toBeTruthy();
  });

  it("retry button on the error banner re-attempts the purchase", async () => {
    mockPro.offerings = {
      annual: makePackage("$rc_annual", "€29.99"),
      monthly: makePackage("$rc_monthly", "€4.99"),
    } as unknown as PurchasesOffering;
    mockPro.purchase = jest
      .fn()
      .mockRejectedValueOnce(new Error("first try fails"))
      .mockResolvedValueOnce(undefined);
    const onClose = jest.fn();
    render(wrap(<PaywallScreen onClose={onClose} />));
    await act(async () => {
      fireEvent.press(screen.getByTestId("paywall-cta"));
    });
    await waitFor(() => expect(screen.getByTestId("paywall-error")).toBeTruthy());
    // Retry — should clear the banner and close the sheet.
    await act(async () => {
      fireEvent.press(screen.getByText("Try again"));
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockPro.purchase).toHaveBeenCalledTimes(2);
  });
});

describe("PaywallScreen — restore purchases", () => {
  it("tapping Restore purchases calls restore() and updates the label to 'Purchases restored'", async () => {
    render(wrap(<PaywallScreen onClose={() => {}} />));
    await act(async () => {
      fireEvent.press(screen.getByTestId("paywall-restore"));
    });
    expect(mockPro.restore).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText("Purchases restored")).toBeTruthy());
  });

  it("restore failure surfaces the same error banner", async () => {
    mockPro.restore = jest.fn().mockRejectedValue(new Error("offline"));
    render(wrap(<PaywallScreen onClose={() => {}} />));
    await act(async () => {
      fireEvent.press(screen.getByTestId("paywall-restore"));
    });
    await waitFor(() => expect(screen.getByTestId("paywall-error")).toBeTruthy());
    expect(screen.getByText("offline")).toBeTruthy();
  });
});

describe("PaywallScreen — close + props", () => {
  it("tapping the close (X) button calls onClose without invoking purchase", () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(wrap(<PaywallScreen onClose={onClose} />));
    fireEvent.press(getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockPro.purchase).not.toHaveBeenCalled();
  });

  it("accepts an optional `source` prop without rendering it", () => {
    render(wrap(<PaywallScreen onClose={() => {}} source="settings" />));
    expect(screen.getByText("Track every place that matters.")).toBeTruthy();
  });
});

import { act } from "@testing-library/react-native";
import RevenueCatUI from "react-native-purchases-ui";
import { openPaywall } from "../openPaywall";
import * as revenuecat from "../revenuecat";
import { PAYWALL_RESULT } from "../revenuecat";
import { useSheetStore } from "@/state/sheetStore";
import { useSnackbarStore } from "@/state/snackbarStore";

const presentPaywallMock = RevenueCatUI.presentPaywall as jest.Mock;
const getOfferingsSpy = jest.spyOn(revenuecat, "getOfferings");

// openPaywall only branches on null vs. non-null — the specific offering
// shape doesn't matter here, so stub just enough to satisfy the type.
const offeringStub = { identifier: "default" } as unknown as Awaited<
  ReturnType<typeof revenuecat.getOfferings>
>;

describe("openPaywall", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getOfferingsSpy.mockResolvedValue(offeringStub);
    act(() => {
      useSheetStore.getState().closeSheet();
      useSheetStore.getState().setPendingPlaceForm(null);
      useSnackbarStore.setState({ current: null });
    });
  });

  test("presents the RC paywall", async () => {
    presentPaywallMock.mockResolvedValueOnce(PAYWALL_RESULT.CANCELLED);
    openPaywall({ source: "settings" });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(presentPaywallMock).toHaveBeenCalledTimes(1);
  });

  test("PURCHASED with pendingPlaceForm reopens AddPlace", async () => {
    presentPaywallMock.mockResolvedValueOnce(PAYWALL_RESULT.PURCHASED);
    act(() => {
      useSheetStore.getState().setPendingPlaceForm({
        placeId: null,
        source: "places-tab",
        description: "x",
        latitude: 0,
        longitude: 0,
        name: "n",
        radiusM: 100,
        colorIdx: 0,
        iconIdx: 0,
        entryBufferMin: 5,
        exitBufferMin: 3,
        dailyGoalMinutes: null,
        weeklyGoalMinutes: null,
      });
    });
    openPaywall({ source: "2nd-place" });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(useSheetStore.getState().active).toBe("addPlace");
  });

  test("CANCELLED leaves AddPlace closed even with pendingPlaceForm", async () => {
    presentPaywallMock.mockResolvedValueOnce(PAYWALL_RESULT.CANCELLED);
    act(() => {
      useSheetStore.getState().setPendingPlaceForm({
        placeId: null,
        source: "places-tab",
        description: "x",
        latitude: 0,
        longitude: 0,
        name: "n",
        radiusM: 100,
        colorIdx: 0,
        iconIdx: 0,
        entryBufferMin: 5,
        exitBufferMin: 3,
        dailyGoalMinutes: null,
        weeklyGoalMinutes: null,
      });
    });
    openPaywall({ source: "2nd-place" });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(useSheetStore.getState().active).toBeNull();
  });

  test("null offering shows snackbar with retry action and skips presentPaywall", async () => {
    getOfferingsSpy.mockResolvedValueOnce(null);
    openPaywall({ source: "settings" });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(presentPaywallMock).not.toHaveBeenCalled();
    const snack = useSnackbarStore.getState().current;
    expect(snack).not.toBeNull();
    expect(snack!.message).toMatch(/pricing|preise/i);
    expect(snack!.action?.label).toBeTruthy();
  });

  test("snackbar retry action re-invokes openPaywall with the same source", async () => {
    getOfferingsSpy.mockResolvedValueOnce(null);
    openPaywall({ source: "settings" });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    const snack = useSnackbarStore.getState().current;
    expect(snack?.action?.onPress).toBeTruthy();
    // Second attempt uses the default offering from beforeEach.
    presentPaywallMock.mockResolvedValueOnce(PAYWALL_RESULT.CANCELLED);
    act(() => {
      snack!.action!.onPress();
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(presentPaywallMock).toHaveBeenCalledTimes(1);
  });

  test("loaded offering passes through to presentPaywall (regression)", async () => {
    presentPaywallMock.mockResolvedValueOnce(PAYWALL_RESULT.CANCELLED);
    openPaywall({ source: "settings" });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    // revenuecat.presentPaywall(offering) wraps the SDK call as
    // RevenueCatUI.presentPaywall({ offering }).
    expect(presentPaywallMock).toHaveBeenCalledWith({ offering: offeringStub });
  });
});

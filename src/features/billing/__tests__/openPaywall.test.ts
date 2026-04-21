import { act } from "@testing-library/react-native";
import RevenueCatUI from "react-native-purchases-ui";
import { openPaywall } from "../openPaywall";
import * as revenuecat from "../revenuecat";
import { PAYWALL_RESULT } from "../revenuecat";
import { useSheetStore } from "@/state/sheetStore";
import { useSnackbarStore } from "@/state/snackbarStore";

const presentPaywallMock = RevenueCatUI.presentPaywall as jest.Mock;

describe("openPaywall", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      useSheetStore.getState().closeSheet();
      useSheetStore.getState().setPendingPlaceForm(null);
      useSnackbarStore.setState({ current: null });
    });
  });

  test("mock mode shows a snackbar pointing at the Dev toggle", () => {
    jest.spyOn(revenuecat, "isMockMode").mockReturnValue(true);
    openPaywall({ source: "settings" });
    expect(useSnackbarStore.getState().current?.message).toBeTruthy();
    expect(presentPaywallMock).not.toHaveBeenCalled();
  });

  test("real mode presents the RC paywall", async () => {
    jest.spyOn(revenuecat, "isMockMode").mockReturnValue(false);
    presentPaywallMock.mockResolvedValueOnce(PAYWALL_RESULT.CANCELLED);
    openPaywall({ source: "settings" });
    await Promise.resolve();
    await Promise.resolve();
    expect(presentPaywallMock).toHaveBeenCalledTimes(1);
  });

  test("real-mode PURCHASED with pendingPlaceForm reopens AddPlace", async () => {
    jest.spyOn(revenuecat, "isMockMode").mockReturnValue(false);
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
    expect(useSheetStore.getState().active).toBe("addPlace");
  });

  test("real-mode CANCELLED leaves AddPlace closed even with pendingPlaceForm", async () => {
    jest.spyOn(revenuecat, "isMockMode").mockReturnValue(false);
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
    expect(useSheetStore.getState().active).toBeNull();
  });
});

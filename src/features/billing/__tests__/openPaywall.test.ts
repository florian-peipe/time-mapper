import { act } from "@testing-library/react-native";
import { openPaywall, openPlanChange } from "../openPaywall";
import * as revenuecat from "../revenuecat";
import { useSheetStore } from "@/state/sheetStore";
import { useSnackbarStore } from "@/state/snackbarStore";

const getOfferingsSpy = jest.spyOn(revenuecat, "getOfferings");

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

  test("opens the paywall sheet with the correct source", async () => {
    openPaywall({ source: "settings" });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    const state = useSheetStore.getState();
    expect(state.active).toBe("paywall");
    expect(state.payload).toMatchObject({ paywallSource: "settings" });
  });

  test("opens paywall sheet for 2nd-place source", async () => {
    openPaywall({ source: "2nd-place" });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(useSheetStore.getState().active).toBe("paywall");
    expect(useSheetStore.getState().payload).toMatchObject({ paywallSource: "2nd-place" });
  });

  test("null offering shows snackbar with retry action and skips opening sheet", async () => {
    getOfferingsSpy.mockResolvedValueOnce(null);
    openPaywall({ source: "settings" });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(useSheetStore.getState().active).toBeNull();
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
    // Second attempt: offering is available now (beforeEach default).
    act(() => {
      snack!.action!.onPress();
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(useSheetStore.getState().active).toBe("paywall");
    expect(useSheetStore.getState().payload).toMatchObject({ paywallSource: "settings" });
  });
});

describe("openPlanChange", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getOfferingsSpy.mockResolvedValue(offeringStub);
    act(() => {
      useSheetStore.getState().closeSheet();
      useSnackbarStore.setState({ current: null });
    });
  });

  test("opens paywall sheet in change mode with currentProductId", async () => {
    openPlanChange({ source: "settings-upgrade", currentProductId: "tm_pro_monthly" });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    const state = useSheetStore.getState();
    expect(state.active).toBe("paywall");
    expect(state.payload).toMatchObject({
      paywallSource: "settings-upgrade",
      mode: "change",
      currentProductId: "tm_pro_monthly",
    });
  });

  test("opens with settings-downgrade source for annual → monthly", async () => {
    openPlanChange({ source: "settings-downgrade", currentProductId: "tm_pro_annual" });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(useSheetStore.getState().payload).toMatchObject({
      paywallSource: "settings-downgrade",
      mode: "change",
      currentProductId: "tm_pro_annual",
    });
  });

  test("null offering shows snackbar and skips opening sheet", async () => {
    getOfferingsSpy.mockResolvedValueOnce(null);
    openPlanChange({ source: "settings-upgrade", currentProductId: "tm_pro_monthly" });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(useSheetStore.getState().active).toBeNull();
    const snack = useSnackbarStore.getState().current;
    expect(snack).not.toBeNull();
    expect(snack!.action?.label).toBeTruthy();
  });

  test("snackbar retry action re-invokes openPlanChange with the same opts", async () => {
    getOfferingsSpy.mockResolvedValueOnce(null);
    openPlanChange({ source: "settings-upgrade", currentProductId: "tm_pro_monthly" });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    const snack = useSnackbarStore.getState().current;
    act(() => {
      snack!.action!.onPress();
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(useSheetStore.getState().active).toBe("paywall");
    expect(useSheetStore.getState().payload).toMatchObject({
      mode: "change",
      currentProductId: "tm_pro_monthly",
    });
  });
});

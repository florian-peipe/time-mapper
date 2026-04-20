import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { PermissionsScreen } from "./PermissionsScreen";

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: jest.fn(),
    canGoBack: () => false,
  }),
}));

type LocStatus = "granted" | "foreground-only" | "denied" | "undetermined";
const mockReqFg = jest.fn<Promise<LocStatus>, []>(async () => "granted");
const mockReqBg = jest.fn<Promise<LocStatus>, []>(async () => "granted");
const mockReqNotif = jest.fn<Promise<"granted" | "denied" | "undetermined">, []>(
  async () => "granted",
);

jest.mock("@/features/permissions", () => ({
  requestForegroundLocation: () => mockReqFg(),
  requestBackgroundLocation: () => mockReqBg(),
  requestNotifications: () => mockReqNotif(),
}));

function wrap(ui: React.ReactNode) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 640 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>
    </SafeAreaProvider>
  );
}

beforeEach(() => {
  mockPush.mockReset();
  mockReplace.mockReset();
  mockReqFg.mockReset().mockResolvedValue("granted");
  mockReqBg.mockReset().mockResolvedValue("granted");
  mockReqNotif.mockReset().mockResolvedValue("granted");
});

describe("PermissionsScreen", () => {
  it("renders the 'Always location' headline and rationale", () => {
    render(wrap(<PermissionsScreen />));
    expect(screen.getByText(/Always location/i)).toBeTruthy();
    expect(screen.getByText(/on your device/i)).toBeTruthy();
  });

  it("enable CTA requests foreground location, advances to first-place", async () => {
    render(wrap(<PermissionsScreen />));
    await act(async () => {
      fireEvent.press(screen.getByTestId("onboarding-permissions-enable"));
    });
    expect(mockReqFg).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/(onboarding)/first-place");
  });

  it("foreground grant triggers background request", async () => {
    mockReqFg.mockResolvedValue("foreground-only");
    render(wrap(<PermissionsScreen />));
    await act(async () => {
      fireEvent.press(screen.getByTestId("onboarding-permissions-enable"));
    });
    expect(mockReqBg).toHaveBeenCalled();
  });

  it("foreground denied skips background and still requests notifications", async () => {
    mockReqFg.mockResolvedValue("denied");
    render(wrap(<PermissionsScreen />));
    await act(async () => {
      fireEvent.press(screen.getByTestId("onboarding-permissions-enable"));
    });
    expect(mockReqBg).not.toHaveBeenCalled();
    expect(mockReqNotif).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/(onboarding)/first-place");
  });

  it("any denial still advances — partial setup is still usable", async () => {
    mockReqFg.mockResolvedValue("denied");
    mockReqNotif.mockResolvedValue("denied");
    render(wrap(<PermissionsScreen />));
    await act(async () => {
      fireEvent.press(screen.getByTestId("onboarding-permissions-enable"));
    });
    expect(mockPush).toHaveBeenCalledWith("/(onboarding)/first-place");
  });

  it("'Not now' skips prompting and advances", () => {
    render(wrap(<PermissionsScreen />));
    fireEvent.press(screen.getByTestId("onboarding-permissions-skip"));
    expect(mockReqFg).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/(onboarding)/first-place");
  });
});

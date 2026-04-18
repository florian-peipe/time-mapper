import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { PermissionsScreen } from "./PermissionsScreen";

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
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
});

describe("PermissionsScreen", () => {
  it("renders the 'Always location' headline and rationale", () => {
    render(wrap(<PermissionsScreen />));
    expect(screen.getByText(/Always location/i)).toBeTruthy();
    expect(screen.getByText(/on your device/i)).toBeTruthy();
  });

  it("enable CTA advances to the first-place screen", () => {
    render(wrap(<PermissionsScreen />));
    fireEvent.press(screen.getByTestId("onboarding-permissions-enable"));
    expect(mockPush).toHaveBeenCalledWith("/(onboarding)/first-place");
  });

  it("'Not now' also advances — the OS prompt is deferred to later", () => {
    render(wrap(<PermissionsScreen />));
    fireEvent.press(screen.getByTestId("onboarding-permissions-skip"));
    expect(mockPush).toHaveBeenCalledWith("/(onboarding)/first-place");
  });
});

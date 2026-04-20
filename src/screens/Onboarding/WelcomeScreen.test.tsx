import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { WelcomeScreen } from "./WelcomeScreen";

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

describe("WelcomeScreen", () => {
  it("renders the brand title and pitch copy", () => {
    render(wrap(<WelcomeScreen />));
    expect(screen.getByText("Time Mapper")).toBeTruthy();
    expect(screen.getByText(/automatic time tracking/i)).toBeTruthy();
  });

  it("primary CTA advances to the how-it-works slide", () => {
    render(wrap(<WelcomeScreen />));
    fireEvent.press(screen.getByTestId("onboarding-welcome-continue"));
    expect(mockPush).toHaveBeenCalledWith("/(onboarding)/how-it-works");
  });
});

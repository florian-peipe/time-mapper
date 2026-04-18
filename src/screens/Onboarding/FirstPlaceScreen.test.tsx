import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { KvRepo } from "@/db/repository/kv";
import { createTestDb } from "@/db/testClient";
import { useSheetStore } from "@/state/sheetStore";
import { useUiStore } from "@/state/uiStore";
import { KvRepoProvider, ONBOARDING_COMPLETE_KEY } from "@/features/onboarding/useOnboardingGate";
import { FirstPlaceScreen } from "./FirstPlaceScreen";

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

function setup() {
  const db = createTestDb();
  const repo = new KvRepo(db);
  const utils = render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 640 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider schemeOverride="light">
        <KvRepoProvider value={repo}>
          <FirstPlaceScreen />
        </KvRepoProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  return { ...utils, repo };
}

beforeEach(() => {
  mockPush.mockReset();
  mockReplace.mockReset();
  useSheetStore.setState({ active: null, payload: null });
  useUiStore.setState({
    themeOverride: null,
    localeOverride: null,
    onboardingComplete: false,
  });
});

describe("FirstPlaceScreen", () => {
  it("primary CTA opens the AddPlaceSheet tagged as onboarding", () => {
    setup();
    fireEvent.press(screen.getByTestId("onboarding-first-place-add"));
    expect(useSheetStore.getState().active).toBe("addPlace");
    expect(useSheetStore.getState().payload).toEqual({ placeId: null, source: "onboarding" });
  });

  it("'Skip' marks onboarding complete (KV + store) and routes to tabs", () => {
    const { repo } = setup();
    fireEvent.press(screen.getByTestId("onboarding-first-place-skip"));
    expect(repo.get(ONBOARDING_COMPLETE_KEY)).toBe("1");
    expect(useUiStore.getState().onboardingComplete).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
  });
});

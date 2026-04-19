import React from "react";
import { act, render, screen, fireEvent } from "@testing-library/react-native";
import { Linking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { TrackingBanner } from "./TrackingBanner";
import * as Location from "expo-location";
import { KvRepoProvider } from "@/features/onboarding/useOnboardingGate";
import { PlacesRepoProvider } from "@/features/places/usePlaces";
import { KvRepo } from "@/db/repository/kv";
import { PlacesRepo } from "@/db/repository/places";
import { createTestDb } from "@/db/testClient";

const mLoc = Location as jest.Mocked<typeof Location>;

function grant(): Location.LocationPermissionResponse {
  return {
    status: "granted",
    granted: true,
    expires: "never",
    canAskAgain: true,
  } as unknown as Location.LocationPermissionResponse;
}
function deny(): Location.LocationPermissionResponse {
  return {
    status: "denied",
    granted: false,
    expires: "never",
    canAskAgain: true,
  } as unknown as Location.LocationPermissionResponse;
}

function wrap(ui: React.ReactNode) {
  // The tracking-health derivation in TrackingBanner needs a KvRepo + a
  // PlacesRepo to read the last-fire timestamp + places count — seed with
  // a single place so the "empty → unknown" short-circuit doesn't swallow
  // the permission banner under test.
  const db = createTestDb();
  const kv = new KvRepo(db);
  const places = new PlacesRepo(db);
  places.create({ name: "Home", address: "a", latitude: 0, longitude: 0 });
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 640 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <ThemeProvider schemeOverride="light">
        <KvRepoProvider value={kv}>
          <PlacesRepoProvider value={places}>{ui}</PlacesRepoProvider>
        </KvRepoProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

describe("TrackingBanner", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders nothing when location is fully granted", async () => {
    mLoc.getForegroundPermissionsAsync.mockResolvedValue(grant());
    mLoc.getBackgroundPermissionsAsync.mockResolvedValue(grant());
    render(wrap(<TrackingBanner />));
    // Flush the pending promise from the initial effect.
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId("tracking-banner-fg-only")).toBeNull();
    expect(screen.queryByTestId("tracking-banner-denied")).toBeNull();
  });

  it("renders a warning banner when foreground-only", async () => {
    mLoc.getForegroundPermissionsAsync.mockResolvedValue(grant());
    mLoc.getBackgroundPermissionsAsync.mockResolvedValue(deny());
    render(wrap(<TrackingBanner />));
    // Flush the pending promise from the initial effect.
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId("tracking-banner-fg-only")).toBeTruthy();
  });

  it("renders a danger banner when fully denied", async () => {
    mLoc.getForegroundPermissionsAsync.mockResolvedValue(deny());
    render(wrap(<TrackingBanner />));
    // Flush the pending promise from the initial effect.
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId("tracking-banner-denied")).toBeTruthy();
  });

  it("tapping the CTA opens OS settings", async () => {
    mLoc.getForegroundPermissionsAsync.mockResolvedValue(deny());
    const openSpy = jest.spyOn(Linking, "openSettings").mockImplementation(async () => undefined);
    render(wrap(<TrackingBanner />));
    // Flush the pending promise from the initial effect.
    await act(async () => {
      await Promise.resolve();
    });
    const banner = screen.getByTestId("tracking-banner-denied");
    const button = banner.findByProps({ accessibilityRole: "button" });
    fireEvent.press(button);
    expect(openSpy).toHaveBeenCalled();
    openSpy.mockRestore();
  });
});

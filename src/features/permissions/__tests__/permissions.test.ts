import * as Location from "expo-location";
import * as N from "expo-notifications";
import {
  getLocationStatus,
  requestForegroundLocation,
  requestBackgroundLocation,
  getNotificationsStatus,
  requestNotifications,
} from "../index";

jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
}));

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));

const mLoc = Location as jest.Mocked<typeof Location>;
const mN = N as jest.Mocked<typeof N>;

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
function undet(): Location.LocationPermissionResponse {
  return {
    status: "undetermined",
    granted: false,
    expires: "never",
    canAskAgain: true,
  } as unknown as Location.LocationPermissionResponse;
}

describe("features/permissions", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("getLocationStatus", () => {
    test("fg granted + bg granted → granted", async () => {
      mLoc.getForegroundPermissionsAsync.mockResolvedValue(grant());
      mLoc.getBackgroundPermissionsAsync.mockResolvedValue(grant());
      expect(await getLocationStatus()).toBe("granted");
    });

    test("fg granted + bg denied → foreground-only", async () => {
      mLoc.getForegroundPermissionsAsync.mockResolvedValue(grant());
      mLoc.getBackgroundPermissionsAsync.mockResolvedValue(deny());
      expect(await getLocationStatus()).toBe("foreground-only");
    });

    test("fg denied → denied", async () => {
      mLoc.getForegroundPermissionsAsync.mockResolvedValue(deny());
      expect(await getLocationStatus()).toBe("denied");
    });

    test("fg undetermined → undetermined", async () => {
      mLoc.getForegroundPermissionsAsync.mockResolvedValue(undet());
      expect(await getLocationStatus()).toBe("undetermined");
    });
  });

  describe("requestForegroundLocation", () => {
    test("grant returns 'foreground-only' if background isn't yet granted", async () => {
      mLoc.requestForegroundPermissionsAsync.mockResolvedValue(grant());
      mLoc.getBackgroundPermissionsAsync.mockResolvedValue(deny());
      expect(await requestForegroundLocation()).toBe("foreground-only");
    });

    test("grant returns 'granted' if background was already granted (e.g. re-prompt)", async () => {
      mLoc.requestForegroundPermissionsAsync.mockResolvedValue(grant());
      mLoc.getBackgroundPermissionsAsync.mockResolvedValue(grant());
      expect(await requestForegroundLocation()).toBe("granted");
    });

    test("deny returns 'denied'", async () => {
      mLoc.requestForegroundPermissionsAsync.mockResolvedValue(deny());
      expect(await requestForegroundLocation()).toBe("denied");
    });

    test("thrown error falls back to 'denied' (cannot propagate)", async () => {
      mLoc.requestForegroundPermissionsAsync.mockRejectedValue(new Error("no"));
      expect(await requestForegroundLocation()).toBe("denied");
    });
  });

  describe("requestBackgroundLocation", () => {
    test("grant → granted", async () => {
      mLoc.requestBackgroundPermissionsAsync.mockResolvedValue(grant());
      expect(await requestBackgroundLocation()).toBe("granted");
    });

    test("deny with foreground still granted → 'foreground-only'", async () => {
      mLoc.requestBackgroundPermissionsAsync.mockResolvedValue(deny());
      mLoc.getForegroundPermissionsAsync.mockResolvedValue(grant());
      expect(await requestBackgroundLocation()).toBe("foreground-only");
    });

    test("deny with foreground also lost → 'denied'", async () => {
      mLoc.requestBackgroundPermissionsAsync.mockResolvedValue(deny());
      mLoc.getForegroundPermissionsAsync.mockResolvedValue(deny());
      expect(await requestBackgroundLocation()).toBe("denied");
    });
  });

  describe("getNotificationsStatus / requestNotifications", () => {
    test("getNotificationsStatus returns 'granted' when permission is granted", async () => {
      mN.getPermissionsAsync.mockResolvedValue({
        status: "granted",
        granted: true,
      } as unknown as N.NotificationPermissionsStatus);
      expect(await getNotificationsStatus()).toBe("granted");
    });

    test("requestNotifications returns 'denied' when the user refuses", async () => {
      mN.requestPermissionsAsync.mockResolvedValue({
        status: "denied",
        granted: false,
      } as unknown as N.NotificationPermissionsStatus);
      expect(await requestNotifications()).toBe("denied");
    });
  });
});

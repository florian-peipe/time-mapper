import { webcrypto } from "node:crypto";

if (typeof globalThis.crypto === "undefined") {
  // Node 18 has webcrypto, but may not expose it as globalThis.crypto in Jest jsdom env
  (globalThis as unknown as { crypto: Crypto }).crypto = webcrypto as unknown as Crypto;
}

// Default module mocks for the native modules we touch in tracking code.
// Individual test files can still jest.mock() these to override with custom
// per-test behavior; this just provides a safe "nothing happens" default for
// the broad swath of UI tests that don't care about permission state.
jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn(async () => ({
    status: "undetermined",
    granted: false,
    expires: "never",
    canAskAgain: true,
  })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({
    status: "undetermined",
    granted: false,
    expires: "never",
    canAskAgain: true,
  })),
  getBackgroundPermissionsAsync: jest.fn(async () => ({
    status: "undetermined",
    granted: false,
    expires: "never",
    canAskAgain: true,
  })),
  requestBackgroundPermissionsAsync: jest.fn(async () => ({
    status: "undetermined",
    granted: false,
    expires: "never",
    canAskAgain: true,
  })),
  startGeofencingAsync: jest.fn(async () => undefined),
  stopGeofencingAsync: jest.fn(async () => undefined),
  hasStartedGeofencingAsync: jest.fn(async () => false),
  getLastKnownPositionAsync: jest.fn(async () => null),
}));

jest.mock("expo-task-manager", () => ({
  defineTask: jest.fn(),
  isTaskDefined: jest.fn(() => false),
}));

jest.mock("expo-notifications", () => ({
  scheduleNotificationAsync: jest.fn(async () => "notif-id"),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  setNotificationCategoryAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ status: "undetermined", granted: false })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "undetermined", granted: false })),
  AndroidImportance: { LOW: 2, DEFAULT: 3, HIGH: 4 },
}));

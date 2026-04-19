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

jest.mock("expo-store-review", () => ({
  __esModule: true,
  isAvailableAsync: jest.fn(async () => false),
  requestReview: jest.fn(async () => undefined),
  hasAction: jest.fn(async () => false),
}));

jest.mock("expo-file-system", () => ({
  __esModule: true,
  documentDirectory: "/tmp/mock-docs/",
  writeAsStringAsync: jest.fn(async () => undefined),
  readAsStringAsync: jest.fn(async () => ""),
  deleteAsync: jest.fn(async () => undefined),
  getInfoAsync: jest.fn(async () => ({ exists: false })),
}));

jest.mock("expo-sharing", () => ({
  __esModule: true,
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

// @sentry/react-native ships native bridge modules that Jest can't load.
// Stub the whole module so crash.ts can still lazy-require without the
// real binding; real-init behavior is covered by the unit tests in
// crash.test.ts which override this mock per-case.
jest.mock("@sentry/react-native", () => ({
  __esModule: true,
  init: jest.fn(),
  captureException: jest.fn(),
  setUser: jest.fn(),
}));

// react-native-maps ships a native binding that Jest can't load through
// node_modules. We only need MapView/Marker/Circle to RENDER in UI tests —
// not to actually display tiles — so stub the exports with passthrough Views.
// Individual test files can override this mock if they need to verify
// specific map props.
jest.mock("react-native-maps", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native");
  const MapView = (props: { children?: unknown; testID?: string }) =>
    R.createElement(View, { testID: props.testID ?? "mock-mapview" }, props.children);
  const Marker = (props: { testID?: string }) =>
    R.createElement(View, { testID: props.testID ?? "mock-marker" });
  const Circle = (props: { testID?: string }) =>
    R.createElement(View, { testID: props.testID ?? "mock-circle" });
  return {
    __esModule: true,
    default: MapView,
    Marker,
    Circle,
    PROVIDER_DEFAULT: undefined,
  };
});

// react-native-purchases pulls in @revenuecat/purchases-js-hybrid-mappings at
// require-time, which ships ESM that jest can't parse. Screens that use
// `usePro` only care about the entitlement state, not the SDK plumbing —
// stub the module here so anyone who imports `./revenuecat` transitively
// gets a no-op implementation. Tests that need to drive the SDK directly
// (revenuecat.test.ts, usePro.test.tsx) override these with their own
// jest.mock() and jest.resetModules() between cases.
jest.mock("react-native-purchases", () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    getCustomerInfo: jest.fn(async () => ({
      entitlements: { all: {}, active: {}, verification: "NOT_REQUESTED" },
    })),
    getOfferings: jest.fn(async () => ({ all: {}, current: null })),
    purchasePackage: jest.fn(async () => ({
      customerInfo: { entitlements: { all: {}, active: {}, verification: "NOT_REQUESTED" } },
      productIdentifier: "stub",
    })),
    restorePurchases: jest.fn(async () => ({
      entitlements: { all: {}, active: {}, verification: "NOT_REQUESTED" },
    })),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(() => true),
  },
}));

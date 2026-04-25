// Breadcrumb contract test. Verifies the *real* breadcrumbs emitted by a
// scripted geofence → entry → paywall chain have the shapes the Sentry
// dashboard expects (category / message / level / data keys), and that
// scrubLocation strips coordinates from any breadcrumb that acquires them.
//
// Why contract-level (not just unit)? scrubLocation alone is unit-tested in
// crash.test.ts; what's missing is a test that exercises every call site
// through its real entry point (`handleGeofencingEvent`, `openPaywall`,
// `applyEffects`) and asserts the *emitted* shape. If a future commit
// introduces a breadcrumb with lat/lng in `data`, the invariant-safety-net
// test ensures scrubLocation still strips it.
import * as crash from "@/lib/crash";
import { getDeviceDb } from "@/db/deviceDb";
import { createTestDb } from "@/db/testClient";
import { PlacesRepo } from "@/db/repository/places";
import { handleGeofencingEvent } from "@/background/tasks";
import { openPaywall } from "@/features/billing/openPaywall";
import * as revenuecat from "@/features/billing/revenuecat";
import RevenueCatUI from "react-native-purchases-ui";

// Replace `addBreadcrumb` with a spy but keep `scrubLocation` + the rest of
// the crash module real. Every module that imports `addBreadcrumb` from here
// (tasks.ts, persistence.ts, openPaywall.ts) will resolve to the spy.
jest.mock("@/lib/crash", () => {
  const actual = jest.requireActual("@/lib/crash");
  return { ...actual, addBreadcrumb: jest.fn() };
});

// Use the in-memory test DB for handleGeofencingEvent. getDeviceDb() resolves
// to a fresh DB each test via beforeEach.
jest.mock("@/db/deviceDb", () => ({
  getDeviceDb: jest.fn(),
}));

// Notifier is a leaf side-effect; skip so the test doesn't depend on
// expo-notifications behavior. We're asserting breadcrumb emission, not
// notification fan-out.
jest.mock("@/features/notifications/notifier", () => ({
  maybeNotifyForEffects: jest.fn(async () => undefined),
}));

// trackingHealth writes a kv row each wake. The kv repo on the test DB would
// work too, but muting it keeps the test focused.
jest.mock("@/features/tracking/trackingHealth", () => ({
  recordBgFire: jest.fn(),
}));

type Breadcrumb = {
  category?: string;
  message?: string;
  level?: string;
  data?: Record<string, unknown>;
};

const addBreadcrumbSpy = crash.addBreadcrumb as jest.Mock;
const getDeviceDbMock = getDeviceDb as jest.MockedFunction<typeof getDeviceDb>;
const presentPaywallMock = RevenueCatUI.presentPaywall as jest.Mock;
const getOfferingsSpy = jest.spyOn(revenuecat, "getOfferings");

const offeringStub = { identifier: "default" } as unknown as Awaited<
  ReturnType<typeof revenuecat.getOfferings>
>;

// iOS eventType constants mirror background/tasks.ts.
const EVENT_ENTER = 1;

describe("breadcrumb contract — geofence → entry → paywall", () => {
  let placeId: string;

  beforeEach(() => {
    const db = createTestDb();
    getDeviceDbMock.mockReturnValue(db as unknown as ReturnType<typeof getDeviceDb>);
    const places = new PlacesRepo(db);
    const place = places.create({
      name: "Home",
      address: "Teststr 1",
      latitude: 50.9,
      longitude: 6.9,
      entryBufferS: 300,
      exitBufferS: 180,
    });
    placeId = place.id;
    addBreadcrumbSpy.mockClear();
    presentPaywallMock.mockReset();
    getOfferingsSpy.mockResolvedValue(offeringStub);
  });

  function emitted(): Breadcrumb[] {
    return addBreadcrumbSpy.mock.calls.map((c) => c[0] as Breadcrumb);
  }

  test("REGION_ENTER → 'geofence/region-enter' crumb carries placeId + atS, no coords", async () => {
    await handleGeofencingEvent(
      {
        eventType: EVENT_ENTER,
        region: { identifier: placeId, latitude: 50.9, longitude: 6.9, radius: 100 },
      },
      10_000,
    );

    const crumbs = emitted();
    const geo = crumbs.find((c) => c.category === "geofence");
    expect(geo).toBeDefined();
    expect(geo).toMatchObject({
      category: "geofence",
      message: "region-enter",
      level: "info",
      data: { placeId, atS: 10_000 },
    });
    expect(geo!.data).not.toHaveProperty("latitude");
    expect(geo!.data).not.toHaveProperty("longitude");
    expect(geo!.data).not.toHaveProperty("location");
  });

  test("ENTER + elapsed buffer fires 'entry/entry-open' with placeId + entryId, no coords", async () => {
    // Step 1: ENTER at t=10_000 — creates pending_enter row, buffer=300.
    await handleGeofencingEvent(
      {
        eventType: EVENT_ENTER,
        region: { identifier: placeId, latitude: 50.9, longitude: 6.9, radius: 100 },
      },
      10_000,
    );
    addBreadcrumbSpy.mockClear();

    // Step 2: No event, but nowS past the 300s buffer → opportunistic CONFIRM
    // flips PENDING_ENTER → ACTIVE, emitting entry-open.
    await handleGeofencingEvent(null, 10_400);

    const crumbs = emitted();
    const open = crumbs.find((c) => c.message === "entry-open");
    expect(open).toBeDefined();
    expect(open).toMatchObject({
      category: "entry",
      message: "entry-open",
      level: "info",
    });
    expect(open!.data).toHaveProperty("placeId", placeId);
    expect(open!.data).toHaveProperty("entryId");
    expect(typeof open!.data!.entryId).toBe("string");
    expect(open!.data).toHaveProperty("atS", 10_000);
    expect(open!.data).not.toHaveProperty("latitude");
    expect(open!.data).not.toHaveProperty("longitude");
  });

  test("openPaywall emits 'paywall-open' then 'paywall-closed' with {source, result}, no coords", async () => {
    presentPaywallMock.mockResolvedValueOnce("CANCELLED");
    openPaywall({ source: "settings" });
    // openPaywall is fire-and-forget — drain microtasks to reach the trailing
    // crumb. Matches the pattern in openPaywall.test.ts.
    for (let i = 0; i < 4; i++) await Promise.resolve();

    const crumbs = emitted();
    const open = crumbs.find((c) => c.message === "paywall-open");
    const closed = crumbs.find((c) => c.message === "paywall-closed");

    expect(open).toMatchObject({
      category: "paywall",
      message: "paywall-open",
      level: "info",
      data: { source: "settings" },
    });
    expect(closed).toMatchObject({
      category: "paywall",
      message: "paywall-closed",
      level: "info",
      data: { source: "settings", result: "CANCELLED" },
    });
    for (const c of [open, closed]) {
      expect(c!.data).not.toHaveProperty("latitude");
      expect(c!.data).not.toHaveProperty("longitude");
    }
  });

  test("end-to-end script: geofence → entry-open → paywall-open → paywall-closed (ordered)", async () => {
    await handleGeofencingEvent(
      {
        eventType: EVENT_ENTER,
        region: { identifier: placeId, latitude: 50.9, longitude: 6.9, radius: 100 },
      },
      10_000,
    );
    await handleGeofencingEvent(null, 10_400); // CONFIRM past buffer
    presentPaywallMock.mockResolvedValueOnce("CANCELLED");
    openPaywall({ source: "settings" });
    for (let i = 0; i < 4; i++) await Promise.resolve();

    // Filter to known-stable messages; a future commit that adds a benign
    // crumb (e.g. a second paywall source) must not fail this ordering test.
    const messages = emitted().map((c) => c.message);
    const stable = messages.filter((m) =>
      ["region-enter", "entry-open", "paywall-open", "paywall-closed"].includes(m ?? ""),
    );
    expect(stable).toEqual(["region-enter", "entry-open", "paywall-open", "paywall-closed"]);
  });
});

describe("breadcrumb contract — scrubLocation invariant", () => {
  test("strips latitude/longitude/location from every breadcrumb data slot while preserving other keys", () => {
    const event = {
      breadcrumbs: [
        {
          data: {
            latitude: 50.9,
            longitude: 6.9,
            location: "home",
            placeId: "place-1",
            atS: 10_000,
          },
        },
        {
          data: { entryId: "e-1", atS: 12_000, longitude: 0 },
        },
      ],
      extra: { latitude: 50.9, longitude: 6.9, location: "home", keep: "me" },
    };

    const result = crash.scrubLocation(event) as typeof event;

    // Extra is scrubbed AND unrelated keys survive.
    expect(result.extra).not.toHaveProperty("latitude");
    expect(result.extra).not.toHaveProperty("longitude");
    expect(result.extra).not.toHaveProperty("location");
    expect(result.extra).toHaveProperty("keep", "me");

    // Each breadcrumb's data is scrubbed without dropping legitimate fields.
    const bc0 = result.breadcrumbs[0]!;
    const bc1 = result.breadcrumbs[1]!;
    expect(bc0.data).not.toHaveProperty("latitude");
    expect(bc0.data).not.toHaveProperty("longitude");
    expect(bc0.data).not.toHaveProperty("location");
    expect(bc0.data).toHaveProperty("placeId", "place-1");
    expect(bc0.data).toHaveProperty("atS", 10_000);

    expect(bc1.data).not.toHaveProperty("longitude");
    expect(bc1.data).toHaveProperty("entryId", "e-1");
    expect(bc1.data).toHaveProperty("atS", 12_000);
  });

  test("no-op on non-object input", () => {
    expect(crash.scrubLocation(null)).toBeNull();
    expect(crash.scrubLocation("plain")).toBe("plain");
    expect(crash.scrubLocation(42)).toBe(42);
  });
});

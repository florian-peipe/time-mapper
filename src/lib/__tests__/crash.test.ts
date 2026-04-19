import {
  initCrashReporting,
  captureException,
  scrubLocation,
  isCrashReportingEnabled,
  identifyAnonUser,
  __resetForTests,
} from "../crash";

describe("crash reporting", () => {
  const DSN_KEY = "EXPO_PUBLIC_SENTRY_DSN";
  let originalDsn: string | undefined;

  beforeEach(() => {
    originalDsn = process.env[DSN_KEY];
    delete process.env[DSN_KEY];
    __resetForTests();
  });
  afterEach(() => {
    if (originalDsn !== undefined) process.env[DSN_KEY] = originalDsn;
    __resetForTests();
  });

  it("no-ops when DSN is missing and logs a single informational line", () => {
    const info = jest.spyOn(console, "info").mockImplementation(() => undefined);
    initCrashReporting();
    initCrashReporting(); // second call should not double-log
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0]![0]).toMatch(/DSN not set/);
    expect(isCrashReportingEnabled()).toBe(false);
    info.mockRestore();
  });

  it("initializes Sentry when DSN + module are present", () => {
    process.env[DSN_KEY] = "https://fake-dsn@sentry.io/123";
    // The jest.setup.ts @sentry/react-native stub exposes `init` as a
    // spyable mock; after initCrashReporting runs, the flag flips true.
    initCrashReporting();
    expect(isCrashReportingEnabled()).toBe(true);
  });

  it("captureException falls back to console.error when Sentry is disabled", () => {
    const err = jest.spyOn(console, "error").mockImplementation(() => undefined);
    captureException(new Error("boom"), { context: "test" });
    expect(err).toHaveBeenCalledWith(expect.stringContaining("[crash]"), expect.any(Error), {
      context: "test",
    });
    err.mockRestore();
  });

  it("identifyAnonUser is a no-op without Sentry", () => {
    expect(() => identifyAnonUser("anon-abc")).not.toThrow();
    expect(() => identifyAnonUser(null)).not.toThrow();
  });

  describe("scrubLocation", () => {
    it("drops latitude / longitude / location from extra", () => {
      const event = {
        extra: { latitude: 50.1, longitude: 6.2, location: { foo: 1 }, keep: "yes" },
      };
      scrubLocation(event);
      expect(event.extra.latitude).toBeUndefined();
      expect(event.extra.longitude).toBeUndefined();
      expect(event.extra.location).toBeUndefined();
      expect(event.extra.keep).toBe("yes");
    });

    it("drops location fields from each breadcrumb", () => {
      const event = {
        breadcrumbs: [
          { data: { location: { lat: 1 }, latitude: 1, longitude: 2, other: "k" } },
          { data: { other: "x" } },
        ],
      };
      scrubLocation(event);
      expect(event.breadcrumbs[0]!.data.location).toBeUndefined();
      expect(event.breadcrumbs[0]!.data.latitude).toBeUndefined();
      expect(event.breadcrumbs[0]!.data.longitude).toBeUndefined();
      expect(event.breadcrumbs[0]!.data.other).toBe("k");
      expect(event.breadcrumbs[1]!.data.other).toBe("x");
    });

    it("tolerates non-object events", () => {
      expect(() => scrubLocation(null)).not.toThrow();
      expect(() => scrubLocation("string")).not.toThrow();
      expect(() => scrubLocation(42)).not.toThrow();
    });
  });
});

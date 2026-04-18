import { buildDiagnosticPayload, exportDiagnosticLog } from "../exportLog";

describe("diagnostics", () => {
  it("buildDiagnosticPayload returns the expected shape", () => {
    const payload = buildDiagnosticPayload();
    expect(payload).toHaveProperty("generatedAt");
    expect(payload).toHaveProperty("platform");
    expect(payload).toHaveProperty("appVersion");
    expect(payload).toHaveProperty("environment");
    expect(payload.environment).toHaveProperty("hasPlacesKey");
    expect(payload.environment).toHaveProperty("hasRevenueCatIos");
    expect(Array.isArray(payload.pendingTransitions)).toBe(true);
    expect(Array.isArray(payload.recentEvents)).toBe(true);
  });

  it("buildDiagnosticPayload honors overrides", () => {
    const payload = buildDiagnosticPayload({
      appVersion: "1.2.3",
      anonUserId: "anon-abc",
      pendingTransitions: [{ placeId: "a" }],
    });
    expect(payload.appVersion).toBe("1.2.3");
    expect(payload.anonUserId).toBe("anon-abc");
    expect(payload.pendingTransitions).toHaveLength(1);
  });

  it("exportDiagnosticLog logs to console without throwing when modules unavailable", async () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    await expect(exportDiagnosticLog()).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith("[diagnostics]", expect.any(String));
    spy.mockRestore();
  });
});

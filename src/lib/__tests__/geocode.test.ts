import { autocomplete, geocodePlace, DEMO_SUGGESTIONS } from "../geocode";

// Inside Jest the geocode module short-circuits to a deterministic demo
// list so tests don't hit the network. To exercise the real Photon
// branch we temporarily unset JEST_WORKER_ID, mock fetch, and run the
// assertions.

describe("geocode — Jest demo fallback", () => {
  it("autocomplete returns the full demo list for empty query (seeds the sheet on open)", async () => {
    const r = await autocomplete("");
    expect(r.length).toBe(DEMO_SUGGESTIONS.length);
    expect(r[0]).toHaveProperty("placeId");
  });

  it("autocomplete filters demo by keyword", async () => {
    const r = await autocomplete("Düsseldorf");
    expect(r.length).toBe(1);
    expect(r[0]!.description).toContain("Düsseldorf");
  });

  it("autocomplete filters demo by street", async () => {
    const r = await autocomplete("Kinkel");
    expect(r.length).toBe(2);
  });

  it("autocomplete with unmatched query returns empty", async () => {
    const r = await autocomplete("nonexistent-street-42");
    expect(r).toEqual([]);
  });

  it("geocodePlace returns demo coordinates for known demo ids", async () => {
    const details = await geocodePlace("demo-koeln-1");
    expect(details.lat).toBeCloseTo(50.9613, 3);
    expect(details.lng).toBeCloseTo(6.9585, 3);
    expect(details.formattedAddress).toContain("Kinkelstr");
  });

  it("geocodePlace throws for unknown demo id", async () => {
    await expect(geocodePlace("not-a-demo-id")).rejects.toThrow(/unknown placeId/);
  });

  it("geocodePlace decodes coordinates from an OSM-style placeId without hitting the network", async () => {
    const details = await geocodePlace("osm:123456:52.52:13.405");
    expect(details.lat).toBeCloseTo(52.52, 3);
    expect(details.lng).toBeCloseTo(13.405, 3);
    expect(details.formattedAddress).toBe("");
  });

  it("geocodePlace rejects malformed OSM-style placeId", async () => {
    await expect(geocodePlace("osm:x:not-a-number:13.4")).rejects.toThrow(/invalid OSM/);
  });

  it("DEMO_SUGGESTIONS is non-empty and well-formed", () => {
    expect(DEMO_SUGGESTIONS.length).toBeGreaterThan(0);
    for (const s of DEMO_SUGGESTIONS) {
      expect(s.placeId).toMatch(/^demo-/);
      expect(s.mainText.length).toBeGreaterThan(0);
    }
  });
});

describe("geocode — Photon live API (mocked fetch)", () => {
  let originalWorkerId: string | undefined;
  let originalFetch: typeof fetch | undefined;

  beforeEach(() => {
    originalWorkerId = process.env.JEST_WORKER_ID;
    delete process.env.JEST_WORKER_ID;
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    if (originalWorkerId !== undefined) process.env.JEST_WORKER_ID = originalWorkerId;
    if (originalFetch) globalThis.fetch = originalFetch;
  });

  it("autocomplete builds a Photon URL and maps a feature into a PlaceSuggestion", async () => {
    const mockFetch = jest.fn(async (url: string) => {
      expect(url).toContain("photon.komoot.io");
      expect(url).toContain("q=Berlin");
      expect(url).toContain("limit=8");
      return new Response(
        JSON.stringify({
          features: [
            {
              properties: {
                osm_id: 240109189,
                name: "Berlin",
                city: "Berlin",
                postcode: "10115",
                state: "Berlin",
                country: "Germany",
              },
              geometry: { coordinates: [13.405, 52.52] },
            },
          ],
        }),
        { status: 200 },
      );
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const r = await autocomplete("Berlin");
    expect(r).toHaveLength(1);
    expect(r[0]!.placeId).toBe("osm:240109189:52.52:13.405");
    expect(r[0]!.description).toContain("Berlin");
    expect(r[0]!.secondaryText).toContain("Germany");
  });

  it("autocomplete returns the empty array for <2 char queries (skips network)", async () => {
    const mockFetch = jest.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    const r = await autocomplete("a");
    expect(r).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("autocomplete falls back to the demo list on HTTP failure", async () => {
    globalThis.fetch = jest.fn(
      async () => new Response("server on fire", { status: 500 }),
    ) as unknown as typeof fetch;
    const r = await autocomplete("Köln");
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((s) => s.placeId.startsWith("demo-"))).toBe(true);
  });

  it("autocomplete propagates AbortError so callers can tell cancel apart from failure", async () => {
    globalThis.fetch = jest.fn(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }) as unknown as typeof fetch;
    await expect(autocomplete("anywhere")).rejects.toThrow(/aborted/);
  });

  it("autocomplete handles features with missing properties gracefully", async () => {
    globalThis.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            features: [
              {
                geometry: { coordinates: [8.1, 50.3] },
              },
            ],
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;
    const r = await autocomplete("Mainz");
    expect(r).toHaveLength(1);
    expect(r[0]!.placeId).toMatch(/^osm:/);
  });
});

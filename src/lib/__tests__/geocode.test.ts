import { autocomplete, geocodePlace } from "../geocode";

describe("geocode — short query handling", () => {
  let originalFetch: typeof fetch | undefined;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    if (originalFetch) globalThis.fetch = originalFetch;
  });

  it("autocomplete returns empty + ok for queries shorter than 2 chars", async () => {
    const mockFetch = jest.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    await expect(autocomplete("")).resolves.toEqual({ suggestions: [], failed: false });
    await expect(autocomplete("a")).resolves.toEqual({ suggestions: [], failed: false });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("geocode — Photon live API (mocked fetch)", () => {
  let originalFetch: typeof fetch | undefined;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
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

    const { suggestions, failed } = await autocomplete("Berlin");
    expect(failed).toBe(false);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.placeId).toBe("osm:240109189:52.52:13.405");
    expect(suggestions[0]!.description).toContain("Berlin");
    expect(suggestions[0]!.secondaryText).toContain("Germany");
  });

  it("autocomplete returns empty + failed=true on HTTP failure", async () => {
    globalThis.fetch = jest.fn(
      async () => new Response("server on fire", { status: 500 }),
    ) as unknown as typeof fetch;
    const { suggestions, failed } = await autocomplete("Köln");
    expect(suggestions).toEqual([]);
    expect(failed).toBe(true);
  });

  it("autocomplete returns empty + failed=true on network error", async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError("Network request failed");
    }) as unknown as typeof fetch;
    const { suggestions, failed } = await autocomplete("Hamburg");
    expect(suggestions).toEqual([]);
    expect(failed).toBe(true);
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
    const { suggestions } = await autocomplete("Mainz");
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.placeId).toMatch(/^osm:/);
  });
});

describe("geocodePlace", () => {
  it("decodes coordinates from an OSM-style placeId without hitting the network", async () => {
    const details = await geocodePlace("osm:123456:52.52:13.405");
    expect(details.lat).toBeCloseTo(52.52, 3);
    expect(details.lng).toBeCloseTo(13.405, 3);
    expect(details.formattedAddress).toBe("");
  });

  it("rejects malformed OSM-style placeId", async () => {
    await expect(geocodePlace("osm:x:not-a-number:13.4")).rejects.toThrow(/invalid OSM/);
  });

  it("throws for non-OSM placeIds", async () => {
    await expect(geocodePlace("demo-koeln-1")).rejects.toThrow(/unknown placeId/);
    await expect(geocodePlace("")).rejects.toThrow(/unknown placeId/);
  });
});

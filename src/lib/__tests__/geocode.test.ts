import {
  autocomplete,
  geocodePlace,
  createSessionToken,
  hasApiKey,
  DEMO_SUGGESTIONS,
} from "../geocode";

// Ensure the module reads the env var at call time — mutate it per test. Jest
// resets modules between test files automatically, but env vars set by
// process.env are module-scoped within a single file, so we read/write the
// live object here.
const KEY = "EXPO_PUBLIC_GOOGLE_PLACES_API_KEY";

describe("geocode — demo fallback (no API key)", () => {
  let originalKey: string | undefined;
  beforeEach(() => {
    originalKey = process.env[KEY];
    delete process.env[KEY];
  });
  afterEach(() => {
    if (originalKey !== undefined) process.env[KEY] = originalKey;
  });

  it("hasApiKey returns false when no key", () => {
    expect(hasApiKey()).toBe(false);
  });

  it("autocomplete returns all demo suggestions for empty query", async () => {
    const token = createSessionToken();
    const r = await autocomplete("", token);
    expect(r.length).toBe(DEMO_SUGGESTIONS.length);
    expect(r[0]).toHaveProperty("placeId");
    expect(r[0]).toHaveProperty("mainText");
  });

  it("autocomplete filters demo by keyword", async () => {
    const token = createSessionToken();
    const r = await autocomplete("Düsseldorf", token);
    expect(r.length).toBe(1);
    expect(r[0]!.description).toContain("Düsseldorf");
  });

  it("autocomplete filters demo by street", async () => {
    const token = createSessionToken();
    const r = await autocomplete("Kinkel", token);
    expect(r.length).toBe(2);
  });

  it("autocomplete with unmatched query returns empty", async () => {
    const token = createSessionToken();
    const r = await autocomplete("nonexistent-street-42", token);
    expect(r).toEqual([]);
  });

  it("geocodePlace returns demo coordinates for known demo ids", async () => {
    const token = createSessionToken();
    const details = await geocodePlace("demo-koeln-1", token);
    expect(details.lat).toBeCloseTo(50.9613, 3);
    expect(details.lng).toBeCloseTo(6.9585, 3);
    expect(details.formattedAddress).toContain("Kinkelstr");
  });

  it("geocodePlace throws for unknown demo id", async () => {
    const token = createSessionToken();
    await expect(geocodePlace("not-a-demo-id", token)).rejects.toThrow(/demo placeId/);
  });

  it("createSessionToken returns a non-empty string", () => {
    const a = createSessionToken();
    const b = createSessionToken();
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});

describe("geocode — live API (mocked fetch)", () => {
  let originalKey: string | undefined;
  let originalFetch: typeof fetch | undefined;

  beforeEach(() => {
    originalKey = process.env[KEY];
    originalFetch = globalThis.fetch;
    process.env[KEY] = "TEST_KEY_12345";
  });
  afterEach(() => {
    if (originalKey !== undefined) process.env[KEY] = originalKey;
    else delete process.env[KEY];
    if (originalFetch) globalThis.fetch = originalFetch;
  });

  it("hasApiKey returns true when key is set", () => {
    expect(hasApiKey()).toBe(true);
  });

  it("autocomplete builds the expected URL and maps the response", async () => {
    const mockFetch = jest.fn(async (url: string) => {
      expect(url).toContain("place/autocomplete/json");
      expect(url).toContain("key=TEST_KEY_12345");
      expect(url).toContain("sessiontoken=session-abc");
      expect(url).toContain("input=Berlin");
      return new Response(
        JSON.stringify({
          status: "OK",
          predictions: [
            {
              place_id: "berlin-main",
              description: "Berlin, Germany",
              structured_formatting: {
                main_text: "Berlin",
                secondary_text: "Germany",
              },
            },
          ],
        }),
        { status: 200 },
      );
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const r = await autocomplete("Berlin", "session-abc");
    expect(r).toEqual([
      {
        placeId: "berlin-main",
        description: "Berlin, Germany",
        mainText: "Berlin",
        secondaryText: "Germany",
      },
    ]);
  });

  it("autocomplete returns empty for ZERO_RESULTS", async () => {
    globalThis.fetch = jest.fn(
      async () => new Response(JSON.stringify({ status: "ZERO_RESULTS" }), { status: 200 }),
    ) as unknown as typeof fetch;
    const r = await autocomplete("nothingmatches", "tok");
    expect(r).toEqual([]);
  });

  it("autocomplete throws on non-OK status", async () => {
    globalThis.fetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ status: "REQUEST_DENIED", error_message: "Bad key" }), {
          status: 200,
        }),
    ) as unknown as typeof fetch;
    await expect(autocomplete("x", "tok")).rejects.toThrow(/REQUEST_DENIED/);
  });

  it("autocomplete throws on HTTP error", async () => {
    globalThis.fetch = jest.fn(
      async () => new Response("oops", { status: 500 }),
    ) as unknown as typeof fetch;
    await expect(autocomplete("x", "tok")).rejects.toThrow(/HTTP 500/);
  });

  it("autocomplete returns empty for whitespace query (skips network)", async () => {
    const mockFetch = jest.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    const r = await autocomplete("   ", "tok");
    expect(r).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("geocodePlace maps geometry + formatted_address", async () => {
    globalThis.fetch = jest.fn(async (url: string) => {
      expect(url).toContain("place/details/json");
      expect(url).toContain("place_id=xyz");
      expect(url).toContain("sessiontoken=tok");
      return new Response(
        JSON.stringify({
          status: "OK",
          result: {
            formatted_address: "123 Main St, London, UK",
            geometry: { location: { lat: 51.5, lng: -0.12 } },
          },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const r = await geocodePlace("xyz", "tok");
    expect(r.lat).toBeCloseTo(51.5, 2);
    expect(r.lng).toBeCloseTo(-0.12, 2);
    expect(r.formattedAddress).toBe("123 Main St, London, UK");
  });

  it("geocodePlace throws when geometry is missing", async () => {
    globalThis.fetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ status: "OK", result: { formatted_address: "no geo" } }), {
          status: 200,
        }),
    ) as unknown as typeof fetch;
    await expect(geocodePlace("xyz", "tok")).rejects.toThrow(/geometry/);
  });

  it("geocodePlace throws on API error status", async () => {
    globalThis.fetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ status: "NOT_FOUND", error_message: "gone" }), {
          status: 200,
        }),
    ) as unknown as typeof fetch;
    await expect(geocodePlace("xyz", "tok")).rejects.toThrow(/NOT_FOUND/);
  });
});

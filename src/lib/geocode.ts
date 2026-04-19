// Google Places — address autocomplete + geocoding. Reads the API key from
// `process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`. When the key is missing we
// degrade gracefully to the demo suggestions hard-coded below, so UI work
// keeps flowing without infra setup (same "mock mode" posture as RevenueCat).
//
// Cost note: the Places Autocomplete API charges per keystroke session. We
// mint a UUID per "session" (user-focused input → selection) and pass it with
// every autocomplete+details request; Google rolls all requests in that
// session into a single billed transaction. Callers must call
// `createSessionToken()` once when the search input is opened and reuse it
// until a suggestion is selected.

/**
 * A single autocomplete suggestion row. Fields line up with the Places
 * Autocomplete response: `place_id`, `description`, plus the broken-out
 * `structured_formatting.main_text` / `secondary_text` for two-line rendering.
 */
export type PlaceSuggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

/**
 * Result of resolving a placeId to coordinates. `formattedAddress` is the
 * canonical address string Google hands back from Place Details.
 */
export type PlaceDetails = {
  lat: number;
  lng: number;
  formattedAddress: string;
};

/**
 * When no API key is configured the three hardcoded German addresses from
 * Plan 2 stand in for real autocomplete. Kept here (not in AddPlaceSheet) so
 * every caller — including tests — exercises the same fallback path.
 */
export const DEMO_SUGGESTIONS: readonly PlaceSuggestion[] = [
  {
    placeId: "demo-koeln-1",
    description: "Kinkelstr. 3, 50733 Köln, Germany",
    mainText: "Kinkelstr. 3",
    secondaryText: "50733 Köln, Germany",
  },
  {
    placeId: "demo-koeln-2",
    description: "Mediapark 8, 50670 Köln, Germany",
    mainText: "Mediapark 8",
    secondaryText: "50670 Köln, Germany",
  },
  {
    placeId: "demo-duesseldorf-1",
    description: "Kinkel Straße 12, Düsseldorf, Germany",
    mainText: "Kinkel Straße 12",
    secondaryText: "Düsseldorf, Germany",
  },
] as const;

/**
 * Demo coordinates returned from `geocodePlace` when the key is missing. Keyed
 * by the demo `placeId` so tests can assert deterministic lat/lng output.
 */
const DEMO_DETAILS: Record<string, PlaceDetails> = {
  "demo-koeln-1": {
    lat: 50.9613,
    lng: 6.9585,
    formattedAddress: "Kinkelstr. 3, 50733 Köln, Germany",
  },
  "demo-koeln-2": {
    lat: 50.9484,
    lng: 6.9445,
    formattedAddress: "Mediapark 8, 50670 Köln, Germany",
  },
  "demo-duesseldorf-1": {
    lat: 51.2379,
    lng: 6.8011,
    formattedAddress: "Kinkel Straße 12, 40211 Düsseldorf, Germany",
  },
};

const AUTOCOMPLETE_URL = "https://maps.googleapis.com/maps/api/place/autocomplete/json";
const DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";

function getApiKey(): string {
  return process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? "";
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}

/**
 * Returns a filtered slice of `DEMO_SUGGESTIONS` matching `query`. Used when
 * no API key is configured.
 */
function filterDemoSuggestions(query: string): PlaceSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...DEMO_SUGGESTIONS];
  return DEMO_SUGGESTIONS.filter(
    (s) =>
      s.description.toLowerCase().includes(q) ||
      s.mainText.toLowerCase().includes(q) ||
      s.secondaryText.toLowerCase().includes(q),
  );
}

/**
 * Mint a session token for cost-optimized Places billing. Google accepts any
 * opaque string; we use a RFC4122 UUID from the platform `crypto` global (the
 * same one `react-native-get-random-values` polyfills for Hermes).
 */
export function createSessionToken(): string {
  // `crypto.randomUUID` is available in Node ≥19 and on Hermes after the
  // polyfill. Fall back to a Math.random-based v4-ish UUID if somehow
  // missing — this is only used as a Places session tag, not for security.
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 10)}`;
}

type AutocompleteResponse = {
  status: string;
  error_message?: string;
  predictions?: {
    place_id: string;
    description: string;
    structured_formatting?: {
      main_text?: string;
      secondary_text?: string;
    };
  }[];
};

type DetailsResponse = {
  status: string;
  error_message?: string;
  result?: {
    formatted_address?: string;
    geometry?: {
      location?: { lat: number; lng: number };
    };
  };
};

/**
 * Fetch autocomplete suggestions from the Google Places API (or filter the
 * demo list when the key is missing). Callers should debounce: the screen
 * debounces by 300ms on every keystroke before calling this.
 *
 * `sessionToken` should be the same value for every call within one
 * "search → select" interaction so Google bills only for the final details
 * lookup. Mint a fresh one when the search sheet opens.
 *
 * Optional `signal` aborts the in-flight fetch (e.g. the caller typed a
 * new keystroke and we no longer need the old result). When the signal
 * fires we bubble the `AbortError` up so the caller can tell an aborted
 * call apart from a real network/API failure.
 *
 * Throws on HTTP errors or non-OK `status` returned by the API — callers
 * should catch and surface a Banner. `ZERO_RESULTS` is NOT treated as an
 * error; we return an empty array.
 */
export async function autocomplete(
  query: string,
  sessionToken: string,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const key = getApiKey();
  if (!key) return filterDemoSuggestions(query);
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({
    input: trimmed,
    key,
    sessiontoken: sessionToken,
    // `types=address` narrows to postal-address results (omitting business
    // POIs, which would bloat the suggestion list for a time-tracker). The
    // Places UI can still complete any address worldwide.
    types: "address",
  });

  const res = await fetch(`${AUTOCOMPLETE_URL}?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`Places autocomplete HTTP ${res.status}`);
  const data = (await res.json()) as AutocompleteResponse;
  if (data.status === "ZERO_RESULTS") return [];
  if (data.status !== "OK") {
    throw new Error(
      `Places autocomplete failed: ${data.status}${data.error_message ? ` — ${data.error_message}` : ""}`,
    );
  }
  return (data.predictions ?? []).map((p) => ({
    placeId: p.place_id,
    description: p.description,
    mainText: p.structured_formatting?.main_text ?? p.description,
    secondaryText: p.structured_formatting?.secondary_text ?? "",
  }));
}

/**
 * Resolve a placeId to lat/lng + canonical formatted address via Places
 * Details. Pass the same `sessionToken` used for the autocomplete call so
 * Google bills a single session rather than per-keystroke.
 *
 * Throws on HTTP errors, missing geometry, or non-OK `status`. Demo mode
 * returns the stubbed coordinates from `DEMO_DETAILS`.
 */
export async function geocodePlace(placeId: string, sessionToken: string): Promise<PlaceDetails> {
  const key = getApiKey();
  if (!key) {
    const demo = DEMO_DETAILS[placeId];
    if (demo) return demo;
    throw new Error(`geocodePlace: unknown demo placeId ${placeId}`);
  }

  const params = new URLSearchParams({
    place_id: placeId,
    key,
    sessiontoken: sessionToken,
    fields: "geometry,formatted_address",
  });
  const res = await fetch(`${DETAILS_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`Places details HTTP ${res.status}`);
  const data = (await res.json()) as DetailsResponse;
  if (data.status !== "OK") {
    throw new Error(
      `Places details failed: ${data.status}${data.error_message ? ` — ${data.error_message}` : ""}`,
    );
  }
  const loc = data.result?.geometry?.location;
  if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
    throw new Error("Places details missing geometry.location");
  }
  return {
    lat: loc.lat,
    lng: loc.lng,
    formattedAddress: data.result?.formatted_address ?? "",
  };
}

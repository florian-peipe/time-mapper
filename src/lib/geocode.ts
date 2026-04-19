// Address autocomplete + geocoding via Photon (photon.komoot.io). Free,
// no API key, hosted by Komoot GmbH in Potsdam, Germany — so GDPR-wise
// typed addresses stay in the EU. Falls back to a tiny hardcoded demo
// list if Photon is unreachable (or during Jest runs), which keeps the
// AddPlaceSheet flow exercisable offline.
//
// Photon is fair-use (~1M req/month/app without prior arrangement). No
// hard SLA — treat 500s as "show the demo list" rather than "error
// toast". See docs/SIDELOAD.md + README for the privacy rationale.
//
// Note: Photon returns coordinates directly in the autocomplete response
// so there's no separate "details" round-trip in the Google Places sense.
// We preserve the `PlaceSuggestion` → `geocodePlace(placeId)` API shape
// because the AddPlaceSheet caller already wires it that way, but under
// the hood the coordinates are encoded into the synthetic placeId
// (`osm:<id>:<lat>:<lng>`) so `geocodePlace` can decode without a second
// HTTP call.

/**
 * A single autocomplete suggestion row. `placeId` is an opaque token that
 * `geocodePlace` understands — for Photon results it encodes the lat/lng
 * so no second HTTP round-trip is needed.
 */
export type PlaceSuggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

/** Result of resolving a placeId to coordinates + canonical address. */
export type PlaceDetails = {
  lat: number;
  lng: number;
  formattedAddress: string;
};

/**
 * Offline / failure fallback — three German addresses that always work so
 * the AddPlaceSheet flow is exercisable during development, in Jest, or
 * when Photon is unreachable. Kept here (not in AddPlaceSheet) so every
 * caller — including tests — hits the same fallback path.
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

/** Demo coordinates returned from `geocodePlace` for the demo placeIds. */
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

const PHOTON_URL = "https://photon.komoot.io/api/";

/** True when running inside Jest — keeps the deterministic demo list. */
function isJestEnv(): boolean {
  return typeof process !== "undefined" && !!process.env.JEST_WORKER_ID;
}

/**
 * Opaque session token. Photon doesn't bill per-session (unlike Google
 * Places) so this is a vestigial shim — callers still mint one on search
 * open so the public API stays stable, but we ignore it internally.
 */
export function createSessionToken(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

/**
 * Filter the demo list by keyword. Used offline / when Photon fails /
 * inside Jest. Empty query returns the full list.
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
 * Fetch autocomplete suggestions from Photon. Callers should debounce;
 * the AddPlaceSheet debounces by 300ms. `sessionToken` is accepted for
 * API compatibility and ignored internally (Photon isn't session-billed).
 *
 * `signal` aborts the in-flight fetch (e.g. a new keystroke arrived).
 * We bubble the `AbortError` up so the caller can tell abort apart from
 * a network failure.
 *
 * Non-error outcomes: empty query → []. Whitespace-only → [].
 * Error outcomes fall back to the demo list rather than throwing, so the
 * UI never shows a bare error for a transient Photon hiccup.
 */
export async function autocomplete(
  query: string,
  _sessionToken: string,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  // Empty query → return the full demo list. This is the "sheet just
  // opened, nothing typed yet" case; we prefer seeding the suggestion
  // list with the three Köln demos so the user has something tappable
  // immediately. Photon would return nothing useful for an empty query
  // anyway, so we never bother calling it.
  //
  // Jest always uses the demo list so tests stay deterministic.
  if (!trimmed || isJestEnv()) return filterDemoSuggestions(trimmed);

  try {
    return await photonAutocomplete(trimmed, signal);
  } catch (err) {
    // AbortError should propagate — the caller wants to distinguish
    // user-driven cancellation from network failure.
    if (err instanceof Error && err.name === "AbortError") throw err;
    return filterDemoSuggestions(trimmed);
  }
}

/**
 * Resolve a placeId to lat/lng + canonical formatted address.
 *
 * Photon autocomplete already returns coordinates, so we encode them
 * into the synthetic placeId (`osm:<id>:<lat>:<lng>`) at autocomplete
 * time and decode here — no second HTTP round-trip.
 */
export async function geocodePlace(placeId: string, _sessionToken: string): Promise<PlaceDetails> {
  if (placeId.startsWith("osm:")) {
    const parts = placeId.split(":");
    const lat = Number(parts[2]);
    const lng = Number(parts[3]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error(`geocodePlace: invalid OSM placeId ${placeId}`);
    }
    return { lat, lng, formattedAddress: "" };
  }

  const demo = DEMO_DETAILS[placeId];
  if (demo) return demo;
  throw new Error(`geocodePlace: unknown placeId ${placeId}`);
}

type PhotonFeature = {
  properties?: {
    osm_id?: number | string;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    postcode?: string;
    state?: string;
    country?: string;
  };
  geometry?: {
    coordinates?: [number, number]; // [lng, lat]
  };
};

type PhotonResponse = {
  features?: PhotonFeature[];
};

/**
 * Photon autocomplete (Komoot's OSM-backed search-as-you-type service).
 * Free, no API key, typically 100-300ms worldwide. Short queries
 * (<2 chars) skip the network. Throws on HTTP errors so the outer
 * `autocomplete()` can fall back to the demo list.
 */
async function photonAutocomplete(query: string, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  if (query.length < 2) return [];
  const params = new URLSearchParams({
    q: query,
    limit: "8",
  });
  const res = await fetch(`${PHOTON_URL}?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`Photon HTTP ${res.status}`);
  const data = (await res.json()) as PhotonResponse;
  const features = data.features ?? [];
  return features
    .map((f, idx) => {
      const coords = f.geometry?.coordinates;
      if (!coords || coords.length < 2) return null;
      const [lng, lat] = coords;
      if (typeof lat !== "number" || typeof lng !== "number") return null;

      const p = f.properties ?? {};
      // Main line: street + housenumber if we have them, else POI name,
      // else city. Best-effort join so every row renders something useful.
      const streetLine =
        p.street && p.housenumber
          ? `${p.street} ${p.housenumber}`
          : (p.street ?? p.name ?? p.city ?? "");
      const tail = [p.postcode, p.city, p.state, p.country]
        .filter((v): v is string => typeof v === "string" && v.length > 0)
        .join(", ");
      const description = [streetLine, tail].filter((s) => s.length > 0).join(", ");
      const id = p.osm_id != null ? String(p.osm_id) : `photon-${idx}`;
      return {
        placeId: `osm:${id}:${lat}:${lng}`,
        description,
        mainText: streetLine || description,
        secondaryText: tail,
      } satisfies PlaceSuggestion;
    })
    .filter((v): v is PlaceSuggestion => v !== null);
}

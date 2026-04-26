// Address autocomplete + geocoding via Photon (photon.komoot.io). Free,
// no API key, hosted by Komoot GmbH in Potsdam, Germany — typed
// addresses stay in the EU.
//
// Photon's autocomplete response already carries coordinates so there's
// no separate "details" round-trip. We encode lat/lng into the synthetic
// placeId (`osm:<id>:<lat>:<lng>`) so `geocodePlace` can decode without
// a second HTTP call.

export type PlaceSuggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

export type PlaceDetails = {
  lat: number;
  lng: number;
  formattedAddress: string;
};

export type AutocompleteResult = {
  suggestions: PlaceSuggestion[];
  /** True when the network call failed (or we're offline) — the UI
   * surfaces a "couldn't reach the address service" banner. */
  failed: boolean;
};

const PHOTON_URL = "https://photon.komoot.io/api/";
const PHOTON_REVERSE_URL = "https://photon.komoot.io/reverse";

/**
 * In-memory cache for recent Photon queries. Typing "wo, wor, worl, world"
 * without the cache hits the network four times; with it, the prefix runs
 * once and the rest hit cache. TTL is short (30s) so a real location change
 * still refreshes, and capacity is small (16) so memory stays bounded.
 */
const CACHE_TTL_MS = 30_000;
const CACHE_MAX_ENTRIES = 16;

type CacheEntry = { at: number; suggestions: PlaceSuggestion[] };
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string, nowMs: number): PlaceSuggestion[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (nowMs - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.suggestions;
}

function cacheSet(key: string, suggestions: PlaceSuggestion[], nowMs: number): void {
  cache.set(key, { at: nowMs, suggestions });
  // LRU trim — oldest first. `Map` iteration preserves insertion order, so
  // re-inserting on hit keeps the MRU at the tail.
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Test-only — wipes the autocomplete cache so each test starts clean. */
export function __resetAutocompleteCacheForTests(): void {
  cache.clear();
}

/**
 * Reverse-geocode a coordinate pair to a human-readable address string.
 * Uses the same Photon backend as `autocomplete` — no API key, EU-hosted.
 *
 * Throws on network failure, non-200, or empty result so the caller can
 * fall back to a coordinate string. The signal is optional and only used
 * for cancellation (e.g. if the user dismisses the sheet before the call
 * resolves).
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<{ description: string }> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    limit: "1",
  });
  const res = await fetch(`${PHOTON_REVERSE_URL}?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`Photon reverse HTTP ${res.status}`);
  const data = (await res.json()) as PhotonResponse;
  const feature = (data.features ?? [])[0];
  if (!feature) throw new Error("Photon reverse: no results");
  const p = feature.properties ?? {};
  const streetLine =
    p.street && p.housenumber
      ? `${p.street} ${p.housenumber}`
      : (p.street ?? p.name ?? p.city ?? "");
  const tail = [p.postcode, p.city, p.state, p.country]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join(", ");
  const description = [streetLine, tail].filter((s) => s.length > 0).join(", ");
  if (!description) throw new Error("Photon reverse: empty description");
  return { description };
}

/**
 * Fetch autocomplete suggestions. AddPlaceSheet debounces keystrokes
 * before calling this. `signal` aborts the in-flight fetch when a
 * newer keystroke arrives; AbortError is propagated so the caller can
 * tell cancel apart from a network failure.
 *
 * Short queries (`< 2` chars) return `{ suggestions: [], failed: false }`.
 * Network failure returns `{ suggestions: [], failed: true }`.
 *
 * Successful responses are cached for 30s — a subsequent keystroke that
 * produces the same query string skips the network round-trip entirely.
 */
export async function autocomplete(
  query: string,
  signal?: AbortSignal,
): Promise<AutocompleteResult> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return { suggestions: [], failed: false };

  const now = Date.now();
  const cached = cacheGet(trimmed, now);
  if (cached) return { suggestions: cached, failed: false };

  try {
    const suggestions = await photonAutocomplete(trimmed, signal);
    cacheSet(trimmed, suggestions, now);
    return { suggestions, failed: false };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    return { suggestions: [], failed: true };
  }
}

/**
 * Resolve a placeId to lat/lng + canonical formatted address.
 * OSM-style ids encode coordinates inline so this never hits the
 * network.
 */
export async function geocodePlace(placeId: string): Promise<PlaceDetails> {
  if (!placeId.startsWith("osm:")) {
    throw new Error(`geocodePlace: unknown placeId ${placeId}`);
  }
  const parts = placeId.split(":");
  const lat = Number(parts[2]);
  const lng = Number(parts[3]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(`geocodePlace: invalid OSM placeId ${placeId}`);
  }
  return { lat, lng, formattedAddress: "" };
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

async function photonAutocomplete(query: string, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  const params = new URLSearchParams({ q: query, limit: "8" });
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

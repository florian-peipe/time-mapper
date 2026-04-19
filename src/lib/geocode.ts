// Address autocomplete + geocoding via Photon (photon.komoot.io). Free,
// no API key, hosted by Komoot GmbH in Potsdam, Germany — typed
// addresses stay in the EU. Falls back to a three-row Köln/Düsseldorf
// demo list if Photon is unreachable or during Jest runs, so the
// AddPlaceSheet flow is exercisable offline.
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

/**
 * Offline / failure fallback — three German addresses that always
 * resolve so the AddPlaceSheet flow works during Jest runs, on
 * airplane-mode devices, and when Photon is down.
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

function isJestEnv(): boolean {
  return typeof process !== "undefined" && !!process.env.JEST_WORKER_ID;
}

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
 * Fetch autocomplete suggestions. AddPlaceSheet debounces keystrokes
 * before calling this. `signal` aborts the in-flight fetch when a
 * newer keystroke arrives; AbortError is propagated so the caller can
 * tell cancel apart from a network failure.
 *
 * Empty query → full demo list (the sheet seeds suggestions on open).
 * Photon failure → filtered demo list (no bare error in the UI for a
 * transient outage).
 */
export async function autocomplete(
  query: string,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed || isJestEnv()) return filterDemoSuggestions(trimmed);

  try {
    return await photonAutocomplete(trimmed, signal);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    return filterDemoSuggestions(trimmed);
  }
}

/**
 * Resolve a placeId to lat/lng + canonical formatted address.
 * OSM-style ids encode coordinates inline so this never hits the
 * network for a Photon-sourced selection. Demo ids use the baked-in
 * coordinate table.
 */
export async function geocodePlace(placeId: string): Promise<PlaceDetails> {
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

async function photonAutocomplete(query: string, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  if (query.length < 2) return [];
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

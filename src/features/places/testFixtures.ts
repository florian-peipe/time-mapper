import type { Place } from "@/db/schema";

/**
 * Canonical `Place` test fixture. Every test that needs a Place row
 * constructs through here so schema changes (new columns, renamed
 * fields) only need updating in one spot. Fill in overrides for the
 * fields your assertion cares about; the rest get sensible defaults
 * (Berlin coords, 100 m radius, 5-min entry / 3-min exit buffer, no
 * goals, no soft-delete).
 */
export function makePlace(id: string, overrides: Partial<Place> = {}): Place {
  return {
    id,
    name: `P-${id}`,
    address: "addr",
    latitude: 52.52,
    longitude: 13.405,
    radiusM: 100,
    entryBufferS: 300,
    exitBufferS: 180,
    color: "#FF7A1A",
    icon: "map-pin",
    dailyGoalMinutes: null,
    weeklyGoalMinutes: null,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
    ...overrides,
  };
}

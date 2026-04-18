import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type * as DbClientModule from "@/db/client";
import { PlacesRepo, type CreatePlaceInput } from "@/db/repository/places";
import type { Place } from "@/db/schema";

/**
 * Context for injecting a `PlacesRepo` instance. Tests wrap `renderHook` with
 * `PlacesRepoProvider` so hooks read from an in-memory test DB. In production
 * the provider is omitted and the hook falls back to a repo bound to the
 * device `db` client. The device client is loaded lazily so that Jest (which
 * cannot resolve `expo-sqlite`'s native bindings) never triggers its import.
 */
const PlacesRepoContext = createContext<PlacesRepo | null>(null);

export function PlacesRepoProvider({
  value,
  children,
}: {
  value: PlacesRepo;
  children: React.ReactNode;
}) {
  return <PlacesRepoContext.Provider value={value}>{children}</PlacesRepoContext.Provider>;
}

let cachedDeviceRepo: PlacesRepo | null = null;
function getDeviceRepo(): PlacesRepo {
  if (!cachedDeviceRepo) {
    // Deferred require keeps the `expo-sqlite` device binding off the test import graph.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { db } = require("@/db/client") as typeof DbClientModule;
    cachedDeviceRepo = new PlacesRepo(db);
  }
  return cachedDeviceRepo;
}

/**
 * Resolve a `PlacesRepo` from context, falling back to a device-bound repo.
 * Exported so other feature hooks (e.g. `useWeekStats`) can reuse the same
 * resolution rules when they need place metadata.
 */
export function usePlacesRepo(): PlacesRepo {
  const injected = useContext(PlacesRepoContext);
  // Memoize so the fallback repo is stable across renders within a component.
  return useMemo(() => injected ?? getDeviceRepo(), [injected]);
}

export type UsePlacesResult = {
  places: Place[];
  loading: boolean;
  refresh: () => void;
  create: (input: CreatePlaceInput) => Place;
  update: (id: string, patch: Partial<CreatePlaceInput>) => Place;
  remove: (id: string) => void;
  count: number;
};

export function usePlaces(): UsePlacesResult {
  const repo = usePlacesRepo();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setPlaces(repo.list());
  }, [repo]);

  useEffect(() => {
    refresh();
    setLoading(false);
  }, [refresh]);

  const create = useCallback(
    (input: CreatePlaceInput) => {
      const p = repo.create(input);
      refresh();
      return p;
    },
    [repo, refresh],
  );

  const update = useCallback(
    (id: string, patch: Partial<CreatePlaceInput>) => {
      const p = repo.update(id, patch);
      refresh();
      return p;
    },
    [repo, refresh],
  );

  const remove = useCallback(
    (id: string) => {
      repo.softDelete(id);
      refresh();
    },
    [repo, refresh],
  );

  return { places, loading, refresh, create, update, remove, count: places.length };
}

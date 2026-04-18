import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type * as DbClientModule from "@/db/client";
import { EntriesRepo } from "@/db/repository/entries";
import type { Entry } from "@/db/schema";

/**
 * Shared context for injecting an `EntriesRepo`. Used by `useEntries`,
 * `useOngoingEntry`, and `useWeekStats` so a test can inject one repo and have
 * every entries hook read from it. Mirrors the pattern in `usePlaces.tsx`.
 */
const EntriesRepoContext = createContext<EntriesRepo | null>(null);

export function EntriesRepoProvider({
  value,
  children,
}: {
  value: EntriesRepo;
  children: React.ReactNode;
}) {
  return <EntriesRepoContext.Provider value={value}>{children}</EntriesRepoContext.Provider>;
}

let cachedDeviceRepo: EntriesRepo | null = null;
function getDeviceRepo(): EntriesRepo {
  if (!cachedDeviceRepo) {
    // Deferred require keeps the `expo-sqlite` device binding off the test import graph.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { db } = require("@/db/client") as typeof DbClientModule;
    cachedDeviceRepo = new EntriesRepo(db);
  }
  return cachedDeviceRepo;
}

/** Shared across all entries hooks — exported for the other hook files to reuse. */
export function useEntriesRepo(): EntriesRepo {
  const injected = useContext(EntriesRepoContext);
  return useMemo(() => injected ?? getDeviceRepo(), [injected]);
}

/**
 * Returns the local-time start-of-day (as unix seconds) for today shifted by
 * `dayOffset`. `dayOffset = 0` → today, `-1` → yesterday.
 */
function dayStartSeconds(dayOffset: number): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() + dayOffset * 86_400_000) / 1000);
}

export type UseEntriesResult = {
  entries: Entry[];
  loading: boolean;
  refresh: () => void;
  createManual: (input: {
    placeId: string;
    startedAt: number;
    endedAt: number;
    note?: string;
    pauseS?: number;
  }) => Entry;
  softDelete: (id: string) => void;
};

/**
 * Entries whose `startedAt` falls inside the local day (midnight → midnight)
 * identified by `dayOffset`. `dayOffset = 0` is today, `-1` yesterday, etc.
 * Re-queries when `dayOffset` changes or when mutations are issued through
 * the returned helpers.
 */
export function useEntries(dayOffset: number): UseEntriesResult {
  const repo = useEntriesRepo();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    const start = dayStartSeconds(dayOffset);
    const end = start + 86_400 - 1;
    setEntries(repo.listBetween(start, end));
  }, [repo, dayOffset]);

  useEffect(() => {
    refresh();
    setLoading(false);
  }, [refresh]);

  const createManual = useCallback(
    (input: {
      placeId: string;
      startedAt: number;
      endedAt: number;
      note?: string;
      pauseS?: number;
    }) => {
      const e = repo.createManual(input);
      refresh();
      return e;
    },
    [repo, refresh],
  );

  const softDelete = useCallback(
    (id: string) => {
      repo.softDelete(id);
      refresh();
    },
    [repo, refresh],
  );

  return { entries, loading, refresh, createManual, softDelete };
}

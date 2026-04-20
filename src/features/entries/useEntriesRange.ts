import { useCallback, useEffect, useState } from "react";
import type { Entry } from "@/db/schema";
import { useEntriesRepo } from "./useEntries";
import { useDataVersionStore } from "@/state/dataVersionStore";

export type UseEntriesRangeResult = {
  entries: Entry[];
  loading: boolean;
  refresh: () => void;
};

/**
 * Generalized `useEntries` — accepts a closed `[startS, endS]` unix-second
 * window and returns entries whose `startedAt` falls inside it. Subscribes
 * to `dataVersionStore.entriesVersion` so bg-task writes surface without a
 * manual `refresh()`.
 *
 * Use this when the caller wants a non-day range (week / month / year view
 * on the Timeline). The existing `useEntries(dayOffset)` stays for the
 * common day-aligned case.
 */
export function useEntriesRange(startS: number, endS: number): UseEntriesRangeResult {
  const repo = useEntriesRepo();
  const version = useDataVersionStore((s) => s.entriesVersion);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setEntries(repo.listBetween(startS, endS));
  }, [repo, startS, endS]);

  useEffect(() => {
    refresh();
    setLoading(false);
  }, [refresh, version]);

  return { entries, loading, refresh };
}

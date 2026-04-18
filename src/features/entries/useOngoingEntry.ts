import { useCallback, useEffect, useState } from "react";
import type { Entry } from "@/db/schema";
import { useEntriesRepo } from "./useEntries";

export type UseOngoingEntryResult = {
  entry: Entry | null;
  loading: boolean;
  refresh: () => void;
  start: (input: { placeId: string; source: "auto" | "manual"; pauseS?: number }) => Entry;
  stop: () => void;
};

/**
 * Proxies `EntriesRepo.ongoing()` — the single row with `endedAt === null`, or
 * null. `refresh()` re-queries, and `start()` / `stop()` are thin wrappers
 * around `open()` / `close()` that also trigger a refresh.
 *
 * Uses the same `EntriesRepoContext` as `useEntries` so a single test
 * `EntriesRepoProvider` serves every entries hook.
 */
export function useOngoingEntry(): UseOngoingEntryResult {
  const repo = useEntriesRepo();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setEntry(repo.ongoing());
  }, [repo]);

  useEffect(() => {
    refresh();
    setLoading(false);
  }, [refresh]);

  const start = useCallback(
    (input: { placeId: string; source: "auto" | "manual"; pauseS?: number }) => {
      const e = repo.open(input);
      refresh();
      return e;
    },
    [repo, refresh],
  );

  const stop = useCallback(() => {
    const current = repo.ongoing();
    if (!current) return;
    repo.close(current.id);
    refresh();
  }, [repo, refresh]);

  return { entry, loading, refresh, start, stop };
}

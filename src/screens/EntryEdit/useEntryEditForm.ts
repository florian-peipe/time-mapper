import { useEffect, useMemo, useState } from "react";
import type { Place } from "@/db/schema";
import { useEntriesRepo } from "@/features/entries/useEntries";
import { defaultEnd, defaultStart, pauseDateToMinutes, pauseMinutesToDate } from "./entryEditUtils";

export function useEntryEditForm(entryId: string | null, _places: Place[]) {
  const entriesRepo = useEntriesRepo();

  const [placeId, setPlaceId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date>(() => defaultStart(new Date()));
  const [endDate, setEndDate] = useState<Date>(() => defaultEnd(new Date()));
  const [pauseDate, setPauseDate] = useState<Date>(() => pauseMinutesToDate(0));
  const [note, setNote] = useState<string>("");
  const [entrySource, setEntrySource] = useState<"auto" | "manual" | null>(null);

  useEffect(() => {
    if (entryId) {
      const e = entriesRepo.get(entryId);
      if (e) {
        setPlaceId(e.placeId);
        setStartDate(new Date(e.startedAt * 1000));
        setEndDate(
          e.endedAt != null ? new Date(e.endedAt * 1000) : defaultEnd(new Date(e.startedAt * 1000)),
        );
        setPauseDate(pauseMinutesToDate(Math.round((e.pauseS ?? 0) / 60)));
        setNote(e.note ?? "");
        setEntrySource(e.source);
      }
    } else {
      const now = new Date();
      setStartDate(defaultStart(now));
      setEndDate(defaultEnd(now));
      setPauseDate(pauseMinutesToDate(0));
      setNote("");
      setEntrySource(null);
    }
  }, [entryId, entriesRepo]);

  const grossMin = useMemo(
    () => Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / 60_000)),
    [startDate, endDate],
  );

  const pauseMin = useMemo(() => pauseDateToMinutes(pauseDate), [pauseDate]);

  const netMin = useMemo(() => Math.max(0, grossMin - pauseMin), [grossMin, pauseMin]);

  return {
    placeId,
    setPlaceId,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    pauseDate,
    setPauseDate,
    note,
    setNote,
    entrySource,
    grossMin,
    pauseMin,
    netMin,
  };
}

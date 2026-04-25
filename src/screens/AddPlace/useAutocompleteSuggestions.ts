import { useEffect } from "react";
import { autocomplete, type PlaceSuggestion } from "@/lib/geocode";
import type { Selection } from "./usePlaceForm";

const DEBOUNCE_MS = 300;

type Opts = {
  query: string;
  editing: boolean;
  selected: Selection | null;
  setSuggestions: (v: PlaceSuggestion[]) => void;
  setSearching: (v: boolean) => void;
  setApiError: (v: string | null) => void;
};

export function useAutocompleteSuggestions({
  query,
  editing,
  selected,
  setSuggestions,
  setSearching,
  setApiError,
}: Opts) {
  useEffect(() => {
    if (editing || selected) return;
    let cancelled = false;
    const controller = new AbortController();
    const handle = setTimeout(() => {
      setSearching(true);
      void (async () => {
        try {
          const { suggestions: results, failed } = await autocomplete(query, controller.signal);
          if (!cancelled) {
            setSuggestions(results);
            setApiError(failed ? "offline" : null);
          }
        } catch (err) {
          if (cancelled) return;
          if (err instanceof Error && err.name === "AbortError") return;
          const msg = err instanceof Error ? err.message : String(err);
          setApiError(msg);
          setSuggestions([]);
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(handle);
    };
  }, [query, editing, selected, setSuggestions, setSearching, setApiError]);
}

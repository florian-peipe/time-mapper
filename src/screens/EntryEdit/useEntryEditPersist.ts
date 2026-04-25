import { useCallback } from "react";
import { Alert } from "react-native";
import { useEntriesRepo } from "@/features/entries/useEntries";
import { i18n } from "@/lib/i18n";
import { useSnackbarStore } from "@/state/snackbarStore";
import { useDataVersionStore } from "@/state/dataVersionStore";
import { pauseDateToMinutes } from "./entryEditUtils";

type Opts = {
  entryId: string | null;
  placeId: string | null;
  startDate: Date;
  endDate: Date;
  pauseDate: Date;
  note: string;
  onClose: () => void;
};

export function useEntryEditPersist({
  entryId,
  placeId,
  startDate,
  endDate,
  pauseDate,
  note,
  onClose,
}: Opts) {
  const entriesRepo = useEntriesRepo();
  const bumpEntries = useDataVersionStore((s) => s.bumpEntries);
  const isNew = entryId == null;
  const pauseMin = pauseDateToMinutes(pauseDate);

  const handleSave = useCallback(() => {
    if (!placeId) return;

    const startedAt = Math.floor(startDate.getTime() / 1000);
    let endedAt = Math.floor(endDate.getTime() / 1000);
    if (endedAt < startedAt) endedAt += 86_400;
    const pauseS = pauseMin * 60;

    const commit = (opts?: { replace?: ReturnType<typeof entriesRepo.findOverlapping> }) => {
      if (opts?.replace) {
        for (const r of opts.replace) {
          entriesRepo.softDelete(r.id);
        }
      }
      if (isNew) {
        entriesRepo.createManual({ placeId, startedAt, endedAt, note: note || undefined, pauseS });
      } else if (entryId) {
        entriesRepo.update(entryId, { placeId, startedAt, endedAt, note: note || null, pauseS });
      }
      bumpEntries();
      onClose();
    };

    const overlaps = entriesRepo.findOverlapping(startedAt, endedAt, entryId ?? undefined);
    if (overlaps.length > 0) {
      Alert.alert(
        i18n.t("entryEdit.overlap.title"),
        i18n.t("entryEdit.overlap.body", { count: overlaps.length }),
        [
          { text: i18n.t("common.cancel"), style: "cancel" },
          { text: i18n.t("entryEdit.overlap.keepBoth"), onPress: () => commit() },
          {
            text: i18n.t("entryEdit.overlap.replace"),
            style: "destructive",
            onPress: () => commit({ replace: overlaps }),
          },
        ],
      );
      return;
    }
    commit();
  }, [placeId, isNew, entryId, startDate, endDate, pauseMin, note, entriesRepo, bumpEntries, onClose]);

  const handleDelete = useCallback(() => {
    if (!entryId) return;
    entriesRepo.softDelete(entryId);
    bumpEntries();
    useSnackbarStore.getState().show({
      message: i18n.t("entryEdit.snack.deleted"),
      action: {
        label: i18n.t("entryEdit.snack.undo"),
        onPress: () => {
          try {
            entriesRepo.restore(entryId);
            bumpEntries();
          } catch {
            // Row was hard-purged between delete and undo.
          }
        },
      },
      ttlMs: 5000,
    });
    onClose();
  }, [entryId, entriesRepo, bumpEntries, onClose]);

  return { handleSave, handleDelete };
}

import React, { useCallback } from "react";
import { useRouter } from "expo-router";
import { useSheetStore, type AddPlaceSource } from "@/state/sheetStore";
import { EntryEditSheet } from "@/screens/EntryEdit/EntryEditSheet";
import { AddPlaceSheet } from "@/screens/AddPlace/AddPlaceSheet";
import { useOnboardingGate } from "@/features/onboarding/useOnboardingGate";

const ADD_PLACE_SOURCES: readonly AddPlaceSource[] = ["onboarding", "places-tab"];

function narrowAddPlaceSource(v: unknown): AddPlaceSource | undefined {
  if (typeof v !== "string") return undefined;
  return ADD_PLACE_SOURCES.includes(v as AddPlaceSource) ? (v as AddPlaceSource) : undefined;
}

/**
 * Global sheet orchestrator — mounted once at the app root. Owns the two
 * in-app sheets (`entryEdit`, `addPlace`) and listens to `useSheetStore`
 * for `{ active, payload }`. Both sheet components are always rendered;
 * the underlying `Sheet` primitive's RN Modal handles show/hide natively
 * via its `visible` prop.
 *
 * The paywall is no longer a sheet — it's presented natively by
 * `RevenueCatUI.presentPaywall()` via `openPaywall()`, which also owns
 * the post-purchase AddPlace re-open dance.
 */
export function SheetHost() {
  const router = useRouter();
  const active = useSheetStore((s) => s.active);
  const payload = useSheetStore((s) => s.payload);
  const close = useSheetStore((s) => s.closeSheet);
  const { markComplete } = useOnboardingGate();

  const entryId =
    active === "entryEdit" && payload && "entryId" in payload ? payload.entryId : null;
  const placeId = active === "addPlace" && payload && "placeId" in payload ? payload.placeId : null;
  const addPlaceSource =
    active === "addPlace" && payload && "source" in payload
      ? narrowAddPlaceSource(payload.source)
      : undefined;

  const handleAddPlaceSaved = useCallback(() => {
    if (addPlaceSource === "onboarding") {
      markComplete();
      router.replace("/(tabs)");
    }
  }, [addPlaceSource, markComplete, router]);

  return (
    <>
      <EntryEditSheet visible={active === "entryEdit"} entryId={entryId} onClose={close} />
      <AddPlaceSheet
        visible={active === "addPlace"}
        placeId={placeId}
        source={addPlaceSource}
        onClose={close}
        onSaved={handleAddPlaceSaved}
      />
    </>
  );
}

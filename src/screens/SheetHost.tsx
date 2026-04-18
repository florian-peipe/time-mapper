import React, { useCallback } from "react";
import { useRouter } from "expo-router";
import { useSheetStore, type AddPlaceSource } from "@/state/sheetStore";
import { PaywallScreen } from "@/screens/Paywall/PaywallScreen";
import { EntryEditSheet } from "@/screens/EntryEdit/EntryEditSheet";
import { AddPlaceSheet } from "@/screens/AddPlace/AddPlaceSheet";
import { useOnboardingGate } from "@/features/onboarding/useOnboardingGate";

const ADD_PLACE_SOURCES: readonly AddPlaceSource[] = [
  "onboarding",
  "places-list",
  "settings-places",
];

function narrowAddPlaceSource(v: unknown): AddPlaceSource | undefined {
  if (typeof v !== "string") return undefined;
  return ADD_PLACE_SOURCES.includes(v as AddPlaceSource) ? (v as AddPlaceSource) : undefined;
}

/**
 * Global sheet orchestrator — mounted once at the app root (inside the
 * ThemeProvider subtree in `app/_layout.tsx`). Every sheet in the app is
 * owned here and listens to `useSheetStore` for `{ active, payload }`.
 *
 * Implementation note: all three sheet components are ALWAYS rendered; the
 * underlying `Sheet` primitive's RN `Modal` handles show/hide natively via
 * its own `visible` prop. This avoids mount/unmount churn when the user
 * flips between sheets (e.g. Add Place → Paywall upsell), keeping the
 * gesture handlers + form state stable across transitions.
 *
 * Payload type narrowing happens here so the child sheet props stay strict:
 *   - `entryEdit` → `{ entryId: string | null }`
 *   - `addPlace`  → `{ placeId: string | null; source?: AddPlaceSource }`
 *   - `paywall`   → `{ source?: "2nd-place" | "export" | ... }`
 *
 * When `addPlace` is opened with `source: "onboarding"` we wire an
 * `onSaved` callback that marks onboarding complete and routes to the
 * tabs — this is the only side-effect the sheet host injects on behalf
 * of the onboarding flow.
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
      <PaywallScreen visible={active === "paywall"} onClose={close} />
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

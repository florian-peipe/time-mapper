import React from "react";
import { useSheetStore } from "@/state/sheetStore";
import { PaywallScreen } from "@/screens/Paywall/PaywallScreen";
import { EntryEditSheet } from "@/screens/EntryEdit/EntryEditSheet";
import { AddPlaceSheet } from "@/screens/AddPlace/AddPlaceSheet";

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
 *   - `addPlace`  → `{ placeId:  string | null }`
 *   - `paywall`   → `{ source?: "2nd-place" | "export" | ... }`  (unused visually)
 *
 * If a caller opens a sheet with the wrong payload shape we fall back to
 * `null` for the narrowed field and the sheet renders in its "new" mode —
 * safer than throwing, since the store isn't type-narrowed at runtime.
 */
export function SheetHost() {
  const active = useSheetStore((s) => s.active);
  const payload = useSheetStore((s) => s.payload);
  const close = useSheetStore((s) => s.closeSheet);

  const entryId =
    active === "entryEdit" && payload && "entryId" in payload ? payload.entryId : null;
  const placeId =
    active === "addPlace" && payload && "placeId" in payload ? payload.placeId : null;

  return (
    <>
      <PaywallScreen visible={active === "paywall"} onClose={close} />
      <EntryEditSheet visible={active === "entryEdit"} entryId={entryId} onClose={close} />
      <AddPlaceSheet visible={active === "addPlace"} placeId={placeId} onClose={close} />
    </>
  );
}

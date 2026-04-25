import React, { useCallback } from "react";
import { useRouter } from "expo-router";
import {
  useSheetStore,
  type AddPlaceSource,
  type PaywallMode,
  type PaywallSource,
} from "@/state/sheetStore";
import { EntryEditSheet } from "@/screens/EntryEdit/EntryEditSheet";
import { AddPlaceSheet } from "@/screens/AddPlace/AddPlaceSheet";
import { PaywallSheet } from "@/screens/Paywall/PaywallSheet";
import { useOnboardingGate } from "@/features/onboarding/useOnboardingGate";

const ADD_PLACE_SOURCES: readonly AddPlaceSource[] = ["onboarding", "places-tab"];
const PAYWALL_SOURCES: readonly PaywallSource[] = [
  "2nd-place",
  "export",
  "history",
  "settings",
  "settings-upgrade",
  "settings-downgrade",
];
const PAYWALL_MODES: readonly PaywallMode[] = ["subscribe", "change"];

function narrowAddPlaceSource(v: unknown): AddPlaceSource | undefined {
  if (typeof v !== "string") return undefined;
  return ADD_PLACE_SOURCES.includes(v as AddPlaceSource) ? (v as AddPlaceSource) : undefined;
}

function narrowPaywallSource(v: unknown): PaywallSource | undefined {
  if (typeof v !== "string") return undefined;
  return PAYWALL_SOURCES.includes(v as PaywallSource) ? (v as PaywallSource) : undefined;
}

function narrowPaywallMode(v: unknown): PaywallMode | undefined {
  if (typeof v !== "string") return undefined;
  return PAYWALL_MODES.includes(v as PaywallMode) ? (v as PaywallMode) : undefined;
}

/**
 * Global sheet orchestrator — mounted once at the app root. Owns the three
 * in-app sheets (`entryEdit`, `addPlace`, `paywall`) and listens to
 * `useSheetStore` for `{ active, payload }`. All sheet components are always
 * rendered; the underlying `Sheet` primitive's RN Modal handles show/hide
 * natively via its `visible` prop.
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
  const paywallSource =
    active === "paywall" && payload && "paywallSource" in payload
      ? narrowPaywallSource(payload.paywallSource)
      : undefined;
  const paywallMode =
    active === "paywall" && payload && "mode" in payload
      ? narrowPaywallMode(payload.mode)
      : undefined;
  const paywallCurrentProductId =
    active === "paywall" && payload && "currentProductId" in payload
      ? (typeof payload.currentProductId === "string" ? payload.currentProductId : undefined)
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
      <PaywallSheet
        visible={active === "paywall"}
        paywallSource={paywallSource}
        mode={paywallMode}
        currentProductId={paywallCurrentProductId}
        onClose={close}
      />
    </>
  );
}

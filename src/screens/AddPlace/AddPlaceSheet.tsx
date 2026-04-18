import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { useTheme } from "@/theme/useTheme";
import { PLACE_COLORS } from "@/theme/tokens";
import { Banner, Button, Icon, Input, Sheet, type IconName } from "@/components";
import { usePlaces } from "@/features/places/usePlaces";
import { usePro } from "@/features/billing/usePro";
import { useSheetStore, type AddPlaceSource } from "@/state/sheetStore";
import { MAX_PLACES } from "@/features/tracking/geofenceService";
import { i18n } from "@/lib/i18n";
import {
  autocomplete,
  geocodePlace,
  createSessionToken,
  type PlaceSuggestion,
} from "@/lib/geocode";

export type AddPlaceSheetProps = {
  visible: boolean;
  /** null → New place. Non-null → edit that place. */
  placeId: string | null;
  /**
   * Optional marker of where the sheet was opened from. Currently only
   * `"onboarding"` drives extra behavior (calls `onSaved` so the gate can
   * mark onboarding complete). Other sources are plain string tags used for
   * analytics / debugging.
   */
  source?: AddPlaceSource;
  onClose: () => void;
  /**
   * Fired after a successful save (create OR update). Lets the onboarding
   * flow mark itself complete and navigate to the tabs without knowing the
   * AddPlaceSheet internals. For non-onboarding opens the host just passes
   * `undefined` and this becomes a no-op.
   */
  onSaved?: (placeId: string) => void;
};

/** Internal selection state — either from an autocomplete pick or an edit. */
type Selection = {
  description: string;
  placeId?: string;
  latitude: number;
  longitude: number;
};

/**
 * The 9 icons the design offers for place customisation. Source: Screens.jsx
 * AddPlaceSheet `icons` array. The array originally used shorthand names
 * like `bag` / `book` — here we use the canonical IconName keys instead of
 * inventing new icons.
 */
const ICON_CHOICES: readonly IconName[] = [
  "home",
  "briefcase",
  "dumbbell",
  "coffee",
  "book-open",
  "shopping-bag",
  "heart",
  "music",
  "star",
] as const;

const RADIUS_MIN = 50;
const RADIUS_MAX = 300;
const RADIUS_DEFAULT = 100;
const AUTOCOMPLETE_DEBOUNCE_MS = 300;

/**
 * AddPlaceSheet — two-phase flow for creating (or, in v0.3, editing) a place.
 *
 * Phase 1: Search input (leading icon) + list of suggestion rows. In Plan 5+
 * suggestions come from `@/lib/geocode.autocomplete`, which calls Google
 * Places if `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` is set or falls back to a
 * hardcoded demo list otherwise. Tap a suggestion to trigger `geocodePlace`
 * (resolves to lat/lng) and transition to Phase 2 with the name pre-filled.
 *
 * Phase 2: Name input, address preview card, geofence radius slider
 * (50–300 m), color picker (8 swatches), icon picker (9 tiles), and a
 * sticky Save footer. In edit mode a destructive "Delete place" row sits
 * below Save with a confirmation Alert.
 *
 * Pro gate: free users with ≥1 existing place see a "Unlock more places
 * with Pro" CTA that opens the paywall instead of calling
 * `placesRepo.create` — but only in NEW mode. Edit mode is never gated
 * (the user already owns the place; billing only limits adding more).
 */
export function AddPlaceSheet({ visible, placeId, source, onClose, onSaved }: AddPlaceSheetProps) {
  const t = useTheme();
  const { places, create, update, remove, count } = usePlaces();
  const { isPro } = usePro();
  const openSheet = useSheetStore((s) => s.openSheet);

  const editing = placeId != null;
  const editingPlace = useMemo(
    () => (placeId ? (places.find((p) => p.id === placeId) ?? null) : null),
    [places, placeId],
  );

  // Resolve the initial color/icon index from an edited place. Defaults to
  // index 0 if the stored value isn't one of the chosen lists (old data,
  // truncated color, etc.).
  const initialColorIdx = useMemo(() => {
    if (!editingPlace) return 0;
    const idx = PLACE_COLORS.findIndex((c) => c === editingPlace.color);
    return idx >= 0 ? idx : 0;
  }, [editingPlace]);
  const initialIconIdx = useMemo(() => {
    if (!editingPlace) return 0;
    const idx = ICON_CHOICES.findIndex((i) => i === editingPlace.icon);
    return idx >= 0 ? idx : 0;
  }, [editingPlace]);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [selected, setSelected] = useState<Selection | null>(
    editingPlace
      ? {
          description: editingPlace.address,
          latitude: editingPlace.latitude,
          longitude: editingPlace.longitude,
        }
      : null,
  );
  const [name, setName] = useState(editingPlace?.name ?? "");
  const [radius, setRadius] = useState(editingPlace?.radiusM ?? RADIUS_DEFAULT);
  const [colorIdx, setColorIdx] = useState(initialColorIdx);
  const [iconIdx, setIconIdx] = useState(initialIconIdx);
  const [apiError, setApiError] = useState<string | null>(null);

  // Places session token — minted per "open search → select" interaction so
  // Google bills a single transaction across the autocomplete keystrokes and
  // the final details call. Refreshed when a selection completes (prep for
  // the next search) or when the sheet opens fresh.
  const sessionTokenRef = useRef<string>(createSessionToken());

  // When the sheet is reused for a different placeId (edit vs. new vs.
  // another edit), re-hydrate the local state so stale values from the
  // previous instance don't leak through. Also resets when the sheet is
  // hidden so reopening gives a clean slate.
  useEffect(() => {
    if (editingPlace) {
      setSelected({
        description: editingPlace.address,
        latitude: editingPlace.latitude,
        longitude: editingPlace.longitude,
      });
      setName(editingPlace.name);
      setRadius(editingPlace.radiusM);
      setColorIdx(initialColorIdx);
      setIconIdx(initialIconIdx);
    } else if (!visible) {
      setQuery("");
      setSelected(null);
      setName("");
      setRadius(RADIUS_DEFAULT);
      setColorIdx(0);
      setIconIdx(0);
      setSuggestions([]);
      setApiError(null);
      sessionTokenRef.current = createSessionToken();
    }
  }, [editingPlace, visible, initialColorIdx, initialIconIdx]);

  // Autocomplete debounce. Every keystroke schedules a Places Autocomplete
  // call 300ms later; if the user keeps typing we cancel and reschedule.
  // Empty query → show all demo rows (when no key) or clear suggestions.
  useEffect(() => {
    if (editing || selected) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      void (async () => {
        try {
          const results = await autocomplete(query, sessionTokenRef.current);
          if (!cancelled) {
            setSuggestions(results);
            setApiError(null);
          }
        } catch (err) {
          if (!cancelled) {
            const msg = err instanceof Error ? err.message : String(err);
            setApiError(msg);
            setSuggestions([]);
          }
        }
      })();
    }, AUTOCOMPLETE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, editing, selected]);

  // Pro gate only applies when the user is trying to create an ADDITIONAL
  // place on the free plan. Edit mode (placeId !== null) is never gated.
  const shouldPaywall = !isPro && count >= 1 && !editing;

  const handlePickSuggestion = async (s: PlaceSuggestion) => {
    // Optimistically set the name from the main text so users see progress
    // while Place Details resolves in the background.
    setName(s.mainText || s.description.split(",")[0] || s.description);
    try {
      const details = await geocodePlace(s.placeId, sessionTokenRef.current);
      setSelected({
        description: details.formattedAddress || s.description,
        placeId: s.placeId,
        latitude: details.lat,
        longitude: details.lng,
      });
      // Mint a fresh token — this selection ended the billing session.
      sessionTokenRef.current = createSessionToken();
      setApiError(null);
    } catch (err) {
      // If geocoding fails, still let the user proceed with description
      // only (lat/lng zero). Surface the error in a Banner.
      const msg = err instanceof Error ? err.message : String(err);
      setApiError(msg);
      setSelected({
        description: s.description,
        placeId: s.placeId,
        latitude: 0,
        longitude: 0,
      });
    }
  };

  const handleSave = () => {
    if (shouldPaywall) {
      openSheet("paywall", { source: "2nd-place" });
      return;
    }
    // iOS caps geofence regions at 20. We enforce the same limit on Android
    // for consistency and because the state machine + reconcile loop both
    // assume a bounded set. Edit mode is never gated (the place already
    // exists, we're not adding one).
    if (!editing && count >= MAX_PLACES) {
      Alert.alert(i18n.t("tracking.placeLimit.title"), i18n.t("tracking.placeLimit.body"), [
        { text: i18n.t("tracking.placeLimit.ok") },
      ]);
      return;
    }
    if (!selected) return;
    const chosenColor = PLACE_COLORS[colorIdx] ?? PLACE_COLORS[0];
    const chosenIcon = ICON_CHOICES[iconIdx] ?? ICON_CHOICES[0];

    let saved;
    if (editing && placeId) {
      saved = update(placeId, {
        name: name.trim() || selected.description,
        address: selected.description,
        latitude: selected.latitude,
        longitude: selected.longitude,
        radiusM: radius,
        color: chosenColor,
        icon: chosenIcon,
      });
    } else {
      saved = create({
        name: name.trim() || selected.description,
        address: selected.description,
        latitude: selected.latitude,
        longitude: selected.longitude,
        radiusM: radius,
        color: chosenColor,
        icon: chosenIcon,
      });
    }
    onSaved?.(saved.id);
    onClose();
  };

  const handleDelete = () => {
    if (!placeId) return;
    Alert.alert(i18n.t("addPlace.delete.title"), i18n.t("addPlace.delete.body"), [
      { text: i18n.t("common.cancel"), style: "cancel" },
      {
        text: i18n.t("common.delete"),
        style: "destructive",
        onPress: () => {
          remove(placeId);
          onClose();
        },
      },
    ]);
  };

  // Avoid using the source prop for behavior inside the sheet for now —
  // the parent (SheetHost) is in charge of wiring `source === "onboarding"`
  // into the `onSaved` callback. Keeping this reference prevents the lint
  // rule from flagging the unused prop (TypeScript already tracks it).
  void source;

  const saveLabel = shouldPaywall
    ? i18n.t("addPlace.cta.unlockPro")
    : editing
      ? i18n.t("addPlace.cta.saveChanges")
      : i18n.t("addPlace.cta.savePlace");
  const sheetTitle = editing ? i18n.t("addPlace.title.edit") : i18n.t("addPlace.title.new");

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      heightPercent={88}
      title={sheetTitle}
      testID="add-place-sheet"
      footer={
        selected ? (
          <View style={{ gap: t.space[2] }}>
            <Button
              variant="primary"
              size="md"
              full
              onPress={handleSave}
              testID="add-place-save"
              accessibilityLabel={saveLabel}
              accessibilityHint={shouldPaywall ? i18n.t("addPlace.cta.unlockPro.hint") : undefined}
            >
              {saveLabel}
            </Button>
            {editing ? (
              <Button
                variant="destructive"
                size="md"
                full
                onPress={handleDelete}
                testID="add-place-delete"
                accessibilityLabel={i18n.t("addPlace.delete.cta")}
                accessibilityHint={i18n.t("addPlace.delete.hint")}
              >
                {i18n.t("addPlace.delete.cta")}
              </Button>
            ) : null}
          </View>
        ) : null
      }
    >
      {!selected ? (
        <>
          <Input
            testID="add-place-search"
            autoFocus
            placeholder={i18n.t("addPlace.search.placeholder")}
            value={query}
            onChangeText={setQuery}
            leading="search"
            containerStyle={{ marginBottom: t.space[3] }}
            accessibilityLabel={i18n.t("addPlace.search.placeholder")}
            accessibilityHint={i18n.t("addPlace.search.hint")}
          />
          {apiError ? (
            <View style={{ marginBottom: t.space[3] }}>
              <Banner
                tone="warning"
                title={i18n.t("addPlace.search.errorTitle")}
                body={i18n.t("addPlace.search.errorBody")}
                testID="add-place-api-error"
              />
            </View>
          ) : null}
          {suggestions.map((s, i) => (
            <Pressable
              key={`${s.placeId}-${i}`}
              testID={`add-place-suggestion-${i}`}
              onPress={() => {
                void handlePickSuggestion(s);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${s.mainText}, ${s.secondaryText}`}
              accessibilityHint={i18n.t("addPlace.suggestion.hint")}
              hitSlop={t.space[2]}
              style={{
                flexDirection: "row",
                gap: t.space[3],
                paddingVertical: t.space[3],
                paddingHorizontal: t.space[1],
                borderBottomWidth: 1,
                borderBottomColor: t.color("color.border"),
                minHeight: t.minTouchTarget,
              }}
            >
              <View style={{ marginTop: 2 }}>
                <Icon
                  name="map-pin"
                  size={18}
                  color={t.color("color.fg3")}
                  accessibilityLabel={i18n.t("addPlace.icon.pin")}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: t.type.size.body,
                    color: t.color("color.fg"),
                    fontFamily: t.type.family.sans,
                  }}
                >
                  {s.mainText || s.description}
                </Text>
                <Text
                  style={{
                    fontSize: t.type.size.xs + 1, // design-source: secondary 12
                    color: t.color("color.fg3"),
                    fontFamily: t.type.family.sans,
                    marginTop: 2,
                  }}
                >
                  {s.secondaryText}
                </Text>
              </View>
            </Pressable>
          ))}
        </>
      ) : (
        <View style={{ flexDirection: "column", gap: t.space[5] - 2 }}>
          {/* Name field. */}
          <View style={{ flexDirection: "column", gap: t.space[1] + 2 }}>
            <Text
              accessibilityRole="text"
              style={{
                fontSize: t.type.size.s,
                color: t.color("color.fg2"),
                fontFamily: t.type.family.sans,
                fontWeight: t.type.weight.medium,
              }}
            >
              {i18n.t("addPlace.field.name")}
            </Text>
            <Input
              testID="add-place-name"
              value={name}
              onChangeText={setName}
              accessibilityLabel={i18n.t("addPlace.field.name")}
            />
          </View>

          {/* Address preview card. */}
          <View
            accessibilityRole="text"
            accessibilityLabel={`${i18n.t("addPlace.field.address")}, ${selected.description}`}
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: t.space[3] - 2, // design-source: gap 10
              paddingVertical: t.space[3],
              paddingHorizontal: 14, // design-source: 14 horizontal
              backgroundColor: t.color("color.surface2"),
              borderRadius: t.radius.md - 2, // design-source: radius 10
            }}
          >
            <View style={{ marginTop: 2 }}>
              <Icon name="map-pin" size={18} color={t.color("color.fg2")} />
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: t.type.size.body - 1, // design-source: 14
                color: t.color("color.fg2"),
                fontFamily: t.type.family.sans,
              }}
            >
              {selected.description}
            </Text>
          </View>

          {/* Radius section. */}
          <View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: t.space[2],
              }}
            >
              <Text
                accessibilityRole="text"
                style={{
                  fontSize: t.type.size.s,
                  color: t.color("color.fg2"),
                  fontFamily: t.type.family.sans,
                  fontWeight: t.type.weight.medium,
                }}
              >
                {i18n.t("addPlace.field.radius")}
              </Text>
              <Text
                style={{
                  fontSize: t.type.size.s,
                  color: t.color("color.fg"),
                  fontFamily: t.type.family.sans,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {radius} m
              </Text>
            </View>
            <Slider
              testID="add-place-radius"
              minimumValue={RADIUS_MIN}
              maximumValue={RADIUS_MAX}
              step={1}
              value={radius}
              onValueChange={(v: number) => setRadius(Math.round(v))}
              minimumTrackTintColor={t.color("color.accent")}
              maximumTrackTintColor={t.color("color.border")}
              thumbTintColor={t.color("color.accent")}
              style={{ width: "100%", height: 40 }}
              accessibilityRole="adjustable"
              accessibilityLabel={i18n.t("addPlace.field.radius")}
              accessibilityValue={{
                min: RADIUS_MIN,
                max: RADIUS_MAX,
                now: radius,
                text: `${radius} m`,
              }}
              accessibilityHint={i18n.t("addPlace.field.radius.hint")}
            />
          </View>

          {/* Color picker. */}
          <View>
            <Text
              accessibilityRole="text"
              style={{
                fontSize: t.type.size.s,
                color: t.color("color.fg2"),
                fontFamily: t.type.family.sans,
                fontWeight: t.type.weight.medium,
                marginBottom: t.space[2],
              }}
            >
              {i18n.t("addPlace.field.color")}
            </Text>
            <View
              style={{
                flexDirection: "row",
                gap: t.space[2] + 2, // design-source: gap 10
                flexWrap: "wrap",
              }}
            >
              {PLACE_COLORS.map((c, i) => (
                <ColorSwatch
                  key={c}
                  color={c}
                  selected={i === colorIdx}
                  onPress={() => setColorIdx(i)}
                  testID={`add-place-color-${i}`}
                />
              ))}
            </View>
          </View>

          {/* Icon picker grid (6 per row). */}
          <View>
            <Text
              accessibilityRole="text"
              style={{
                fontSize: t.type.size.s,
                color: t.color("color.fg2"),
                fontFamily: t.type.family.sans,
                fontWeight: t.type.weight.medium,
                marginBottom: t.space[2],
              }}
            >
              {i18n.t("addPlace.field.icon")}
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                // design-source: gap 8 between tiles on both axes
                gap: t.space[2],
              }}
            >
              {ICON_CHOICES.map((iconName, i) => (
                <IconTile
                  key={iconName}
                  name={iconName}
                  selected={i === iconIdx}
                  color={PLACE_COLORS[colorIdx] ?? PLACE_COLORS[0]!}
                  onPress={() => setIconIdx(i)}
                  testID={`add-place-icon-${i}`}
                />
              ))}
            </View>
          </View>
        </View>
      )}
    </Sheet>
  );
}

/**
 * A 36×36 circular color chip. Selected state draws two nested rings to
 * mimic the design-system `0 0 0 3px bg, 0 0 0 5px fg` double-shadow trick.
 */
function ColorSwatch({
  color,
  selected,
  onPress,
  testID,
}: {
  color: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${i18n.t("addPlace.field.color")} ${color}`}
      accessibilityState={{ selected }}
      hitSlop={t.space[1]}
      style={{
        // Outer ring = bg-colour with 5px extra — only painted when selected.
        width: 46,
        height: 46,
        borderRadius: t.radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: selected ? t.color("color.fg") : "transparent",
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: t.radius.pill,
          backgroundColor: t.color("color.bg"),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            // design-source: inner swatch 36×36
            width: 36,
            height: 36,
            borderRadius: t.radius.pill,
            backgroundColor: color,
          }}
        />
      </View>
    </Pressable>
  );
}

/**
 * A square icon tile. Selected: filled with the current accent color + white
 * icon. Others: surface2 bg + fg2 icon. Design-source: AddPlaceSheet icon
 * grid (lines 407-414).
 */
function IconTile({
  name,
  selected,
  color,
  onPress,
  testID,
}: {
  name: IconName;
  selected: boolean;
  color: string;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${i18n.t("addPlace.field.icon")} ${name}`}
      accessibilityState={{ selected }}
      hitSlop={t.space[1]}
      style={{
        // design-source: 6 per row = (100% - 5 gaps of 8) / 6; we keep a
        // fixed square so the test environment width stays stable.
        width: 48,
        height: 48,
        borderRadius: t.radius.md - 2, // design-source: radius 10
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: selected ? color : t.color("color.surface2"),
      }}
    >
      <Icon
        name={name}
        size={20}
        color={selected ? t.color("color.accent.contrast") : t.color("color.fg2")}
      />
    </Pressable>
  );
}

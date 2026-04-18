import React, { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { useTheme } from "@/theme/useTheme";
import { PLACE_COLORS } from "@/theme/tokens";
import { Button, Icon, Input, Sheet, type IconName } from "@/components";
import { usePlaces } from "@/features/places/usePlaces";
import { usePro } from "@/features/billing/usePro";
import { useSheetStore, type AddPlaceSource } from "@/state/sheetStore";
import { MAX_PLACES } from "@/features/tracking/geofenceService";
import { i18n } from "@/lib/i18n";

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

type Suggestion = {
  /** Street + city line (primary label). */
  desc: string;
  /** Country line (secondary). */
  sec: string;
};

/**
 * Hardcoded German address suggestions. Real Google Places integration is
 * Plan 3/4. Source: Screens.jsx AddPlaceSheet (lines 329-342).
 */
const SUGGESTIONS: readonly Suggestion[] = [
  { desc: "Kinkelstr. 3, 50733 Köln", sec: "Germany" },
  { desc: "Mediapark 8, 50670 Köln", sec: "Germany" },
  { desc: "Kinkel Straße 12, Düsseldorf", sec: "Germany" },
] as const;

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

/**
 * AddPlaceSheet — two-phase flow for creating (or, in v0.3, editing) a place.
 *
 * Phase 1: Search input (leading icon) + list of suggestion rows. Tap a
 * suggestion to transition to Phase 2 with the name pre-filled from the
 * first part of the address. Skipped entirely when `placeId != null`
 * because we jump straight into Phase 2 with the loaded place's fields.
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
  const [selected, setSelected] = useState<Suggestion | null>(
    editingPlace ? { desc: editingPlace.address, sec: "" } : null,
  );
  const [name, setName] = useState(editingPlace?.name ?? "");
  const [radius, setRadius] = useState(editingPlace?.radiusM ?? RADIUS_DEFAULT);
  const [colorIdx, setColorIdx] = useState(initialColorIdx);
  const [iconIdx, setIconIdx] = useState(initialIconIdx);

  // When the sheet is reused for a different placeId (edit vs. new vs.
  // another edit), re-hydrate the local state so stale values from the
  // previous instance don't leak through. Also resets when the sheet is
  // hidden so reopening gives a clean slate.
  React.useEffect(() => {
    if (editingPlace) {
      setSelected({ desc: editingPlace.address, sec: "" });
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
    }
  }, [editingPlace, visible, initialColorIdx, initialIconIdx]);

  // Pro gate only applies when the user is trying to create an ADDITIONAL
  // place on the free plan. Edit mode (placeId !== null) is never gated.
  const shouldPaywall = !isPro && count >= 1 && !editing;

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SUGGESTIONS;
    return SUGGESTIONS.filter((s) => s.desc.toLowerCase().includes(q));
  }, [query]);

  const handlePickSuggestion = (s: Suggestion) => {
    setSelected(s);
    // Pre-fill name from first part of the address (before the first comma).
    setName(s.desc.split(",")[0] ?? s.desc);
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
        name: name.trim() || selected.desc,
        address: selected.desc,
        radiusM: radius,
        color: chosenColor,
        icon: chosenIcon,
      });
    } else {
      saved = create({
        name: name.trim() || selected.desc,
        address: selected.desc,
        // Coordinates are unavailable without a geocoder; stored as zeros for
        // Plan 2. Plan 3 replaces the hardcoded suggestions with Google Places
        // and populates real lat/long.
        latitude: 0,
        longitude: 0,
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
    Alert.alert("Delete place?", "This removes the place from your list. Entries are kept.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
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
    ? "Unlock more places with Pro"
    : editing
      ? "Save changes"
      : "Save place";
  const sheetTitle = editing ? "Edit place" : "Add place";

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
            <Button variant="primary" size="md" full onPress={handleSave} testID="add-place-save">
              {saveLabel}
            </Button>
            {editing ? (
              <Button
                variant="destructive"
                size="md"
                full
                onPress={handleDelete}
                testID="add-place-delete"
              >
                Delete place
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
            placeholder="Search address"
            value={query}
            onChangeText={setQuery}
            leading="search"
            containerStyle={{ marginBottom: t.space[3] }}
          />
          {suggestions.map((s, i) => (
            <Pressable
              key={`${s.desc}-${i}`}
              testID={`add-place-suggestion-${i}`}
              onPress={() => handlePickSuggestion(s)}
              accessibilityRole="button"
              style={{
                flexDirection: "row",
                gap: t.space[3],
                paddingVertical: t.space[3],
                paddingHorizontal: t.space[1],
                borderBottomWidth: 1,
                borderBottomColor: t.color("color.border"),
              }}
            >
              <View style={{ marginTop: 2 }}>
                <Icon name="map-pin" size={18} color={t.color("color.fg3")} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: t.type.size.body,
                    color: t.color("color.fg"),
                    fontFamily: t.type.family.sans,
                  }}
                >
                  {s.desc}
                </Text>
                <Text
                  style={{
                    fontSize: t.type.size.xs + 1, // design-source: secondary 12
                    color: t.color("color.fg3"),
                    fontFamily: t.type.family.sans,
                    marginTop: 2,
                  }}
                >
                  {s.sec}
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
              style={{
                fontSize: t.type.size.s,
                color: t.color("color.fg2"),
                fontFamily: t.type.family.sans,
                fontWeight: t.type.weight.medium,
              }}
            >
              Name
            </Text>
            <Input testID="add-place-name" value={name} onChangeText={setName} />
          </View>

          {/* Address preview card. */}
          <View
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
              {selected.desc}
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
                style={{
                  fontSize: t.type.size.s,
                  color: t.color("color.fg2"),
                  fontFamily: t.type.family.sans,
                  fontWeight: t.type.weight.medium,
                }}
              >
                Geofence radius
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
            />
          </View>

          {/* Color picker. */}
          <View>
            <Text
              style={{
                fontSize: t.type.size.s,
                color: t.color("color.fg2"),
                fontFamily: t.type.family.sans,
                fontWeight: t.type.weight.medium,
                marginBottom: t.space[2],
              }}
            >
              Color
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
              style={{
                fontSize: t.type.size.s,
                color: t.color("color.fg2"),
                fontFamily: t.type.family.sans,
                fontWeight: t.type.weight.medium,
                marginBottom: t.space[2],
              }}
            >
              Icon
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
      accessibilityState={{ selected }}
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
      accessibilityState={{ selected }}
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

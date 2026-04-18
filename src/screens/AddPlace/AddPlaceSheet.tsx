import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { useTheme } from "@/theme/useTheme";
import { PLACE_COLORS } from "@/theme/tokens";
import { Button, Icon, Input, Sheet, type IconName } from "@/components";
import { usePlaces } from "@/features/places/usePlaces";
import { useProMock } from "@/features/billing/useProMock";
import { useSheetStore } from "@/state/sheetStore";

export type AddPlaceSheetProps = {
  visible: boolean;
  /** null → New. Edit mode is Plan 3+; we only support null for now. */
  placeId: string | null;
  onClose: () => void;
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
 * AddPlaceSheet — two-phase flow for creating a new place.
 *
 * Phase 1: Search input (leading icon) + list of suggestion rows. Tap a
 * suggestion to transition to Phase 2 with the name pre-filled from the
 * first part of the address.
 *
 * Phase 2: Name input, address preview card, geofence radius slider
 * (50–300 m), color picker (8 swatches), icon picker (9 tiles), and a
 * sticky Save footer. Pro gate: free users with ≥1 existing place see a
 * "Unlock more places with Pro" CTA that opens the paywall instead of
 * calling `placesRepo.create`.
 */
export function AddPlaceSheet({ visible, placeId: _placeId, onClose }: AddPlaceSheetProps) {
  const t = useTheme();
  const { create, count } = usePlaces();
  const { isPro } = useProMock();
  const openSheet = useSheetStore((s) => s.openSheet);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [name, setName] = useState("");
  const [radius, setRadius] = useState(RADIUS_DEFAULT);
  const [colorIdx, setColorIdx] = useState(0);
  const [iconIdx, setIconIdx] = useState(0);

  const shouldPaywall = !isPro && count >= 1;

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
    if (!selected) return;
    const chosenColor = PLACE_COLORS[colorIdx] ?? PLACE_COLORS[0];
    const chosenIcon = ICON_CHOICES[iconIdx] ?? ICON_CHOICES[0];
    create({
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
    onClose();
  };

  const saveLabel = shouldPaywall ? "Unlock more places with Pro" : "Save place";

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      heightPercent={88}
      title="Add place"
      testID="add-place-sheet"
      footer={
        selected ? (
          <Button variant="primary" size="md" full onPress={handleSave} testID="add-place-save">
            {saveLabel}
          </Button>
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

import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Banner, Icon, Input } from "@/components";
import { i18n } from "@/lib/i18n";
import type { PlaceSuggestion } from "@/lib/geocode";

/**
 * Phase-1 of the AddPlaceSheet: free-form search input + debounced Photon
 * autocomplete rows. The parent owns the query/suggestions state (the
 * debounce lives in the effect up in AddPlaceSheet) so this component is
 * a pure renderer + event forwarder — picking a row transitions the parent
 * into Phase-2 by resolving `onPickSuggestion`.
 */
export function Phase1SearchStep({
  query,
  suggestions,
  searching,
  apiError,
  onChangeQuery,
  onPickSuggestion,
}: {
  query: string;
  suggestions: PlaceSuggestion[];
  searching: boolean;
  apiError: string | null;
  onChangeQuery: (v: string) => void;
  onPickSuggestion: (s: PlaceSuggestion) => void;
}) {
  const t = useTheme();
  return (
    <>
      <Input
        testID="add-place-search"
        autoFocus
        placeholder={i18n.t("addPlace.search.placeholder")}
        value={query}
        onChangeText={onChangeQuery}
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
      {searching ? (
        <View
          testID="add-place-searching"
          accessible
          accessibilityLiveRegion="polite"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: t.space[2],
            paddingVertical: t.space[2],
            paddingHorizontal: t.space[1],
          }}
        >
          <ActivityIndicator size="small" color={t.color("color.accent")} />
          <Text
            style={{
              fontSize: t.type.size.s,
              color: t.color("color.fg3"),
              fontFamily: t.type.family.sans,
            }}
          >
            {i18n.t("addPlace.search.searching")}
          </Text>
        </View>
      ) : null}
      {suggestions.map((s, i) => (
        <Pressable
          key={`${s.placeId}-${i}`}
          testID={`add-place-suggestion-${i}`}
          onPress={() => {
            onPickSuggestion(s);
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
                fontSize: t.type.size.xs + 1,
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
  );
}

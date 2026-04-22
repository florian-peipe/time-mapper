import React from "react";
import { Pressable } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Icon, type IconName } from "@/components";
import { i18n } from "@/lib/i18n";

/**
 * Square icon tile used in the AddPlaceSheet icon grid. Selected tile is
 * filled with the currently-picked place color + white icon; others use
 * the muted `surface2` background.
 */
export function IconTile({
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
        // 6 tiles per row = (container − 5 gaps of 8px) / 6; we keep a
        // fixed square so the test environment width stays stable.
        width: 48,
        height: 48,
        borderRadius: t.radius.md - 2,
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

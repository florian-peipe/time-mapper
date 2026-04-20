import React from "react";
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Icon, type IconName } from "./Icon";
import { IconBadge } from "./IconBadge";

type Props = {
  icon?: IconName;
  iconBg?: string;
  iconColor?: string;
  title: string;
  detail?: string | React.ReactNode;
  onPress?: () => void;
  /** If true, omit the bottom hairline (used for the last row in a Section). */
  last?: boolean;
  /** Override the right accessory (e.g. a Switch). Suppresses the default chevron. */
  accessoryRight?: React.ReactNode;
  /** Override the computed accessibility label. Defaults to `title` + detail. */
  accessibilityLabel?: string;
  /** Short hint explaining what the row does when activated. */
  accessibilityHint?: string;
  /** Semantic role. Defaults to "button" for tappable rows. */
  accessibilityRole?: "button" | "link" | "switch" | "header";
  /** Optional a11y state — used when `accessoryRight` is a Switch, etc. */
  accessibilityState?: {
    disabled?: boolean;
    selected?: boolean;
    checked?: boolean;
    busy?: boolean;
  };
  testID?: string;
};

/**
 * Settings-style row — padding 12/14, gap 12, optional IconBadge on
 * the left, chevron-right when tappable.
 */
export function ListRow({
  icon,
  iconBg,
  iconColor,
  title,
  detail,
  onPress,
  last,
  accessoryRight,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  accessibilityState,
  testID,
}: Props) {
  const t = useTheme();

  const borderBottomWidth = last ? 0 : 1;

  // 12/14 padding — space[3] is 12 (vertical). Horizontal 14 has no
  // matching token; written as a literal rather than inventing a 3.5.
  const style: StyleProp<ViewStyle> = {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space[3],
    paddingVertical: t.space[3],
    paddingHorizontal: 14,
    borderBottomWidth,
    borderBottomColor: t.color("color.border"),
    backgroundColor: "transparent",
    minHeight: t.minTouchTarget,
  };

  const rightAccessory =
    accessoryRight !== undefined ? (
      accessoryRight
    ) : onPress ? (
      <Icon name="chevron-right" size={16} color={t.color("color.fg3")} />
    ) : null;

  const content = (
    <>
      {icon && <IconBadge icon={icon} bg={iconBg} color={iconColor} />}
      <View style={{ flex: 1, flexShrink: 1 }}>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{
            fontSize: t.type.size.body,
            color: t.color("color.fg"),
            fontFamily: t.type.family.sans,
          }}
        >
          {title}
        </Text>
      </View>
      {typeof detail === "string" ? (
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{
            flexShrink: 1,
            maxWidth: "50%",
            fontSize: t.type.size.body,
            color: t.color("color.fg3"),
            fontFamily: t.type.family.sans,
          }}
        >
          {detail}
        </Text>
      ) : (
        detail
      )}
      {rightAccessory}
    </>
  );

  // Compose the default a11y label from title + string detail so screen
  // readers announce "Theme, Light" rather than just "Theme".
  const computedLabel =
    accessibilityLabel ??
    (typeof detail === "string" && detail.length > 0 ? `${title}, ${detail}` : title);

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole={accessibilityRole ?? "button"}
        accessibilityLabel={computedLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={accessibilityState}
        hitSlop={4}
        style={style}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View
      testID={testID}
      accessibilityLabel={computedLabel}
      accessibilityRole={accessibilityRole}
      style={style}
    >
      {content}
    </View>
  );
}

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
  testID?: string;
};

/**
 * Settings-style row. Source: Screens.jsx SettingsScreen `Row` helper —
 * `padding: '12px 14px'`, gap 12, optional IconBadge on the left,
 * chevron-right when tappable.
 *
 * The 12 vertical / 14 horizontal padding is design-driven: the system
 * README calls out `14px` as the list-row vertical rhythm. We write the
 * numbers directly with a comment; adding space[3.5] would pollute the grid.
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
  testID,
}: Props) {
  const t = useTheme();

  const borderBottomWidth = last ? 0 : 1;

  // 12px vertical / 14px horizontal — design-system row in Screens.jsx.
  // Space[3] is 12 (matches). Horizontal 14 has no matching token; written
  // as a literal on purpose so we don't invent a 3.5 bucket.
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
      <View style={{ flex: 1 }}>
        <Text
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
          style={{
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

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={style}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={style}>
      {content}
    </View>
  );
}

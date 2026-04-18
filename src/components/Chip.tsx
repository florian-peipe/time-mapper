import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Icon, type IconName } from "./Icon";

export type ChipTone = "neutral" | "accent";

type Props = {
  label: string;
  icon?: IconName;
  selected?: boolean;
  onPress?: () => void;
  tone?: ChipTone;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

/**
 * Small pill used for benefit badges, place-picker chips in EntryEditSheet,
 * and filter pills. Source: Screens.jsx EntryEditSheet place picker
 * (`padding: '7px 12px 7px 8px'`, accent highlight when selected) + paywall
 * feature chips.
 *
 * Tone:
 * - `neutral` — default. Unselected: surface2 bg + border; selected: accent
 *   tint + accent border.
 * - `accent` — same as neutral's selected state regardless of `selected`
 *   (purely visual emphasis, e.g. for paywall badges).
 */
export function Chip({
  label,
  icon,
  selected,
  onPress,
  tone = "neutral",
  accessibilityLabel,
  accessibilityHint,
  testID,
}: Props) {
  const t = useTheme();

  const isHighlighted = tone === "accent" || selected;
  const bg = isHighlighted ? t.color("color.accent.soft") : t.color("color.surface2");
  const borderColor = isHighlighted ? t.color("color.accent") : t.color("color.border");
  const fg = isHighlighted ? t.color("color.accent") : t.color("color.fg");

  const style = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: t.space[2],
    // Design-system place-picker chip uses 7px vertical / 12px horizontal.
    // Token space[2] = 8 is close; we use explicit 7 so the chip is visually
    // identical to Screens.jsx without inventing a new token.
    paddingVertical: 7,
    paddingHorizontal: t.space[3],
    borderRadius: t.radius.pill,
    borderWidth: 1,
    borderColor,
    backgroundColor: bg,
    alignSelf: "flex-start" as const,
  };

  const content = (
    <>
      {icon && <Icon name={icon} size={14} color={fg} />}
      <Text
        style={{
          fontSize: t.type.size.s,
          fontWeight: t.type.weight.medium,
          fontFamily: t.type.family.sans,
          color: fg,
        }}
      >
        {label}
      </Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ selected: !!selected }}
        hitSlop={6}
        style={style}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="text"
      style={style}
    >
      {content}
    </View>
  );
}

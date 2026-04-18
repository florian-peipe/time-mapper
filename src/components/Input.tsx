import React, { useState } from "react";
import {
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/theme/useTheme";
import { Icon, type IconName } from "./Icon";

type Props = TextInputProps & {
  /** Red border + asks consumers to render helper text themselves. */
  invalid?: boolean;
  /** Icon name for a left adornment (~18px). */
  leading?: IconName;
  /** Optional container style — rarely needed; most sizing is fixed by tokens. */
  containerStyle?: StyleProp<ViewStyle>;
  /**
   * Inline validation message. When a non-empty string is passed the input
   * renders with the danger border (equivalent to `invalid`) and a small
   * danger-coloured line of text below it. Used by EntryEditSheet to flag
   * invalid HH:MM values without needing a separate helper component.
   */
  error?: string;
};

/**
 * Token-styled TextInput. Source: Screens.jsx `inputStyle` (height 48, radius
 * md, 1px border, padding horizontal 16).
 *
 * Focused border uses `color.border.strong` to give a subtle depth cue without
 * relying on a glow or outline (no native outline on web/RN).
 *
 * To render as read-only, pass `editable={false}` from the consumer.
 */
export function Input({
  invalid,
  leading,
  containerStyle,
  style,
  onFocus,
  onBlur,
  placeholderTextColor,
  error,
  testID,
  ...rest
}: Props) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);

  const hasError = !!error;
  const borderColor =
    invalid || hasError
      ? t.color("color.danger")
      : focused
        ? t.color("color.border.strong")
        : t.color("color.border");

  type FocusHandler = NonNullable<TextInputProps["onFocus"]>;
  type BlurHandler = NonNullable<TextInputProps["onBlur"]>;

  const handleFocus: FocusHandler = (e) => {
    setFocused(true);
    onFocus?.(e);
  };
  const handleBlur: BlurHandler = (e) => {
    setFocused(false);
    onBlur?.(e);
  };

  const input = (
    <TextInput
      {...rest}
      testID={testID}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholderTextColor={placeholderTextColor ?? t.color("color.fg3")}
      style={[
        {
          height: 48,
          borderRadius: t.radius.md,
          borderWidth: 1,
          borderColor,
          paddingHorizontal: t.space[4],
          // 42 matches the design-system search input (icon sits at left: 14 with ~18 icon)
          paddingLeft: leading ? 42 : t.space[4],
          color: t.color("color.fg"),
          backgroundColor: t.color("color.surface"),
          fontSize: t.type.size.body,
          fontFamily: t.type.family.sans,
        },
        style,
      ]}
    />
  );

  const errorLine = hasError ? (
    <Text
      testID={testID ? `${testID}-error` : undefined}
      style={{
        color: t.color("color.danger"),
        fontSize: t.type.size.xs,
        fontFamily: t.type.family.sans,
        // design-source: 4px gap between field and inline validation text.
        marginTop: t.space[1],
      }}
    >
      {error}
    </Text>
  ) : null;

  if (!leading) {
    if (!errorLine) return input;
    return (
      <View style={containerStyle}>
        {input}
        {errorLine}
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <View style={{ position: "relative" }}>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            // 14 matches Screens.jsx AddPlaceSheet search-icon left offset
            left: 14,
            top: 0,
            bottom: 0,
            justifyContent: "center",
            zIndex: 1,
          }}
        >
          <Icon name={leading} size={18} color={t.color("color.fg3")} />
        </View>
        {input}
      </View>
      {errorLine}
    </View>
  );
}

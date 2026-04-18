import React, { useState } from "react";
import { TextInput, type TextInputProps } from "react-native";
import { useTheme } from "@/theme/useTheme";

type Props = TextInputProps & {
  /** Red border; consumers render helper text themselves. */
  invalid?: boolean;
  /** Minimum visible lines before content grows. Default 3. */
  minHeightLines?: number;
  /** Maximum visible lines; further content scrolls. Default 6. */
  maxHeightLines?: number;
};

/**
 * Multiline token-styled TextInput. Source: Screens.jsx EntryEditSheet note
 * field (textarea with `minHeight: 60`, padding 0, body font, Inter).
 *
 * Content-aware growing: the input starts at `minHeightLines` lines, expands
 * with typed content (via `onContentSizeChange`) and caps at `maxHeightLines`.
 * Past that, content scrolls.
 */
export function TextArea({
  invalid,
  minHeightLines = 3,
  maxHeightLines = 6,
  style,
  onContentSizeChange,
  onFocus,
  onBlur,
  placeholderTextColor,
  ...rest
}: Props) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const [measured, setMeasured] = useState<number | null>(null);

  // Body font size is 15, line-height multiplier is "body" (1.5) → 22.5, rounded.
  const lineHeight = Math.round(t.type.size.body * t.type.lineHeight.body);
  // Inner vertical padding (top + bottom). Design-system textarea uses 14px
  // vertical (see Screens.jsx row: "padding: '14px 16px'"). We mirror that.
  const padV = 14;
  const minHeight = minHeightLines * lineHeight + padV * 2;
  const maxHeight = maxHeightLines * lineHeight + padV * 2;

  const borderColor = invalid
    ? t.color("color.danger")
    : focused
      ? t.color("color.border.strong")
      : t.color("color.border");

  const height = measured == null ? minHeight : Math.min(Math.max(measured, minHeight), maxHeight);

  type FocusHandler = NonNullable<TextInputProps["onFocus"]>;
  type BlurHandler = NonNullable<TextInputProps["onBlur"]>;
  type ContentSizeHandler = NonNullable<TextInputProps["onContentSizeChange"]>;

  const handleFocus: FocusHandler = (e) => {
    setFocused(true);
    onFocus?.(e);
  };
  const handleBlur: BlurHandler = (e) => {
    setFocused(false);
    onBlur?.(e);
  };
  const handleContentSize: ContentSizeHandler = (e) => {
    const raw = e.nativeEvent?.contentSize?.height;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      // Account for padding the TextInput reports inside contentSize height
      setMeasured(raw + padV * 2);
    }
    onContentSizeChange?.(e);
  };

  return (
    <TextInput
      {...rest}
      multiline
      textAlignVertical="top"
      onFocus={handleFocus}
      onBlur={handleBlur}
      onContentSizeChange={handleContentSize}
      placeholderTextColor={placeholderTextColor ?? t.color("color.fg3")}
      style={[
        {
          minHeight,
          maxHeight,
          height,
          borderRadius: t.radius.md,
          borderWidth: 1,
          borderColor,
          paddingHorizontal: t.space[4],
          // 14 is the design-system row vertical padding — documented above.
          paddingVertical: padV,
          color: t.color("color.fg"),
          backgroundColor: t.color("color.surface"),
          fontSize: t.type.size.body,
          fontFamily: t.type.family.sans,
          lineHeight,
        },
        style,
      ]}
    />
  );
}

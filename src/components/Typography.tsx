import React, { useMemo } from "react";
import { Text, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "@/theme/useTheme";

/**
 * Typography variants. Named by role (what they're for) not by size so
 * screens read declaratively. Sizes map to `tokens.type.size`:
 *
 *   display  — top-level screen hero (32px)
 *   title    — section/card headline (24px)
 *   heading  — subheading within a card (20px)
 *   body     — primary reading text (15px, default)
 *   label    — form labels, metadata (13px)
 *   caption  — small secondary text (11px)
 */
export type TypographyVariant = "display" | "title" | "heading" | "body" | "label" | "caption";

/**
 * Semantic tone for the color channel. Independent of variant so a muted
 * body and a muted caption share the same tone key.
 */
export type TypographyTone = "default" | "muted" | "subtle" | "accent" | "danger" | "success";

type TypographyProps = TextProps & {
  variant?: TypographyVariant;
  tone?: TypographyTone;
  /** Force weight override. Defaults to the variant's canonical weight. */
  weight?: "regular" | "medium" | "semibold" | "bold";
  /** Render with tabular (monospaced) numbers. Useful for timers / stats. */
  tabularNums?: boolean;
  /** Mono font family override — e.g. for code-style snippets. */
  mono?: boolean;
};

/**
 * Single text primitive that defaults the font family, color, and weight so
 * screens don't restate them on every `<Text>`. Everything else passes
 * through to RN's `<Text>`.
 *
 * Consumers:
 *   <Typography>copy</Typography>                 // body / default / regular
 *   <Typography variant="title">Stats</Typography>
 *   <Typography tone="muted">inactive</Typography>
 *
 * For the two most common cases we also export `Heading` and `Body` as
 * lightweight aliases — they're just `Typography` with `variant` pinned.
 */
export function Typography({
  variant = "body",
  tone = "default",
  weight,
  tabularNums,
  mono,
  style,
  ...rest
}: TypographyProps) {
  const t = useTheme();
  const baseStyle = useMemo<TextStyle>(() => {
    const size = sizeFor(variant, t.type.size);
    const defaultWeight = weightFor(variant);
    const style: TextStyle = {
      fontFamily: mono ? t.type.family.mono : t.type.family.sans,
      fontSize: size,
      fontWeight: t.type.weight[weight ?? defaultWeight],
      color: colorFor(t, tone),
    };
    if (tabularNums) style.fontVariant = ["tabular-nums"];
    return style;
  }, [t, variant, tone, weight, mono, tabularNums]);

  return <Text {...rest} style={[baseStyle, style]} />;
}

/** Alias: title-sized heading. */
export function Heading(props: Omit<TypographyProps, "variant">) {
  return <Typography variant="title" {...props} />;
}

/** Alias: body-sized copy. The default for most screen text. */
export function Body(props: Omit<TypographyProps, "variant">) {
  return <Typography variant="body" {...props} />;
}

function sizeFor(
  variant: TypographyVariant,
  size: { xs: number; s: number; body: number; m: number; l: number; xl: number; display: number },
): number {
  switch (variant) {
    case "display":
      return size.display;
    case "title":
      return size.xl;
    case "heading":
      return size.l;
    case "body":
      return size.body;
    case "label":
      return size.s;
    case "caption":
      return size.xs;
  }
}

function weightFor(variant: TypographyVariant): "regular" | "medium" | "semibold" | "bold" {
  switch (variant) {
    case "display":
      return "bold";
    case "title":
      return "semibold";
    case "heading":
      return "semibold";
    case "body":
      return "regular";
    case "label":
      return "medium";
    case "caption":
      return "regular";
  }
}

function colorFor(t: ReturnType<typeof useTheme>, tone: TypographyTone): string {
  switch (tone) {
    case "default":
      return t.color("color.fg");
    case "muted":
      return t.color("color.fg2");
    case "subtle":
      return t.color("color.fg3");
    case "accent":
      return t.color("color.accent");
    case "danger":
      return t.color("color.danger");
    case "success":
      return t.color("color.success");
  }
}

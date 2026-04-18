import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme, type Theme } from "@/theme/useTheme";
import type { ColorTokenKey } from "@/theme/tokens";
import { Icon, type IconName } from "./Icon";

export type BannerTone = "info" | "warning" | "danger";

type BannerAction = {
  label: string;
  onPress: () => void;
};

type Props = {
  tone: BannerTone;
  title: string;
  body?: string;
  /** Icon override. Defaults: info→info, warning→alert-triangle, danger→alert-circle. */
  icon?: IconName;
  action?: BannerAction;
  testID?: string;
};

const TONE_ICON: Record<BannerTone, IconName> = {
  info: "info",
  warning: "alert-triangle",
  danger: "alert-circle",
};

// Design-system README insists "do not invent new hues": semantic colors are
// green (success), amber (warning), red (danger). For `info` we reuse the
// `chip.auto.*` tokens — the existing cool-blue pair used for auto-tracked
// source chips, which matches the neutral/informational semantic we need.
const TONE_TOKENS: Record<BannerTone, { bg: ColorTokenKey; fg: ColorTokenKey }> = {
  info: { bg: "color.chip.auto.bg", fg: "color.chip.auto.fg" },
  warning: { bg: "color.warning.soft", fg: "color.warning" },
  danger: { bg: "color.danger.soft", fg: "color.danger" },
};

function resolveTone(t: Theme, tone: BannerTone) {
  const keys = TONE_TOKENS[tone];
  return { bg: t.color(keys.bg), fg: t.color(keys.fg) };
}

/**
 * Inline message surface. Source: design-system README "Semantic" rule —
 * green for currently-tracking, amber for permission warnings, red for
 * destructive. Banner maps tone → soft bg + strong fg.
 *
 * Used for permission primers, "location denied", "notifications off", etc.
 * Keep copy second-person per the voice guidelines.
 */
export function Banner({ tone, title, body, icon, action, testID }: Props) {
  const t = useTheme();
  const { bg, fg } = resolveTone(t, tone);
  const iconName = icon ?? TONE_ICON[tone];

  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: t.space[3],
        padding: t.space[4],
        backgroundColor: bg,
        borderRadius: t.radius.md,
        borderWidth: 1,
        borderColor: fg,
      }}
    >
      <View style={{ marginTop: 2 }}>
        <Icon name={iconName} size={18} color={fg} />
      </View>
      <View style={{ flex: 1, gap: body ? t.space[1] : 0 }}>
        <Text
          style={{
            color: t.color("color.fg"),
            fontSize: t.type.size.body,
            fontWeight: t.type.weight.semibold,
            fontFamily: t.type.family.sans,
          }}
        >
          {title}
        </Text>
        {body && (
          <Text
            style={{
              color: t.color("color.fg2"),
              fontSize: t.type.size.s,
              fontFamily: t.type.family.sans,
              lineHeight: Math.round(t.type.size.s * t.type.lineHeight.body),
            }}
          >
            {body}
          </Text>
        )}
        {action && (
          <Pressable
            onPress={action.onPress}
            accessibilityRole="button"
            hitSlop={8}
            style={{ alignSelf: "flex-start", marginTop: t.space[2] }}
          >
            <Text
              style={{
                color: fg,
                fontSize: t.type.size.s,
                fontWeight: t.type.weight.semibold,
                fontFamily: t.type.family.sans,
              }}
            >
              {action.label}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

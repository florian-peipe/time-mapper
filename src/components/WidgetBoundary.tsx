import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";
import { ErrorBoundary } from "./ErrorBoundary";

type Props = {
  children: React.ReactNode;
  /** Sentry label so we can tell which widget crashed. */
  scope: string;
  testID?: string;
};

/**
 * Inline error boundary for a single widget (chart, map preview, etc.). A
 * render crash shows a compact "this section couldn't load" card with a
 * Retry button — the rest of the screen keeps working. Use {@link
 * ErrorBoundary} directly at the app root where the full-screen fallback
 * is appropriate.
 */
export function WidgetBoundary({ children, scope, testID }: Props) {
  return (
    <ErrorBoundary
      scope={scope}
      fallback={(reset) => <WidgetFallback onReset={reset} testID={testID} />}
    >
      {children}
    </ErrorBoundary>
  );
}

function WidgetFallback({ onReset, testID }: { onReset: () => void; testID?: string }) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      style={{
        marginHorizontal: t.space[5],
        marginVertical: t.space[3],
        padding: t.space[4],
        borderRadius: t.radius.md,
        borderWidth: 1,
        borderColor: t.color("color.border"),
        backgroundColor: t.color("color.surface"),
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontSize: t.type.size.body,
          fontWeight: t.type.weight.semibold,
          color: t.color("color.fg"),
          fontFamily: t.type.family.sans,
          textAlign: "center",
        }}
      >
        {i18n.t("widgetError.title")}
      </Text>
      <Text
        style={{
          marginTop: t.space[1],
          fontSize: t.type.size.s,
          color: t.color("color.fg2"),
          fontFamily: t.type.family.sans,
          textAlign: "center",
        }}
      >
        {i18n.t("widgetError.body")}
      </Text>
      <Pressable
        onPress={onReset}
        accessibilityRole="button"
        accessibilityLabel={i18n.t("common.retry")}
        style={{
          marginTop: t.space[3],
          paddingVertical: t.space[2],
          paddingHorizontal: t.space[4],
          borderRadius: t.radius.pill,
          backgroundColor: t.color("color.fg"),
        }}
      >
        <Text
          style={{
            fontSize: t.type.size.s,
            fontWeight: t.type.weight.semibold,
            color: t.color("color.bg"),
            fontFamily: t.type.family.sans,
          }}
        >
          {i18n.t("common.retry")}
        </Text>
      </Pressable>
    </View>
  );
}

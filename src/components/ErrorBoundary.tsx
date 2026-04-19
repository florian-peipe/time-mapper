import React from "react";
import { Text, View, Pressable } from "react-native";
import { captureException } from "@/lib/crash";
import { i18n } from "@/lib/i18n";
import { tokens } from "@/theme/tokens";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

/**
 * Top-level React error boundary. Catches uncaught exceptions thrown from
 * any rendered descendant, reports them through `captureException` (Sentry
 * when configured, console otherwise), and shows a minimal "something went
 * wrong" fallback with a Restart button that resets the boundary state so
 * the subtree re-renders.
 *
 * NOT a replacement for proper error handling in effects or async code —
 * JS errors in those paths don't reach error boundaries. This is the last
 * line of defense for render-phase crashes that would otherwise leave the
 * user staring at a frozen screen.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    captureException(error, { componentStack: info.componentStack ?? undefined });
  }

  reset = (): void => {
    this.setState({ hasError: false });
  };

  override render() {
    if (!this.state.hasError) return this.props.children;
    return <ErrorFallback onReset={this.reset} />;
  }
}

/**
 * Fallback UI shown when the boundary catches an error. Plain React Native
 * primitives — no theme context dependency, since the ErrorBoundary might
 * catch a crash inside ThemeProvider itself.
 */
function ErrorFallback({ onReset }: { onReset: () => void }) {
  // Deliberately raw styles via direct token lookup — we skip the theme
  // context (useTheme/ThemeProvider) since that might be what crashed.
  // The light palette is hardcoded: if the theme context is broken, we
  // can't consult the user's dark-mode preference anyway.
  const c = tokens.light;
  return (
    <View
      testID="error-boundary-fallback"
      style={{
        flex: 1,
        backgroundColor: c["color.bg"],
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <Text
        style={{
          fontSize: 20,
          fontWeight: "700",
          color: c["color.fg"],
          textAlign: "center",
          marginBottom: 12,
        }}
      >
        {i18n.t("errorBoundary.title")}
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: c["color.fg2"],
          textAlign: "center",
          marginBottom: 24,
        }}
      >
        {i18n.t("errorBoundary.body")}
      </Text>
      <Pressable
        testID="error-boundary-restart"
        accessibilityRole="button"
        accessibilityLabel={i18n.t("errorBoundary.restart")}
        onPress={onReset}
        style={{
          paddingVertical: 12,
          paddingHorizontal: 24,
          borderRadius: 9999,
          backgroundColor: c["color.accent"],
        }}
      >
        <Text style={{ color: c["color.accent.contrast"], fontWeight: "600", fontSize: 15 }}>
          {i18n.t("errorBoundary.restart")}
        </Text>
      </Pressable>
    </View>
  );
}

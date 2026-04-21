import React from "react";
import { Text, View, Pressable } from "react-native";
import { captureException } from "@/lib/crash";
import { i18n } from "@/lib/i18n";
import { tokens } from "@/theme/tokens";

type Props = {
  children: React.ReactNode;
  /**
   * Optional inline fallback used when wrapping a single widget. When
   * omitted the boundary falls back to the full-screen "something went
   * wrong" page — appropriate only at the app root. Scoped sub-boundaries
   * should pass an inline fallback so the rest of the screen stays
   * interactive when one widget crashes.
   */
  fallback?: (reset: () => void) => React.ReactNode;
  /** Label forwarded to Sentry so we can tell which subtree crashed. */
  scope?: string;
};

type State = {
  hasError: boolean;
};

/**
 * React error boundary. Catches uncaught render-phase exceptions from any
 * descendant, reports them through `captureException` (Sentry when
 * configured, console otherwise), and renders either a full-screen fallback
 * (default) or a caller-supplied inline one.
 *
 * NOT a replacement for proper error handling in effects or async code —
 * JS errors in those paths don't reach error boundaries.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    captureException(error, {
      componentStack: info.componentStack ?? undefined,
      scope: this.props.scope,
    });
  }

  reset = (): void => {
    this.setState({ hasError: false });
  };

  override render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.reset);
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

import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { useSnackbarStore } from "@/state/snackbarStore";

/**
 * Global snackbar host. Subscribes to `useSnackbarStore`, renders the
 * current snack (if any), and dismisses it after its TTL. The timer is
 * keyed on the snack's id so replacing the snack mid-flight immediately
 * cancels the prior timeout.
 *
 * Visual spec:
 *   - Pinned to the bottom of the screen with a 16pt margin.
 *   - surface color background, 12pt radius, border, shadow-sm.
 *   - Inline action button on the right (accent-colored text). Tapping
 *     the action fires `onPress` AND dismisses.
 *
 * Accessibility:
 *   - Exposes an `alert` role so screen readers announce appearance.
 *   - The action is a proper button with label propagated from the store.
 *   - The snack itself is NOT focus-trapping — it's a transient hint, not
 *     a modal.
 */
export function SnackbarHost({ testID }: { testID?: string } = {}) {
  const t = useTheme();
  const snack = useSnackbarStore((s) => s.current);
  const dismiss = useSnackbarStore((s) => s.dismiss);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Countdown progress (1 → 0 over ttlMs). Re-used across snacks to keep a
  // single animated value in flight; reset to 1 whenever a new snack mounts.
  const progress = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    progress.stopAnimation();
    progress.setValue(1);
    if (!snack) return;
    const id = snack.id;
    Animated.timing(progress, {
      toValue: 0,
      duration: snack.ttlMs,
      // Width animations must run on the JS thread — native driver only
      // supports transform/opacity.
      useNativeDriver: false,
    }).start();
    timerRef.current = setTimeout(() => {
      dismiss(id);
    }, snack.ttlMs);
    return () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      progress.stopAnimation();
    };
  }, [snack, dismiss, progress]);

  if (!snack) return null;

  const handleAction = () => {
    snack.action?.onPress();
    dismiss(snack.id);
  };

  return (
    <View
      testID={testID ?? "snackbar"}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={{
        position: "absolute",
        left: t.space[4],
        right: t.space[4],
        bottom: t.space[5] + t.space[4],
        flexDirection: "row",
        alignItems: "center",
        gap: t.space[3],
        paddingVertical: t.space[3],
        paddingHorizontal: t.space[4],
        backgroundColor: t.color("color.surface"),
        borderRadius: t.radius.md,
        borderWidth: 1,
        borderColor: t.color("color.border"),
        shadowColor: t.color("color.shadow"),
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 6,
      }}
    >
      <Text
        testID="snackbar-message"
        style={{
          flex: 1,
          fontSize: t.type.size.s,
          color: t.color("color.fg"),
          fontFamily: t.type.family.sans,
        }}
      >
        {snack.message}
      </Text>
      {snack.action ? (
        <Pressable
          testID="snackbar-action"
          accessibilityRole="button"
          accessibilityLabel={snack.action.label}
          onPress={handleAction}
          hitSlop={8}
          style={{
            paddingVertical: t.space[1],
            paddingHorizontal: t.space[2],
          }}
        >
          <Text
            style={{
              fontSize: t.type.size.s,
              fontWeight: t.type.weight.semibold,
              color: t.color("color.accent"),
              fontFamily: t.type.family.sans,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {snack.action.label}
          </Text>
        </Pressable>
      ) : null}
      {/*
        Countdown bar — a thin accent-colored fill at the bottom edge of the
        snackbar that depletes from full to empty over the TTL. Only rendered
        when the snack has an action (the undo case) — transient snacks
        without an action don't need a visible countdown.
      */}
      {snack.action ? (
        <View
          testID="snackbar-countdown"
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 3,
            backgroundColor: t.color("color.border"),
            borderBottomLeftRadius: t.radius.md,
            borderBottomRightRadius: t.radius.md,
            overflow: "hidden",
          }}
        >
          <Animated.View
            style={{
              height: "100%",
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
              backgroundColor: t.color("color.accent"),
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

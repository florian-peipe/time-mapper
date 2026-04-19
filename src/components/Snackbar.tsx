import React, { useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";
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

  useEffect(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!snack) return;
    const id = snack.id;
    timerRef.current = setTimeout(() => {
      dismiss(id);
    }, snack.ttlMs);
    return () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [snack, dismiss]);

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
    </View>
  );
}

import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";
import { Icon } from "./Icon";

type Props = {
  visible: boolean;
  onClose: () => void;
  /**
   * Percent of screen height the sheet should occupy (0-100). Default 88.
   * Typical overrides: 88% for AddPlaceSheet, 86% for EntryEditSheet, 92%
   * for Paywall.
   */
  heightPercent?: number;
  title?: string;
  children: React.ReactNode;
  /** Optional sticky footer with a top hairline and padding. */
  footer?: React.ReactNode;
  /**
   * Optional header accessory rendered in the right slot that would otherwise
   * be an empty spacer balancing the close button. Used by EntryEditSheet for
   * its inline `Save` pill. When omitted the slot falls back to an invisible
   * 36px spacer so the title remains visually centered.
   */
  rightAccessory?: React.ReactNode;
  testID?: string;
};

/**
 * Bottom sheet built on React Native's built-in `Modal` with
 * `animationType="slide"`, rather than reanimated +
 * react-native-gesture-handler for drag-to-dismiss. Rationale:
 * - native RN slide-up is already smooth on both platforms;
 * - the feature set (tap-outside to close, X button) covers every sheet we
 *   need — AddPlaceSheet, EntryEditSheet, Paywall, onboarding steps;
 * - reanimated pulls additional Babel config and binary size;
 * - if drag-to-dismiss is ever needed we can swap the implementation without
 *   changing the public API.
 */
export function Sheet({
  visible,
  onClose,
  heightPercent = 88,
  title,
  children,
  footer,
  rightAccessory,
  testID,
}: Props) {
  const t = useTheme();

  const overlayStyle: StyleProp<ViewStyle> = {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: t.color("color.scrim"),
  };

  const sheetStyle: StyleProp<ViewStyle> = {
    backgroundColor: t.color("color.bg"),
    width: "100%",
    height: `${heightPercent}%`,
    borderTopLeftRadius: t.radius.lg,
    borderTopRightRadius: t.radius.lg,
    flexDirection: "column",
    // shadow-lg — sheet elevates above the scrim.
    shadowColor: t.color("color.shadow"),
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 12,
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
    >
      <Pressable
        testID="sheet-overlay"
        accessibilityRole="button"
        accessibilityLabel={i18n.t("common.close")}
        accessibilityHint={title ? `${i18n.t("common.close")} ${title}` : undefined}
        style={overlayStyle}
        onPress={onClose}
      >
        {/* Tap inside the sheet body does NOT propagate to the scrim. */}
        <Pressable
          style={sheetStyle}
          onPress={() => {
            /* swallow */
          }}
        >
          {/* Grabber: 36×4 pill, border.strong bg, centered, 8 top margin */}
          <View
            accessible={false}
            style={{
              width: 36,
              height: 4,
              borderRadius: t.radius.pill,
              backgroundColor: t.color("color.border.strong"),
              marginTop: t.space[2],
              alignSelf: "center",
            }}
          />

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: t.space[3],
              paddingTop: t.space[2],
              paddingBottom: t.space[3],
            }}
          >
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={i18n.t("common.close")}
              hitSlop={t.space[2]}
              style={{
                width: 36,
                height: 36,
                minWidth: t.minTouchTarget,
                minHeight: t.minTouchTarget,
                borderRadius: t.radius.pill,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="x" size={20} color={t.color("color.fg2")} />
            </Pressable>
            <View style={{ flex: 1, alignItems: "center" }}>
              {title ? (
                <Text
                  accessibilityRole="header"
                  style={{
                    fontSize: t.type.size.m,
                    fontWeight: t.type.weight.semibold,
                    color: t.color("color.fg"),
                    fontFamily: t.type.family.sans,
                  }}
                >
                  {title}
                </Text>
              ) : null}
            </View>
            {/* Right slot: hosts an optional accessory (e.g. EntryEditSheet's
                Save pill); otherwise a 36×36 spacer keeps the title centered. */}
            {rightAccessory ? (
              <View style={{ minWidth: 36, alignItems: "flex-end" }}>{rightAccessory}</View>
            ) : (
              <View style={{ width: 36 }} />
            )}
          </View>

          {/* Body */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              padding: t.space[5],
              // Extra bottom breathing room so the last control sits well
              // clear of the sticky footer (or the system home indicator on
              // footer-less sheets) — otherwise users complain it's "hard
              // to scroll the last slider into view".
              paddingBottom: t.space[10],
            }}
            keyboardShouldPersistTaps="handled"
            // Android mesh-scroll fix — without this, a parent ScrollView
            // (when the sheet is rendered inside a scrollable modal frame)
            // can claim the gesture.
            nestedScrollEnabled
            // Let drags dismiss the keyboard so the last slider is reachable
            // without needing an extra tap outside.
            keyboardDismissMode="on-drag"
          >
            {children}
          </ScrollView>

          {/* Sticky footer */}
          {footer ? (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: t.color("color.border"),
                paddingHorizontal: t.space[5],
                paddingVertical: t.space[3],
                backgroundColor: t.color("color.bg"),
              }}
            >
              {footer}
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

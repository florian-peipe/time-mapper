import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/useTheme";
import { Icon } from "@/components";
import { i18n } from "@/lib/i18n";
import { getLegalDocument, type DocumentKey } from "./documents";

export type LegalScreenProps = {
  documentKey: DocumentKey;
};

/**
 * Generic legal text viewer. Loads the privacy / terms / Impressum document
 * for the current locale and renders it as a `ScrollView` of `Text` blocks.
 *
 * Source of truth for document content is `src/screens/Legal/documents.ts`,
 * which exports locale-keyed string tables — mirroring the i18n JSON pattern
 * so the strings live in one place and translators see them as a group.
 * (Loading raw markdown from `docs/legal/*.md` at runtime would require a
 * bundler/Metro asset pipeline that Expo doesn't expose for .md files.)
 */
export function LegalScreen({ documentKey }: LegalScreenProps) {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const locale = i18n.locale.startsWith("de") ? "de" : "en";
  const doc = getLegalDocument(documentKey, locale);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/settings");
  };

  return (
    <View
      style={{ flex: 1, backgroundColor: t.color("color.bg") }}
      testID={`legal-screen-${documentKey}`}
    >
      {/* Header with a back button — matches the sheet header spacing. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingTop: insets.top + t.space[2],
          paddingBottom: t.space[3],
          paddingHorizontal: t.space[3],
          borderBottomWidth: 1,
          borderBottomColor: t.color("color.border"),
        }}
      >
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel={i18n.t("legal.back")}
          hitSlop={t.space[2]}
          testID="legal-back"
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
          <Icon name="chevron-left" size={22} color={t.color("color.fg2")} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text
            accessibilityRole="header"
            style={{
              fontSize: t.type.size.m,
              fontWeight: t.type.weight.semibold,
              color: t.color("color.fg"),
              fontFamily: t.type.family.sans,
            }}
          >
            {doc.title}
          </Text>
        </View>
        {/* spacer so the title centers */}
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: t.space[5],
          paddingBottom: insets.bottom + t.space[8],
          gap: t.space[4],
        }}
      >
        {doc.blocks.map((block, i) => {
          if (block.type === "h1") {
            return (
              <Text
                key={i}
                accessibilityRole="header"
                style={{
                  fontSize: t.type.size.xl,
                  fontWeight: t.type.weight.bold,
                  color: t.color("color.fg"),
                  fontFamily: t.type.family.sans,
                  letterSpacing: -0.3,
                  marginTop: i === 0 ? 0 : t.space[4],
                }}
              >
                {block.text}
              </Text>
            );
          }
          if (block.type === "h2") {
            return (
              <Text
                key={i}
                accessibilityRole="header"
                style={{
                  fontSize: t.type.size.m,
                  fontWeight: t.type.weight.semibold,
                  color: t.color("color.fg"),
                  fontFamily: t.type.family.sans,
                  marginTop: t.space[3],
                }}
              >
                {block.text}
              </Text>
            );
          }
          return (
            <Text
              key={i}
              style={{
                fontSize: t.type.size.body,
                color: t.color("color.fg2"),
                fontFamily: t.type.family.sans,
                lineHeight: t.type.size.body * t.type.lineHeight.body,
              }}
            >
              {block.text}
            </Text>
          );
        })}
      </ScrollView>
    </View>
  );
}

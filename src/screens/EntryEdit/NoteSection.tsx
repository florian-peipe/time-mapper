import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { TextArea } from "@/components";
import { i18n } from "@/lib/i18n";

export type NoteSectionProps = {
  value: string;
  onChangeText: (text: string) => void;
};

export function NoteSection({ value, onChangeText }: NoteSectionProps) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.color("color.surface"),
        borderWidth: 1,
        borderColor: t.color("color.border"),
        borderRadius: t.radius.md,
        marginBottom: t.space[4],
        paddingVertical: 14,
        paddingHorizontal: t.space[4],
      }}
    >
      <Text
        style={{
          fontSize: t.type.size.s,
          color: t.color("color.fg3"),
          fontFamily: t.type.family.sans,
          fontWeight: t.type.weight.medium,
          marginBottom: t.space[1] + 2,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {i18n.t("entryEdit.label.note")}
      </Text>
      <TextArea
        testID="entry-edit-note"
        value={value}
        onChangeText={onChangeText}
        placeholder={i18n.t("entryEdit.label.notePlaceholder")}
        style={{
          borderWidth: 0,
          paddingHorizontal: 0,
          paddingVertical: 0,
          backgroundColor: "transparent",
          minHeight: 60,
        }}
      />
    </View>
  );
}

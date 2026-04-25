import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { i18n } from "@/lib/i18n";
import { pauseDateToMinutes, pauseMinutesToDate } from "./entryEditUtils";

const STEP = 5;
const MAX_MIN = 240;

type Props = {
  value: Date;
  onChange: (d: Date) => void;
  testID?: string;
};

export function PauseDurationStepper({ value, onChange, testID }: Props) {
  const t = useTheme();
  const minutes = pauseDateToMinutes(value);

  const decrement = () => {
    if (minutes >= STEP) onChange(pauseMinutesToDate(minutes - STEP));
    else if (minutes > 0) onChange(pauseMinutesToDate(0));
  };

  const increment = () => {
    if (minutes < MAX_MIN) onChange(pauseMinutesToDate(minutes + STEP));
  };

  const btnStyle = (disabled: boolean) =>
    ({
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.color("color.border"),
      backgroundColor: t.color("color.surface2"),
      alignItems: "center" as const,
      justifyContent: "center" as const,
      opacity: disabled ? 0.35 : 1,
    }) as const;

  return (
    <View
      testID={testID}
      accessibilityValue={{ text: String(minutes) }}
      style={{ flexDirection: "row", alignItems: "center", gap: t.space[3] }}
    >
      <Pressable
        onPress={decrement}
        disabled={minutes === 0}
        accessibilityRole="button"
        accessibilityLabel={i18n.t("entryEdit.label.pauseDecrement")}
        testID={testID ? `${testID}-decrement` : undefined}
        style={btnStyle(minutes === 0)}
      >
        <Text
          style={{
            fontSize: 18,
            lineHeight: 20,
            color: t.color("color.fg"),
            fontFamily: t.type.family.sans,
          }}
        >
          −
        </Text>
      </Pressable>
      <Text
        style={{
          fontSize: t.type.size.s,
          color: t.color("color.accent"),
          fontFamily: t.type.family.sans,
          fontWeight: t.type.weight.medium,
          minWidth: 52,
          textAlign: "center",
        }}
      >
        {`${minutes} ${i18n.t("entryEdit.label.minSuffix")}`}
      </Text>
      <Pressable
        onPress={increment}
        disabled={minutes >= MAX_MIN}
        accessibilityRole="button"
        accessibilityLabel={i18n.t("entryEdit.label.pauseIncrement")}
        testID={testID ? `${testID}-increment` : undefined}
        style={btnStyle(minutes >= MAX_MIN)}
      >
        <Text
          style={{
            fontSize: 18,
            lineHeight: 20,
            color: t.color("color.fg"),
            fontFamily: t.type.family.sans,
          }}
        >
          +
        </Text>
      </Pressable>
    </View>
  );
}

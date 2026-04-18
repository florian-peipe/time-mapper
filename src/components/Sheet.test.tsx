import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text, View } from "react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { Sheet } from "./Sheet";

const wrap = (ui: React.ReactNode) => <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>;

describe("Sheet", () => {
  it("does not render body content when visible=false", () => {
    render(
      wrap(
        <Sheet visible={false} onClose={() => {}}>
          <Text>hidden body</Text>
        </Sheet>,
      ),
    );
    expect(screen.queryByText("hidden body")).toBeNull();
  });

  it("renders children when visible=true", () => {
    render(
      wrap(
        <Sheet visible={true} onClose={() => {}}>
          <Text>shown body</Text>
        </Sheet>,
      ),
    );
    expect(screen.getByText("shown body")).toBeTruthy();
  });

  it("renders the title when provided", () => {
    render(
      wrap(
        <Sheet visible={true} onClose={() => {}} title="Add place">
          <Text>body</Text>
        </Sheet>,
      ),
    );
    expect(screen.getByText("Add place")).toBeTruthy();
  });

  it("fires onClose when the scrim is tapped", () => {
    const onClose = jest.fn();
    render(
      wrap(
        <Sheet visible={true} onClose={onClose} title="T">
          <Text>body</Text>
        </Sheet>,
      ),
    );
    fireEvent.press(screen.getByTestId("sheet-overlay"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("fires onClose when the close (X) button is tapped", () => {
    const onClose = jest.fn();
    render(
      wrap(
        <Sheet visible={true} onClose={onClose} title="T">
          <Text>body</Text>
        </Sheet>,
      ),
    );
    fireEvent.press(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders the footer when provided", () => {
    render(
      wrap(
        <Sheet
          visible={true}
          onClose={() => {}}
          footer={
            <View testID="foot">
              <Text>Save</Text>
            </View>
          }
        >
          <Text>body</Text>
        </Sheet>,
      ),
    );
    expect(screen.getByTestId("foot")).toBeTruthy();
    expect(screen.getByText("Save")).toBeTruthy();
  });
});

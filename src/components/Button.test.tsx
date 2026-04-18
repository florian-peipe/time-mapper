import React from "react";
import { render, fireEvent, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { Button } from "./Button";

const wrap = (ui: React.ReactNode) => <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>;

describe("Button", () => {
  it("fires onPress when pressed", () => {
    const onPress = jest.fn();
    render(wrap(<Button onPress={onPress}>Save</Button>));
    fireEvent.press(screen.getByText("Save"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders destructive variant with the danger color", () => {
    render(
      wrap(
        <Button variant="destructive" onPress={() => {}}>
          Delete
        </Button>,
      ),
    );
    expect(screen.getByText("Delete")).toBeTruthy();
  });

  it("does not fire onPress when loading", () => {
    const onPress = jest.fn();
    render(
      wrap(
        <Button loading onPress={onPress}>
          Save
        </Button>,
      ),
    );
    fireEvent.press(screen.getByRole("button"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("renders sm size with smaller height", () => {
    render(
      wrap(
        <Button size="sm" onPress={() => {}}>
          Tap
        </Button>,
      ),
    );
    const button = screen.getByRole("button");
    // First style entry contains baseline; second entry has dynamic style with height
    const flat = Array.isArray(button.props.style)
      ? Object.assign({}, ...button.props.style.flat())
      : button.props.style;
    expect(flat.height).toBe(36);
  });

  it("renders md size by default with 48 height", () => {
    render(wrap(<Button onPress={() => {}}>Tap</Button>));
    const button = screen.getByRole("button");
    const flat = Array.isArray(button.props.style)
      ? Object.assign({}, ...button.props.style.flat())
      : button.props.style;
    expect(flat.height).toBe(48);
  });

  it("respects full width when full prop set", () => {
    render(
      wrap(
        <Button full onPress={() => {}}>
          Tap
        </Button>,
      ),
    );
    const button = screen.getByRole("button");
    const flat = Array.isArray(button.props.style)
      ? Object.assign({}, ...button.props.style.flat())
      : button.props.style;
    expect(flat.width).toBe("100%");
  });
});

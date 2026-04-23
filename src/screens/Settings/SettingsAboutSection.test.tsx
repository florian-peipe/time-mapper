import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { SettingsAboutSection } from "./SettingsAboutSection";

function wrap(ui: React.ReactNode) {
  return <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>;
}

describe("SettingsAboutSection", () => {
  it("renders all five navigation rows", () => {
    const { getByTestId } = render(
      wrap(
        <SettingsAboutSection
          onOpenPrivacy={jest.fn()}
          onOpenTerms={jest.fn()}
          onOpenImpressum={jest.fn()}
          onSupport={jest.fn()}
          onRate={jest.fn()}
        />,
      ),
    );
    expect(getByTestId("settings-row-privacy")).toBeTruthy();
    expect(getByTestId("settings-row-terms")).toBeTruthy();
    expect(getByTestId("settings-row-impressum")).toBeTruthy();
    expect(getByTestId("settings-row-support")).toBeTruthy();
    expect(getByTestId("settings-row-rate")).toBeTruthy();
  });

  it("fires the matching handler for each row press — handlers don't cross-wire", () => {
    const onOpenPrivacy = jest.fn();
    const onOpenTerms = jest.fn();
    const onOpenImpressum = jest.fn();
    const onSupport = jest.fn();
    const onRate = jest.fn();
    const { getByTestId } = render(
      wrap(
        <SettingsAboutSection
          onOpenPrivacy={onOpenPrivacy}
          onOpenTerms={onOpenTerms}
          onOpenImpressum={onOpenImpressum}
          onSupport={onSupport}
          onRate={onRate}
        />,
      ),
    );
    fireEvent.press(getByTestId("settings-row-impressum"));
    expect(onOpenImpressum).toHaveBeenCalledTimes(1);
    expect(onOpenPrivacy).not.toHaveBeenCalled();
    expect(onOpenTerms).not.toHaveBeenCalled();

    fireEvent.press(getByTestId("settings-row-rate"));
    expect(onRate).toHaveBeenCalledTimes(1);
    expect(onSupport).not.toHaveBeenCalled();
  });
});

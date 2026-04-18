import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { Section } from "./Section";
import { ListRow } from "./ListRow";

const wrap = (ui: React.ReactNode) => <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>;

describe("Section", () => {
  it("renders the title as uppercase when provided", () => {
    render(
      wrap(
        <Section title="Tracking">
          <Text>content</Text>
        </Section>,
      ),
    );
    // We don't force CSS-uppercase in RN; we uppercase the string directly.
    expect(screen.getByText("TRACKING")).toBeTruthy();
  });

  it("omits the title caption when title is not provided", () => {
    render(
      wrap(
        <Section>
          <Text>body</Text>
        </Section>,
      ),
    );
    expect(screen.getByText("body")).toBeTruthy();
    // No caption exists
    expect(screen.queryByText(/^[A-Z]{2,}$/)).toBeNull();
  });

  it("composes with ListRow children without crashing", () => {
    render(
      wrap(
        <Section title="Appearance">
          <ListRow icon="moon" title="Theme" detail="System" />
          <ListRow icon="globe" title="Language" detail="English" last />
        </Section>,
      ),
    );
    expect(screen.getByText("Theme")).toBeTruthy();
    expect(screen.getByText("Language")).toBeTruthy();
  });
});

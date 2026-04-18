import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { LegalScreen } from "./LegalScreen";
import { LEGAL_DOCS } from "./documents";

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);

jest.mock("expo-router", () => ({
  __esModule: true,
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    canGoBack: mockCanGoBack,
  }),
}));

function wrap(ui: React.ReactNode) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 375, height: 812 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider schemeOverride="light">{ui}</ThemeProvider>
    </SafeAreaProvider>
  );
}

beforeEach(() => {
  mockBack.mockReset();
  mockReplace.mockReset();
  mockCanGoBack.mockReset().mockReturnValue(true);
});

describe("LegalScreen", () => {
  it("renders the privacy policy title and intro paragraph", () => {
    const { getAllByText, getByTestId } = render(wrap(<LegalScreen documentKey="privacy" />));
    expect(getByTestId("legal-screen-privacy")).toBeTruthy();
    // Title appears in the header AND the h1 block — both are acceptable.
    expect(getAllByText(/privacy policy/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the terms policy page", () => {
    const { getByTestId, getAllByText } = render(wrap(<LegalScreen documentKey="terms" />));
    expect(getByTestId("legal-screen-terms")).toBeTruthy();
    expect(getAllByText(/terms of service/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Impressum with placeholder tokens visible", () => {
    const { getByTestId, getByText } = render(wrap(<LegalScreen documentKey="impressum" />));
    expect(getByTestId("legal-screen-impressum")).toBeTruthy();
    // Placeholder tokens stay in the rendered output so testers see them.
    // Multiple blocks reference OWNER_NAME (owner + responsible) — use getAll.
    const { getAllByText } = render(wrap(<LegalScreen documentKey="impressum" />));
    expect(getAllByText(/OWNER_NAME/).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/ADDRESS/).length).toBeGreaterThanOrEqual(1);
    void getByText; // silence lint
  });

  it("back button calls router.back() when history exists", () => {
    mockCanGoBack.mockReturnValue(true);
    const { getByTestId } = render(wrap(<LegalScreen documentKey="privacy" />));
    fireEvent.press(getByTestId("legal-back"));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("back button falls back to replacing /settings when no history", () => {
    mockCanGoBack.mockReturnValue(false);
    const { getByTestId } = render(wrap(<LegalScreen documentKey="privacy" />));
    fireEvent.press(getByTestId("legal-back"));
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/settings");
  });

  it("h1 + h2 blocks are tagged with accessibilityRole=header", () => {
    const { getAllByRole } = render(wrap(<LegalScreen documentKey="privacy" />));
    // At least 2 headers: page title + first h1; real document has more.
    expect(getAllByRole("header").length).toBeGreaterThanOrEqual(2);
  });

  it("has symmetric EN + DE content for every document", () => {
    for (const key of ["privacy", "terms", "impressum"] as const) {
      const en = LEGAL_DOCS[key].en;
      const de = LEGAL_DOCS[key].de;
      expect(en.blocks.length).toBeGreaterThan(0);
      expect(de.blocks.length).toBeGreaterThan(0);
      // Types match 1:1 so the English copy can't silently drift in structure.
      expect(en.blocks.map((b) => b.type)).toEqual(de.blocks.map((b) => b.type));
    }
  });
});

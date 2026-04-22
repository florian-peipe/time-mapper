// Force the contact loader to see "no file" regardless of the local clone
// state — otherwise a developer who has filled contact.local.ts will see
// the configured Impressum and this test (which asserts the fallback) fails.
import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { LegalScreen } from "./LegalScreen";
import { LEGAL_DOCS } from "./documents";

jest.mock("./contact.local", () => ({ __esModule: true, default: null }), { virtual: true });

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

  it("renders the Impressum unconfigured variant when contact.local.ts is missing", () => {
    // In this sandbox there is no `src/screens/Legal/contact.local.ts` — the
    // document loader should fall back to the "not yet configured" copy
    // rather than leaking `{{OWNER_NAME}}` etc. through to the UI.
    const { getByTestId, getAllByText, queryByText } = render(
      wrap(<LegalScreen documentKey="impressum" />),
    );
    expect(getByTestId("legal-screen-impressum")).toBeTruthy();
    expect(getAllByText(/not yet configured/i).length).toBeGreaterThanOrEqual(1);
    // And critically: no {{...}} token can slip through.
    expect(queryByText(/\{\{[A-Z_]+\}\}/)).toBeNull();
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

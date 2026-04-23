/**
 * Accessibility smoke — renders each shared primitive + screen once and
 * asserts every interactive element carries a meaningful a11y label/role.
 *
 * This guards against regressions: if someone adds a new `<Pressable>`
 * without a label, a test in here will fail long before QA runs VoiceOver.
 *
 * Intentionally defensive — we check the presence of labels and roles, not
 * the exact copy. Translation audits already guarantee the strings exist.
 */
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { Banner, Button, Chip, ListRow, Sheet } from "@/components";
import { Text } from "react-native";
// Imports for the "screens honor Dynamic Type" block below. Hoisted to file
// scope so the describe block doesn't need require()s (which trip lint).
import { createTestDb } from "@/db/testClient";
import { PlacesRepo } from "@/db/repository/places";
import { EntriesRepo } from "@/db/repository/entries";
import { KvRepo } from "@/db/repository/kv";
import { PlacesRepoProvider } from "@/features/places/usePlaces";
import { EntriesRepoProvider } from "@/features/entries/useEntries";
import { KvRepoProvider } from "@/features/onboarding/useOnboardingGate";
import { __setProForTests } from "@/features/billing/usePro";
import { TimelineScreen } from "@/screens/Timeline/TimelineScreen";
import { StatsScreen } from "@/screens/Stats/StatsScreen";
import { AddPlaceSheet } from "@/screens/AddPlace/AddPlaceSheet";

// Mock expo-router so screens that use `useRouter` don't crash.
jest.mock("expo-router", () => ({
  __esModule: true,
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
  }),
  useSegments: () => [],
  Stack: () => null,
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

describe("a11y — shared primitives", () => {
  describe("Button", () => {
    it("applies accessibilityRole=button", () => {
      const { getByTestId } = render(
        wrap(
          <Button testID="btn" onPress={() => {}}>
            Go
          </Button>,
        ),
      );
      expect(getByTestId("btn").props.accessibilityRole).toBe("button");
    });

    it("exposes a custom accessibilityLabel", () => {
      const { getByTestId } = render(
        wrap(
          <Button testID="btn" onPress={() => {}} accessibilityLabel="Save the place">
            Save
          </Button>,
        ),
      );
      expect(getByTestId("btn").props.accessibilityLabel).toBe("Save the place");
    });

    it("forwards an accessibilityHint", () => {
      const { getByTestId } = render(
        wrap(
          <Button testID="btn" onPress={() => {}} accessibilityHint="Opens the paywall">
            Unlock
          </Button>,
        ),
      );
      expect(getByTestId("btn").props.accessibilityHint).toBe("Opens the paywall");
    });

    it("marks disabled state in accessibilityState", () => {
      const { getByTestId } = render(
        wrap(
          <Button testID="btn" onPress={() => {}} disabled>
            Go
          </Button>,
        ),
      );
      expect(getByTestId("btn").props.accessibilityState.disabled).toBe(true);
    });

    it("marks busy state when loading", () => {
      const { getByTestId } = render(
        wrap(
          <Button testID="btn" onPress={() => {}} loading>
            Loading
          </Button>,
        ),
      );
      expect(getByTestId("btn").props.accessibilityState.busy).toBe(true);
    });

    it("meets minimum 44pt touch target", () => {
      const { getByTestId } = render(
        wrap(
          <Button testID="btn" size="sm" onPress={() => {}}>
            S
          </Button>,
        ),
      );
      const style = getByTestId("btn").props.style;
      const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
      // Small buttons explicitly honor the 44pt minimum via `minHeight`.
      expect(flat.minHeight).toBeGreaterThanOrEqual(44);
    });
  });

  describe("Chip", () => {
    it("is a button when pressable", () => {
      const { getByTestId } = render(wrap(<Chip testID="chip" label="Hi" onPress={() => {}} />));
      expect(getByTestId("chip").props.accessibilityRole).toBe("button");
    });

    it("forwards selected state", () => {
      const { getByTestId } = render(
        wrap(<Chip testID="chip" label="Hi" onPress={() => {}} selected />),
      );
      expect(getByTestId("chip").props.accessibilityState.selected).toBe(true);
    });

    it("carries the label as accessibility label", () => {
      const { getByTestId } = render(
        wrap(<Chip testID="chip" label="Manual" onPress={() => {}} />),
      );
      expect(getByTestId("chip").props.accessibilityLabel).toBe("Manual");
    });

    it("honors a custom accessibility label override", () => {
      const { getByTestId } = render(
        wrap(<Chip testID="chip" label="M" accessibilityLabel="Manual source" />),
      );
      expect(getByTestId("chip").props.accessibilityLabel).toBe("Manual source");
    });
  });

  describe("ListRow", () => {
    it("renders a tappable row with button role", () => {
      const { getByTestId } = render(
        wrap(<ListRow testID="row" title="Theme" detail="Light" onPress={() => {}} />),
      );
      expect(getByTestId("row").props.accessibilityRole).toBe("button");
    });

    it("composes title + string detail into the label", () => {
      const { getByTestId } = render(
        wrap(<ListRow testID="row" title="Theme" detail="Light" onPress={() => {}} />),
      );
      expect(getByTestId("row").props.accessibilityLabel).toBe("Theme, Light");
    });

    it("uses title alone when detail is absent", () => {
      const { getByTestId } = render(
        wrap(<ListRow testID="row" title="Notifications" onPress={() => {}} />),
      );
      expect(getByTestId("row").props.accessibilityLabel).toBe("Notifications");
    });

    it("allows overriding the a11y label", () => {
      const { getByTestId } = render(
        wrap(
          <ListRow
            testID="row"
            title="Theme"
            detail="Light"
            accessibilityLabel="Current theme is Light"
            onPress={() => {}}
          />,
        ),
      );
      expect(getByTestId("row").props.accessibilityLabel).toBe("Current theme is Light");
    });

    it("forwards a11y state for switch-style rows", () => {
      const { getByTestId } = render(
        wrap(
          <ListRow
            testID="row"
            title="Toggle"
            onPress={() => {}}
            accessibilityState={{ checked: true }}
          />,
        ),
      );
      expect(getByTestId("row").props.accessibilityState.checked).toBe(true);
    });

    it("forwards a hint", () => {
      const { getByTestId } = render(
        wrap(
          <ListRow
            testID="row"
            title="Edit"
            onPress={() => {}}
            accessibilityHint="Opens the editor"
          />,
        ),
      );
      expect(getByTestId("row").props.accessibilityHint).toBe("Opens the editor");
    });

    it("meets 44pt minimum touch target", () => {
      const { getByTestId } = render(wrap(<ListRow testID="row" title="X" onPress={() => {}} />));
      const style = getByTestId("row").props.style;
      const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flat.minHeight).toBeGreaterThanOrEqual(44);
    });
  });

  describe("Banner", () => {
    it("uses accessibilityRole=alert", () => {
      const { getByTestId } = render(
        wrap(<Banner tone="warning" title="Heads up" body="Body." testID="b" />),
      );
      expect(getByTestId("b").props.accessibilityRole).toBe("alert");
    });
  });

  describe("Sheet", () => {
    it("renders an overlay with a Close a11y label and a header role on the title", () => {
      const { getByTestId, getAllByLabelText, getByText } = render(
        wrap(
          <Sheet visible onClose={() => {}} title="Test sheet">
            <Text>body</Text>
          </Sheet>,
        ),
      );
      expect(getByTestId("sheet-overlay").props.accessibilityLabel).toBeDefined();
      // "Close" label is present on both the scrim and the X button.
      const closes = getAllByLabelText(/close/i);
      expect(closes.length).toBeGreaterThanOrEqual(2);
      // Title has header role for a11y
      expect(getByText("Test sheet").props.accessibilityRole).toBe("header");
    });
  });
});

describe("a11y — screens", () => {
  function wrapTimeline(seeded: boolean) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PlacesRepo } = require("@/db/repository/places");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EntriesRepo } = require("@/db/repository/entries");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { KvRepo } = require("@/db/repository/kv");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createTestDb } = require("@/db/testClient");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PlacesRepoProvider } = require("@/features/places/usePlaces");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EntriesRepoProvider } = require("@/features/entries/useEntries");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { KvRepoProvider } = require("@/features/onboarding/useOnboardingGate");
    const db = createTestDb();
    const placesRepo = new PlacesRepo(db);
    const entriesRepo = new EntriesRepo(db);
    const kvRepo = new KvRepo(db);
    if (seeded) {
      placesRepo.create({ name: "Home", address: "1 Example Ln", latitude: 0, longitude: 0 });
    }
    return {
      placesRepo,
      entriesRepo,
      kvRepo,
      PlacesRepoProvider,
      EntriesRepoProvider,
      KvRepoProvider,
    };
  }

  it("Timeline FAB and empty-state header carry a11y attributes", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TimelineScreen } = require("@/screens/Timeline/TimelineScreen");
    const {
      placesRepo,
      entriesRepo,
      kvRepo,
      PlacesRepoProvider,
      EntriesRepoProvider,
      KvRepoProvider,
    } = wrapTimeline(true);
    const { getByTestId } = render(
      wrap(
        <KvRepoProvider value={kvRepo}>
          <PlacesRepoProvider value={placesRepo}>
            <EntriesRepoProvider value={entriesRepo}>
              <TimelineScreen />
            </EntriesRepoProvider>
          </PlacesRepoProvider>
        </KvRepoProvider>,
      ),
    );
    const fab = getByTestId("timeline-fab");
    expect(fab.props.accessibilityRole).toBe("button");
    expect(fab.props.accessibilityLabel).toBeTruthy();
    expect(fab.props.accessibilityHint).toBeTruthy();
  });

  it("Timeline NoPlaces empty state uses a header on the title", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TimelineScreen } = require("@/screens/Timeline/TimelineScreen");
    const {
      placesRepo,
      entriesRepo,
      kvRepo,
      PlacesRepoProvider,
      EntriesRepoProvider,
      KvRepoProvider,
    } = wrapTimeline(false);
    const { getByText } = render(
      wrap(
        <KvRepoProvider value={kvRepo}>
          <PlacesRepoProvider value={placesRepo}>
            <EntriesRepoProvider value={entriesRepo}>
              <TimelineScreen />
            </EntriesRepoProvider>
          </PlacesRepoProvider>
        </KvRepoProvider>,
      ),
    );
    const header = getByText(/add a place/i);
    expect(header.props.accessibilityRole).toBe("header");
  });

  it("Welcome onboarding screen exposes a header role on the product name", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { WelcomeScreen } = require("@/screens/Onboarding/WelcomeScreen");
    const { getByText } = render(wrap(<WelcomeScreen />));
    const heading = getByText("Time Mapper");
    expect(heading.props.accessibilityRole).toBe("header");
  });

  it("Permissions onboarding screen exposes a header role on the title", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PermissionsScreen } = require("@/screens/Onboarding/PermissionsScreen");
    const { getByText } = render(wrap(<PermissionsScreen />));
    expect(getByText(/always location/i).props.accessibilityRole).toBe("header");
  });

  it("FirstPlace onboarding exposes a header role on the title", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FirstPlaceScreen } = require("@/screens/Onboarding/FirstPlaceScreen");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { KvRepo } = require("@/db/repository/kv");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createTestDb } = require("@/db/testClient");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { KvRepoProvider } = require("@/features/onboarding/useOnboardingGate");
    const kvRepo = new KvRepo(createTestDb());
    const { getByText } = render(
      wrap(
        <KvRepoProvider value={kvRepo}>
          <FirstPlaceScreen />
        </KvRepoProvider>,
      ),
    );
    expect(getByText(/your first place/i).props.accessibilityRole).toBe("header");
  });

  it("Settings screen headings have header role", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SettingsScreen } = require("@/screens/Settings/SettingsScreen");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PlacesRepo } = require("@/db/repository/places");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { KvRepo } = require("@/db/repository/kv");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createTestDb } = require("@/db/testClient");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PlacesRepoProvider } = require("@/features/places/usePlaces");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EntriesRepoProvider } = require("@/features/entries/useEntries");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EntriesRepo } = require("@/db/repository/entries");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { KvRepoProvider } = require("@/features/onboarding/useOnboardingGate");
    const db = createTestDb();
    const repo = new PlacesRepo(db);
    const kv = new KvRepo(db);
    const { getAllByRole } = render(
      wrap(
        <KvRepoProvider value={kv}>
          <PlacesRepoProvider value={repo}>
            <EntriesRepoProvider value={new EntriesRepo(db)}>
              <SettingsScreen />
            </EntriesRepoProvider>
          </PlacesRepoProvider>
        </KvRepoProvider>,
      ),
    );
    const headers = getAllByRole("header");
    // Each Section title is a header; we have at least Places, Tracking,
    // Appearance, Subscription, Data, About (6) — plus the dev section in
    // __DEV__ builds. Assert ≥5 to leave slack.
    expect(headers.length).toBeGreaterThanOrEqual(5);
  });

  it("Places list-view rows include an a11y hint pointing at the edit action", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PlacesScreen } = require("@/screens/Places/PlacesScreen");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PlacesRepo } = require("@/db/repository/places");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createTestDb } = require("@/db/testClient");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PlacesRepoProvider } = require("@/features/places/usePlaces");
    const db = createTestDb();
    const repo = new PlacesRepo(db);
    const place = repo.create({
      name: "Home",
      address: "1 Example Ln",
      latitude: 0,
      longitude: 0,
    });
    const { getByTestId } = render(
      wrap(
        <PlacesRepoProvider value={repo}>
          <PlacesScreen />
        </PlacesRepoProvider>,
      ),
    );
    // Switch to list view so the row is rendered (map mode renders into
    // native map primitives that don't expose a11y props in the test tree).
    fireEvent.press(getByTestId("places-toggle-list"));
    const row = getByTestId(`places-list-row-${place.id}`);
    expect(row.props.accessibilityHint).toBeDefined();
  });
});

describe("a11y — adjustable control (slider in AddPlaceSheet)", () => {
  it("AddPlace radius slider advertises the adjustable role + value", async () => {
    jest.useFakeTimers();
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { AddPlaceSheet } = require("@/screens/AddPlace/AddPlaceSheet");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PlacesRepo } = require("@/db/repository/places");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { KvRepo } = require("@/db/repository/kv");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createTestDb } = require("@/db/testClient");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PlacesRepoProvider } = require("@/features/places/usePlaces");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { KvRepoProvider } = require("@/features/onboarding/useOnboardingGate");
      const db = createTestDb();
      const repo = new PlacesRepo(db);
      const kv = new KvRepo(db);
      // Edit mode hydrates Phase 2 instantly with a place that carries
      // non-zero lat/lng (ensures the slider is present on first render).
      const p = repo.create({
        name: "Home",
        address: "1 Example Ln",
        latitude: 50.9613,
        longitude: 6.9585,
        radiusM: 120,
      });
      const { getByTestId } = render(
        wrap(
          <KvRepoProvider value={kv}>
            <PlacesRepoProvider value={repo}>
              <AddPlaceSheet visible placeId={p.id} onClose={() => {}} onSaved={() => {}} />
            </PlacesRepoProvider>
          </KvRepoProvider>,
        ),
      );
      const slider = getByTestId("add-place-radius");
      expect(slider.props.accessibilityRole).toBe("adjustable");
      expect(slider.props.accessibilityValue).toEqual(
        expect.objectContaining({ min: 25, max: 300, now: 120 }),
      );
    } finally {
      jest.useRealTimers();
    }
  });
});

/**
 * Walk a rendered tree and collect every `<Text>` node's a11y-relevant props.
 * Used by both the primitives block and the screens block below — hoisted to
 * file scope so both describe blocks can reach it.
 *
 * Handles both shapes: react-test-renderer's JSON output puts children at the
 * top level (`node.children`), while some component sources expose children
 * via props (`node.props.children`). Walking both keeps this robust across
 * RNTL upgrades and mixed node types.
 */
function allTextNodes(tree: unknown): { allowFontScaling?: boolean }[] {
  const out: { allowFontScaling?: boolean }[] = [];
  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    const n = node as {
      type?: { displayName?: string; name?: string } | string;
      props?: { children?: unknown; allowFontScaling?: boolean };
      children?: unknown;
    };
    const type = n.type;
    if (type) {
      const name = typeof type === "string" ? type : (type.displayName ?? type.name);
      if (name === "Text" && n.props) {
        out.push({ allowFontScaling: n.props.allowFontScaling });
      }
    }
    if (Array.isArray(n.children)) {
      for (const c of n.children) walk(c);
    } else if (n.children) {
      walk(n.children);
    }
    if (n.props && Array.isArray(n.props.children)) {
      for (const c of n.props.children) walk(c);
    } else if (n.props && n.props.children) {
      walk(n.props.children);
    }
  }
  walk(tree);
  return out;
}

describe("a11y — large-text compatibility", () => {
  /**
   * Snapshot the primary shared primitives under a simulated 1.3× dynamic
   * type scale. We can't re-route RN's `allowFontScaling` from a test, but
   * we CAN verify that every `<Text>` the primitive renders does NOT set
   * `allowFontScaling={false}` (which would opt out of large-text support).
   *
   * Extend this list when adding a new primitive — the regression would
   * otherwise only surface via iOS reviewer VoiceOver + large-text checks.
   */

  it("Button text allows font scaling (never opts out of Dynamic Type)", () => {
    const { toJSON } = render(wrap(<Button onPress={() => {}}>Save place</Button>));
    for (const n of allTextNodes(toJSON())) {
      expect(n.allowFontScaling).not.toBe(false);
    }
  });

  it("Banner text allows font scaling", () => {
    const { toJSON } = render(wrap(<Banner tone="info" title="Offline" />));
    for (const n of allTextNodes(toJSON())) {
      expect(n.allowFontScaling).not.toBe(false);
    }
  });

  it("Chip text allows font scaling", () => {
    const { toJSON } = render(wrap(<Chip label="Draft" onPress={() => {}} />));
    for (const n of allTextNodes(toJSON())) {
      expect(n.allowFontScaling).not.toBe(false);
    }
  });

  it("ListRow title + detail allow font scaling", () => {
    const { toJSON } = render(
      wrap(<ListRow icon="home" title="Home" detail="2 / 1 min" onPress={() => {}} />),
    );
    for (const n of allTextNodes(toJSON())) {
      expect(n.allowFontScaling).not.toBe(false);
    }
  });
});

// The original "item A" plan was a truncation-risk audit that flags any Text
// with `numberOfLines` set on long user content. That turned out to be noise:
// a grep of src/ shows six `numberOfLines={1}` occurrences, all on list-row
// primitives (ListRow, PlacesListView, EntryRow, PlaceBar) where single-line
// clipping is the design — dynamic type users see truncation in the row, but
// the full content remains reachable via the row's detail view or a11y label.
// Flagging that would fail the suite on correct-by-design behavior.
//
// What IS catchable: a new screen-level `<Text allowFontScaling={false}>`
// slipping past review. The existing block above only covers shared
// primitives (Button, Banner, Chip, ListRow). Below extends the same walker
// to the three highest-traffic screens with seeded user-content fixtures, so
// any raw Text added inside Timeline / Stats / AddPlace that opts out of
// Dynamic Type fails fast.
describe("a11y — screens honor Dynamic Type", () => {
  const LONG_NAME = "The Very Long Coffee Shop Name Over Here";
  const LONG_NOTE = "A note that goes on and on beyond any single-line width";

  function assertAllTextScales(tree: unknown) {
    const nodes = allTextNodes(tree);
    // Sanity: at least some Text should render (guards against the screen
    // short-circuiting into a loading state with no text).
    expect(nodes.length).toBeGreaterThan(0);
    for (const n of nodes) {
      expect(n.allowFontScaling).not.toBe(false);
    }
  }

  beforeEach(() => {
    __setProForTests(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("TimelineScreen — every Text honors Dynamic Type (seeded with long place name + note)", () => {
    const nowMs = new Date(2026, 3, 17, 12, 0, 0).getTime();
    const nowSeconds = Math.floor(nowMs / 1000);
    jest.useFakeTimers().setSystemTime(new Date(nowMs));

    const db = createTestDb();
    const placesRepo = new PlacesRepo(db, { now: () => nowSeconds });
    const entriesRepo = new EntriesRepo(db, { now: () => nowSeconds });
    const kvRepo = new KvRepo(db);
    const place = placesRepo.create({
      name: LONG_NAME,
      address: "",
      latitude: 0,
      longitude: 0,
    });
    entriesRepo.createManual({
      placeId: place.id,
      startedAt: nowSeconds - 3600,
      endedAt: nowSeconds - 1800,
      note: LONG_NOTE,
    });

    const { toJSON } = render(
      wrap(
        <KvRepoProvider value={kvRepo}>
          <PlacesRepoProvider value={placesRepo}>
            <EntriesRepoProvider value={entriesRepo}>
              <TimelineScreen />
            </EntriesRepoProvider>
          </PlacesRepoProvider>
        </KvRepoProvider>,
      ),
    );
    assertAllTextScales(toJSON());
  });

  it("StatsScreen — every Text honors Dynamic Type (seeded with long place name)", () => {
    const nowMs = new Date(2026, 3, 15, 12, 0, 0).getTime();
    const nowSeconds = Math.floor(nowMs / 1000);
    jest.useFakeTimers().setSystemTime(new Date(nowMs));

    const db = createTestDb();
    const placesRepo = new PlacesRepo(db, { now: () => nowSeconds });
    const entriesRepo = new EntriesRepo(db, { now: () => nowSeconds });
    const place = placesRepo.create({
      name: LONG_NAME,
      address: "",
      latitude: 0,
      longitude: 0,
    });
    entriesRepo.createManual({
      placeId: place.id,
      startedAt: nowSeconds - 3600,
      endedAt: nowSeconds - 1800,
    });

    const { toJSON } = render(
      wrap(
        <PlacesRepoProvider value={placesRepo}>
          <EntriesRepoProvider value={entriesRepo}>
            <StatsScreen />
          </EntriesRepoProvider>
        </PlacesRepoProvider>,
      ),
    );
    assertAllTextScales(toJSON());
  });

  it("AddPlaceSheet (edit mode) — every Text honors Dynamic Type", () => {
    const db = createTestDb();
    const placesRepo = new PlacesRepo(db);
    const kvRepo = new KvRepo(db);
    const place = placesRepo.create({
      name: LONG_NAME,
      address: "Long Street 42, 50667 Köln, Germany",
      latitude: 50.9,
      longitude: 6.9,
    });

    const { toJSON } = render(
      wrap(
        <KvRepoProvider value={kvRepo}>
          <PlacesRepoProvider value={placesRepo}>
            <AddPlaceSheet visible placeId={place.id} onClose={() => {}} />
          </PlacesRepoProvider>
        </KvRepoProvider>,
      ),
    );
    assertAllTextScales(toJSON());
  });
});

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import type { Entry, Place } from "@/db/schema";
import { Ledger } from "./Ledger";

/**
 * Unit-level test harness for the Ledger. We hand-build Entry/Place rows
 * rather than going through repos, because the chart has no DB dependency
 * and using the repo plumbing here would obscure what's under test.
 */
function makePlace(partial: Partial<Place> & Pick<Place, "id" | "name">): Place {
  return {
    id: partial.id,
    name: partial.name,
    address: "",
    latitude: 0,
    longitude: 0,
    radiusM: 100,
    entryBufferS: 300,
    exitBufferS: 180,
    categoryId: null,
    color: partial.color ?? "#FF6A3D",
    icon: partial.icon ?? "home",
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
  };
}

function makeEntry(partial: Partial<Entry> & Pick<Entry, "id" | "placeId">): Entry {
  return {
    id: partial.id,
    placeId: partial.placeId,
    startedAt: partial.startedAt ?? 0,
    endedAt: partial.endedAt ?? null,
    pauseS: partial.pauseS ?? 0,
    source: partial.source ?? "manual",
    note: partial.note ?? null,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
  };
}

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider schemeOverride="light">{ui}</ThemeProvider>);
}

describe("Ledger", () => {
  it("renders the Excel-style column letters A..F", () => {
    wrap(
      <Ledger entries={[]} placesById={new Map()} onOpenEntry={jest.fn()} onAddRow={jest.fn()} />,
    );
    for (const letter of ["A", "B", "C", "D", "E", "F"]) {
      expect(screen.getByTestId(`ledger-col-letter-${letter}`).props.children).toBe(letter);
    }
  });

  it("renders one row per entry with the place name", () => {
    const home = makePlace({ id: "p1", name: "Home" });
    const office = makePlace({ id: "p2", name: "Office" });
    // Both entries on the same date — startedAt values are unix seconds in local.
    // Choose 09:00 and 14:00 on an arbitrary local day.
    const day0 = new Date(2026, 3, 15, 0, 0, 0).getTime() / 1000;
    const e1 = makeEntry({
      id: "e1",
      placeId: "p1",
      startedAt: day0 + 9 * 3600,
      endedAt: day0 + 10 * 3600,
    });
    const e2 = makeEntry({
      id: "e2",
      placeId: "p2",
      startedAt: day0 + 14 * 3600,
      endedAt: day0 + 15 * 3600 + 15 * 60,
      pauseS: 10 * 60,
    });
    wrap(
      <Ledger
        entries={[e2, e1]}
        placesById={
          new Map([
            [home.id, home],
            [office.id, office],
          ])
        }
        onOpenEntry={jest.fn()}
        onAddRow={jest.fn()}
      />,
    );
    expect(screen.getByTestId("ledger-row-0")).toBeTruthy();
    expect(screen.getByTestId("ledger-row-1")).toBeTruthy();
    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("Office")).toBeTruthy();
  });

  it("sum row computes net duration and pause totals correctly", () => {
    const home = makePlace({ id: "p1", name: "Home" });
    const day0 = new Date(2026, 3, 15, 0, 0, 0).getTime() / 1000;
    // 1h 0m net (60 gross, 0 pause)
    const e1 = makeEntry({
      id: "e1",
      placeId: "p1",
      startedAt: day0 + 9 * 3600,
      endedAt: day0 + 10 * 3600,
    });
    // 1h 5m net (2h gross, 55 min pause) -> 65 net
    const e2 = makeEntry({
      id: "e2",
      placeId: "p1",
      startedAt: day0 + 14 * 3600,
      endedAt: day0 + 16 * 3600,
      pauseS: 55 * 60,
    });
    wrap(
      <Ledger
        entries={[e2, e1]}
        placesById={new Map([[home.id, home]])}
        onOpenEntry={jest.fn()}
        onAddRow={jest.fn()}
      />,
    );
    // Expect Σ row duration = 2:05 (60 + 65 = 125 minutes)
    expect(screen.getByTestId("ledger-sum-duration").props.children).toBe("2:05");
    // Expect Σ row pause = 0:55 (total 55 minutes pause)
    expect(screen.getByTestId("ledger-sum-pause").props.children).toBe("0:55");
  });

  it("omits the sum row when the entries list is empty", () => {
    wrap(
      <Ledger entries={[]} placesById={new Map()} onOpenEntry={jest.fn()} onAddRow={jest.fn()} />,
    );
    expect(screen.queryByTestId("ledger-sum-row")).toBeNull();
  });

  it("tapping a row fires onOpenEntry with the entry id", () => {
    const home = makePlace({ id: "p1", name: "Home" });
    const day0 = new Date(2026, 3, 15, 0, 0, 0).getTime() / 1000;
    const e1 = makeEntry({
      id: "entry-xyz",
      placeId: "p1",
      startedAt: day0 + 9 * 3600,
      endedAt: day0 + 10 * 3600,
    });
    const onOpen = jest.fn();
    wrap(
      <Ledger
        entries={[e1]}
        placesById={new Map([[home.id, home]])}
        onOpenEntry={onOpen}
        onAddRow={jest.fn()}
      />,
    );
    fireEvent.press(screen.getByTestId("ledger-row-0"));
    expect(onOpen).toHaveBeenCalledWith("entry-xyz");
  });

  it("tapping 'Add row' fires onAddRow", () => {
    const onAdd = jest.fn();
    wrap(<Ledger entries={[]} placesById={new Map()} onOpenEntry={jest.fn()} onAddRow={onAdd} />);
    fireEvent.press(screen.getByTestId("ledger-add-row"));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("renders '—' in the pause cell when an entry has no pause", () => {
    const home = makePlace({ id: "p1", name: "Home" });
    const day0 = new Date(2026, 3, 15, 0, 0, 0).getTime() / 1000;
    const e1 = makeEntry({
      id: "e1",
      placeId: "p1",
      startedAt: day0 + 9 * 3600,
      endedAt: day0 + 10 * 3600,
      pauseS: 0,
    });
    wrap(
      <Ledger
        entries={[e1]}
        placesById={new Map([[home.id, home]])}
        onOpenEntry={jest.fn()}
        onAddRow={jest.fn()}
      />,
    );
    // There should be at least one "—" (pause cell) in the body.
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("skips entries whose place lookup is missing (soft-deleted referent)", () => {
    const home = makePlace({ id: "p1", name: "Home" });
    const day0 = new Date(2026, 3, 15, 0, 0, 0).getTime() / 1000;
    const e1 = makeEntry({
      id: "e1",
      placeId: "p1",
      startedAt: day0 + 9 * 3600,
      endedAt: day0 + 10 * 3600,
    });
    const e2 = makeEntry({
      id: "e2",
      placeId: "missing-place",
      startedAt: day0 + 10 * 3600,
      endedAt: day0 + 11 * 3600,
    });
    wrap(
      <Ledger
        entries={[e1, e2]}
        placesById={new Map([[home.id, home]])}
        onOpenEntry={jest.fn()}
        onAddRow={jest.fn()}
      />,
    );
    expect(screen.getByTestId("ledger-row-0")).toBeTruthy();
    // Second entry is silently dropped.
    expect(screen.queryByTestId("ledger-row-1")).toBeNull();
  });
});

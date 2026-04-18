import { createTestDb } from "../testClient";
import { PlacesRepo } from "./places";
import { EntriesRepo } from "./entries";

function setup() {
  const db = createTestDb();
  let now = 1_700_000_000;
  const clock = { now: () => now };
  const advance = (s: number) => {
    now += s;
  };
  const placesRepo = new PlacesRepo(db, clock);
  const entriesRepo = new EntriesRepo(db, clock);
  const place = placesRepo.create({ name: "Work", address: "", latitude: 0, longitude: 0 });
  return { db, entriesRepo, place, advance, now: () => now };
}

describe("EntriesRepo", () => {
  it("opens an auto entry and finds it ongoing", () => {
    const { entriesRepo, place } = setup();
    const e = entriesRepo.open({ placeId: place.id, source: "auto" });
    expect(e.endedAt).toBeNull();
    expect(entriesRepo.ongoing()).toEqual(expect.objectContaining({ id: e.id }));
  });

  it("closes an ongoing entry with endedAt", () => {
    const { entriesRepo, place, advance } = setup();
    const e = entriesRepo.open({ placeId: place.id, source: "auto" });
    advance(600);
    const closed = entriesRepo.close(e.id);
    expect(closed.endedAt).toBe(1_700_000_600);
    expect(entriesRepo.ongoing()).toBeNull();
  });

  it("lists entries by day, most recent first", () => {
    const { entriesRepo, place, advance } = setup();
    const a = entriesRepo.open({ placeId: place.id, source: "auto" });
    advance(60);
    entriesRepo.close(a.id);
    advance(100);
    const b = entriesRepo.open({ placeId: place.id, source: "manual" });
    advance(60);
    entriesRepo.close(b.id);

    const list = entriesRepo.listBetween(0, 1_700_001_000);
    expect(list.map((e) => e.source)).toEqual(["manual", "auto"]);
  });

  it("creates a completed manual entry", () => {
    const { entriesRepo, place } = setup();
    const e = entriesRepo.createManual({
      placeId: place.id,
      startedAt: 1_699_000_000,
      endedAt: 1_699_001_000,
    });
    expect(e.endedAt).toBe(1_699_001_000);
    expect(e.source).toBe("manual");
  });

  it("update() merges a partial patch and bumps updatedAt", () => {
    const { entriesRepo, place, advance } = setup();
    const e = entriesRepo.createManual({
      placeId: place.id,
      startedAt: 1_699_000_000,
      endedAt: 1_699_001_000,
    });
    advance(50);
    const updated = entriesRepo.update(e.id, {
      endedAt: 1_699_002_000,
      note: "client call",
      pauseS: 300,
    });
    expect(updated.endedAt).toBe(1_699_002_000);
    expect(updated.note).toBe("client call");
    expect(updated.pauseS).toBe(300);
    // updatedAt reflects the clock at the time of update.
    expect(updated.updatedAt).toBe(1_700_000_050);
    // Fields not in the patch are preserved.
    expect(updated.startedAt).toBe(1_699_000_000);
    expect(updated.source).toBe("manual");
  });

  it("update() throws if the entry does not exist", () => {
    const { entriesRepo } = setup();
    expect(() => entriesRepo.update("missing-id", { note: "x" })).toThrow(
      /Entry missing-id not found/,
    );
  });
});

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
});

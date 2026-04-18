import { createTestDb } from "../testClient";
import { PendingTransitionsRepo } from "./pending";
import { PlacesRepo } from "./places";

describe("PendingTransitionsRepo", () => {
  function setup() {
    const db = createTestDb();
    const places = new PlacesRepo(db);
    const place = places.create({
      name: "Home",
      address: "street",
      latitude: 0,
      longitude: 0,
    });
    const repo = new PendingTransitionsRepo(db);
    return { repo, placeId: place.id };
  }

  test("insert + get roundtrips", () => {
    const { repo, placeId } = setup();
    const row = repo.insert({
      id: "t1",
      placeId,
      kind: "enter",
      regionEventAt: 1000,
      confirmAt: 1300,
    });
    expect(row.resolvedAt).toBeNull();
    expect(repo.get("t1")).toMatchObject({ id: "t1", placeId, kind: "enter" });
  });

  test("getLatestUnresolved returns the newest-by-regionEventAt unresolved row", () => {
    const { repo, placeId } = setup();
    repo.insert({ id: "t1", placeId, kind: "enter", regionEventAt: 1000, confirmAt: 1300 });
    repo.insert({ id: "t2", placeId, kind: "exit", regionEventAt: 2000, confirmAt: 2180 });
    repo.resolve("t1", "started", 1400);
    expect(repo.getLatestUnresolved()?.id).toBe("t2");
  });

  test("getLatestUnresolved returns null when all resolved", () => {
    const { repo, placeId } = setup();
    repo.insert({ id: "t1", placeId, kind: "enter", regionEventAt: 1000, confirmAt: 1300 });
    repo.resolve("t1", "cancelled", 1100);
    expect(repo.getLatestUnresolved()).toBeNull();
  });

  test("dueAt returns only unresolved rows whose confirmAt has passed, oldest-first", () => {
    const { repo, placeId } = setup();
    repo.insert({ id: "past", placeId, kind: "enter", regionEventAt: 100, confirmAt: 400 });
    repo.insert({ id: "future", placeId, kind: "exit", regionEventAt: 500, confirmAt: 800 });
    repo.insert({ id: "resolved", placeId, kind: "enter", regionEventAt: 50, confirmAt: 150 });
    repo.resolve("resolved", "started", 200);

    const due = repo.dueAt(450);
    expect(due.map((r) => r.id)).toEqual(["past"]);
  });

  test("resolve is idempotent — second call does nothing", () => {
    const { repo, placeId } = setup();
    repo.insert({ id: "t1", placeId, kind: "enter", regionEventAt: 1000, confirmAt: 1300 });
    repo.resolve("t1", "started", 1400);
    const first = repo.get("t1");
    expect(first?.resolvedAt).toBe(1400);
    expect(first?.outcome).toBe("started");

    // Second resolve with different outcome — should be ignored because the
    // WHERE clause requires resolved_at IS NULL.
    repo.resolve("t1", "cancelled", 9999);
    const second = repo.get("t1");
    expect(second?.resolvedAt).toBe(1400);
    expect(second?.outcome).toBe("started");
  });
});

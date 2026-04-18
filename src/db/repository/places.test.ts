import { createTestDb } from "../testClient";
import { PlacesRepo } from "./places";

function makeRepo() {
  const db = createTestDb();
  return new PlacesRepo(db, { now: () => 1_700_000_000 });
}

describe("PlacesRepo", () => {
  it("creates a place with defaults", () => {
    const repo = makeRepo();
    const p = repo.create({
      name: "Work",
      address: "Kinkelstr. 3, 50935 Köln",
      latitude: 50.927,
      longitude: 6.918,
    });
    expect(p.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(p.radiusM).toBe(100);
    expect(p.entryBufferS).toBe(300);
    expect(p.exitBufferS).toBe(180);
    expect(p.createdAt).toBe(1_700_000_000);
  });

  it("lists only non-deleted places, ordered by updatedAt desc", () => {
    const repo = makeRepo();
    const a = repo.create({ name: "A", address: "", latitude: 0, longitude: 0 });
    const b = repo.create({ name: "B", address: "", latitude: 0, longitude: 0 });
    repo.softDelete(a.id);
    const list = repo.list();
    expect(list.map((p) => p.id)).toEqual([b.id]);
  });

  it("updates and bumps updatedAt", () => {
    let now = 1000;
    const db = createTestDb();
    const repo = new PlacesRepo(db, { now: () => now });
    const p = repo.create({ name: "X", address: "", latitude: 0, longitude: 0 });
    now = 2000;
    const updated = repo.update(p.id, { name: "Y" });
    expect(updated.name).toBe("Y");
    expect(updated.updatedAt).toBe(2000);
  });

  it("counts non-deleted places", () => {
    const repo = makeRepo();
    repo.create({ name: "A", address: "", latitude: 0, longitude: 0 });
    const b = repo.create({ name: "B", address: "", latitude: 0, longitude: 0 });
    repo.softDelete(b.id);
    expect(repo.count()).toBe(1);
  });
});

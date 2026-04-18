import { createTestDb } from "./testClient";
import { places } from "./schema";

describe("test db client", () => {
  it("creates an in-memory db with migrations applied", () => {
    const db = createTestDb();
    const rows = db.select().from(places).all();
    expect(rows).toEqual([]);
  });

  it("isolates separate test dbs", () => {
    const a = createTestDb();
    const b = createTestDb();
    a.insert(places)
      .values({
        id: "p1",
        name: "A",
        address: "",
        latitude: 0,
        longitude: 0,
        color: "#FF7A1A",
        icon: "pin",
        createdAt: 0,
        updatedAt: 0,
      })
      .run();
    expect(b.select().from(places).all()).toEqual([]);
  });
});

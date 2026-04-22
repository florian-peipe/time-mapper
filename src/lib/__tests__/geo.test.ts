import { haversineMeters } from "../geo";

describe("lib/geo", () => {
  test("haversineMeters is zero for identical points", () => {
    expect(haversineMeters(52.52, 13.405, 52.52, 13.405)).toBeCloseTo(0, 5);
  });

  test("haversineMeters is symmetric", () => {
    const ab = haversineMeters(52.52, 13.405, 48.137, 11.576);
    const ba = haversineMeters(48.137, 11.576, 52.52, 13.405);
    expect(ab).toBeCloseTo(ba, 3);
  });

  test("haversineMeters Berlin-Munich is ~500km", () => {
    const d = haversineMeters(52.52, 13.405, 48.137, 11.576);
    expect(d).toBeGreaterThan(400_000);
    expect(d).toBeLessThan(600_000);
  });
});

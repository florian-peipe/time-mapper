import { isDayInDailyGoal, isoDayOfWeek, netMinutes } from "../entries";

describe("netMinutes", () => {
  it("returns 0 for an open entry", () => {
    expect(
      netMinutes({
        id: "1",
        placeId: "p",
        startedAt: 1000,
        endedAt: null,
        pauseS: 0,
        source: "auto",
        note: null,
        createdAt: 1000,
        updatedAt: 1000,
        deletedAt: null,
      }),
    ).toBe(0);
  });

  it("returns net (gross − pause) rounded to minutes", () => {
    // 3700s gross, 100s pause → 3600s net → 60 min.
    expect(
      netMinutes({
        id: "1",
        placeId: "p",
        startedAt: 0,
        endedAt: 3700,
        pauseS: 100,
        source: "auto",
        note: null,
        createdAt: 0,
        updatedAt: 0,
        deletedAt: null,
      }),
    ).toBe(60);
  });

  it("clamps to 0 when pause exceeds gross", () => {
    expect(
      netMinutes({
        id: "1",
        placeId: "p",
        startedAt: 0,
        endedAt: 1000,
        pauseS: 5000,
        source: "auto",
        note: null,
        createdAt: 0,
        updatedAt: 0,
        deletedAt: null,
      }),
    ).toBe(0);
  });
});

describe("isoDayOfWeek", () => {
  it("maps JS Sunday (0) to ISO 7", () => {
    // 2026-04-19 is a Sunday.
    expect(isoDayOfWeek(new Date(2026, 3, 19))).toBe(7);
  });

  it("maps JS Monday (1) to ISO 1", () => {
    // 2026-04-20 is a Monday.
    expect(isoDayOfWeek(new Date(2026, 3, 20))).toBe(1);
  });

  it("maps JS Saturday (6) to ISO 6", () => {
    // 2026-04-18 is a Saturday.
    expect(isoDayOfWeek(new Date(2026, 3, 18))).toBe(6);
  });
});

describe("isDayInDailyGoal", () => {
  it("treats null as 'every day'", () => {
    expect(isDayInDailyGoal(null, new Date(2026, 3, 20))).toBe(true);
  });

  it("treats empty string as 'every day'", () => {
    expect(isDayInDailyGoal("", new Date(2026, 3, 20))).toBe(true);
  });

  it("matches a single configured day", () => {
    // Monday 2026-04-20, set Mon only.
    expect(isDayInDailyGoal("1", new Date(2026, 3, 20))).toBe(true);
    // Tuesday 2026-04-21, set Mon only.
    expect(isDayInDailyGoal("1", new Date(2026, 3, 21))).toBe(false);
  });

  it("matches a Mon-Fri set", () => {
    const days = "1,2,3,4,5";
    // Wednesday 2026-04-22.
    expect(isDayInDailyGoal(days, new Date(2026, 3, 22))).toBe(true);
    // Saturday 2026-04-18.
    expect(isDayInDailyGoal(days, new Date(2026, 3, 18))).toBe(false);
    // Sunday 2026-04-19.
    expect(isDayInDailyGoal(days, new Date(2026, 3, 19))).toBe(false);
  });

  it("tolerates whitespace around day numbers", () => {
    // Monday 2026-04-20.
    expect(isDayInDailyGoal("1, 2, 3", new Date(2026, 3, 20))).toBe(true);
  });

  it("returns true for a 'weekends' filter on Sunday", () => {
    // Sunday 2026-04-19 → ISO 7.
    expect(isDayInDailyGoal("6,7", new Date(2026, 3, 19))).toBe(true);
  });
});

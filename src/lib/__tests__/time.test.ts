import {
  DAY_MS,
  DAY_S,
  formatClock,
  formatDurationCompact,
  formatDurationFixed,
  formatElapsed,
  nowS,
  padNumber,
} from "../time";

describe("lib/time — nowS", () => {
  it("returns current unix seconds", () => {
    const before = Math.floor(Date.now() / 1000);
    const n = nowS();
    const after = Math.floor(Date.now() / 1000);
    expect(n).toBeGreaterThanOrEqual(before);
    expect(n).toBeLessThanOrEqual(after);
  });
});

describe("lib/time — constants", () => {
  it("DAY_S is 86400 seconds", () => {
    expect(DAY_S).toBe(86_400);
  });
  it("DAY_MS is 86400000 milliseconds", () => {
    expect(DAY_MS).toBe(86_400_000);
  });
});

describe("lib/time — padNumber", () => {
  it("pads single digits to width 2 by default", () => {
    expect(padNumber(0)).toBe("00");
    expect(padNumber(5)).toBe("05");
    expect(padNumber(42)).toBe("42");
  });
  it("respects a custom width", () => {
    expect(padNumber(7, 3)).toBe("007");
  });
});

describe("lib/time — formatDurationCompact", () => {
  it("omits hours slot when zero", () => {
    expect(formatDurationCompact(0)).toBe("0m");
    expect(formatDurationCompact(30 * 60)).toBe("30m");
    expect(formatDurationCompact(59 * 60)).toBe("59m");
  });
  it("prints hours + zero-padded minutes above one hour", () => {
    expect(formatDurationCompact(60 * 60)).toBe("1h 00m");
    expect(formatDurationCompact(90 * 60)).toBe("1h 30m");
    expect(formatDurationCompact(65 * 60)).toBe("1h 05m");
    expect(formatDurationCompact(11 * 3600 + 7 * 60)).toBe("11h 07m");
  });
});

describe("lib/time — formatDurationFixed", () => {
  it("always renders the hours slot, including when zero", () => {
    expect(formatDurationFixed(0)).toBe("0h 00m");
    expect(formatDurationFixed(30 * 60)).toBe("0h 30m");
    expect(formatDurationFixed(3600)).toBe("1h 00m");
    expect(formatDurationFixed(90 * 60)).toBe("1h 30m");
    expect(formatDurationFixed(25 * 3600 + 5 * 60)).toBe("25h 05m");
  });
});

describe("lib/time — formatElapsed", () => {
  it("renders HH:MM:SS always 3-slot", () => {
    expect(formatElapsed(0)).toBe("00:00:00");
    expect(formatElapsed(5)).toBe("00:00:05");
    expect(formatElapsed(65)).toBe("00:01:05");
    expect(formatElapsed(3665)).toBe("01:01:05");
  });
  it("clamps negative to zero", () => {
    expect(formatElapsed(-100)).toBe("00:00:00");
  });
});

describe("lib/time — formatClock", () => {
  it("formats a unix timestamp as local HH:MM", () => {
    const midnight = new Date(2026, 3, 15, 13, 5, 0).getTime() / 1000;
    expect(formatClock(midnight)).toBe("13:05");
  });
});

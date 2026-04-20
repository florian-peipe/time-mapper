import { rangeForMode } from "../range";

/**
 * Unix seconds → local Date helper for readable assertions.
 * Jest sets a fixed system time per test so the windows are deterministic.
 */
function isoLocal(unixS: number): string {
  const d = new Date(unixS * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${dd} ${hh}:${mm}:${ss}`;
}

beforeEach(() => {
  // Wednesday 2026-04-15 12:34:56 local.
  jest.useFakeTimers().setSystemTime(new Date(2026, 3, 15, 12, 34, 56));
});

afterEach(() => {
  jest.useRealTimers();
});

describe("rangeForMode — day", () => {
  it("offset 0 spans today's midnight → tomorrow's midnight − 1s", () => {
    const { startS, endS } = rangeForMode("day", 0);
    expect(isoLocal(startS)).toBe("2026-04-15 00:00:00");
    expect(isoLocal(endS)).toBe("2026-04-15 23:59:59");
  });

  it("offset −1 spans yesterday", () => {
    const { startS, endS } = rangeForMode("day", -1);
    expect(isoLocal(startS)).toBe("2026-04-14 00:00:00");
    expect(isoLocal(endS)).toBe("2026-04-14 23:59:59");
  });

  it("offset −7 spans one week ago", () => {
    const { startS, endS } = rangeForMode("day", -7);
    expect(isoLocal(startS)).toBe("2026-04-08 00:00:00");
    expect(isoLocal(endS)).toBe("2026-04-08 23:59:59");
  });
});

describe("rangeForMode — week", () => {
  it("offset 0 anchors to the local Monday when today is Wednesday", () => {
    const { startS, endS } = rangeForMode("week", 0);
    expect(isoLocal(startS)).toBe("2026-04-13 00:00:00"); // Monday
    expect(isoLocal(endS)).toBe("2026-04-19 23:59:59"); // Sunday 23:59:59
  });

  it("offset −1 spans the previous Monday → Sunday", () => {
    const { startS, endS } = rangeForMode("week", -1);
    expect(isoLocal(startS)).toBe("2026-04-06 00:00:00");
    expect(isoLocal(endS)).toBe("2026-04-12 23:59:59");
  });

  it("Monday-start rule holds when today is Sunday", () => {
    // Sunday 2026-04-19 (end of the observed week).
    jest.setSystemTime(new Date(2026, 3, 19, 12, 0, 0));
    const { startS, endS } = rangeForMode("week", 0);
    expect(isoLocal(startS)).toBe("2026-04-13 00:00:00");
    expect(isoLocal(endS)).toBe("2026-04-19 23:59:59");
  });

  it("Monday-start rule holds when today is Monday", () => {
    jest.setSystemTime(new Date(2026, 3, 13, 12, 0, 0));
    const { startS, endS } = rangeForMode("week", 0);
    expect(isoLocal(startS)).toBe("2026-04-13 00:00:00");
    expect(isoLocal(endS)).toBe("2026-04-19 23:59:59");
  });
});

describe("rangeForMode — month", () => {
  it("offset 0 spans the first → last day of the current month", () => {
    const { startS, endS } = rangeForMode("month", 0);
    expect(isoLocal(startS)).toBe("2026-04-01 00:00:00");
    expect(isoLocal(endS)).toBe("2026-04-30 23:59:59");
  });

  it("offset −1 spans March 2026 (31-day month)", () => {
    const { startS, endS } = rangeForMode("month", -1);
    expect(isoLocal(startS)).toBe("2026-03-01 00:00:00");
    expect(isoLocal(endS)).toBe("2026-03-31 23:59:59");
  });

  it("offset −2 spans February 2026 (28-day month)", () => {
    const { startS, endS } = rangeForMode("month", -2);
    expect(isoLocal(startS)).toBe("2026-02-01 00:00:00");
    expect(isoLocal(endS)).toBe("2026-02-28 23:59:59");
  });

  it("crosses a year boundary (Jan 2027 at offset +9 from April 2026)", () => {
    const { startS, endS } = rangeForMode("month", 9);
    expect(isoLocal(startS)).toBe("2027-01-01 00:00:00");
    expect(isoLocal(endS)).toBe("2027-01-31 23:59:59");
  });
});

describe("rangeForMode — year", () => {
  it("offset 0 spans Jan 1 → Dec 31 of the current year", () => {
    const { startS, endS } = rangeForMode("year", 0);
    expect(isoLocal(startS)).toBe("2026-01-01 00:00:00");
    expect(isoLocal(endS)).toBe("2026-12-31 23:59:59");
  });

  it("offset −1 spans the previous year", () => {
    const { startS, endS } = rangeForMode("year", -1);
    expect(isoLocal(startS)).toBe("2025-01-01 00:00:00");
    expect(isoLocal(endS)).toBe("2025-12-31 23:59:59");
  });

  it("offset +1 spans next year (UI shouldn't normally request this; function stays pure)", () => {
    const { startS, endS } = rangeForMode("year", 1);
    expect(isoLocal(startS)).toBe("2027-01-01 00:00:00");
    expect(isoLocal(endS)).toBe("2027-12-31 23:59:59");
  });
});

describe("rangeForMode — continuity", () => {
  it("sequential day windows don't overlap and leave no gap", () => {
    const d0 = rangeForMode("day", 0);
    const dMinus1 = rangeForMode("day", -1);
    // day -1 ends 1 second before day 0 begins.
    expect(d0.startS - dMinus1.endS).toBe(1);
  });

  it("sequential week windows don't overlap and leave no gap", () => {
    const w0 = rangeForMode("week", 0);
    const wMinus1 = rangeForMode("week", -1);
    expect(w0.startS - wMinus1.endS).toBe(1);
  });
});

import { createTestDb } from "@/db/testClient";
import { KvRepo } from "@/db/repository/kv";
import { bumpCounter, bumpFirst, readCounters, __resetCountersForTests } from "../counters";

function makeKv() {
  return new KvRepo(createTestDb());
}

describe("diagnostics/counters", () => {
  test("readCounters on a fresh kv returns {}", () => {
    expect(readCounters(makeKv())).toEqual({});
  });

  test("bumpCounter increments and persists", () => {
    const kv = makeKv();
    expect(bumpCounter(kv, "app_launch")).toBe(1);
    expect(bumpCounter(kv, "app_launch")).toBe(2);
    expect(bumpCounter(kv, "app_launch", 3)).toBe(5);
    expect(readCounters(kv)).toEqual({ app_launch: 5 });
  });

  test("bumpCounter isolates events", () => {
    const kv = makeKv();
    bumpCounter(kv, "app_launch");
    bumpCounter(kv, "paywall_shown");
    bumpCounter(kv, "paywall_shown");
    expect(readCounters(kv)).toEqual({ app_launch: 1, paywall_shown: 2 });
  });

  test("bumpFirst only records on the first call", () => {
    const kv = makeKv();
    expect(bumpFirst(kv, "first_entry")).toBe(true);
    expect(bumpFirst(kv, "first_entry")).toBe(false);
    expect(bumpFirst(kv, "first_entry")).toBe(false);
    expect(readCounters(kv).first_entry).toBe(1);
  });

  test("readCounters ignores malformed JSON", () => {
    const kv = makeKv();
    kv.set("diagnostics.counters", "{not valid");
    expect(readCounters(kv)).toEqual({});
  });

  test("readCounters ignores non-numeric values", () => {
    const kv = makeKv();
    kv.set("diagnostics.counters", JSON.stringify({ app_launch: "bad", paywall_shown: 3 }));
    expect(readCounters(kv)).toEqual({ paywall_shown: 3 });
  });

  test("reset helper clears the row", () => {
    const kv = makeKv();
    bumpCounter(kv, "app_launch");
    __resetCountersForTests(kv);
    expect(readCounters(kv)).toEqual({});
  });
});

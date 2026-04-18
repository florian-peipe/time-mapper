import { createTestDb } from "@/db/testClient";
import { PlacesRepo } from "@/db/repository/places";
import { EntriesRepo } from "@/db/repository/entries";
import { PendingTransitionsRepo } from "@/db/repository/pending";
import { step, IDLE, type MachineState, type Event } from "../stateMachine";
import { loadState, applyEffects } from "../persistence";

/**
 * Integration test covering the full cycle end-to-end: the three repos,
 * the state machine, and the persistence layer wired together exactly as
 * the background task wires them at runtime. No mocks — just real SQLite.
 *
 * Goal: prove that the system reaches a self-consistent final state under
 * the representative event sequences the background task will dispatch.
 */
describe("tracking — end-to-end", () => {
  function setup() {
    const db = createTestDb();
    const places = new PlacesRepo(db);
    const entries = new EntriesRepo(db);
    const pending = new PendingTransitionsRepo(db);
    const place = places.create({
      name: "Home",
      address: "s",
      latitude: 0,
      longitude: 0,
      entryBufferS: 300,
      exitBufferS: 180,
    });
    return { db, places, entries, pending, placeId: place.id };
  }

  /**
   * Drive one event through step() + applyEffects() in lockstep with the
   * background task. Reload from DB first — matches the real task, which
   * wakes cold with no in-memory state.
   */
  function dispatch(
    entries: EntriesRepo,
    pending: PendingTransitionsRepo,
    event: Event,
    nowS: number,
  ): MachineState {
    const state = loadState(entries, pending);
    const r = step(state, event);
    return applyEffects(r.effects, r.next, entries, pending, nowS);
  }

  test("open → dwell → close cycle records exactly one entry with the right boundaries", () => {
    const { entries, pending, placeId } = setup();

    // 1. OS fires ENTER at 10:00
    dispatch(
      entries,
      pending,
      {
        kind: "REGION_ENTER",
        placeId,
        atS: 10_000,
        entryBufferS: 300,
        transitionId: "t-enter",
      },
      10_000,
    );
    expect(pending.getLatestUnresolved()?.kind).toBe("enter");
    expect(entries.ongoing()).toBeNull();

    // 2. CONFIRM at 10:05:01 (buffer elapsed) — entry opens at original event time
    dispatch(entries, pending, { kind: "CONFIRM", atS: 10_301 }, 10_301);
    expect(pending.getLatestUnresolved()).toBeNull();
    const active = entries.ongoing();
    expect(active).not.toBeNull();
    expect(active?.startedAt).toBe(10_000);
    expect(active?.source).toBe("auto");

    // 3. OS fires EXIT at 12:00
    dispatch(
      entries,
      pending,
      {
        kind: "REGION_EXIT",
        placeId,
        atS: 17_200, // +2h
        exitBufferS: 180,
        transitionId: "t-exit",
      },
      17_200,
    );
    expect(pending.getLatestUnresolved()?.kind).toBe("exit");
    expect(entries.ongoing()).not.toBeNull(); // still open until exit is confirmed

    // 4. CONFIRM at 12:03:01 — entry closes at original exit time (12:00)
    dispatch(entries, pending, { kind: "CONFIRM", atS: 17_381 }, 17_381);
    expect(entries.ongoing()).toBeNull();

    const all = entries.listBetween(0, 99_999);
    expect(all).toHaveLength(1);
    expect(all[0]?.startedAt).toBe(10_000);
    expect(all[0]?.endedAt).toBe(17_200);
    // Duration should be 2h even though CONFIRM fired 3min later.
    expect((all[0]?.endedAt ?? 0) - (all[0]?.startedAt ?? 0)).toBe(7_200);
  });

  test("drive-by (ENTER then EXIT before buffer) leaves no entry and no pending row", () => {
    const { entries, pending, placeId } = setup();
    dispatch(
      entries,
      pending,
      {
        kind: "REGION_ENTER",
        placeId,
        atS: 1000,
        entryBufferS: 300,
        transitionId: "t1",
      },
      1000,
    );
    dispatch(
      entries,
      pending,
      {
        kind: "REGION_EXIT",
        placeId,
        atS: 1100,
        exitBufferS: 180,
        transitionId: "t2",
      },
      1100,
    );
    expect(entries.ongoing()).toBeNull();
    expect(entries.listBetween(0, 99_999)).toHaveLength(0);
    expect(pending.getLatestUnresolved()).toBeNull();
  });

  test("zig-zag (ENTER → EXIT → ENTER → CONFIRM) opens exactly one entry", () => {
    const { entries, pending, placeId } = setup();
    dispatch(
      entries,
      pending,
      {
        kind: "REGION_ENTER",
        placeId,
        atS: 1000,
        entryBufferS: 300,
        transitionId: "t1",
      },
      1000,
    );
    dispatch(
      entries,
      pending,
      {
        kind: "REGION_EXIT",
        placeId,
        atS: 1100,
        exitBufferS: 180,
        transitionId: "t2",
      },
      1100,
    );
    dispatch(
      entries,
      pending,
      {
        kind: "REGION_ENTER",
        placeId,
        atS: 2000,
        entryBufferS: 300,
        transitionId: "t3",
      },
      2000,
    );
    dispatch(entries, pending, { kind: "CONFIRM", atS: 2400 }, 2400);
    expect(entries.ongoing()).not.toBeNull();
    const all = entries.listBetween(0, 99_999);
    expect(all).toHaveLength(1);
    expect(all[0]?.startedAt).toBe(2000);
  });

  test("step-out dance (ACTIVE → PENDING_EXIT → ACTIVE) leaves one continuous entry", () => {
    const { entries, pending, placeId } = setup();

    // Go ACTIVE
    dispatch(
      entries,
      pending,
      {
        kind: "REGION_ENTER",
        placeId,
        atS: 1000,
        entryBufferS: 300,
        transitionId: "t-enter",
      },
      1000,
    );
    dispatch(entries, pending, { kind: "CONFIRM", atS: 1400 }, 1400);
    const openEntryId = entries.ongoing()?.id;
    expect(openEntryId).toBeDefined();

    // Step out briefly
    dispatch(
      entries,
      pending,
      {
        kind: "REGION_EXIT",
        placeId,
        atS: 2000,
        exitBufferS: 180,
        transitionId: "t-step",
      },
      2000,
    );
    // Come back within the buffer
    dispatch(
      entries,
      pending,
      {
        kind: "REGION_ENTER",
        placeId,
        atS: 2100,
        entryBufferS: 300,
        transitionId: "t-back",
      },
      2100,
    );
    const stillActive = entries.ongoing();
    expect(stillActive?.id).toBe(openEntryId);
    expect(stillActive?.startedAt).toBe(1000);
    expect(pending.getLatestUnresolved()).toBeNull();
  });

  test("reloadState round-trips across 'wakes' — each dispatch stands alone", () => {
    const { entries, pending, placeId } = setup();

    dispatch(
      entries,
      pending,
      {
        kind: "REGION_ENTER",
        placeId,
        atS: 1000,
        entryBufferS: 300,
        transitionId: "t-enter",
      },
      1000,
    );

    // Simulate a fresh task wake: only the DB carries state.
    const reloaded = loadState(entries, pending);
    expect(reloaded.kind).toBe("PENDING_ENTER");

    dispatch(entries, pending, { kind: "CONFIRM", atS: 1400 }, 1400);

    // Second wake
    const reloadedActive = loadState(entries, pending);
    expect(reloadedActive.kind).toBe("ACTIVE");
    if (reloadedActive.kind !== "ACTIVE") throw new Error("unreachable");
    expect(reloadedActive.placeId).toBe(placeId);
    expect(reloadedActive.startedAtS).toBe(1000);
  });

  test("pending_transitions.resolved_at is set after every cycle — no stale unresolved rows", () => {
    const { entries, pending, placeId } = setup();
    dispatch(
      entries,
      pending,
      {
        kind: "REGION_ENTER",
        placeId,
        atS: 1000,
        entryBufferS: 300,
        transitionId: "t1",
      },
      1000,
    );
    dispatch(entries, pending, { kind: "CONFIRM", atS: 1400 }, 1400);
    dispatch(
      entries,
      pending,
      {
        kind: "REGION_EXIT",
        placeId,
        atS: 2000,
        exitBufferS: 180,
        transitionId: "t2",
      },
      2000,
    );
    dispatch(entries, pending, { kind: "CONFIRM", atS: 2200 }, 2200);

    const all = pending.listAll();
    expect(all).toHaveLength(2);
    for (const row of all) {
      expect(row.resolvedAt).not.toBeNull();
      expect(row.outcome).not.toBeNull();
    }
    expect(pending.getLatestUnresolved()).toBeNull();
  });

  test("empty-state round-trip: loadState(fresh DB) → IDLE", () => {
    const { entries, pending } = setup();
    expect(loadState(entries, pending)).toEqual(IDLE);
  });
});

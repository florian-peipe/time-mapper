import { createTestDb } from "@/db/testClient";
import { PlacesRepo } from "@/db/repository/places";
import { EntriesRepo } from "@/db/repository/entries";
import { PendingTransitionsRepo } from "@/db/repository/pending";
import { loadState, applyEffects } from "../persistence";
import { IDLE, step } from "../stateMachine";
import type { MachineState } from "../stateMachine";

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

describe("tracking/persistence", () => {
  describe("loadState", () => {
    test("empty DB → IDLE", () => {
      const { entries, pending } = setup();
      expect(loadState(entries, pending)).toEqual(IDLE);
    });

    test("one pending enter, no ongoing entry → PENDING_ENTER", () => {
      const { entries, pending, placeId } = setup();
      pending.insert({
        id: "t1",
        placeId,
        kind: "enter",
        regionEventAt: 1000,
        confirmAt: 1300,
      });
      const s = loadState(entries, pending);
      expect(s.kind).toBe("PENDING_ENTER");
      if (s.kind !== "PENDING_ENTER") throw new Error("unreachable");
      expect(s.placeId).toBe(placeId);
      expect(s.entryBufferS).toBe(300);
    });

    test("no pending, one ongoing entry → ACTIVE", () => {
      const { entries, pending, placeId } = setup();
      const entry = entries.open({ placeId, source: "auto", startedAt: 1000 });
      const s = loadState(entries, pending);
      expect(s.kind).toBe("ACTIVE");
      if (s.kind !== "ACTIVE") throw new Error("unreachable");
      expect(s.entryId).toBe(entry.id);
      expect(s.startedAtS).toBe(1000);
    });

    test("pending exit + ongoing entry → PENDING_EXIT", () => {
      const { entries, pending, placeId } = setup();
      entries.open({ placeId, source: "auto", startedAt: 1000 });
      pending.insert({
        id: "tx",
        placeId,
        kind: "exit",
        regionEventAt: 2000,
        confirmAt: 2180,
      });
      const s = loadState(entries, pending);
      expect(s.kind).toBe("PENDING_EXIT");
      if (s.kind !== "PENDING_EXIT") throw new Error("unreachable");
      expect(s.exitBufferS).toBe(180);
    });

    test("stale pending exit with no ongoing entry → IDLE and cancel the pending", () => {
      const { entries, pending, placeId } = setup();
      pending.insert({
        id: "tx",
        placeId,
        kind: "exit",
        regionEventAt: 2000,
        confirmAt: 2180,
      });
      const s = loadState(entries, pending);
      expect(s).toEqual(IDLE);
      expect(pending.get("tx")?.resolvedAt).not.toBeNull();
      expect(pending.get("tx")?.outcome).toBe("cancelled");
    });
  });

  describe("applyEffects", () => {
    test("persist_pending inserts a pending_transitions row", () => {
      const { entries, pending, placeId } = setup();
      const nextState: MachineState = {
        kind: "PENDING_ENTER",
        placeId,
        entryBufferS: 300,
        eventAtS: 1000,
        confirmAtS: 1300,
        transitionId: "t1",
      };
      applyEffects(
        [
          {
            kind: "persist_pending",
            transition: {
              id: "t1",
              placeId,
              kind: "enter",
              regionEventAtS: 1000,
              confirmAtS: 1300,
            },
          },
        ],
        nextState,
        entries,
        pending,
      );
      expect(pending.get("t1")).toMatchObject({ id: "t1", placeId, kind: "enter" });
    });

    test("persist_pending is idempotent for the same id (exactly-once)", () => {
      const { entries, pending, placeId } = setup();
      const effect = {
        kind: "persist_pending" as const,
        transition: {
          id: "t1",
          placeId,
          kind: "enter" as const,
          regionEventAtS: 1000,
          confirmAtS: 1300,
        },
      };
      const nextState: MachineState = {
        kind: "PENDING_ENTER",
        placeId,
        entryBufferS: 300,
        eventAtS: 1000,
        confirmAtS: 1300,
        transitionId: "t1",
      };
      applyEffects([effect], nextState, entries, pending);
      expect(() => applyEffects([effect], nextState, entries, pending)).not.toThrow();
      const rows = pending.listAll();
      expect(rows).toHaveLength(1);
    });

    test("open_entry creates an auto entry and fills the pending:<tid> placeholder", () => {
      const { entries, pending, placeId } = setup();
      const placeholderState: MachineState = {
        kind: "ACTIVE",
        placeId,
        entryId: "pending:t1",
        startedAtS: 1000,
      };
      const resolved = applyEffects(
        [{ kind: "open_entry", placeId, atS: 1000 }],
        placeholderState,
        entries,
        pending,
      );
      expect(resolved.kind).toBe("ACTIVE");
      if (resolved.kind !== "ACTIVE") throw new Error("unreachable");
      expect(resolved.entryId).not.toBe("pending:t1");
      const entry = entries.ongoing();
      expect(entry).not.toBeNull();
      expect(entry?.startedAt).toBe(1000);
      expect(entry?.source).toBe("auto");
    });

    test("close_entry stamps endedAt at the exit event time, not 'now'", () => {
      const { entries, pending, placeId } = setup();
      const open = entries.open({ placeId, source: "auto", startedAt: 1000 });
      applyEffects(
        [{ kind: "close_entry", entryId: open.id, atS: 2000 }],
        IDLE,
        entries,
        pending,
        9999, // nowS is irrelevant for endedAt
      );
      const closed = entries.get(open.id);
      expect(closed?.endedAt).toBe(2000);
    });

    test("clear_pending marks the row resolved with the given outcome", () => {
      const { entries, pending, placeId } = setup();
      pending.insert({
        id: "t1",
        placeId,
        kind: "enter",
        regionEventAt: 1000,
        confirmAt: 1300,
      });
      applyEffects(
        [{ kind: "clear_pending", transitionId: "t1", outcome: "started" }],
        IDLE,
        entries,
        pending,
        1400,
      );
      expect(pending.get("t1")?.resolvedAt).toBe(1400);
      expect(pending.get("t1")?.outcome).toBe("started");
    });

    test("reducer + persistence round-trip: enter → confirm → active reads back as ACTIVE", () => {
      const { entries, pending, placeId } = setup();
      let state = loadState(entries, pending);
      expect(state).toEqual(IDLE);

      // Dispatch REGION_ENTER
      let result = step(state, {
        kind: "REGION_ENTER",
        placeId,
        atS: 1000,
        entryBufferS: 300,
        transitionId: "t1",
      });
      state = applyEffects(result.effects, result.next, entries, pending, 1000);
      expect(state.kind).toBe("PENDING_ENTER");

      // Reload state from DB — should match
      const reloaded = loadState(entries, pending);
      expect(reloaded.kind).toBe("PENDING_ENTER");

      // Dispatch CONFIRM
      result = step(reloaded, { kind: "CONFIRM", atS: 1400 });
      state = applyEffects(result.effects, result.next, entries, pending, 1400);
      expect(state.kind).toBe("ACTIVE");
      if (state.kind !== "ACTIVE") throw new Error("unreachable");
      expect(state.entryId).not.toMatch(/^pending:/);

      // Reload again — entry id should be stable
      const reloaded2 = loadState(entries, pending);
      expect(reloaded2.kind).toBe("ACTIVE");
      if (reloaded2.kind !== "ACTIVE") throw new Error("unreachable");
      expect(reloaded2.entryId).toBe(state.entryId);
    });
  });
});

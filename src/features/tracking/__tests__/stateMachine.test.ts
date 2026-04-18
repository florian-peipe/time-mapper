import { step, IDLE, type MachineState, type Event } from "../stateMachine";

const ENTRY_BUFFER = 300; // 5min
const EXIT_BUFFER = 180; // 3min
const PLACE_A = "place-a";
const PLACE_B = "place-b";

function enter(
  opts: Partial<{ placeId: string; atS: number; buf: number; tid: string }> = {},
): Event {
  return {
    kind: "REGION_ENTER",
    placeId: opts.placeId ?? PLACE_A,
    atS: opts.atS ?? 1000,
    entryBufferS: opts.buf ?? ENTRY_BUFFER,
    transitionId: opts.tid ?? "t-enter",
  };
}

function exit(
  opts: Partial<{ placeId: string; atS: number; buf: number; tid: string }> = {},
): Event {
  return {
    kind: "REGION_EXIT",
    placeId: opts.placeId ?? PLACE_A,
    atS: opts.atS ?? 2000,
    exitBufferS: opts.buf ?? EXIT_BUFFER,
    transitionId: opts.tid ?? "t-exit",
  };
}

function confirm(atS: number): Event {
  return { kind: "CONFIRM", atS };
}

describe("tracking/stateMachine", () => {
  describe("IDLE", () => {
    test("1. IDLE → PENDING_ENTER on REGION_ENTER; persists a pending transition", () => {
      const r = step(IDLE, enter({ atS: 1000, buf: 300, tid: "t1" }));
      expect(r.next.kind).toBe("PENDING_ENTER");
      if (r.next.kind !== "PENDING_ENTER") throw new Error("unreachable");
      expect(r.next.placeId).toBe(PLACE_A);
      expect(r.next.confirmAtS).toBe(1300);
      expect(r.next.transitionId).toBe("t1");
      expect(r.effects).toEqual([
        {
          kind: "persist_pending",
          transition: {
            id: "t1",
            placeId: PLACE_A,
            kind: "enter",
            regionEventAtS: 1000,
            confirmAtS: 1300,
          },
        },
      ]);
    });

    test("2. IDLE ignores REGION_EXIT (phantom OS event)", () => {
      const r = step(IDLE, exit());
      expect(r.next).toEqual(IDLE);
      expect(r.effects).toEqual([]);
    });

    test("3. IDLE ignores CONFIRM (nothing pending)", () => {
      const r = step(IDLE, confirm(5000));
      expect(r.next).toEqual(IDLE);
      expect(r.effects).toEqual([]);
    });
  });

  describe("PENDING_ENTER", () => {
    function makePending(overrides: Partial<{ tid: string }> = {}): MachineState {
      return {
        kind: "PENDING_ENTER",
        placeId: PLACE_A,
        entryBufferS: ENTRY_BUFFER,
        eventAtS: 1000,
        confirmAtS: 1300,
        transitionId: overrides.tid ?? "t-pend",
      };
    }

    test("4. PENDING_ENTER → IDLE on REGION_EXIT before confirm (drive-by)", () => {
      const s = makePending({ tid: "tp" });
      const r = step(s, exit({ atS: 1100 }));
      expect(r.next).toEqual(IDLE);
      expect(r.effects).toEqual([
        { kind: "clear_pending", transitionId: "tp", outcome: "cancelled" },
      ]);
    });

    test("5. PENDING_ENTER → ACTIVE on CONFIRM after confirmAtS; opens entry", () => {
      const s = makePending({ tid: "tp" });
      const r = step(s, confirm(1400));
      expect(r.next.kind).toBe("ACTIVE");
      if (r.next.kind !== "ACTIVE") throw new Error("unreachable");
      expect(r.next.placeId).toBe(PLACE_A);
      expect(r.next.startedAtS).toBe(1000);
      expect(r.effects).toEqual([
        { kind: "open_entry", placeId: PLACE_A, atS: 1000 },
        { kind: "clear_pending", transitionId: "tp", outcome: "started" },
      ]);
    });

    test("6. PENDING_ENTER: CONFIRM before confirmAtS is a no-op (too early)", () => {
      const s = makePending();
      const r = step(s, confirm(1200)); // 100s before confirmAtS
      expect(r.next).toEqual(s);
      expect(r.effects).toEqual([]);
    });

    test("7. PENDING_ENTER: CONFIRM exactly at confirmAtS promotes to ACTIVE", () => {
      const s = makePending({ tid: "tp" });
      const r = step(s, confirm(1300));
      expect(r.next.kind).toBe("ACTIVE");
    });

    test("8. PENDING_ENTER: duplicate REGION_ENTER for same place is a no-op", () => {
      const s = makePending();
      const r = step(s, enter({ atS: 1050 }));
      expect(r.next).toEqual(s);
      expect(r.effects).toEqual([]);
    });

    test("9. PENDING_ENTER: REGION_ENTER for a different place cancels first, pends second", () => {
      const s = makePending({ tid: "tp1" });
      const r = step(s, enter({ placeId: PLACE_B, atS: 1200, tid: "tp2" }));
      expect(r.next.kind).toBe("PENDING_ENTER");
      if (r.next.kind !== "PENDING_ENTER") throw new Error("unreachable");
      expect(r.next.placeId).toBe(PLACE_B);
      expect(r.next.confirmAtS).toBe(1500);
      expect(r.effects).toHaveLength(2);
      expect(r.effects[0]).toEqual({
        kind: "clear_pending",
        transitionId: "tp1",
        outcome: "cancelled",
      });
      expect(r.effects[1]).toMatchObject({
        kind: "persist_pending",
        transition: { id: "tp2", placeId: PLACE_B, kind: "enter" },
      });
    });

    test("10. PENDING_ENTER: REGION_EXIT for an unrelated place is ignored", () => {
      const s = makePending();
      const r = step(s, exit({ placeId: PLACE_B, atS: 1100 }));
      expect(r.next).toEqual(s);
      expect(r.effects).toEqual([]);
    });
  });

  describe("ACTIVE", () => {
    const activeState: MachineState = {
      kind: "ACTIVE",
      placeId: PLACE_A,
      entryId: "entry-1",
      startedAtS: 1000,
    };

    test("11. ACTIVE → PENDING_EXIT on REGION_EXIT", () => {
      const r = step(activeState, exit({ atS: 2000, tid: "tx" }));
      expect(r.next.kind).toBe("PENDING_EXIT");
      if (r.next.kind !== "PENDING_EXIT") throw new Error("unreachable");
      expect(r.next.entryId).toBe("entry-1");
      expect(r.next.confirmAtS).toBe(2180);
      expect(r.effects).toEqual([
        {
          kind: "persist_pending",
          transition: {
            id: "tx",
            placeId: PLACE_A,
            kind: "exit",
            regionEventAtS: 2000,
            confirmAtS: 2180,
          },
        },
      ]);
    });

    test("12. ACTIVE: duplicate REGION_ENTER (same place) is a no-op", () => {
      const r = step(activeState, enter({ atS: 1500 }));
      expect(r.next).toEqual(activeState);
      expect(r.effects).toEqual([]);
    });

    test("13. ACTIVE: REGION_ENTER for a different place closes current entry, pends new", () => {
      const r = step(activeState, enter({ placeId: PLACE_B, atS: 1600, tid: "tp-b" }));
      expect(r.next.kind).toBe("PENDING_ENTER");
      if (r.next.kind !== "PENDING_ENTER") throw new Error("unreachable");
      expect(r.next.placeId).toBe(PLACE_B);
      expect(r.effects[0]).toEqual({ kind: "close_entry", entryId: "entry-1", atS: 1600 });
      expect(r.effects[1]).toMatchObject({
        kind: "persist_pending",
        transition: { placeId: PLACE_B, kind: "enter" },
      });
    });

    test("14. ACTIVE: REGION_EXIT for a different place is ignored", () => {
      const r = step(activeState, exit({ placeId: PLACE_B, atS: 1800 }));
      expect(r.next).toEqual(activeState);
      expect(r.effects).toEqual([]);
    });

    test("15. ACTIVE: CONFIRM is a no-op (nothing pending)", () => {
      const r = step(activeState, confirm(3000));
      expect(r.next).toEqual(activeState);
      expect(r.effects).toEqual([]);
    });
  });

  describe("PENDING_EXIT", () => {
    function makePendingExit(): MachineState {
      return {
        kind: "PENDING_EXIT",
        placeId: PLACE_A,
        entryId: "entry-1",
        startedAtS: 1000,
        exitBufferS: EXIT_BUFFER,
        eventAtS: 2000,
        confirmAtS: 2180,
        transitionId: "tx",
      };
    }

    test("16. PENDING_EXIT → ACTIVE on REGION_ENTER before confirm (brief step-out)", () => {
      const s = makePendingExit();
      const r = step(s, enter({ atS: 2100 }));
      expect(r.next.kind).toBe("ACTIVE");
      if (r.next.kind !== "ACTIVE") throw new Error("unreachable");
      expect(r.next.entryId).toBe("entry-1");
      expect(r.next.startedAtS).toBe(1000);
      expect(r.effects).toEqual([
        { kind: "clear_pending", transitionId: "tx", outcome: "cancelled" },
      ]);
    });

    test("17. PENDING_EXIT → IDLE on CONFIRM after confirmAtS; closes entry at original exit time", () => {
      const s = makePendingExit();
      const r = step(s, confirm(2200));
      expect(r.next).toEqual(IDLE);
      expect(r.effects).toEqual([
        { kind: "close_entry", entryId: "entry-1", atS: 2000 }, // not 2200 — use exit event time
        { kind: "clear_pending", transitionId: "tx", outcome: "ended" },
      ]);
    });

    test("18. PENDING_EXIT: CONFIRM before confirmAtS is a no-op", () => {
      const s = makePendingExit();
      const r = step(s, confirm(2100));
      expect(r.next).toEqual(s);
      expect(r.effects).toEqual([]);
    });

    test("19. PENDING_EXIT: REGION_ENTER for different place closes current, pends new", () => {
      const s = makePendingExit();
      const r = step(s, enter({ placeId: PLACE_B, atS: 2050, tid: "tp-b" }));
      expect(r.next.kind).toBe("PENDING_ENTER");
      if (r.next.kind !== "PENDING_ENTER") throw new Error("unreachable");
      expect(r.next.placeId).toBe(PLACE_B);
      expect(r.effects).toEqual([
        { kind: "close_entry", entryId: "entry-1", atS: 2050 },
        { kind: "clear_pending", transitionId: "tx", outcome: "cancelled" },
        {
          kind: "persist_pending",
          transition: {
            id: "tp-b",
            placeId: PLACE_B,
            kind: "enter",
            regionEventAtS: 2050,
            confirmAtS: 2350,
          },
        },
      ]);
    });

    test("20. PENDING_EXIT: duplicate REGION_EXIT is a no-op", () => {
      const s = makePendingExit();
      const r = step(s, exit({ atS: 2050 }));
      expect(r.next).toEqual(s);
      expect(r.effects).toEqual([]);
    });
  });

  describe("Zig-zag and full cycles", () => {
    test("21. Zig-zag: IDLE → PENDING_ENTER → IDLE → PENDING_ENTER → ACTIVE only opens one entry", () => {
      let s: MachineState = IDLE;
      let openCount = 0;

      // Enter 1
      let r = step(s, enter({ atS: 1000, tid: "t1" }));
      s = r.next;
      openCount += r.effects.filter((e) => e.kind === "open_entry").length;

      // Exit before confirm
      r = step(s, exit({ atS: 1100 }));
      s = r.next;
      expect(s).toEqual(IDLE);
      openCount += r.effects.filter((e) => e.kind === "open_entry").length;

      // Enter 2
      r = step(s, enter({ atS: 2000, tid: "t2" }));
      s = r.next;
      openCount += r.effects.filter((e) => e.kind === "open_entry").length;

      // Confirm after buffer
      r = step(s, confirm(2500));
      s = r.next;
      openCount += r.effects.filter((e) => e.kind === "open_entry").length;

      expect(s.kind).toBe("ACTIVE");
      expect(openCount).toBe(1);
    });

    test("22. Full cycle: enter → confirm → active → exit → confirm → idle opens + closes exactly one entry", () => {
      let s: MachineState = IDLE;
      const allEffects: { kind: string }[] = [];

      let r = step(s, enter({ atS: 1000, tid: "t1" }));
      s = r.next;
      allEffects.push(...r.effects);

      r = step(s, confirm(1400));
      s = r.next;
      allEffects.push(...r.effects);

      r = step(s, exit({ atS: 3000, tid: "t2" }));
      s = r.next;
      allEffects.push(...r.effects);

      r = step(s, confirm(3200));
      s = r.next;
      allEffects.push(...r.effects);

      expect(s).toEqual(IDLE);
      expect(allEffects.filter((e) => e.kind === "open_entry")).toHaveLength(1);
      expect(allEffects.filter((e) => e.kind === "close_entry")).toHaveLength(1);
      expect(allEffects.filter((e) => e.kind === "persist_pending")).toHaveLength(2);
      expect(allEffects.filter((e) => e.kind === "clear_pending")).toHaveLength(2);
    });

    test("23. Step-out dance: active → pending-exit → active leaves one continuous entry", () => {
      let s: MachineState = {
        kind: "ACTIVE",
        placeId: PLACE_A,
        entryId: "entry-1",
        startedAtS: 1000,
      };
      const allEffects: { kind: string }[] = [];

      let r = step(s, exit({ atS: 2000, tid: "tx" }));
      s = r.next;
      allEffects.push(...r.effects);

      // Came back within buffer
      r = step(s, enter({ atS: 2050 }));
      s = r.next;
      allEffects.push(...r.effects);

      expect(s.kind).toBe("ACTIVE");
      if (s.kind !== "ACTIVE") throw new Error("unreachable");
      expect(s.entryId).toBe("entry-1");
      expect(s.startedAtS).toBe(1000);
      expect(allEffects.filter((e) => e.kind === "close_entry")).toHaveLength(0);
      expect(allEffects.filter((e) => e.kind === "open_entry")).toHaveLength(0);
    });

    test("24. Place A → Place B full handoff while ACTIVE closes A and opens B after its buffer", () => {
      let s: MachineState = {
        kind: "ACTIVE",
        placeId: PLACE_A,
        entryId: "entry-a",
        startedAtS: 1000,
      };
      const allEffects: { kind: string; entryId?: string; placeId?: string }[] = [];

      let r = step(s, enter({ placeId: PLACE_B, atS: 2000, tid: "tb" }));
      s = r.next;
      allEffects.push(...r.effects.map((e) => e as unknown as (typeof allEffects)[number]));

      // A was closed immediately on cross-place enter
      expect(
        allEffects.find((e) => e.kind === "close_entry" && e.entryId === "entry-a"),
      ).toBeDefined();

      r = step(s, confirm(2500));
      s = r.next;
      allEffects.push(...r.effects.map((e) => e as unknown as (typeof allEffects)[number]));

      expect(s.kind).toBe("ACTIVE");
      if (s.kind !== "ACTIVE") throw new Error("unreachable");
      expect(s.placeId).toBe(PLACE_B);
      expect(
        allEffects.find((e) => e.kind === "open_entry" && e.placeId === PLACE_B),
      ).toBeDefined();
    });

    test("25. CONFIRM in IDLE after unrelated noise stays IDLE", () => {
      let s: MachineState = IDLE;
      for (const e of [confirm(100), confirm(200), confirm(300)]) {
        const r = step(s, e);
        s = r.next;
        expect(r.effects).toEqual([]);
      }
      expect(s).toEqual(IDLE);
    });

    test("26. A long dwell with many late CONFIRMs in ACTIVE stays ACTIVE and emits no effects", () => {
      let s: MachineState = {
        kind: "ACTIVE",
        placeId: PLACE_A,
        entryId: "entry-1",
        startedAtS: 1000,
      };
      for (let i = 0; i < 5; i++) {
        const r = step(s, confirm(1500 + i * 100));
        s = r.next;
        expect(r.effects).toEqual([]);
      }
      expect(s.kind).toBe("ACTIVE");
    });
  });
});

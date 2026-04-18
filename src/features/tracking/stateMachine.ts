/**
 * Pure buffer state machine for geofence auto-tracking.
 *
 * The OS fires `ENTER` / `EXIT` events eagerly — often from weak GPS locks
 * that bounce across region boundaries. We don't trust a bare transition:
 * every event buffers for the place's `entryBufferS` / `exitBufferS` seconds
 * before becoming a real entry open / close. Drive-bys (enter followed by
 * quick exit) cancel themselves; brief step-outs (exit followed by re-enter)
 * collapse back to ACTIVE.
 *
 * This module is intentionally pure and I/O-free — the background task owns
 * DB persistence and effect application. Wrap every call in the persistence
 * layer's transaction and keyed on the `pending_transitions.id` for
 * exactly-once semantics. See `src/features/tracking/persistence.ts`.
 *
 * State flow:
 *   IDLE → PENDING_ENTER → ACTIVE → PENDING_EXIT → IDLE
 *     └──←──┘              └──←──┘
 *       (drive-by)          (brief step-out)
 */

export type MachineState =
  | { kind: "IDLE"; placeId: null }
  | {
      kind: "PENDING_ENTER";
      placeId: string;
      entryBufferS: number;
      eventAtS: number;
      confirmAtS: number;
      /** Opaque id of the `pending_transitions` row so the DB layer can clear it. */
      transitionId: string;
    }
  | {
      kind: "ACTIVE";
      placeId: string;
      entryId: string;
      startedAtS: number;
    }
  | {
      kind: "PENDING_EXIT";
      placeId: string;
      entryId: string;
      startedAtS: number;
      exitBufferS: number;
      eventAtS: number;
      confirmAtS: number;
      transitionId: string;
    };

export type Event =
  | {
      kind: "REGION_ENTER";
      placeId: string;
      atS: number;
      entryBufferS: number;
      transitionId: string;
    }
  | { kind: "REGION_EXIT"; placeId: string; atS: number; exitBufferS: number; transitionId: string }
  /** Opportunistic resolve: fires on any location wake; promotes any PENDING_* whose confirmAt has passed. */
  | { kind: "CONFIRM"; atS: number };

export type Effect =
  | { kind: "open_entry"; placeId: string; atS: number }
  | { kind: "close_entry"; entryId: string; atS: number }
  | {
      kind: "persist_pending";
      transition: {
        id: string;
        placeId: string;
        kind: "enter" | "exit";
        regionEventAtS: number;
        confirmAtS: number;
      };
    }
  | { kind: "clear_pending"; transitionId: string; outcome: "started" | "ended" | "cancelled" };

export const IDLE: MachineState = { kind: "IDLE", placeId: null };

export type StepResult = { next: MachineState; effects: Effect[] };

/**
 * Pure transition function. Never mutates, never touches DB, never posts
 * notifications — just computes the next state and the effects the caller
 * should apply. The background task is responsible for turning
 * `open_entry` / `close_entry` effects into notifications.
 */
export function step(state: MachineState, event: Event): StepResult {
  switch (state.kind) {
    case "IDLE":
      return stepFromIdle(state, event);
    case "PENDING_ENTER":
      return stepFromPendingEnter(state, event);
    case "ACTIVE":
      return stepFromActive(state, event);
    case "PENDING_EXIT":
      return stepFromPendingExit(state, event);
  }
}

function stepFromIdle(state: MachineState & { kind: "IDLE" }, event: Event): StepResult {
  switch (event.kind) {
    case "REGION_ENTER": {
      const confirmAtS = event.atS + event.entryBufferS;
      return {
        next: {
          kind: "PENDING_ENTER",
          placeId: event.placeId,
          entryBufferS: event.entryBufferS,
          eventAtS: event.atS,
          confirmAtS,
          transitionId: event.transitionId,
        },
        effects: [
          {
            kind: "persist_pending",
            transition: {
              id: event.transitionId,
              placeId: event.placeId,
              kind: "enter",
              regionEventAtS: event.atS,
              confirmAtS,
            },
          },
        ],
      };
    }
    // EXIT in IDLE is a phantom event (OS fired exit for a region we weren't tracking). Ignore.
    case "REGION_EXIT":
      return { next: state, effects: [] };
    case "CONFIRM":
      return { next: state, effects: [] };
  }
}

function stepFromPendingEnter(
  state: MachineState & { kind: "PENDING_ENTER" },
  event: Event,
): StepResult {
  switch (event.kind) {
    case "REGION_EXIT":
      // Drive-by. Cancel the pending enter without opening an entry.
      if (event.placeId !== state.placeId) {
        // Exit for a different place while pending enter — treat as IDLE for that place,
        // stay in current pending state (OS likely noise).
        return { next: state, effects: [] };
      }
      return {
        next: IDLE,
        effects: [
          { kind: "clear_pending", transitionId: state.transitionId, outcome: "cancelled" },
        ],
      };
    case "REGION_ENTER":
      // Duplicate enter for same place: noop.
      if (event.placeId === state.placeId) return { next: state, effects: [] };
      // Enter for a different place while still pending the first:
      // cancel the first, start pending for the second. (Rare — user walked
      // past one place and straight into another.)
      {
        const confirmAtS = event.atS + event.entryBufferS;
        return {
          next: {
            kind: "PENDING_ENTER",
            placeId: event.placeId,
            entryBufferS: event.entryBufferS,
            eventAtS: event.atS,
            confirmAtS,
            transitionId: event.transitionId,
          },
          effects: [
            { kind: "clear_pending", transitionId: state.transitionId, outcome: "cancelled" },
            {
              kind: "persist_pending",
              transition: {
                id: event.transitionId,
                placeId: event.placeId,
                kind: "enter",
                regionEventAtS: event.atS,
                confirmAtS,
              },
            },
          ],
        };
      }
    case "CONFIRM":
      if (event.atS < state.confirmAtS) {
        // Too early — the user hasn't dwelled long enough yet.
        return { next: state, effects: [] };
      }
      return {
        next: {
          kind: "ACTIVE",
          placeId: state.placeId,
          // Real entryId is assigned by the persistence layer; use a stable
          // placeholder here so the pure reducer stays deterministic. The
          // DB transaction replaces it atomically when it inserts the row.
          entryId: `pending:${state.transitionId}`,
          startedAtS: state.eventAtS,
        },
        effects: [
          { kind: "open_entry", placeId: state.placeId, atS: state.eventAtS },
          { kind: "clear_pending", transitionId: state.transitionId, outcome: "started" },
        ],
      };
  }
}

function stepFromActive(state: MachineState & { kind: "ACTIVE" }, event: Event): StepResult {
  switch (event.kind) {
    case "REGION_EXIT":
      if (event.placeId !== state.placeId) return { next: state, effects: [] };
      {
        const confirmAtS = event.atS + event.exitBufferS;
        return {
          next: {
            kind: "PENDING_EXIT",
            placeId: state.placeId,
            entryId: state.entryId,
            startedAtS: state.startedAtS,
            exitBufferS: event.exitBufferS,
            eventAtS: event.atS,
            confirmAtS,
            transitionId: event.transitionId,
          },
          effects: [
            {
              kind: "persist_pending",
              transition: {
                id: event.transitionId,
                placeId: state.placeId,
                kind: "exit",
                regionEventAtS: event.atS,
                confirmAtS,
              },
            },
          ],
        };
      }
    case "REGION_ENTER":
      // Enter same place: duplicate (already active), noop.
      if (event.placeId === state.placeId) return { next: state, effects: [] };
      // Enter a different place while ACTIVE at the first. Per spec: close
      // the first entry, start pending-enter for the second.
      {
        const confirmAtS = event.atS + event.entryBufferS;
        return {
          next: {
            kind: "PENDING_ENTER",
            placeId: event.placeId,
            entryBufferS: event.entryBufferS,
            eventAtS: event.atS,
            confirmAtS,
            transitionId: event.transitionId,
          },
          effects: [
            { kind: "close_entry", entryId: state.entryId, atS: event.atS },
            {
              kind: "persist_pending",
              transition: {
                id: event.transitionId,
                placeId: event.placeId,
                kind: "enter",
                regionEventAtS: event.atS,
                confirmAtS,
              },
            },
          ],
        };
      }
    case "CONFIRM":
      // No pending transition to resolve while ACTIVE.
      return { next: state, effects: [] };
  }
}

function stepFromPendingExit(
  state: MachineState & { kind: "PENDING_EXIT" },
  event: Event,
): StepResult {
  switch (event.kind) {
    case "REGION_ENTER":
      if (event.placeId === state.placeId) {
        // Brief step-out: user came back before the exit buffer expired.
        return {
          next: {
            kind: "ACTIVE",
            placeId: state.placeId,
            entryId: state.entryId,
            startedAtS: state.startedAtS,
          },
          effects: [
            { kind: "clear_pending", transitionId: state.transitionId, outcome: "cancelled" },
          ],
        };
      }
      // Enter of a different place while pending exit of the current:
      // close current entry, start pending-enter for the new place.
      {
        const confirmAtS = event.atS + event.entryBufferS;
        return {
          next: {
            kind: "PENDING_ENTER",
            placeId: event.placeId,
            entryBufferS: event.entryBufferS,
            eventAtS: event.atS,
            confirmAtS,
            transitionId: event.transitionId,
          },
          effects: [
            { kind: "close_entry", entryId: state.entryId, atS: event.atS },
            { kind: "clear_pending", transitionId: state.transitionId, outcome: "cancelled" },
            {
              kind: "persist_pending",
              transition: {
                id: event.transitionId,
                placeId: event.placeId,
                kind: "enter",
                regionEventAtS: event.atS,
                confirmAtS,
              },
            },
          ],
        };
      }
    case "REGION_EXIT":
      // Duplicate exit for the same place (rare OS hiccup): ignore.
      return { next: state, effects: [] };
    case "CONFIRM":
      if (event.atS < state.confirmAtS) return { next: state, effects: [] };
      return {
        next: IDLE,
        effects: [
          { kind: "close_entry", entryId: state.entryId, atS: state.eventAtS },
          { kind: "clear_pending", transitionId: state.transitionId, outcome: "ended" },
        ],
      };
  }
}

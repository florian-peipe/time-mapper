import type { EntriesRepo } from "@/db/repository/entries";
import type { PendingTransitionsRepo } from "@/db/repository/pending";
import type { Effect, MachineState } from "./stateMachine";
import { IDLE } from "./stateMachine";

/**
 * Hydrates the state machine's current state from DB-persisted rows. Given a
 * unique latest unresolved pending transition (if any) and the latest
 * ongoing entry (if any), reconstruct the in-memory state.
 *
 * Combinations and what they mean:
 *   (none pending, no ongoing entry)        → IDLE
 *   (pending enter, no ongoing entry)       → PENDING_ENTER
 *   (none pending, ongoing entry)           → ACTIVE
 *   (pending exit, ongoing entry)           → PENDING_EXIT
 *   (pending enter, ongoing entry)          → inconsistent; trust DB ACTIVE
 *   (pending exit, no ongoing entry)        → inconsistent; drop the pending, → IDLE
 */
export function loadState(
  entriesRepo: EntriesRepo,
  pendingRepo: PendingTransitionsRepo,
): MachineState {
  const pending = pendingRepo.getLatestUnresolved();
  const ongoing = entriesRepo.ongoing();

  if (!pending && !ongoing) return IDLE;

  if (pending && pending.kind === "enter" && !ongoing) {
    return {
      kind: "PENDING_ENTER",
      placeId: pending.placeId,
      entryBufferS: pending.confirmAt - pending.regionEventAt,
      eventAtS: pending.regionEventAt,
      confirmAtS: pending.confirmAt,
      transitionId: pending.id,
    };
  }

  if (!pending && ongoing) {
    return {
      kind: "ACTIVE",
      placeId: ongoing.placeId,
      entryId: ongoing.id,
      startedAtS: ongoing.startedAt,
    };
  }

  if (pending && pending.kind === "exit" && ongoing) {
    return {
      kind: "PENDING_EXIT",
      placeId: ongoing.placeId,
      entryId: ongoing.id,
      startedAtS: ongoing.startedAt,
      exitBufferS: pending.confirmAt - pending.regionEventAt,
      eventAtS: pending.regionEventAt,
      confirmAtS: pending.confirmAt,
      transitionId: pending.id,
    };
  }

  // Inconsistent state. Favor the ongoing entry (source of truth — pending
  // rows are transient) and resolve the stray pending as cancelled.
  if (pending && ongoing) {
    pendingRepo.resolve(pending.id, "cancelled", Math.floor(Date.now() / 1000));
    return {
      kind: "ACTIVE",
      placeId: ongoing.placeId,
      entryId: ongoing.id,
      startedAtS: ongoing.startedAt,
    };
  }

  // pending exit but no ongoing entry — the entry was deleted or the row is
  // stale. Drop the pending row and fall back to IDLE.
  if (pending && !ongoing) {
    pendingRepo.resolve(pending.id, "cancelled", Math.floor(Date.now() / 1000));
  }
  return IDLE;
}

/**
 * Apply the reducer's effects to the DB. The state machine produces effects
 * in deterministic order; this module executes them transactionally where
 * the underlying driver supports it. Writes the true `entry.id` back into
 * the machine state on `open_entry` (replacing the `pending:<tid>`
 * placeholder the reducer uses for determinism).
 *
 * Returns the final state, with any entryId placeholders replaced.
 */
export function applyEffects(
  effects: Effect[],
  nextState: MachineState,
  entriesRepo: EntriesRepo,
  pendingRepo: PendingTransitionsRepo,
  nowS: number = Math.floor(Date.now() / 1000),
): MachineState {
  let resolved: MachineState = nextState;

  for (const eff of effects) {
    switch (eff.kind) {
      case "persist_pending": {
        const t = eff.transition;
        // Guard against duplicate insert (exactly-once semantics).
        if (pendingRepo.get(t.id)) break;
        pendingRepo.insert({
          id: t.id,
          placeId: t.placeId,
          kind: t.kind,
          regionEventAt: t.regionEventAtS,
          confirmAt: t.confirmAtS,
        });
        break;
      }
      case "clear_pending":
        pendingRepo.resolve(eff.transitionId, eff.outcome, nowS);
        break;
      case "open_entry": {
        const entry = entriesRepo.open({
          placeId: eff.placeId,
          source: "auto",
          startedAt: eff.atS,
        });
        // Replace the reducer's `pending:<tid>` placeholder with the real id.
        // Only PENDING_ENTER → ACTIVE emits open_entry, so `resolved.kind`
        // is always "ACTIVE" when we get here.
        if (resolved.kind === "ACTIVE" && resolved.entryId.startsWith("pending:")) {
          resolved = { ...resolved, entryId: entry.id };
        }
        break;
      }
      case "close_entry": {
        // Prefer explicit close-at-timestamp rather than "now" so the entry's
        // endedAt matches the geofence exit time recorded by the state
        // machine. The reducer passes the exit event's atS for this reason.
        entriesRepo.closeAt(eff.entryId, eff.atS);
        break;
      }
    }
  }
  return resolved;
}

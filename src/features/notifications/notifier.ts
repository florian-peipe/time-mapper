import type { Effect } from "@/features/tracking/stateMachine";
import type { PlacesRepo } from "@/db/repository/places";

/**
 * Notification surface for the tracking engine. Called by the background
 * task with the effects it applied; decides whether to surface anything.
 *
 * The body is stubbed here and filled in in a later commit — the signature
 * is stable so the background task can import against it today.
 */
export async function maybeNotifyForEffects(
  _effects: Effect[],
  _placesRepo: PlacesRepo,
  _nowS: number,
): Promise<void> {
  // No-op in this commit; replaced by the real notifier in the next.
}

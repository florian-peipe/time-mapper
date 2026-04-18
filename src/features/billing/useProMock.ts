import { create } from "zustand";

/**
 * Mock Pro-entitlement store for Plan 2. Plan 4 replaces the implementation of
 * `useProMock` with a RevenueCat-backed version that exposes the same
 * `{ isPro, grant, revoke }` shape so call sites remain unchanged.
 */
type ProState = {
  isPro: boolean;
  grant: () => void;
  revoke: () => void;
};

const useProStore = create<ProState>((set) => ({
  isPro: false,
  grant: () => set({ isPro: true }),
  revoke: () => set({ isPro: false }),
}));

export function useProMock() {
  const isPro = useProStore((s) => s.isPro);
  const grant = useProStore((s) => s.grant);
  const revoke = useProStore((s) => s.revoke);
  return { isPro, grant, revoke };
}

/** Test-only helper that resets the store back to the free default. */
export function resetProMock() {
  useProStore.setState({ isPro: false });
}

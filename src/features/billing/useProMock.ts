import { create } from "zustand";

/**
 * In-memory Pro-entitlement store used when RevenueCat is in mock mode
 * (no API keys). `usePro()` delegates to this so the rest of the app
 * sees the same `{ isPro, grant, revoke }` shape regardless of mode.
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

/** Test-only helper that flips Pro on without needing to render a component. */
export function grantProMock() {
  useProStore.setState({ isPro: true });
}

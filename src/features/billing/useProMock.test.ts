import { act, renderHook } from "@testing-library/react-native";
import { resetProMock, useProMock } from "./useProMock";

beforeEach(() => resetProMock());

describe("useProMock", () => {
  it("starts as free", () => {
    const { result } = renderHook(() => useProMock());
    expect(result.current.isPro).toBe(false);
  });

  it("grant() flips to pro; revoke() flips back", () => {
    const { result } = renderHook(() => useProMock());
    act(() => result.current.grant());
    expect(result.current.isPro).toBe(true);
    act(() => result.current.revoke());
    expect(result.current.isPro).toBe(false);
  });

  it("shares state across hook instances", () => {
    const a = renderHook(() => useProMock());
    const b = renderHook(() => useProMock());
    act(() => a.result.current.grant());
    expect(b.result.current.isPro).toBe(true);
  });

  it("resetProMock() returns to the free default", () => {
    const { result } = renderHook(() => useProMock());
    act(() => result.current.grant());
    expect(result.current.isPro).toBe(true);
    act(() => resetProMock());
    expect(result.current.isPro).toBe(false);
  });
});

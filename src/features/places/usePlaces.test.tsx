import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { createTestDb } from "@/db/testClient";
import { PlacesRepo } from "@/db/repository/places";
import { PlacesRepoProvider, usePlaces } from "./usePlaces";

function setup() {
  const db = createTestDb();
  let now = 1_700_000_000;
  const repo = new PlacesRepo(db, { now: () => now });
  const advance = (s: number) => {
    now += s;
  };
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <PlacesRepoProvider value={repo}>{children}</PlacesRepoProvider>
  );
  return { repo, wrapper, advance };
}

describe("usePlaces", () => {
  it("returns an empty list after initial load", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => usePlaces(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.places).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it("lists places already in the repo on mount", async () => {
    const { repo, wrapper } = setup();
    repo.create({ name: "Home", address: "", latitude: 0, longitude: 0 });
    const { result } = renderHook(() => usePlaces(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.places.map((p) => p.name)).toEqual(["Home"]);
    expect(result.current.count).toBe(1);
  });

  it("create() inserts and refreshes the list", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => usePlaces(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      result.current.create({ name: "Work", address: "K 3", latitude: 50.9, longitude: 6.9 });
    });
    await waitFor(() => expect(result.current.places.length).toBe(1));
    const first = result.current.places[0];
    expect(first?.name).toBe("Work");
    expect(result.current.count).toBe(1);
  });

  it("update() patches a place and refreshes", async () => {
    const { repo, wrapper, advance } = setup();
    const created = repo.create({ name: "Gym", address: "", latitude: 0, longitude: 0 });
    const { result } = renderHook(() => usePlaces(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    advance(10);
    await act(async () => {
      result.current.update(created.id, { name: "Fitness" });
    });
    await waitFor(() => expect(result.current.places[0]?.name).toBe("Fitness"));
  });

  it("remove() soft-deletes and drops from the list", async () => {
    const { repo, wrapper } = setup();
    const created = repo.create({ name: "Cafe", address: "", latitude: 0, longitude: 0 });
    const { result } = renderHook(() => usePlaces(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.places.length).toBe(1);
    await act(async () => {
      result.current.remove(created.id);
    });
    await waitFor(() => expect(result.current.places.length).toBe(0));
    expect(result.current.count).toBe(0);
  });

  it("refresh() re-queries on demand (picks up external writes)", async () => {
    const { repo, wrapper } = setup();
    const { result } = renderHook(() => usePlaces(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    // External mutation outside the hook
    repo.create({ name: "Park", address: "", latitude: 0, longitude: 0 });
    expect(result.current.places.length).toBe(0);
    await act(async () => {
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.places.length).toBe(1));
  });
});

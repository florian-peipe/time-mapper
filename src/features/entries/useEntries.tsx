import React, { createContext, useContext, useMemo } from "react";
import { EntriesRepo } from "@/db/repository/entries";
import { createDeviceRepo } from "@/db/deviceDb";

const EntriesRepoContext = createContext<EntriesRepo | null>(null);

export function EntriesRepoProvider({
  value,
  children,
}: {
  value: EntriesRepo;
  children: React.ReactNode;
}) {
  return <EntriesRepoContext.Provider value={value}>{children}</EntriesRepoContext.Provider>;
}

const getDeviceRepo = createDeviceRepo((db) => new EntriesRepo(db));

export function useEntriesRepo(): EntriesRepo {
  const injected = useContext(EntriesRepoContext);
  return useMemo(() => injected ?? getDeviceRepo(), [injected]);
}

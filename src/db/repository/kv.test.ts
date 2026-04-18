import { createTestDb } from "../testClient";
import { KvRepo } from "./kv";

describe("KvRepo", () => {
  it("round-trips values", () => {
    const repo = new KvRepo(createTestDb());
    expect(repo.get("onboarding.complete")).toBeNull();
    repo.set("onboarding.complete", "1");
    expect(repo.get("onboarding.complete")).toBe("1");
    repo.set("onboarding.complete", "0");
    expect(repo.get("onboarding.complete")).toBe("0");
    repo.delete("onboarding.complete");
    expect(repo.get("onboarding.complete")).toBeNull();
  });
});

import fs from "node:fs";
import path from "node:path";

// Read migrations.js source to verify it follows the expected shape without
// actually importing .sql (which Metro+babel handle at bundle time on device).
const MIGRATIONS_JS = path.join(__dirname, "..", "migrations", "migrations.js");
const JOURNAL = path.join(__dirname, "..", "migrations", "meta", "_journal.json");

describe("migrations.js bundle shape", () => {
  it("imports the SQL file drizzle-kit emitted", () => {
    const src = fs.readFileSync(MIGRATIONS_JS, "utf8");
    expect(src).toMatch(/from ['"]\.\/0000_init\.sql['"]/);
    expect(src).toMatch(/journal/);
    expect(src).toMatch(/migrations:\s*{/);
  });

  it("journal references 0000_init tag", () => {
    const journal = JSON.parse(fs.readFileSync(JOURNAL, "utf8"));
    expect(journal.entries).toBeInstanceOf(Array);
    expect(journal.entries.length).toBeGreaterThanOrEqual(1);
    expect(journal.entries[0].tag).toBe("0000_init");
  });
});

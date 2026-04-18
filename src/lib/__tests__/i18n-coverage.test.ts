import fs from "node:fs";
import path from "node:path";
import en from "@/locales/en.json";
import de from "@/locales/de.json";

const ROOTS = [
  path.resolve(__dirname, "..", ".."), // src/
  path.resolve(__dirname, "..", "..", "..", "app"), // app/
];

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      if (name === "__tests__" || name === "node_modules" || name.startsWith(".")) continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

function collectKeys(source: string): Set<string> {
  const keys = new Set<string>();
  const re = /i18n\.t\(\s*["'`]([^"'`]+)["'`]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) keys.add(m[1]!);
  return keys;
}

describe("i18n key coverage", () => {
  const files = ROOTS.flatMap((r) => walk(r));
  const allKeys = new Set<string>();
  for (const f of files) {
    for (const k of collectKeys(fs.readFileSync(f, "utf8"))) allKeys.add(k);
  }

  it("finds at least one i18n key in source", () => {
    expect(allKeys.size).toBeGreaterThan(0);
  });

  it("every used key exists in en.json", () => {
    const enKeys = Object.keys(en as Record<string, string>);
    const missing = [...allKeys].filter((k) => !enKeys.includes(k));
    expect(missing).toEqual([]);
  });

  it("every used key exists in de.json", () => {
    const deKeys = Object.keys(de as Record<string, string>);
    const missing = [...allKeys].filter((k) => !deKeys.includes(k));
    expect(missing).toEqual([]);
  });
});

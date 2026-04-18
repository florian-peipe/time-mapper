import fs from "node:fs";
import path from "node:path";
import en from "@/locales/en.json";
import de from "@/locales/de.json";

const ROOTS = [
  path.resolve(__dirname, "..", ".."), // src/
  path.resolve(__dirname, "..", "..", "..", "app"), // app/
];

/** Relative-path suffix → reason. These files are allowed to carry inline copy. */
const UNTRANSLATED_ALLOWLIST: { suffix: string; reason: string }[] = [
  // Background task code — no user-facing UI.
  { suffix: "features/tracking/", reason: "background tracking (no UI strings)" },
  {
    suffix: "features/notifications/",
    reason: "internal notifier — uses i18n through the notifier.*.* keys",
  },
  // Repository + schema + migration code.
  { suffix: "db/", reason: "persistence layer (no UI strings)" },
  // Theme tokens + design-system literal color/type values.
  { suffix: "theme/tokens", reason: "design-system tokens (no UI strings)" },
  // LegalScreen's `documents.ts` contains the legal copy inline by design —
  // translation-source for the legal surfaces.
  { suffix: "screens/Legal/documents", reason: "legal copy source" },
  // Diagnostics payload + helpers — dev-only copy, not user-facing.
  { suffix: "features/diagnostics/", reason: "dev-only diagnostic log" },
  // Autocomplete demo suggestion seed — German addresses, intentional.
  { suffix: "lib/geocode", reason: "hardcoded demo suggestions (place names)" },
  // i18n-lib plumbing.
  { suffix: "lib/i18n", reason: "i18n plumbing" },
  // Shared primitives — no copy of their own.
  { suffix: "components/", reason: "primitive components — copy passes through props" },
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

/**
 * Heuristic check: look for JSX `<Text>...ASCII-only capitalized words...</Text>`
 * inside files under `src/screens/**`. If we find any, and the file isn't on
 * the allowlist, that's an untranslated string. Low-precision, high-recall —
 * we can always expand the allowlist when a false positive shows up.
 */
function findInlineText(source: string): string[] {
  const hits: string[] = [];
  // Match Text elements whose content contains at least 3 English words.
  // Deliberately skips template literals, interpolations, and single-word
  // tokens which are often identifiers or captions.
  const re = />\s*([A-Z][a-z]+(?:\s+[A-Za-z][a-z]+){2,}[.?!]?)\s*</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const text = m[1]!.trim();
    // Skip i18n.t(...) output captured by the JSX minus-tag regex — those
    // don't look like plain words (they'd contain `{`, `}`, or `.t(`).
    if (text.includes("{") || text.includes("}")) continue;
    hits.push(text);
  }
  return hits;
}

function isAllowlisted(relPath: string): boolean {
  const norm = relPath.replace(/\\/g, "/");
  return UNTRANSLATED_ALLOWLIST.some((entry) => norm.includes(entry.suffix));
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

  it("en.json and de.json have the same set of keys (symmetric coverage)", () => {
    const enKeys = new Set(Object.keys(en as Record<string, string>));
    const deKeys = new Set(Object.keys(de as Record<string, string>));
    const enOnly = [...enKeys].filter((k) => !deKeys.has(k));
    const deOnly = [...deKeys].filter((k) => !enKeys.has(k));
    expect({ enOnly, deOnly }).toEqual({ enOnly: [], deOnly: [] });
  });

  it("no English key's value is identical to a non-proper-noun German value (spot check)", () => {
    // Stronger test: if EN and DE values are identical AND the value is more
    // than one word AND doesn't look like a proper noun, flag it — the DE
    // translation is probably still the English source. Proper nouns (single
    // words, brand names) can match intentionally ("Pro", "Time Mapper").
    const enMap = en as Record<string, string>;
    const deMap = de as Record<string, string>;
    const suspicious: { key: string; value: string }[] = [];
    for (const [k, v] of Object.entries(enMap)) {
      const dv = deMap[k];
      if (!dv || dv !== v) continue;
      const words = v.split(/\s+/).filter(Boolean);
      if (words.length < 3) continue;
      // Strings that are essentially placeholder templates (interpolation
      // tokens joined by a separator like " · ") are identical in every
      // locale by design. Same for "Time Mapper" brand strings.
      if (/^Time Mapper/.test(v)) continue;
      if (/^\{\{.*\}\}/.test(v) && v.replace(/\{\{[^}]+\}\}/g, "").trim().length <= 2) continue;
      suspicious.push({ key: k, value: v });
    }
    expect(suspicious).toEqual([]);
  });

  it("no screen file contains obvious untranslated inline <Text>English sentences</Text>", () => {
    const offenders: { file: string; text: string }[] = [];
    for (const f of files) {
      // Only audit files that render UI (screens + app/ routes).
      const norm = f.replace(/\\/g, "/");
      if (!/\/screens\//.test(norm) && !/\/app\//.test(norm)) continue;
      if (isAllowlisted(f)) continue;
      const hits = findInlineText(fs.readFileSync(f, "utf8"));
      for (const t of hits) {
        offenders.push({ file: norm, text: t });
      }
    }
    // If this fails you'll see the exact file + sentence — wrap them in
    // i18n.t() or add to the allowlist (with a reason).
    expect(offenders).toEqual([]);
  });
});

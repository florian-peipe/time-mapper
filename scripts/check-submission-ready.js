#!/usr/bin/env node
/**
 * Pre-submit sanity check — fails if the repo still has placeholder values
 * that would make an `eas submit --profile production` attempt fail review.
 *
 * Run manually:   node scripts/check-submission-ready.js
 * Or via npm:     npm run check:submit
 *
 * Exit codes:
 *   0  all checks passed (safe to submit)
 *   1  one or more blockers — see stderr
 */

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const problems = [];

function fail(msg) {
  problems.push(msg);
}

function readFile(rel) {
  try {
    return fs.readFileSync(path.join(repoRoot, rel), "utf8");
  } catch {
    return null;
  }
}

// 1. eas.json production submit credentials must not contain placeholders.
{
  const easJson = readFile("eas.json");
  if (!easJson) {
    fail("eas.json missing");
  } else {
    const placeholderPatterns = [
      /YOUR_APPLE_ID_EMAIL/,
      /YOUR_APP_STORE_CONNECT_APP_ID/,
      /YOUR_APPLE_TEAM_ID/,
    ];
    for (const p of placeholderPatterns) {
      if (p.test(easJson)) {
        fail(
          `eas.json still contains placeholder ${p.source}. Fill real values before submitting.`,
        );
      }
    }
  }
}

// 2. Play service-account JSON must exist (referenced from eas.json).
if (!fs.existsSync(path.join(repoRoot, "play-service-account.json"))) {
  fail(
    "play-service-account.json missing. Download from Play Console → API access → Service accounts → Create key.",
  );
}

// 3. Legal contact must exist and must NOT be the example template.
{
  const contactPath = path.join(repoRoot, "src", "screens", "Legal", "contact.local.ts");
  if (!fs.existsSync(contactPath)) {
    fail(
      "src/screens/Legal/contact.local.ts missing. Copy contact.local.example.ts and fill with real Impressum details (§5 TMG).",
    );
  } else {
    const contents = fs.readFileSync(contactPath, "utf8");
    if (/EXAMPLE|YOUR_|REPLACE_ME/i.test(contents)) {
      fail(
        "src/screens/Legal/contact.local.ts still has placeholder tokens (EXAMPLE / YOUR_ / REPLACE_ME).",
      );
    }
  }
}

// 4. Store metadata string lengths.
{
  const metadataPath = path.join(repoRoot, "store", "ios", "metadata.yaml");
  if (!fs.existsSync(metadataPath)) {
    fail("store/ios/metadata.yaml missing");
  } else {
    const contents = fs.readFileSync(metadataPath, "utf8");
    // iOS App Store Connect limits:
    //   subtitle: 30 characters
    //   promotionalText: 170 characters
    //   keywords: 100 characters
    //   description: 4000 characters
    const limits = [
      { key: "subtitle", max: 30 },
      { key: "promotionalText", max: 170 },
      { key: "keywords", max: 100 },
    ];
    for (const { key, max } of limits) {
      const re = new RegExp(`^\\s{4,}${key}:\\s*"([^"]*)"`, "gm");
      let m;
      while ((m = re.exec(contents)) !== null) {
        const val = m[1] ?? "";
        if (val.length > max) {
          fail(
            `store/ios/metadata.yaml: "${key}" exceeds ${max} chars (actual ${val.length}): "${val.slice(0, 40)}…"`,
          );
        }
      }
    }
    if (/YOUR_FIRST_NAME|YOUR_LAST_NAME|\+49_XXX/.test(contents)) {
      fail("store/ios/metadata.yaml contact block still has placeholder values.");
    }
  }
}

// 5. Store metadata URLs must not still point at the unregistered timemapper.app domain.
{
  const files = ["store/ios/metadata.yaml", "store/android/metadata.yaml"];
  for (const rel of files) {
    const contents = readFile(rel);
    if (contents && /https?:\/\/timemapper\.app/.test(contents)) {
      fail(
        `${rel} still references timemapper.app (unregistered domain). Replace with the real hosted URL before submitting.`,
      );
    }
  }
}

// 6. .env.local must exist with the keys we expect at build time.
{
  const envPath = path.join(repoRoot, ".env.local");
  if (!fs.existsSync(envPath)) {
    fail(".env.local missing. Copy .env.example and fill the keys you have.");
  }
}

// 7. Android Maps API key — optional, but we warn if absent on Android builds.
{
  const appJson = readFile("app.json");
  if (appJson) {
    if (/"apiKey":\s*""/.test(appJson) || /"apiKey":\s*"YOUR_/.test(appJson)) {
      console.warn(
        "[check:submit] app.json → android.config.googleMaps.apiKey is blank — Android map preview will fall back to the 'unavailable' banner.",
      );
    }
  }
}

if (problems.length > 0) {
  console.error("\nPre-submit check FAILED:\n");
  for (const p of problems) console.error("  ✗ " + p);
  console.error(
    `\n${problems.length} blocker${problems.length === 1 ? "" : "s"} — fix before running \`eas submit\`.\n`,
  );
  process.exit(1);
}

console.log("pre-submit check: all green — safe to run `eas submit`.");

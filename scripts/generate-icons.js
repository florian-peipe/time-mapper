// One-time app-icon generator. Writes:
//   - assets/icon.png              (1024×1024, solid bg + concentric rings)
//   - assets/adaptive-icon.png     (1024×1024, same composition, ≥67% safe area)
//   - assets/splash-icon.png       (1024×1024, same composition)
//   - assets/favicon.png           (48×48, web)
//
// Brand: solid accent #FF6A3D background + white concentric rings
// centered. Three rings at 30/50/70% of the canvas radius, stroke ≈ 4%
// of canvas.
//
// Only depends on `pngjs` which is already a transitive dep. Run:
//   node scripts/generate-icons.js

const { PNG } = require("pngjs");
const fs = require("node:fs");
const path = require("node:path");

// Brand accent (light-theme token `color.accent` / #FF6A3D).
const BG = { r: 0xff, g: 0x6a, b: 0x3d, a: 0xff };
const FG = { r: 0xff, g: 0xff, b: 0xff, a: 0xff };
// Transparent pixel — used for `favicon.png` alpha edges.
const CLEAR = { r: 0, g: 0, b: 0, a: 0 };

/**
 * Paint `canvas` pixel at (x, y) with RGBA tuple.
 */
function setPixel(png, x, y, color) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx + 0] = color.r;
  png.data[idx + 1] = color.g;
  png.data[idx + 2] = color.b;
  png.data[idx + 3] = color.a;
}

/**
 * Paint a filled disc (not a ring) of the given color, centered.
 */
function fillDisc(png, cx, cy, radius, color) {
  const rSq = radius * radius;
  const xMin = Math.max(0, Math.floor(cx - radius));
  const xMax = Math.min(png.width - 1, Math.ceil(cx + radius));
  const yMin = Math.max(0, Math.floor(cy - radius));
  const yMax = Math.min(png.height - 1, Math.ceil(cy + radius));
  for (let y = yMin; y <= yMax; y += 1) {
    for (let x = xMin; x <= xMax; x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= rSq) setPixel(png, x, y, color);
    }
  }
}

/**
 * Paint a circle outline (stroke centered on `radius`, thickness `stroke`).
 */
function strokeCircle(png, cx, cy, radius, stroke, color) {
  const outer = radius + stroke / 2;
  const inner = Math.max(0, radius - stroke / 2);
  const oSq = outer * outer;
  const iSq = inner * inner;
  const xMin = Math.max(0, Math.floor(cx - outer));
  const xMax = Math.min(png.width - 1, Math.ceil(cx + outer));
  const yMin = Math.max(0, Math.floor(cy - outer));
  const yMax = Math.min(png.height - 1, Math.ceil(cy + outer));
  for (let y = yMin; y <= yMax; y += 1) {
    for (let x = xMin; x <= xMax; x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= oSq && d2 >= iSq) setPixel(png, x, y, color);
    }
  }
}

function fillBackground(png, color) {
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) setPixel(png, x, y, color);
  }
}

/**
 * Paint the brand mark — three concentric rings + a filled center dot — onto
 * an existing canvas. `safeInset` is a multiplier on the canvas radius (1.0
 * = fill; 0.72 = Android adaptive safe area).
 */
function paintBrandMark(png, safeInset = 1.0) {
  const cx = png.width / 2;
  const cy = png.height / 2;
  // Scale the rings to live inside the safe-area circle.
  const maxR = (Math.min(png.width, png.height) / 2) * safeInset;
  const stroke = Math.max(2, Math.round(maxR * 0.08)); // 8% of radius, min 2px

  strokeCircle(png, cx, cy, maxR * 0.75, stroke, FG);
  strokeCircle(png, cx, cy, maxR * 0.55, stroke, FG);
  strokeCircle(png, cx, cy, maxR * 0.35, stroke, FG);
  fillDisc(png, cx, cy, maxR * 0.1, FG);
}

function generate(filename, size, { transparent = false, safeInset = 1.0 } = {}) {
  const png = new PNG({ width: size, height: size });
  if (transparent) fillBackground(png, CLEAR);
  else fillBackground(png, BG);
  paintBrandMark(png, safeInset);
  const buf = PNG.sync.write(png);
  const outPath = path.resolve(__dirname, "..", "assets", filename);
  fs.writeFileSync(outPath, buf);
  console.log(`wrote ${outPath} (${size}x${size}, ${buf.length} bytes)`);
}

// Standard iOS icon — solid bg, full-bleed rings.
generate("icon.png", 1024, { safeInset: 0.78 });
// Android adaptive icon — same art, but Android masks into a safe circle
// at 67% (≈0.67). Our rings already live inside that area (0.72).
generate("adaptive-icon.png", 1024, { safeInset: 0.72 });
// Expo splash-icon — centered on a solid background, same mark.
generate("splash-icon.png", 1024, { safeInset: 0.55 });
// Web favicon — small, solid accent bg so rings read at 16/32/48 sizes.
generate("favicon.png", 48, { safeInset: 0.82 });

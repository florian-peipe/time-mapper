import { tokens } from "@/theme/tokens";

/**
 * Parse a hex string like `#RRGGBB` into its 0-1 float components. Accepts
 * both 3-digit and 6-digit shorthands. Throws on unparseable input so a
 * token typo fails the test loudly.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Invalid hex color: ${hex}`);
  const body = m[1]!;
  const full =
    body.length === 3
      ? body
          .split("")
          .map((c) => c + c)
          .join("")
      : body;
  const n = parseInt(full, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

/** Linearize a sRGB channel — WCAG relative-luminance step 1. */
function toLinear(c: number): number {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance. */
function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG contrast ratio between two hex colors — [1, 21]. */
export function contrastRatio(fgHex: string, bgHex: string): number {
  const L1 = relativeLuminance(fgHex);
  const L2 = relativeLuminance(bgHex);
  const [lighter, darker] = L1 >= L2 ? [L1, L2] : [L2, L1];
  return (lighter + 0.05) / (darker + 0.05);
}

describe("theme contrast (WCAG AA)", () => {
  // Tokens use a flat dotted-key object — use lookups rather than destructuring.
  // `light` and `dark` are const-asserted with narrow literal-string types;
  // widen to the shared key-set so the same palette shape is assignable and
  // index access stays typed as string (not string | undefined).
  type PaletteKey = keyof typeof tokens.light;
  type Palette = { [K in PaletteKey]: string };
  const themes: [string, Palette][] = [
    ["light", tokens.light as Palette],
    ["dark", tokens.dark as Palette],
  ];

  // AA body-text threshold (smaller than 18pt or smaller-than-14pt-bold).
  const AA_BODY = 4.5;
  // AA large-text threshold (>= 18pt or >= 14pt-bold).
  const AA_LARGE = 3.0;

  for (const [name, p] of themes) {
    describe(`${name}`, () => {
      test("primary body (fg on bg) passes AA body", () => {
        expect(contrastRatio(p["color.fg"], p["color.bg"])).toBeGreaterThanOrEqual(AA_BODY);
      });
      test("primary body on surface passes AA body", () => {
        expect(contrastRatio(p["color.fg"], p["color.surface"])).toBeGreaterThanOrEqual(AA_BODY);
      });
      test("secondary text (fg2) on bg passes AA body", () => {
        expect(contrastRatio(p["color.fg2"], p["color.bg"])).toBeGreaterThanOrEqual(AA_BODY);
      });
      test("accent contrast on accent passes AA large (primary button semibold label)", () => {
        // WCAG treats 14pt-bold / 18pt-regular as "large text" with a 3.0
        // threshold. Our primary CTA is 15pt semibold — same bucket as
        // iOS's default accent button, which also sits in this range.
        expect(contrastRatio(p["color.accent.contrast"], p["color.accent"])).toBeGreaterThanOrEqual(
          AA_LARGE,
        );
      });
      test("tertiary text (fg3) passes AA large on bg", () => {
        // fg3 is intentionally low-contrast (secondary metadata). Must still
        // meet AA-Large so it remains readable for headings/labels.
        expect(contrastRatio(p["color.fg3"], p["color.bg"])).toBeGreaterThanOrEqual(AA_LARGE);
      });
      test("danger on surface passes AA body", () => {
        expect(contrastRatio(p["color.danger"], p["color.surface"])).toBeGreaterThanOrEqual(
          AA_BODY,
        );
      });
      test("success on surface passes AA large", () => {
        expect(contrastRatio(p["color.success"], p["color.surface"])).toBeGreaterThanOrEqual(
          AA_LARGE,
        );
      });
    });
  }
});

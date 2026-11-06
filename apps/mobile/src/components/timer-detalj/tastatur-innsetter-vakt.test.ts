import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Vakt (16b, 2026-11-06): tastaturet dekket felt i raddialogene fordi
 * `KeyboardAvoidingView` med `keyboardVerticalOffset={0}` løftet for lite i
 * pageSheet-modaler. Modalene her skal bruke `TastaturScrollView` (eller
 * `automaticallyAdjustKeyboardInsets` på rullelisten). Ren kildeskanning.
 */
const DIR = __dirname;

function utenKommentarer(kilde: string): string {
  return kilde.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const filer = readdirSync(DIR)
  .filter((navn) => /\.tsx$/.test(navn) && !/\.test\.tsx$/.test(navn))
  .map((navn) => ({ navn, kilde: utenKommentarer(readFileSync(join(DIR, navn), "utf8")) }));

describe("tastatur-innsetter-vakt (timer-detalj)", () => {
  it("ingen KeyboardAvoidingView eller keyboardVerticalOffset={0}", () => {
    const brudd = filer
      .filter(({ kilde }) => /KeyboardAvoidingView|keyboardVerticalOffset=\{0\}/.test(kilde))
      .map(({ navn }) => navn);
    expect(brudd).toEqual([]);
  });

  it("modaler med tekst-/tallfelt ruller over tastaturet", () => {
    const brudd = filer
      .filter(({ kilde }) => /<Modal[\s>]/.test(kilde) && /<TextInput[\s>]/.test(kilde))
      .filter(({ kilde }) => !/<TastaturScrollView[\s>]|automaticallyAdjustKeyboardInsets/.test(kilde))
      .map(({ navn }) => navn);
    expect(brudd).toEqual([]);
  });

  it("hver rulleliste med keyboardShouldPersistTaps har insets-justering", () => {
    // Props kan inneholde `=>`, så taggen avgrenses bakover fra propen til
    // nærmeste `<ScrollView`/`<FlatList`, ikke med en `[^>]*`-regex.
    const brudd = filer.flatMap(({ navn, kilde }) =>
      [...kilde.matchAll(/keyboardShouldPersistTaps/g)]
        .map((m) => {
          const for_ = kilde.slice(0, m.index);
          const start = Math.max(for_.lastIndexOf("<ScrollView"), for_.lastIndexOf("<FlatList"));
          return kilde.slice(start, m.index);
        })
        .filter((tagg) => !tagg.includes("automaticallyAdjustKeyboardInsets"))
        .map(() => navn),
    );
    expect(brudd).toEqual([]);
  });

  it("TastaturScrollView slår på insets-justering og beholder handled-taps", () => {
    const kilde = readFileSync(join(DIR, "TastaturScrollView.tsx"), "utf8");
    expect(kilde).toMatch(/automaticallyAdjustKeyboardInsets/);
    expect(kilde).toMatch(/keyboardShouldPersistTaps="handled"/);
  });
});

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * w9m (plan § 3): bøtte-kapasiteten er fjernet. Ingen mobilkode skal bruke de
 * slettede funksjonene eller i18n-nøklene igjen — jobbregelen er eneste regel.
 */
const ROT = join(__dirname, "..", "..");
const BORTE = [
  "maskinBucketKapasitet",
  "beregnMaskinBrudd(",
  "overstigerMaskinTak",
  "maskinKapasitet(",
  "timer.maskin.kapasitet",
  "timer.maskinSeksjon.kapasitet",
  "timer.maskin.overstigerArbeid",
];

function filer(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    if (n === "node_modules" || n.startsWith(".")) return [];
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return filer(p);
    return /\.(ts|tsx)$/.test(n) && !n.endsWith(".test.ts") ? [p] : [];
  });
}

describe("w9m — bøtte-kapasitet borte fra mobil", () => {
  const kilder = [...filer(join(ROT, "src")), ...filer(join(ROT, "app"))].map((f) => ({
    f,
    s: readFileSync(f, "utf-8"),
  }));

  it("negativkontroll: kildene er lest", () => {
    expect(kilder.length).toBeGreaterThan(100);
    expect(kilder.some(({ s }) => s.includes("skrivMedMaskinVakt("))).toBe(true);
  });

  it.each(BORTE)("🔴 «%s» brukes ikke", (token) => {
    expect(kilder.filter(({ s }) => s.includes(token)).map(({ f }) => f)).toEqual([]);
  });
});

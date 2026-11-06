import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";

const HER = dirname(fileURLToPath(import.meta.url));

// TILLEGG 2026-11-06 til ORDRE 24: sjekklisten har IKKE oppgavens utkast-lås. Den som kan
// redigere sjekklisten (`!leseModus` — også mottaker med redigeringsrett) kan sette punktet,
// trykke «Bruk min posisjon» og lagre. Harnessen rendrer ikke RN, så regelen voktes på
// kildenivå: alle `tegningBunnfelt`-kall i sjekkliste sender `!leseModus`, aldri status.
const kilde = readFileSync(join(HER, "../../app/sjekkliste/[id].tsx"), "utf8");
const kall = kilde.match(/tegningBunnfelt\(\{[^}]*\}\)/g) ?? [];

describe("sjekkliste: plassering følger !leseModus, ikke utkast-status", () => {
  it("tegningBunnfelt kalles minst én gang", () => {
    expect(kall.length).toBeGreaterThan(0);
  });
  it("hvert kall sender kanRedigerePunkt: !leseModus og nevner ikke status/draft", () => {
    for (const k of kall) {
      expect(k).toContain("kanRedigerePunkt: !leseModus");
      expect(k).not.toMatch(/status|draft/);
    }
  });
});

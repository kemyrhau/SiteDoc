import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  byggNormtakBruddLinje,
  harNormtak,
  restForFravaerMedTak,
  vurderFravaerNormtak,
  type NormtakRad,
} from "./fravaerNormtak";

// Kort-id-spec § 11.10 (B10). TF14 + TF15.

const ARBEID = { type: "ordinaer", fravaerNormtak: true };
const EGENMELDING = { type: "fravaer", fravaerNormtak: true };
const UBETALT = { type: "fravaer", fravaerNormtak: false };
const FERIE_MED_LONN = { type: "fravaer", fravaerNormtak: false };
const PRIVAT = { type: "fravaer", fravaerNormtak: false };

const rad = (timer: number, lonnsart: NormtakRad["lonnsart"], ekstra: Partial<NormtakRad> = {}): NormtakRad => ({
  timer,
  erReise: false,
  lonnsart,
  ...ekstra,
});

describe("TF14 harNormtak", () => {
  it("fravær + false → nei", () => {
    expect(harNormtak({ type: "fravaer", fravaerNormtak: false })).toBe(false);
  });
  it("fravær + true / null / udefinert → ja (ukjent = tak)", () => {
    expect(harNormtak({ type: "fravaer", fravaerNormtak: true })).toBe(true);
    expect(harNormtak({ type: "fravaer", fravaerNormtak: null })).toBe(true);
    expect(harNormtak({ type: "fravaer" })).toBe(true);
  });
  it("ordinær → nei uansett verdi", () => {
    expect(harNormtak({ type: "ordinaer", fravaerNormtak: true })).toBe(false);
    expect(harNormtak({ type: "ordinaer", fravaerNormtak: false })).toBe(false);
    expect(harNormtak({ type: "ordinaer" })).toBe(false);
    expect(harNormtak(null)).toBe(false);
  });

  it("glue-vakt: ingen annen kode leser fravaerNormtak for å avgjøre tak", () => {
    // Tillatt: regelen selv, skrivere (skjema-ruter, seed, import) og oppsett-skjemaet på web
    // (som viser og redigerer verdien). Alle andre treff er en ny leser → bruk harNormtak.
    const rot = join(__dirname, "../../../..");
    const tillatt = [
      "packages/shared/src/utils/fravaerNormtak.ts",
      "apps/api/src/routes/timer/lonnsart.ts",
      "apps/api/src/routes/timer/dagsseddel.ts", // select av feltet til harNormtak
      "apps/api/src/services/seed/index.ts",
      "apps/api/src/services/katalog/importerKatalog.ts",
      "apps/web/src/app/dashbord/firma/timer/lonnsarter/page.tsx",
    ];
    const kataloger = ["apps/api/src", "apps/web/src", "apps/mobile/src", "apps/mobile/app", "packages/shared/src", "packages/db/scripts"];
    const treff: string[] = [];
    const sveip = (kat: string) => {
      for (const navn of readdirSync(kat)) {
        if (navn === "node_modules" || navn.startsWith(".")) continue;
        const p = join(kat, navn);
        if (statSync(p).isDirectory()) sveip(p);
        else if (/\.(ts|tsx)$/.test(navn) && !/\.test\.tsx?$/.test(navn)) {
          const rel = relative(rot, p);
          if (tillatt.includes(rel)) continue;
          // Modulstien ("./fravaerNormtak") er ikke en leser — bare feltet.
          if (/[^/\w]fravaerNormtak\b|fravaer_normtak/.test(readFileSync(p, "utf8"))) treff.push(rel);
        }
      }
    };
    for (const k of kataloger) sveip(join(rot, k));
    expect(treff).toEqual([]);
  });
});

describe("TF15 vurderFravaerNormtak (norm 7,5)", () => {
  const norm = 7.5;
  it("arbeid 2 + egenmelding 7,5 → tak 5,5, over 2", () => {
    const v = vurderFravaerNormtak({ dagsnorm: norm, rader: [rad(2, ARBEID), rad(7.5, EGENMELDING)] });
    expect(v).toMatchObject({ arbeid: 2, fravaerMedTak: 7.5, fravaerUtenTak: 0, tak: 5.5, overTak: 2 });
  });
  it("arbeid 7,5 → tak 0, hele fraværet over", () => {
    const v = vurderFravaerNormtak({ dagsnorm: norm, rader: [rad(7.5, ARBEID), rad(3, EGENMELDING)] });
    expect(v).toMatchObject({ tak: 0, overTak: 3 });
  });
  it("ubetalt 7,5 + arbeid 2 → over 0", () => {
    const v = vurderFravaerNormtak({ dagsnorm: norm, rader: [rad(7.5, UBETALT), rad(2, ARBEID)] });
    expect(v.overTak).toBe(0);
  });
  it("blanding: ferie m/lønn 7,5 + egenmelding 7,5 → tak 0, over 7,5", () => {
    const v = vurderFravaerNormtak({ dagsnorm: norm, rader: [rad(7.5, FERIE_MED_LONN), rad(7.5, EGENMELDING)] });
    expect(v).toMatchObject({ tak: 0, overTak: 7.5, fravaerUtenTak: 7.5 });
  });
  it("blanding: privat ærend 2 + egenmelding 7,5 → tak 5,5, over 2", () => {
    const v = vurderFravaerNormtak({ dagsnorm: norm, rader: [rad(2, PRIVAT), rad(7.5, EGENMELDING)] });
    expect(v).toMatchObject({ tak: 5.5, overTak: 2 });
  });
  it("blanding: ferie m/lønn 7,5 + arbeid 2 → over 0", () => {
    const v = vurderFravaerNormtak({ dagsnorm: norm, rader: [rad(7.5, FERIE_MED_LONN), rad(2, ARBEID)] });
    expect(v.overTak).toBe(0);
  });
  it("blanding: arbeid 2 + privat 2 + egenmelding 3,5 → over 0", () => {
    const v = vurderFravaerNormtak({
      dagsnorm: norm,
      rader: [rad(2, ARBEID), rad(2, PRIVAT), rad(3.5, EGENMELDING)],
    });
    expect(v).toMatchObject({ tak: 3.5, overTak: 0 });
  });
  it("to linjer med tak summeres", () => {
    const v = vurderFravaerNormtak({
      dagsnorm: norm,
      rader: [rad(2, ARBEID), rad(3, EGENMELDING), rad(3, EGENMELDING)],
    });
    expect(v).toMatchObject({ fravaerMedTak: 6, tak: 5.5, overTak: 0.5 });
  });
  it("reise og erstattet teller ikke", () => {
    const v = vurderFravaerNormtak({
      dagsnorm: norm,
      rader: [
        rad(3, ARBEID, { erReise: true }),
        rad(5, ARBEID, { erstattet: true }),
        rad(9, EGENMELDING, { erstattet: true }),
        rad(7.5, EGENMELDING),
      ],
    });
    expect(v).toMatchObject({ arbeid: 0, fravaerMedTak: 7.5, tak: 7.5, overTak: 0 });
  });
  it("fravær med prosjekt teller likt med fravær uten prosjekt (regelen ser bare lønnsarten)", () => {
    const a = vurderFravaerNormtak({ dagsnorm: norm, rader: [rad(2, ARBEID), rad(7.5, EGENMELDING)] });
    const b = vurderFravaerNormtak({ dagsnorm: norm, rader: [rad(2, ARBEID), { ...rad(7.5, EGENMELDING) }] });
    expect(a).toEqual(b);
  });
  it("norm 0 → tak null, over 0 (ukjent norm, L3)", () => {
    const v = vurderFravaerNormtak({ dagsnorm: 0, rader: [rad(2, ARBEID), rad(7.5, EGENMELDING)] });
    expect(v).toMatchObject({ tak: null, overTak: 0 });
  });
  it("N7: taket er eksakt — 7,5 − 2,25 = 5,25", () => {
    const v = vurderFravaerNormtak({ dagsnorm: norm, rader: [rad(2.25, ARBEID), rad(6, EGENMELDING)] });
    expect(v).toMatchObject({ tak: 5.25, overTak: 0.75 });
  });
});

describe("restForFravaerMedTak", () => {
  it("dagsnorm − arbeid − annet fravær, aldri under 0", () => {
    expect(restForFravaerMedTak({ dagsnorm: 7.5, arbeid: 2, annetFravaer: 0 })).toBe(5.5);
    expect(restForFravaerMedTak({ dagsnorm: 7.5, arbeid: 2, annetFravaer: 2 })).toBe(3.5);
    expect(restForFravaerMedTak({ dagsnorm: 7.5, arbeid: 8, annetFravaer: 0 })).toBe(0);
  });
  it("ukjent norm → null (intet tak)", () => {
    expect(restForFravaerMedTak({ dagsnorm: 0, arbeid: 2, annetFravaer: 0 })).toBeNull();
  });
});

// TF25 (visning): bruddlinja bygges fra tallene med i18n-nøklene — samme tekst på web og i
// serverens feilmelding. Ekte nb/en-tekster, enkel {{x}}-interpolasjon som i18next.
const lesSprak = (navn: string) =>
  JSON.parse(readFileSync(new URL(`../i18n/${navn}.json`, import.meta.url), "utf-8")) as Record<string, string>;
const nb = lesSprak("nb");
const en = lesSprak("en");
const lagT = (ordbok: Record<string, string>) => (k: string, vars: Record<string, string> = {}) =>
  (ordbok[k] ?? k).replace(/\{\{(\w+)\}\}/g, (_, v: string) => vars[v] ?? "");
const komma = (n: number) => n.toLocaleString("nb-NO", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

describe("TF25 byggNormtakBruddLinje", () => {
  const brudd = { artNavn: "Egenmelding", fravaerMedTak: 7.5, arbeid: 2, fravaerUtenTak: 0, dagsnorm: 7.5, tak: 5.5 };
  it("arbeid + fravær med tak (nb)", () => {
    expect(byggNormtakBruddLinje(lagT(nb), brudd, komma)).toBe(
      "Egenmelding 7,5 t + arbeid 2,0 t = 9,5 t — over dagsnormen 7,5 t",
    );
  });
  it("blanding tar med annet fravær; null-ledd utelates", () => {
    const b = { ...brudd, arbeid: 0, fravaerUtenTak: 2, tak: 5.5 };
    expect(byggNormtakBruddLinje(lagT(nb), b, komma)).toBe(
      "Egenmelding 7,5 t + annet fravær 2,0 t = 9,5 t — over dagsnormen 7,5 t",
    );
  });
  it("engelsk tekst har ingen norske ord", () => {
    const linje = byggNormtakBruddLinje(lagT(en), brudd, String);
    expect(linje).toContain("7.5");
    expect(linje).not.toMatch(/arbeid|fravær|dagsnorm/);
  });
});

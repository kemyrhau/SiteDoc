import { describe, it, expect } from "vitest";
import { normaliserSok, synonymerFor, matchScore, boundedLev } from "@/lib/sok-match";

/**
 * Finnbarhets-revisjon — søkemotor. Verifiserer skrivefeil-toleranse +
 * synonymlag mot Kenneths konkrete null-treff, med regresjons- og
 * falsk-positiv-vern.
 */

/** Speiler `useSokRegistry.legg()`: base-norm + appendede kjerne-synonymer. */
function byggNorm(tittel: string, brodsmule: string[] = [], sokeord = ""): string {
  const base = normaliserSok([tittel, ...brodsmule, sokeord].join(" "));
  return `${base} ${synonymerFor(base)}`.trim();
}

// Representative treff-normer (slik useSokRegistry ville bygd dem).
const HUB = byggNorm("Innstillinger");
const ANSATTE = byggNorm("Ansatte", ["Firma", "Ansatte og roller"]);
const FIRMAPROFIL = byggNorm("Firmainfo", ["Firma", "Firmaprofil"]);
const BYGGEPLASSER = byggNorm("Byggeplasser", ["Prosjekt", "Byggeplasser"], "lokasjoner tegninger kart geofence omrade");
const LONNSARTER = byggNorm("Lønnsarter", ["Firma", "Timer"]);
const DOKUMENTSOK = byggNorm("Dokumentsøk", ["Prosjekt"]);
const DASHBORD = byggNorm("Dashbord", ["Prosjekt"]);

const q = (s: string) => normaliserSok(s);

describe("sok-match — Kenneths null-treff", () => {
  it("«instill» → Innstillinger-hub", () => {
    expect(matchScore(HUB, q("instill"))).toBeGreaterThan(0);
  });
  it("«admin» → Innstillinger + Ansatte og roller + Firmaprofil", () => {
    expect(matchScore(HUB, q("admin"))).toBeGreaterThan(0);
    expect(matchScore(ANSATTE, q("admin"))).toBeGreaterThan(0);
    expect(matchScore(FIRMAPROFIL, q("admin"))).toBeGreaterThan(0);
  });
  it("«adm» → Innstillinger (prefiks av admin/administrer)", () => {
    expect(matchScore(HUB, q("adm"))).toBeGreaterThan(0);
  });
  it("«oppsett» → Innstillinger-hub (fabels gate-merknad)", () => {
    expect(matchScore(HUB, q("oppsett"))).toBeGreaterThan(0);
  });
});

describe("sok-match — regresjonsvern (dagens treff må bestå)", () => {
  it("«lonnsart» → Lønnsarter", () => {
    expect(matchScore(LONNSARTER, q("lonnsart"))).toBeGreaterThan(0);
  });
  it("«byggeplass»/«lokasjon»/«tegning»/«kart»/«geofence» → Byggeplasser", () => {
    for (const term of ["byggeplass", "lokasjon", "tegning", "kart", "geofence"]) {
      expect(matchScore(BYGGEPLASSER, q(term)), term).toBeGreaterThan(0);
    }
  });
  it("«sok» → Dokumentsøk (synonym dokumentsok→sok)", () => {
    expect(matchScore(DOKUMENTSOK, q("sok"))).toBeGreaterThan(0);
  });
});

describe("sok-match — falsk-positiv-vern", () => {
  it("«zzzxq» → 0 mot alt", () => {
    for (const n of [HUB, ANSATTE, BYGGEPLASSER, LONNSARTER, DASHBORD]) {
      expect(matchScore(n, q("zzzxq"))).toBe(0);
    }
  });
  it("«adm» matcher IKKE «dashbord» (ingen prefiks/substring, fuzzy <4 tegn)", () => {
    expect(matchScore(DASHBORD, q("adm"))).toBe(0);
  });
  it("AND-krav: flerords-query der ett token bommer → 0", () => {
    expect(matchScore(HUB, q("innstillinger zzzxq"))).toBe(0);
  });
});

describe("sok-match — finnbarhets-oppfølgere (2026-07-15)", () => {
  const DOKUMENTFLYT = byggNorm("Dokumentflyt", ["Prosjekt"]);
  const MEDLEMMER = byggNorm("Medlemmer", ["Prosjekt"]);

  it("«georeferanse» → Byggeplasser (utvidet synonym)", () => {
    expect(matchScore(BYGGEPLASSER, q("georeferanse"))).toBeGreaterThan(0);
    expect(matchScore(BYGGEPLASSER, q("kartfeste"))).toBeGreaterThan(0);
  });
  it("gjensidig cluster: «faggruppe»/«medlemmer» → Dokumentflyt", () => {
    expect(matchScore(DOKUMENTFLYT, q("faggruppe"))).toBeGreaterThan(0);
    expect(matchScore(DOKUMENTFLYT, q("medlemmer"))).toBeGreaterThan(0);
  });
  it("gjensidig cluster: «dokumentflyt» → Medlemmer", () => {
    expect(matchScore(MEDLEMMER, q("dokumentflyt"))).toBeGreaterThan(0);
  });
});

describe("sok-match — rangering + hjelpere", () => {
  it("eksakt token rangeres over fuzzy", () => {
    expect(matchScore(HUB, q("oppsett"))).toBeGreaterThan(matchScore(HUB, q("instill")));
  });
  it("boundedLev: transposisjon = 1, tidlig-exit gir tak+1", () => {
    expect(boundedLev("ab", "ba", 2)).toBe(1);
    expect(boundedLev("kart", "xyzw", 1)).toBe(2);
  });
});

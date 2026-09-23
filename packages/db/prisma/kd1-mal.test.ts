import { describe, it, expect } from "vitest";
import { BETINGELSE_EGEN_NOKKEL } from "@sitedoc/shared";
import { KD1_MAL, type FeltDef } from "./seed-bibliotek";

/**
 * KD1 «Belegg av stein og heller» v3 — BETINGEDE KRAVFELT (ordre KD1 v3 2026-09-22, gatet av Kenneth).
 *
 * `Belegningstype` (f01) er FORELDER. De fire kravfeltene splittes i én GREN per kravsett, hver utløst
 * av belegningstypene som deler kravet: tykkelse 4 grener (FØR), fugebredde 5 (ETTER), planhet 4 (ETTER),
 * sprang 5 (ETTER) = 18 grener + 6 alltid-synlige felt = 24 datafelt. Arbeideren ser fire kravfelt,
 * skreddersydd for typen han la (ti felt totalt for en gitt jobb).
 *
 * Barna er SPREDT: tykkelse i FØR (etter Settelag), resten i ETTER, mens forelderen står i FØR. Bygget
 * med `forelderFelt` + `barnAv` (ikke `forgrening`, som legger barna sammenhengende). Kryss-fase er
 * verifisert trygt (§4-fasemåling 2026-09-23).
 *
 * DEN KRITISKE INVARIANTEN (design: «en feil utløser sender arbeideren til feil krav»): for hvert
 * kravfelt PARTISJONERER grenenes utløsersett de 11 belegningstypene — hver type dekkes NØYAKTIG én gang.
 *
 * §7b: SiteDocs egne krav — ingen tabell-/punktkoder i hjelpetekst.
 */

const FORELDER = "belegningstype";
const KRAVFELT = [
  "Tykkelse settelag",
  "Fugebredde",
  "Planhet – svanker/bulninger over 3 m",
  "Største vertikale sprang ved fuger (mm)",
];
const ALLTID_SYNLIG = [
  "Belegningstype",
  "Areal",
  "Settelag",
  "Fall mot avrenning",
  "Fuger og striper i rette linjer eller jevne buer",
  "Krav oppfylt og dokumentasjon levert",
];

const eget = (f: FeltDef) => (f.config?.[BETINGELSE_EGEN_NOKKEL] as string[] | undefined) ?? [];
const grenerFor = (label: string) => KD1_MAL.felter.filter((f) => f.label === label && f.parentRef === FORELDER);

describe("KD1 v3 – betingede kravfelt (18 grener under Belegningstype)", () => {
  it("er malen for KD1", () => {
    expect(KD1_MAL.referanse).toBe("KD1");
    expect(KD1_MAL.kapittelKode).toBe("KD");
    expect(KD1_MAL.navn).toBe("KD1 – Belegg av stein og heller");
  });

  it("har nøyaktig 24 datafelt (6 alltid-synlige + 18 grener)", () => {
    expect(KD1_MAL.felter).toHaveLength(24);
  });

  it("Belegningstype (f01) er forelder: ref=belegningstype, conditionActive, ikke barn, 11 typer", () => {
    const f01 = KD1_MAL.felter[0]!;
    expect(f01.label).toBe("Belegningstype");
    expect(f01.ref).toBe(FORELDER);
    expect(f01.config?.conditionActive).toBe(true);
    expect(f01.parentRef).toBeUndefined();
    expect((f01.config?.options as string[]).length).toBe(11);
  });

  it("de 6 alltid-synlige feltene har verken parentRef eller conditionActive (unntatt forelderen)", () => {
    for (const label of ALLTID_SYNLIG) {
      const f = KD1_MAL.felter.find((x) => x.label === label)!;
      expect(f, `mangler «${label}»`).toBeDefined();
      expect(f.parentRef, `«${label}» skal ikke være barn`).toBeUndefined();
      if (label !== "Belegningstype") {
        expect(f.config?.conditionActive, `«${label}» skal ikke være forelder`).toBeUndefined();
      }
    }
  });

  it("nøyaktig 18 grener, alle barn av belegningstype, med eget utløsersett (aldri conditionValues)", () => {
    const barn = KD1_MAL.felter.filter((f) => f.parentRef);
    expect(barn).toHaveLength(18);
    for (const b of barn) {
      expect(b.parentRef).toBe(FORELDER);
      expect(b.config, `«${b.label}» skal ikke ha conditionValues`).not.toHaveProperty("conditionValues");
      expect(eget(b).length, `«${b.label}» mangler utløsersett`).toBeGreaterThan(0);
    }
    expect(BETINGELSE_EGEN_NOKKEL).toBe("conditionOwnValues");
  });

  it("antall grener per kravfelt: tykkelse 4, fugebredde 5, planhet 4, sprang 5", () => {
    expect(grenerFor("Tykkelse settelag")).toHaveLength(4);
    expect(grenerFor("Fugebredde")).toHaveLength(5);
    expect(grenerFor("Planhet – svanker/bulninger over 3 m")).toHaveLength(4);
    expect(grenerFor("Største vertikale sprang ved fuger (mm)")).toHaveLength(5);
  });

  it("🔴 KRITISK: hvert kravfelt PARTISJONERER de 11 typene — hver type nøyaktig én gren", () => {
    const alleTyper = (KD1_MAL.felter[0]!.config?.options as string[]).slice().sort();
    for (const kravfelt of KRAVFELT) {
      const utlosere = grenerFor(kravfelt).flatMap(eget);
      // Ingen duplikat (én type → én gren) og full dekning (ingen type uten krav).
      expect(new Set(utlosere).size, `«${kravfelt}»: en type er utløser i mer enn én gren`).toBe(utlosere.length);
      expect(utlosere.slice().sort(), `«${kravfelt}» dekker ikke alle 11 typene nøyaktig én gang`).toEqual(alleTyper);
    }
  });

  it("tykkelse-grenene ligger i FØR (fase-flytting v2→v3), resten av kravfeltene i ETTER", () => {
    for (const g of grenerFor("Tykkelse settelag")) expect(g.fase).toBe("FØR");
    for (const label of ["Fugebredde", "Planhet – svanker/bulninger over 3 m", "Største vertikale sprang ved fuger (mm)"]) {
      for (const g of grenerFor(label)) expect(g.fase).toBe("ETTER");
    }
  });

  it("samsvars-kravfeltene har «Innenfor kravet»/«Avvik – måles og noteres»; sprang er heltall mm uten maks", () => {
    for (const label of ["Tykkelse settelag", "Fugebredde", "Planhet – svanker/bulninger over 3 m"]) {
      for (const g of grenerFor(label)) {
        expect(g.type).toBe("list_single");
        expect(g.config?.options).toEqual(["Innenfor kravet", "Avvik – måles og noteres"]);
      }
    }
    for (const g of grenerFor("Største vertikale sprang ved fuger (mm)")) {
      expect(g.type).toBe("integer");
      expect(g.config?.enhet).toBe("mm");
      expect(g.config?.maks).toBeUndefined();
    }
  });

  it("inneholder ikke «Asfalt» (asfaltdekker hører til JH, ikke KD1)", () => {
    const alternativer = (KD1_MAL.felter[0]!.config?.options as string[]) ?? [];
    expect(alternativer.some((a) => a.toLowerCase().includes("asfalt"))).toBe(false);
  });

  it("§7b: ingen hjelpetekst bærer tabell-/punktkoder fra standarden (egne krav)", () => {
    const normkode = /Tabell K|KD\d*\.?\d* ?c\d|KD ?c\d|KD:\d|Matrise KD|NS-EN|NS 3420/;
    for (const f of KD1_MAL.felter) {
      const help = (f.config?.helpText as string | undefined) ?? "";
      expect(help, `Hjelpetekst for «${f.label}» bærer en norm-kode`).not.toMatch(normkode);
    }
  });
});

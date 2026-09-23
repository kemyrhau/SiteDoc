import { describe, it, expect } from "vitest";
import { UP1_MAL, UP2_MAL, UP3_MAL, UO21_MAL, type FeltDef } from "./seed-bibliotek";

/**
 * Delt-tekst-test (ordre UP-deling § 5 + § 5b): basisfeltene B1–B10 og materialeblokkens M2/M3 skal
 * være ORD FOR ORD identiske på tvers av malene. Uten den drifter de fra hverandre ved første revisjon
 * av én mal, og da kan ingen sammenligne kontrollen av to kummer i samme grøft. Rød først.
 *
 * Unntak (ordre § 5): B1 og B6 bytter «kummen»→«enheten» i UO2.1, og B7 utvides i UO2.1. Derfor låses
 * B1/B6/B7 identiske på tvers av kum-malene (UP1/UP2/UP3), mens B2–B5 og B8–B10 låses på tvers av ALLE
 * fire. UO2.1s B1/B6 verifiseres = UP1s med «kummen»→«enheten».
 */

/** Tekst-signatur uten tre-metadata (ref/parentRef/conditionActive/conditionOwnValues). */
const sig = (f: FeltDef) =>
  JSON.stringify({
    label: f.label,
    type: f.type,
    fase: f.fase,
    options: f.config?.options ?? null,
    helpText: f.config?.helpText ?? null,
  });
const finn = (mal: { felter: FeltDef[] }, label: string): FeltDef => {
  const f = mal.felter.find((x) => x.label === label);
  if (!f) throw new Error(`Fant ikke «${label}»`);
  return f;
};

const KUMMALER = [UP1_MAL, UP2_MAL, UP3_MAL];
const ALLE = [UP1_MAL, UP2_MAL, UP3_MAL, UO21_MAL];

// Felt identiske på tvers av ALLE fire (labelen er lik i alle).
const IDENTISK_ALLE = [
  "Grøftebunn og fundament klare",
  "Plassering",
  "Skjøter og gjennomføringer",
  "Oppdrift og vann i grøfta",
  "Lokk eller rist",
  "Lokkhøyde mot dekket",
  "Ren, innmålt og klar",
];
// Felt identiske på tvers av kum-malene (UP1/UP2/UP3), avviker i UO2.1.
const IDENTISK_KUM = ["Kum og deler kontrollert", "Omfylling rundt kummen", "Justeringsringer og ramme"];

describe("UP-deling – delt-tekst-test (basisfelt + materialeblokk)", () => {
  it("B2–B5 og B8–B10 er ord for ord identiske på tvers av ALLE fire malene", () => {
    for (const label of IDENTISK_ALLE) {
      const signaturer = new Set(ALLE.map((m) => sig(finn(m, label))));
      expect(signaturer.size, `«${label}» drifter mellom malene`).toBe(1);
    }
  });

  it("B1, B6 og B7 er identiske på tvers av kum-malene (UP1/UP2/UP3)", () => {
    for (const label of IDENTISK_KUM) {
      const signaturer = new Set(KUMMALER.map((m) => sig(finn(m, label))));
      expect(signaturer.size, `«${label}» drifter mellom kum-malene`).toBe(1);
    }
  });

  it("UO2.1s B1 og B6 = UP1s med «kummen»→«enheten» (ingen annen forskjell)", () => {
    const bytt = (s: string) => s.replace(/kummen/g, "enheten");
    // B1: samme label, hjelpetekst byttet.
    expect(bytt(finn(UP1_MAL, "Kum og deler kontrollert").config?.helpText as string))
      .toBe(finn(UO21_MAL, "Kum og deler kontrollert").config?.helpText);
    // B6: label og innhold byttet.
    const up1b6 = finn(UP1_MAL, "Omfylling rundt kummen");
    const uob6 = finn(UO21_MAL, "Omfylling rundt enheten");
    expect(bytt(up1b6.label)).toBe(uob6.label);
    expect(bytt(up1b6.config?.helpText as string)).toBe(uob6.config?.helpText);
    expect((up1b6.config?.options as string[]).map(bytt)).toEqual(uob6.config?.options);
  });

  it("B7 er utvidet i UO2.1 (skal AVVIKE fra kum-malenes B7)", () => {
    expect(sig(finn(UO21_MAL, "Justeringsringer og ramme")))
      .not.toBe(sig(finn(UP1_MAL, "Justeringsringer og ramme")));
  });

  it("materialeblokk: M2 og M3 er ord for ord identiske i UP1/UP2/UP3 (utløser ekskludert)", () => {
    for (const label of ["Kumskjøt og pakninger", "Oppføringsrør og form"]) {
      const signaturer = new Set(KUMMALER.map((m) => sig(finn(m, label))));
      expect(signaturer.size, `«${label}» drifter mellom malene`).toBe(1);
    }
  });

  it("B5 «Oppdrift» står FØR B6 «Omfylling» i alle fire (rekkefølgen er en del av kravet)", () => {
    for (const m of ALLE) {
      const idxB5 = m.felter.findIndex((f) => f.label === "Oppdrift og vann i grøfta");
      const idxB6 = m.felter.findIndex((f) => f.label.startsWith("Omfylling rundt"));
      expect(idxB5, `${m.referanse}: mangler B5`).toBeGreaterThanOrEqual(0);
      expect(idxB5, `${m.referanse}: B5 skal stå før B6`).toBeLessThan(idxB6);
    }
  });
});

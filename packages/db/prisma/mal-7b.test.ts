import { describe, it, expect } from "vitest";
import { malRegister } from "./generer-mal-sql";

/**
 * §7b-vakt (design-rollen, gatet av Kenneth 2026-09-19): malene skal fremstå med SiteDocs
 * EGNE krav — ikke som avskrift av NS 3420. Ingen tabell-/punktkoder eller eksterne NS-
 * standarder i HJELPETEKSTER eller SVARALTERNATIVER. Standarden nevnes kun i beskrivelsen
 * («Faglig grunnlag»), som derfor ikke testes her.
 *
 * Testen går over alle eksporterte K-maler (KA7 … KM2 via malRegister, filtrert på kapittelKode
 * K*) og feiler hvis en hjelpetekst eller et svaralternativ inneholder en forbudt referanse.
 * F-maler (NS 3420-F) har egne, F-spesifikke §7b-vakter (f.eks. `fd1-mal.test.ts`) — de forbudte
 * mønstrene her er K-spesifikke (Tabell K, normpunktkode K[A-M]…) og skal ikke kjøres over dem.
 *
 * Unntak (tillatt):
 *  - henvisning til egen sjekkliste på formen «sjekklisten KB2» / «sjekklisten KC3.1»
 *    (peker leseren til et annet SiteDoc-dokument, ikke til standarden)
 *  - KM2s «300 mm» (grensen mur/kant — en definisjon arbeideren trenger, ikke et normkrav)
 *
 * Rød først mot dagens tekster (ordre §7 pkt 2): kjøres testen før §7b-rettingen, skal den
 * feile på kodene som ligger i malene i dag.
 */

/** Forbudte mønstre i hjelpetekst/alternativer. */
const FORBUDT: { navn: string; re: RegExp }[] = [
  { navn: "Tabell K", re: /Tabell K/ },
  { navn: "Matrise K", re: /Matrise K/ },
  { navn: "NS-EN", re: /NS-EN/ },
  { navn: "NS 2890", re: /NS ?2890/ },
  { navn: "NS 4400", re: /NS ?4400/ },
  // Normpunktkode: kapittelkode (KA–KM) + tall, ev. underpost («.11») og postbokstav («c1»,
  // «b5», «y2.1»). Fanger KB6 c1, KB2.2 c2, KC3.11, KA7.2, KB6.1 c1 osv.
  { navn: "normpunktkode", re: /K[A-M]\d[\d.]*(?:\s[a-z]\d[\d.]*)?/ },
];

/** Nøytraliser de tillatte unntakene før mønstersjekk, slik at de ikke gir falske treff. */
function utenUnntak(tekst: string): string {
  return tekst
    // «sjekklisten KC3.1» / «sjekklisten KB2» → egen-dokument-henvisning, tillatt.
    .replace(/sjekklisten\s+K[A-M]\d[\d.]*/gi, "sjekklisten X")
    // KM2s «300 mm» (mur/kant-grensen) — tillatt definisjon.
    .replace(/300 mm/g, "300 X");
}

/** Returnerer navnene på de forbudte mønstrene teksten treffer (etter unntak). */
function forbudteTreff(tekst: string): string[] {
  const rent = utenUnntak(tekst);
  return FORBUDT.filter((f) => f.re.test(rent)).map((f) => f.navn);
}

/** Alle testbare strenger i en mal: hver hjelpetekst og hvert svaralternativ (IKKE beskrivelsen). */
function testbareTekster(felter: { config?: Record<string, unknown> }[]): string[] {
  const ut: string[] = [];
  for (const f of felter) {
    const help = f.config?.helpText;
    if (typeof help === "string") ut.push(help);
    const options = f.config?.options;
    if (Array.isArray(options)) for (const o of options) if (typeof o === "string") ut.push(o);
  }
  return ut;
}

describe("§7b — ingen normkoder/eksterne NS-standarder i hjelpetekster eller alternativer", () => {
  // Kun K-maler: de forbudte mønstrene under er K-spesifikke. F-maler har egne vakter.
  const kMaler = [...malRegister()].filter(([, m]) => m.kapittelKode.startsWith("K"));

  it("registeret dekker alle åtte K-malene (KA7 … KM2)", () => {
    expect(kMaler.map(([ref]) => ref).sort()).toEqual(
      ["KA7", "KB2", "KB4", "KB6", "KC3.1", "KD1", "KD2", "KM2"].sort(),
    );
  });

  for (const [ref, mal] of kMaler) {
    it(`${ref}: ingen forbudte referanser`, () => {
      const brudd: { tekst: string; treff: string[] }[] = [];
      for (const tekst of testbareTekster(mal.felter)) {
        const treff = forbudteTreff(tekst);
        if (treff.length > 0) brudd.push({ tekst, treff });
      }
      expect(brudd).toEqual([]);
    });
  }

  // Positiv kontroll: matcheren MÅ fange hver forbudt kategori (ellers er §7b-vakten tannløs).
  it("fanger hver forbudt kategori", () => {
    expect(forbudteTreff("Tabell K4: anbefalt tykkelse")).toContain("Tabell K");
    expect(forbudteTreff("Matrise KB4:1. Formålet")).toContain("Matrise K");
    expect(forbudteTreff("tilfredsstille NS-EN 1338")).toContain("NS-EN");
    expect(forbudteTreff("varedeklarasjon iht. NS 2890")).toContain("NS 2890");
    expect(forbudteTreff("skal tilfredsstille NS 4400")).toContain("NS 4400");
    expect(forbudteTreff("KB6 c1: planter skal")).toContain("normpunktkode");
    expect(forbudteTreff("KB2.2 c2: hardpakket")).toContain("normpunktkode");
    expect(forbudteTreff("Oppstøtting med stokker (KC3.11)")).toContain("normpunktkode");
    expect(forbudteTreff("dokumenteres i KB2-sjekklisten")).toContain("normpunktkode");
  });

  // Negativ kontroll: de tillatte unntakene skal IKKE fanges.
  it("tillater egen-sjekkliste-henvisning og KM2s «300 mm»", () => {
    expect(forbudteTreff("Kravene står i sjekklisten KC3.1.")).toEqual([]);
    expect(forbudteTreff("dokumenteres i sjekklisten KB2.")).toEqual([]);
    expect(forbudteTreff("vishøyde over 300 mm — lavere enn det er en kant")).toEqual([]);
  });
});

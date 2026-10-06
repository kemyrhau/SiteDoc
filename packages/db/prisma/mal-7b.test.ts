import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as seed from "./seed-bibliotek";
import { malRegister, type MalKonstant } from "./generer-mal-sql";

/**
 * §7b-vakt (design-rollen, gatet av Kenneth 2026-09-19, utvidet til alle maler 2026-10-07): malene
 * skal fremstå med SiteDocs EGNE krav — ikke som avskrift av NS 3420 eller andre betalte standarder.
 * Ingen tabell-/punktkoder eller eksterne betalte standarder i HJELPETEKSTER eller SVARALTERNATIVER.
 * Standarden nevnes kun i beskrivelsen («Faglig grunnlag»), som derfor IKKE testes her.
 *
 * Utvidet fra åtte K-maler til ALLE eksporterte `*_MAL` (27 pr. 2026-10-07): mønstrene er nå
 * generalisert over alle fire standardene (K/F/U/J), ikke K-spesifikke. §7c skiller betalte kilder
 * (forbudt) fra gratis offentlige dokumenter (vegvesenets håndbøker, N200 — tillatt).
 *
 * Unntak (tillatt):
 *  - henvisning til egen sjekkliste på formen «sjekklisten KB2» / «sjekklisten FD2» (peker leseren til
 *    et annet SiteDoc-dokument, ikke til standarden)
 *  - KM2s «300 mm» (grensen mur/kant — en definisjon arbeideren trenger, ikke et normkrav; design
 *    bekreftet smalt unntak, inbox-mal 2026-09-19)
 *
 * Rød først (ordre §2, 2026-10-07): kjørt mot dagens tekster FØR §7b-rettingen. 14 treff — FB4 (7
 * hjelpetekster «FB4 b1:» … «FB4 c5:») og FD3 (7, «FD3 b1:» … «FD3 c5:») — de to F-malene som aldri
 * ble §7b-renset. De står i AVVENTER_7B til fabel har gatet tekstomskrivingen (ordre 9b487c98 /
 * tillegg 31dee733). Vakten er LIVE over de 25 rene malene nå; AVVENTER_7B kan ikke vokse stille.
 */

/** Forbudte mønstre i hjelpetekst/alternativer. */
const FORBUDT: { navn: string; re: RegExp }[] = [
  { navn: "Tabell", re: /Tabell [KFUJ]/ },
  { navn: "Matrise", re: /Matrise [KFUJ]/ },
  // Normpunktkode: standardbokstav (K/F/U/J) + kapittelbokstav + tall, MED post-kvalifikator — enten
  // dottet underpost («.2») eller mellomrom + postbokstav+tall (« b1», « c3»). Kvalifikatoren er KRAV
  // (ikke valgfri): den skiller en ekte post-referanse («FB4 b1», «FD1.2», «UM1 c3», «JH2.11») fra en
  // produktmerking §7b uttrykkelig TILLATER («FP100», «F1») og fra en bar mal-referanse. Uten kravet
  // ga mønsteret falskt treff på «FP100» i KD1 (meldt til fabel 2026-10-07).
  { navn: "normpunktkode", re: /\b[KFUJ][A-Z]\d+(?:\.\d+|\s[a-z]\d[\d.]*)/ },
  // §7c pkt 2 — betalte/lukkede kilder: verdiløs henvisning for en arbeider uten tilgang.
  { navn: "NS 3420", re: /NS ?3420/ },
  { navn: "NS-EN", re: /NS-EN/ },
  { navn: "NS 3458", re: /NS ?3458/ },
  { navn: "NS 2890", re: /NS ?2890/ },
  { navn: "NS 4400", re: /NS ?4400/ },
  { navn: "VA/Miljø-blad", re: /VA\/Miljø-blad/ },
  { navn: "Norsk Vann", re: /Norsk Vann/ },
];
// §7c pkt 1 — gratis offentlige dokumenter (vegvesenets håndbøker, N200) er TILLATT og står bevisst
// IKKE i FORBUDT. Testes negativt nedenfor slik at ingen senere legger dem til ved et uhell.

/** Nøytraliser de tillatte unntakene før mønstersjekk, slik at de ikke gir falske treff. */
function utenUnntak(tekst: string): string {
  return (
    tekst
      // «sjekklisten KC3.1» / «sjekklisten FD2» → egen-dokument-henvisning, tillatt.
      .replace(/sjekklisten\s+[KFUJ][A-Z]?\d[\d.]*/gi, "sjekklisten X")
      // KM2s «300 mm» (mur/kant-grensen) — tillatt definisjon.
      .replace(/300 mm/g, "300 X")
  );
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

function bruddFor(mal: MalKonstant): { tekst: string; treff: string[] }[] {
  const brudd: { tekst: string; treff: string[] }[] = [];
  for (const tekst of testbareTekster(mal.felter)) {
    const treff = forbudteTreff(tekst);
    if (treff.length > 0) brudd.push({ tekst, treff });
  }
  return brudd;
}

/**
 * Maler med kjent §7b-gjeld, utestående fabel-gatet tekstomskriving (ordre 9b487c98 / tillegg
 * 31dee733). Hjelpetekstene starter med tabellkoder («FB4 b1:», «FD3 b1:»). Fjernes herfra i SAMME
 * commit som tekstene renses — den per-mal-assertion-en under FEILER hvis en avventende mal er blitt
 * ren (tvinger opprydding), og en ren mal som blir skitten fanges av at den IKKE er i settet.
 */
const AVVENTER_7B = new Set<string>(["FB4", "FD3"]);

describe("§7b — ingen normkoder/betalte NS-standarder i hjelpetekster eller alternativer (alle maler)", () => {
  const register = malRegister();

  it("registeret dekker ALLE eksporterte *_MAL (ingen faller stille ut)", () => {
    const kilde = readFileSync(new URL("./seed-bibliotek.ts", import.meta.url), "utf8");
    const konstantNavn = [...kilde.matchAll(/^export const (\w+_MAL)\b/gm)].map((m) => m[1]);
    expect(konstantNavn.length).toBeGreaterThanOrEqual(27);

    const registrerteReferanser = new Set(register.keys());
    const manglende: string[] = [];
    for (const navn of konstantNavn) {
      const verdi = (seed as Record<string, unknown>)[navn] as Partial<MalKonstant> | undefined;
      // Eksportert *_MAL skal være et objekt med referanse+felter OG være plukket opp av registeret.
      if (
        !verdi ||
        typeof verdi.referanse !== "string" ||
        !Array.isArray(verdi.felter) ||
        !registrerteReferanser.has(verdi.referanse)
      ) {
        manglende.push(navn);
      }
    }
    expect(manglende).toEqual([]);
  });

  it("AVVENTER_7B inneholder kun registrerte malreferanser", () => {
    const registrerte = new Set(register.keys());
    expect([...AVVENTER_7B].filter((ref) => !registrerte.has(ref))).toEqual([]);
  });

  for (const [ref, mal] of register) {
    if (AVVENTER_7B.has(ref)) {
      it(`${ref}: KJENT §7b-gjeld — fortsatt forbudte referanser (fjern fra AVVENTER_7B når fabel har gatet omskrivingen)`, () => {
        expect(bruddFor(mal).length).toBeGreaterThan(0);
      });
    } else {
      it(`${ref}: ingen forbudte referanser`, () => {
        expect(bruddFor(mal)).toEqual([]);
      });
    }
  }

  // Positiv kontroll: matcheren MÅ fange hver forbudt kategori (ellers er §7b-vakten tannløs).
  it("fanger hver forbudt kategori over alle fire standardene", () => {
    expect(forbudteTreff("Tabell K4: anbefalt tykkelse")).toContain("Tabell");
    expect(forbudteTreff("Matrise FB4:1. Formålet")).toContain("Matrise");
    expect(forbudteTreff("KB6 c1: planter skal")).toContain("normpunktkode");
    expect(forbudteTreff("FB4 b1: kontroller spuntprofil")).toContain("normpunktkode");
    expect(forbudteTreff("FD3 c1: mål pelehull mot prosjektert")).toContain("normpunktkode");
    expect(forbudteTreff("se post UM1 c3 i grunnlaget")).toContain("normpunktkode");
    expect(forbudteTreff("JH2.11 angir toleransen")).toContain("normpunktkode");
    expect(forbudteTreff("FD1.2 dekker bunn")).toContain("normpunktkode");
    expect(forbudteTreff("Faglig grunnlag: NS 3420-K:2024")).toContain("NS 3420");
    expect(forbudteTreff("tilfredsstille NS-EN 1338")).toContain("NS-EN");
    expect(forbudteTreff("rør iht. NS 3458")).toContain("NS 3458");
    expect(forbudteTreff("varedeklarasjon iht. NS 2890")).toContain("NS 2890");
    expect(forbudteTreff("skal tilfredsstille NS 4400")).toContain("NS 4400");
    expect(forbudteTreff("legging iht. VA/Miljø-blad nr. 6")).toContain("VA/Miljø-blad");
    expect(forbudteTreff("se Norsk Vann-rapport 227")).toContain("Norsk Vann");
  });

  // Negativ kontroll: tillatte unntak og §7c-gratis-kilder skal IKKE fanges.
  it("tillater egen-sjekkliste-henvisning, KM2s «300 mm», produktmerking og vegvesen-håndbøker", () => {
    expect(forbudteTreff("Kravene står i sjekklisten KC3.1.")).toEqual([]);
    expect(forbudteTreff("dokumenteres i sjekklisten FD2.")).toEqual([]);
    expect(forbudteTreff("vishøyde over 300 mm — lavere enn det er en kant")).toEqual([]);
    // Produktmerking på pallen (§7b): tillatt, ikke en postkode.
    expect(forbudteTreff("tegl merket FP100, betongstein klasse 3 merket D")).toEqual([]);
    expect(forbudteTreff("naturstein F1")).toEqual([]);
    // §7c pkt 1 — gratis offentlig: vegvesenets håndbok N200.
    expect(forbudteTreff("komprimering etter N200")).toEqual([]);
    expect(forbudteTreff("krav i vegvesenets håndbok N200 kap. 5")).toEqual([]);
  });
});

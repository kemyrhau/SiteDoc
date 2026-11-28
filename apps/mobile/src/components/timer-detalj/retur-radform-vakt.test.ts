import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { radManglerBeskrivelse } from "../../utils/dagsoversiktRader";

// RETUR radform (2026-11-12). Mobil har ingen renderer — at modalene stopper
// før skriving vaktes i kilden, med mutanter som negativkontroll.

const her = dirname(fileURLToPath(import.meta.url));
const utenKommentarer = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const TIMER = utenKommentarer(readFileSync(join(her, "TimerSeksjon.tsx"), "utf-8"));
const SPLITT = utenKommentarer(readFileSync(join(her, "SplittRadModal.tsx"), "utf-8"));

/** Innholdet i `{ … }` som starter ved `start` (klammeparentes-matching). */
function blokk(kilde: string, start: string): string {
  const i = kilde.indexOf(start);
  if (i < 0) return "";
  const k = kilde.indexOf("{", i + start.length - 1);
  let dybde = 0;
  for (let j = k; j < kilde.length; j++) {
    if (kilde[j] === "{") dybde++;
    else if (kilde[j] === "}" && --dybde === 0) return kilde.slice(i, j + 1);
  }
  return "";
}

/** Punkt 1: `lagre()` i TimerRadModal stopper arbeidsrad uten beskrivelse før skriving. */
function beskrivelseSperret(kilde: string): boolean {
  const b = blokk(kilde, "function lagre(");
  const sjekk = b.search(
    /if\s*\(\s*radManglerBeskrivelse\(\s*beskrivelse,\s*erReiseFlagg\s*,?\s*\)\s*,?\s*\)\s*\{\s*setBeskrivelseFeil\(true\);[^}]*return;\s*\}/,
  );
  const skriv = Math.min(
    ...["onLagre(", "onLeggTilOvertidDel("].map((s) => b.indexOf(s)).filter((i) => i >= 0),
  );
  return sjekk >= 0 && sjekk < skriv;
}

/**
 * R10: Del opp avviser når en del får færre timer enn en koblet maskin på den delen, før skriving.
 * Runde 8 (Kenneth 2026-11-28 «A»): maskinen fordeles på delene, så vakten gjelder hver del;
 * uten «Følger med» står hele maskinen på del 1 (`i === 0 ? m.timer : 0`), som før.
 */
function splittAvviserMaskinOverDel(kilde: string): boolean {
  const del = kilde.indexOf("const delTimer = tilTall(timerDeler[i]!.timerTekst);");
  const sjekk = kilde.search(
    /const over = maskinerOverRad\(delTimer, paaDel, enhet\);\s*if \(over\.length > 0\) \{[\s\S]*?setFeil\(t\("timer\.maskinSeksjon\.overRad"[\s\S]*?return;\s*\}/,
  );
  const utenFolgerMed = /: i === 0\s*\? m\.timer\s*: 0/.test(kilde);
  const skriv = kilde.indexOf("db.update(sheetTimerLocal)");
  return del >= 0 && sjekk > del && skriv > sjekk && utenFolgerMed;
}

describe("punkt 1 — beskrivelse påkrevd på arbeidsrad", () => {
  it("ren regel: arbeidsrad uten tekst mangler, reise unntatt", () => {
    expect(radManglerBeskrivelse(null, false)).toBe(true);
    expect(radManglerBeskrivelse("   ", false)).toBe(true);
    expect(radManglerBeskrivelse("Forskaling", false)).toBe(false);
    expect(radManglerBeskrivelse(null, true)).toBe(false);
  });

  it("lagre() sperrer før skriving, med feltmelding", () => {
    expect(beskrivelseSperret(TIMER)).toBe(true);
    expect(TIMER).toContain('t("timer.feil.beskrivelsePaakrevd")');
  });

  it("mutant: sperren fjernet → vakta feiler", () => {
    const mutert = TIMER.replace(/if\s*\(\s*radManglerBeskrivelse\(/, "if (false && radManglerBeskrivelse(");
    expect(mutert).not.toBe(TIMER);
    expect(beskrivelseSperret(mutert)).toBe(false);
  });

  it("mutant: reise-unntaket fjernet → vakta feiler", () => {
    const mutert = TIMER.replace(/erReiseFlagg\s*,?\s*\)\s*,?\s*\)\s*\{\s*setBeskrivelseFeil/, "false)) { setBeskrivelseFeil");
    expect(mutert).not.toBe(TIMER);
    expect(beskrivelseSperret(mutert)).toBe(false);
  });
});

describe("R10 — Del opp med koblet maskin over delens timer", () => {
  it("avviser før originalen oppdateres", () => {
    expect(splittAvviserMaskinOverDel(SPLITT)).toBe(true);
  });

  it("mutant: avvisningen fjernet → vakta feiler", () => {
    const mutert = SPLITT.replace(/if \(over\.length > 0\) \{/, "if (false) {");
    expect(mutert).not.toBe(SPLITT);
    expect(splittAvviserMaskinOverDel(mutert)).toBe(false);
  });

  it("mutant: sjekken mot hele originalen i stedet for delen → vakta feiler", () => {
    const mutert = SPLITT.replace("maskinerOverRad(delTimer,", "maskinerOverRad(o.timer,");
    expect(mutert).not.toBe(SPLITT);
    expect(splittAvviserMaskinOverDel(mutert)).toBe(false);
  });

  it("mutant: uten «Følger med» spres maskinen på alle deler → vakta feiler", () => {
    const mutert = SPLITT.replace(/: i === 0\s*\? m\.timer\s*: 0/, ": m.timer");
    expect(mutert).not.toBe(SPLITT);
    expect(splittAvviserMaskinOverDel(mutert)).toBe(false);
  });
});

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
    /if\s*\(\s*radManglerBeskrivelse\(\s*beskrivelse,\s*erReiseRad\s*\|\|\s*erReiseLonnsartLokalt\(organizationId,\s*valgtLonnsartId\)\s*,?\s*\)\s*,?\s*\)\s*\{\s*setBeskrivelseFeil\(true\);[^}]*return;\s*\}/,
  );
  const skriv = Math.min(
    ...["onLagre(", "onLeggTilOvertidDel("].map((s) => b.indexOf(s)).filter((i) => i >= 0),
  );
  return sjekk >= 0 && sjekk < skriv;
}

/** R10: Del opp avviser når del 1 får færre timer enn en koblet maskin, før skriving. */
function splittAvviserMaskinOverDel1(kilde: string): boolean {
  const del1 = kilde.indexOf("const del1Timer = tilTall(timerDeler[0]!.timerTekst);");
  const sjekk = kilde.search(
    /const overDel1 = maskinerOverRad\(del1Timer, hentKobledeMaskiner\(db, o\.id\)\);\s*if \(overDel1\.length > 0\) \{[\s\S]*?setFeil\(t\("timer\.maskinSeksjon\.overRad"[\s\S]*?return;\s*\}/,
  );
  const skriv = kilde.indexOf("db.update(sheetTimerLocal)");
  return del1 >= 0 && sjekk > del1 && skriv > sjekk;
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
    const mutert = TIMER.replace(/erReiseRad\s*\|\|\s*erReiseLonnsartLokalt\(organizationId,\s*valgtLonnsartId\)\s*,?\s*\)\s*,?\s*\)\s*\{\s*setBeskrivelseFeil/, "false)) { setBeskrivelseFeil");
    expect(mutert).not.toBe(TIMER);
    expect(beskrivelseSperret(mutert)).toBe(false);
  });
});

describe("R10 — Del opp med koblet maskin over del 1", () => {
  it("avviser før originalen oppdateres", () => {
    expect(splittAvviserMaskinOverDel1(SPLITT)).toBe(true);
  });

  it("mutant: avvisningen fjernet → vakta feiler", () => {
    const mutert = SPLITT.replace(/if \(overDel1\.length > 0\) \{/, "if (false) {");
    expect(mutert).not.toBe(SPLITT);
    expect(splittAvviserMaskinOverDel1(mutert)).toBe(false);
  });

  it("mutant: sjekken mot hele originalen i stedet for del 1 → vakta feiler", () => {
    const mutert = SPLITT.replace("maskinerOverRad(del1Timer,", "maskinerOverRad(o.timer,");
    expect(mutert).not.toBe(SPLITT);
    expect(splittAvviserMaskinOverDel1(mutert)).toBe(false);
  });
});

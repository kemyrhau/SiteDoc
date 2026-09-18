import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Mal-dialogen (MalListe.tsx) stabler to distinkte overskrifter over hverandre når
 * man lager en oppgave-mal:
 *
 *   - `maler.type.label`  — FORM/datatabell-akse (Oppgave/Sjekkliste/HMS), låst felt
 *   - `mal.type.tittel`   — KLASSE-akse (Oppgave/Kontraktssak), MalTypeVelger
 *
 * Kontraktssak-runde 1 ga begge visningsteksten «Type», så dialogen viste to
 * identiske «Type»-overskrifter (defekt meldt av redesign, rettet ved å omdøpe
 * klasse-aksen til «Dokumentklasse»). Denne testen pinner regresjonen: de to
 * overskriftene skal ALDRI løse til samme streng — i noe språk. Ren i18n-invariant
 * (leser JSON, ingen DOM), så den kan ikke bli skjør av markup-endringer i dialogen.
 */

const I18N_DIR = resolve(__dirname, "../../../../../packages/shared/src/i18n");
const SPRAAK = ["nb", "en", "sv", "lt", "pl", "uk", "ro", "et", "fi", "cs", "de", "ru", "lv", "fr", "sq"] as const;

const FORM_HEADING = "maler.type.label";
const KLASSE_HEADING = "mal.type.tittel";

function lesSpraak(kode: string): Record<string, string> {
  return JSON.parse(readFileSync(resolve(I18N_DIR, `${kode}.json`), "utf-8"));
}

describe("mal-dialog: form- og klasse-overskriften må ikke kollidere", () => {
  for (const kode of SPRAAK) {
    it(`${kode}: «${FORM_HEADING}» ≠ «${KLASSE_HEADING}»`, () => {
      const t = lesSpraak(kode);
      const form = t[FORM_HEADING];
      const klasse = t[KLASSE_HEADING];
      // Begge må finnes (fraværende nøkkel er sin egen feil, ikke en falsk grønn).
      expect(form, `${kode}.json mangler ${FORM_HEADING}`).toBeTruthy();
      expect(klasse, `${kode}.json mangler ${KLASSE_HEADING}`).toBeTruthy();
      expect(
        klasse,
        `${kode}: begge mal-dialog-overskriftene løser til «${form}» — to like «Type» igjen`,
      ).not.toBe(form);
    });
  }
});

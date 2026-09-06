import { describe, it, expect } from "vitest";
import { lesSignaturVerdi, formaterSignaturLinje, feltKartFraRad } from "@sitedoc/shared";
import { lesSignaturVerdiPdf, formaterSignaturLinjePdf, feltKartFraRadPdf } from "@sitedoc/pdf";

/**
 * Drift-vakt for de TILSIKTEDE tvillingene mellom @sitedoc/shared (kanonisk leser)
 * og @sitedoc/pdf (speil — null-runtime-avhengigheter, kan ikke importere shared).
 *
 * Speilene SKAL bestå (dokumentert i begge pakkers CLAUDE.md + cowork-gatet). Det som
 * manglet var en vakt: endres den kanoniske leseren om et halvt år, sier ingenting fra
 * at speilet drifter. Denne testen kjører BEGGE implementasjonene på samme inndata og
 * krever likt svar. Se relay/inbox-drift-konsolidering.md § B.
 */

const GYLDIG_DATAURL = "data:image/png;base64,iVBORw0KGgo=";

describe("signatur-tvilling: lesSignaturVerdi ↔ lesSignaturVerdiPdf", () => {
  // pdf-speilet mangler BEVISST `brukerId` (trenger det ikke) → pariteten gjelder de
  // overlappende feltene {dataUrl, navn, tidspunkt} + null-vs-ikke-null-avgjørelsen.
  const tilfeller: { navn: string; inn: unknown }[] = [
    { navn: "legacy rå data-URL-streng", inn: GYLDIG_DATAURL },
    { navn: "ikke-data-streng (ugyldig)", inn: "bare tekst" },
    { navn: "tom streng", inn: "" },
    {
      navn: "gyldig objekt (fullt)",
      inn: { dataUrl: GYLDIG_DATAURL, brukerId: "u1", navn: "Kari", tidspunkt: "2026-09-05T14:32:07+02:00" },
    },
    { navn: "objekt uten dataUrl", inn: { navn: "Kari", tidspunkt: "2026-09-05T14:32:07+02:00" } },
    { navn: "objekt med ugyldig dataUrl", inn: { dataUrl: "ikke-data", navn: "Kari" } },
    { navn: "objekt uten navn/tidspunkt", inn: { dataUrl: GYLDIG_DATAURL } },
    { navn: "tomt (null)", inn: null },
    { navn: "tomt (undefined)", inn: undefined },
  ];

  for (const { navn, inn } of tilfeller) {
    it(`gir identisk resultat: ${navn}`, () => {
      const s = lesSignaturVerdi(inn);
      const p = lesSignaturVerdiPdf(inn);
      // Begge må være enige om null-vs-ikke-null (drift-klassen vi vokter mot).
      expect(p === null).toBe(s === null);
      if (s === null || p === null) return;
      expect({ dataUrl: p.dataUrl, navn: p.navn, tidspunkt: p.tidspunkt }).toEqual({
        dataUrl: s.dataUrl,
        navn: s.navn,
        tidspunkt: s.tidspunkt,
      });
    });
  }
});

describe("signatur-tvilling: formaterSignaturLinje ↔ formaterSignaturLinjePdf", () => {
  const tilfeller: { navn: string; sig: { dataUrl: string; navn: string | null; tidspunkt: string | null } }[] = [
    { navn: "fullt navn + tidspunkt", sig: { dataUrl: GYLDIG_DATAURL, navn: "Kari Nordmann", tidspunkt: "2026-09-05T14:32:07+02:00" } },
    { navn: "manglende navn → Ukjent", sig: { dataUrl: GYLDIG_DATAURL, navn: null, tidspunkt: "2026-01-03T08:05:00+01:00" } },
    { navn: "legacy: tidspunkt null → ingen linje", sig: { dataUrl: GYLDIG_DATAURL, navn: null, tidspunkt: null } },
    { navn: "ugyldig tidspunkt-format → ingen linje", sig: { dataUrl: GYLDIG_DATAURL, navn: "Per", tidspunkt: "05.09.2026" } },
    { navn: "midnatt (00:00)", sig: { dataUrl: GYLDIG_DATAURL, navn: "Ola", tidspunkt: "2026-12-31T00:00:00+01:00" } },
  ];
  for (const { navn, sig } of tilfeller) {
    it(`gir identisk linje: ${navn}`, () => {
      const linjeShared = formaterSignaturLinje({ ...sig, brukerId: null });
      const linjePdf = formaterSignaturLinjePdf(sig);
      expect(linjePdf).toBe(linjeShared);
    });
  }
});

describe("repeater-tvilling: feltKartFraRad ↔ feltKartFraRadPdf", () => {
  const tilfeller: { navn: string; inn: unknown }[] = [
    { navn: "produksjonsform { _radId, felter }", inn: { _radId: "r1", felter: { f1: "a", f2: 3 } } },
    { navn: "flat/rå form", inn: { f1: "a", f2: 3 } },
    { navn: "felter er ikke objekt (streng) → raden selv", inn: { _radId: "r1", felter: "x" } },
    { navn: "tomt objekt", inn: {} },
    { navn: "null", inn: null },
    { navn: "undefined", inn: undefined },
  ];
  for (const { navn, inn } of tilfeller) {
    it(`gir identisk kart: ${navn}`, () => {
      expect(feltKartFraRadPdf(inn)).toEqual(feltKartFraRad(inn));
    });
  }
});

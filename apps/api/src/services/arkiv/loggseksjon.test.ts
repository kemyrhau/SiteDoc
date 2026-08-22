import { describe, it, expect } from "vitest";
import {
  byggLoggseksjon,
  byggMangelMerknad,
  byggSignaturblokk,
  byggArkivDokument,
  byggArkivSide,
  byggArkivSamling,
  byggArkivLogg,
  type ArkivLogg,
  type HendelseRad,
  type ArkivSignatur,
  type ArkivDokumentInput,
} from "@sitedoc/pdf";

/** Stage 3 — loggseksjon + signatur + sammenstilling. Rent lag. */

const h = (o: Partial<HendelseRad> & { tidspunkt: string; aktor: string; handling: string }): HendelseRad => ({
  kilde: "transfer",
  antallFeltendringer: 0,
  ...o,
});

describe("byggLoggseksjon — Dokumenthistorikk (lag 1)", () => {
  const logg: ArkivLogg = {
    hendelser: [
      h({ tidspunkt: "2026-08-05T11:10:00.000Z", aktor: "Mathias Berg", aktorRolle: "bas", handling: "Sendt", antallFeltendringer: 6 }),
      h({ tidspunkt: "2026-08-06T08:20:00.000Z", aktor: "Silje Havstad", aktorRolle: "anleggsleder", handling: "Avvist", kommentar: "Punkt 1 må re-måles", antallFeltendringer: 1 }),
      h({ tidspunkt: "2026-08-08T09:14:00.000Z", aktor: "Silje Havstad", handling: "Godkjent" }),
    ],
    endringsloggAktivert: false,
  };

  it("rendrer alle hendelser med rolle + kryssreferanse-hale (entall/flertall)", () => {
    const html = byggLoggseksjon(logg);
    expect(html).toContain("Dokumenthistorikk");
    expect(html).toContain("(bas)");
    // D4-revisjon (2026-08-22): behold tallet, «— se Endringslogg» fjernet.
    expect(html).toContain("(6 feltendringer)");
    expect(html).toContain("(1 feltendring)"); // entall
  });

  it("tidspunkt-format er «dd.mm.yyyy hh:mm» uten komma (mockup-fasit)", () => {
    const html = byggLoggseksjon(logg);
    expect(html).toMatch(/05\.08\.2026 \d{2}:\d{2}/); // dato + mellomrom + tid
    expect(html).not.toContain("05.08.2026,"); // ingen komma-skilletegn
    expect(html).not.toContain("aug."); // ikke langt måned-format
  });

  it("semantisk farge på Avvist (rød) og Godkjent (grønn)", () => {
    const html = byggLoggseksjon(logg);
    expect(html).toContain("#b91c1c"); // Avvist rød
    expect(html).toContain("#15803d"); // Godkjent grønn
  });

  it("hendelse uten feltendringer → ingen hale (ikke «0 feltendringer»)", () => {
    const html = byggLoggseksjon(logg);
    expect(html).not.toContain("0 feltendring");
  });

  it("Endringslogg-SEKSJONEN er aldri i PDF (D4-revisjon) — kun Dokumenthistorikk", () => {
    expect(byggLoggseksjon(logg)).not.toContain('ark-seksjon">Endringslogg');
  });
});

// D4-revisjon (2026-08-22): describe «byggLoggseksjon — Endringslogg (lag 2)» FJERNET —
// endringslogg-rendreren utgår (endringsloggen skrives aldri i PDF). Ord-diff-DATAEN
// (byggArkivLogg → ArkivLogg.økter) bygges fortsatt for web-UI-verktøyet; kun PDF-seksjonen
// er borte. Testene for den PDF-seksjonen er derfor slettet, ikke bare deaktivert.

describe("D4-revisjon (2026-08-22) — endringsloggen skrives ALDRI i PDF", () => {
  const logg = byggArkivLogg({
    hendelser: [h({ tidspunkt: "2026-08-05T11:10:00.000Z", aktor: "M", handling: "Sendt", antallFeltendringer: 2 })],
    endringer: [{ userId: "u1", aktor: "M", tidspunkt: "2026-08-05T07:14:00.000Z", felt: "F", fraVerdi: null, tilVerdi: "OK" }],
    endringsloggAktivert: true,
  });

  it("Dokumenthistorikk består ALLTID; Endringslogg-seksjonen er borte (også når endringsloggAktivert)", () => {
    const html = byggLoggseksjon(logg);
    expect(html).toContain("Dokumenthistorikk");
    expect(html).not.toContain('ark-seksjon">Endringslogg');
  });

  it("kryssreferansen: behold tallet «N feltendring(er)», FJERN «— se Endringslogg»", () => {
    const html = byggLoggseksjon(logg);
    expect(html).toMatch(/\(\d+ feltendring(er)?\)/); // «(1 feltendring)» / «(N feltendringer)»
    expect(html).not.toContain("se Endringslogg");
  });
});

describe("vedtak (c) — mangel-merknad", () => {
  it("manglende vedlegg → utvetydig S/H-lesbar merknad med «ikke komplett»", () => {
    const html = byggMangelMerknad(["IMG_4821.jpg", "temp.csv"]);
    expect(html).toContain("MANGLENDE VEDLEGG");
    expect(html).toContain("IMG_4821.jpg");
    expect(html).toContain("ikke komplett");
  });
  it("ingen manglende → tom", () => {
    expect(byggMangelMerknad([])).toBe("");
  });
});

describe("byggSignaturblokk", () => {
  const sig: ArkivSignatur[] = [
    { rolleEtikett: "Utført av", navn: "Mathias Berg", rolle: "bas", tidspunkt: "2026-08-07T14:52:00.000Z", verb: "signert" },
    { rolleEtikett: "Godkjent av", navn: "Silje Havstad", tidspunkt: null },
  ];

  it("signert → navn + kvittering; ikke signert → «ikke signert» + åpen strek", () => {
    const html = byggSignaturblokk(sig);
    expect(html).toContain("Mathias Berg");
    expect(html).toContain("signert i SiteDoc");
    expect(html).toContain("Utført av — Mathias Berg, bas");
    expect(html).toContain("Godkjent av — ikke signert");
  });

  it("tidsstempel-format er «dd.mm.yyyy hh:mm» uten komma (mockup-fasit)", () => {
    const html = byggSignaturblokk(sig);
    expect(html).toMatch(/signert i SiteDoc 07\.08\.2026 \d{2}:52/);
    expect(html).not.toContain("07.08.2026,"); // ingen komma
    expect(html).not.toContain("aug."); // ikke langt format (formaterDatoTid)
  });

  it("tom liste → tom streng", () => {
    expect(byggSignaturblokk([])).toBe("");
  });
});

describe("byggArkivDokument — sammenstilling", () => {
  const input: ArkivDokumentInput = {
    firma: { navn: "SiteDoc AS", orgnr: "923 456 789" },
    meta: { kategori: "sjekkliste", dokumenttype: "Sjekkliste", dokumentnavn: "Betong", dokumentnummer: "SJ-1", dokumentId: "sj_1", status: "approved" },
    prosjektblokk: { prosjekt: "998 P", byggeplass: "Blokk B", byggherre: "BH AS" },
    statusCeller: [{ etikett: "Status", verdi: "Godkjent", farge: "#15803d" }],
    innholdHtml: "<div class='felt-blokk'>INNHOLD</div>",
    logg: { hendelser: [h({ tidspunkt: "2026-08-08T09:14:00.000Z", aktor: "Silje", handling: "Godkjent" })], endringsloggAktivert: false, sistEndret: { navn: "Silje", dato: "2026-08-08T09:14:00.000Z" } },
    signaturer: [{ rolleEtikett: "Utført av", navn: "Mathias", tidspunkt: "2026-08-07T14:52:00.000Z" }],
    generertTekst: "11.08.2026 14:32",
  };

  it("full doc har topptekst, statusblokk (m/ Sist endret), innhold, logg, signatur, generert-stempel", () => {
    const html = byggArkivDokument(input);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("SiteDoc AS");
    expect(html).toContain("Sist endret");
    expect(html).toContain("INNHOLD");
    expect(html).toContain("Dokumenthistorikk");
    expect(html).toContain("signert i SiteDoc");
    expect(html).toContain("Generert fra SiteDoc 11.08.2026 14:32");
    expect(html).not.toContain("dokument-id"); // funn 3: intern nøkkel utgår av bunnteksten
  });

  it("byggArkivSide gir .ark-side-blokk UTEN shell (for samleutskrift)", () => {
    const side = byggArkivSide(input);
    expect(side.startsWith('<div class="ark-side">')).toBe(true);
    expect(side).not.toContain("<!DOCTYPE html>");
    expect(side).toContain("INNHOLD");
  });

  it("byggArkivDokument = én side i shell (inneholder sidens innhold)", () => {
    const doc = byggArkivDokument(input);
    expect(doc).toContain(byggArkivSide(input));
    expect(doc.match(/class="ark-side"/g)?.length).toBe(1);
  });
});

describe("byggArkivSamling — N1 samleutskrift (én PDF, flere dokumenter)", () => {
  const input = (navn: string, tekst: string): ArkivDokumentInput => ({
    firma: { navn: "SiteDoc AS" },
    meta: { kategori: "sjekkliste", dokumenttype: "Sjekkliste", dokumentnavn: navn, dokumentnummer: "", dokumentId: navn, status: "draft" },
    prosjektblokk: { prosjekt: "P", byggeplass: null, byggherre: null },
    statusCeller: [],
    innholdHtml: `<div>${tekst}</div>`,
    logg: { hendelser: [], endringsloggAktivert: false, sistEndret: null },
    signaturer: [],
    generertTekst: "15.08.2026 09:00",
  });

  it("flere sider i ÉN shell, rekkefølge bevart", () => {
    const html = byggArkivSamling([byggArkivSide(input("A", "DOK-A")), byggArkivSide(input("B", "DOK-B"))]);
    // Én shell (én DOCTYPE, én <style>)
    expect(html.match(/<!DOCTYPE html>/g)?.length).toBe(1);
    expect(html.match(/<style>/g)?.length).toBe(1);
    // Begge dokumenter med, i rekkefølge
    expect(html.indexOf("DOK-A")).toBeLessThan(html.indexOf("DOK-B"));
    // To .ark-side-blokker → sideskift-regelen (.ark-side + .ark-side) treffer
    expect(html.match(/class="ark-side"/g)?.length).toBe(2);
    expect(html).toContain(".ark-side + .ark-side");
  });

  it("tom liste → tomt dokument (shell uten sider)", () => {
    const html = byggArkivSamling([]);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).not.toContain('class="ark-side"');
  });
});

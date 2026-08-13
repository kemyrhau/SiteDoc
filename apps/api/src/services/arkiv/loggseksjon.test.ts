import { describe, it, expect } from "vitest";
import {
  byggLoggseksjon,
  byggSignaturblokk,
  byggArkivDokument,
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
    expect(html).toContain("6 feltendringer — se Endringslogg");
    expect(html).toContain("1 feltendring — se Endringslogg"); // entall
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

  it("endringslogg av → ingen Endringslogg-SEKSJON (ordet finnes i halen, men ikke headingen)", () => {
    // Halen sier «... se Endringslogg», men selve seksjons-headingen skal mangle.
    expect(byggLoggseksjon(logg)).not.toContain('ark-seksjon">Endringslogg');
  });
});

describe("byggLoggseksjon — Endringslogg (lag 2, økt-gruppert)", () => {
  it("økt-overskrifter + total-note", () => {
    const logg = byggArkivLogg({
      hendelser: [h({ tidspunkt: "2026-08-05T11:10:00.000Z", aktor: "Mathias Berg", handling: "Sendt" })],
      endringer: [
        { userId: "u1", aktor: "Mathias Berg", tidspunkt: "2026-08-05T07:14:00.000Z", felt: "Punkt 1 — Resultat", fraVerdi: null, tilVerdi: "OK" },
        { userId: "u1", aktor: "Mathias Berg", tidspunkt: "2026-08-05T09:41:00.000Z", felt: "Punkt 2 — Resultat", fraVerdi: null, tilVerdi: "OK" },
        { userId: "u2", aktor: "Silje Havstad", tidspunkt: "2026-08-06T08:21:00.000Z", felt: "Punkt 1 — Kommentar", fraVerdi: "32 mm", tilVerdi: "35 mm" },
      ],
      endringsloggAktivert: true,
    });
    const html = byggLoggseksjon(logg);
    expect(html).toContain("Endringslogg");
    expect(html).toContain("3 feltendringer i 2 økter");
    expect(html).toContain("Mathias Berg · 05.08.2026");
    expect(html).toContain("2 feltendringer");
    expect(html).toContain("Silje Havstad · 06.08.2026");
    expect(html).toContain('<span class="ark-svak">Ikke utfylt</span> → OK'); // tom fra-verdi vist
    expect(html).toContain('<span class="ark-svak">32 mm</span> → 35 mm');
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
    expect(html).toContain("Generert fra SiteDoc 11.08.2026 14:32 · dokument-id sj_1");
  });
});

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, it, expect } from "vitest";

/**
 * RETUR 2026-10-15 (Kontrollør) punkt 2: generatoren oversatte interpolasjons-
 * variabelen i ro.json (`{{total}}` i stedet for `{{totalt}}`), så fremdriften
 * ville vist «{{totalt}}» rått på rumensk. RETUR 2026-10-16 (Kontrollør, R1) fant
 * samme feilklasse igjen i `tegninger.oppdatererFremdrift` — vakta dekket den ikke
 * fordi den kun sjekket en håndplukket nøkkelliste.
 *
 * Denne vakta sjekker nå ALLE nøkler i ALLE språk mot nb. Generaliseringen avdekket
 * 221 eksisterende avvik (12 av 13 språk, oversettelsen har omskrevet variabelnavnet
 * — f.eks. {{navn}}→{{namn}}, {{dato}}→{{data}} — eller skrevet om setningen uten
 * variabelen). Å rette alle 221 er utenfor scope for R1 og er ført i KJENT_AVVIK
 * under, som KUN kan krympe: en nøkkel som ikke lenger avviker MÅ fjernes fra lista
 * (testen feiler på en stale oppføring), og et nytt avvik utenfor lista feiler alltid.
 */

const I18N_DIR = fileURLToPath(new URL("../../../../packages/shared/src/i18n", import.meta.url));
const FASIT = "nb";

const SPRAK = readdirSync(I18N_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""))
  .sort();

function les(lang: string): Record<string, string> {
  return JSON.parse(readFileSync(path.join(I18N_DIR, `${lang}.json`), "utf-8")) as Record<string, string>;
}

function variabler(tekst: string): string[] {
  return [...tekst.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]!).sort();
}

// Kjent avvik ved generaliseringen 2026-10-16 (RETUR R1-oppfølger). Kun lov å krympe —
// se KJENT_AVVIK-sjekken nederst, som feiler hvis en oppføring her er rettet men ikke fjernet.
const KJENT_AVVIK: Record<string, string[]> = {
  cs: [
    "timer.ukeSum", "timer.mine.slettBekreft", "timer.detalj.attestertTittel", "timer.sammenlign.timer",
    "maaling.bekreftForslag", "kontakter.hmsKortUtloper", "firma.timer.rapport.pdf.footerGenerert",
    "maler.slettVern.harBegge", "hms.feltlaas.forklaring", "signaturliste.laast", "signaturliste.foerEndringDato",
    "signaturliste.nySignaturKrevd", "prosjektoppsett.eksport.utloper", "livssyklus.sporMalUtenNavn",
    "flythjelp.handling.videresend", "maskin.detalj.sidenDato", "admin.firmaDetalj.aktivertDato",
    "admin.firmaDetalj.faktura.aktivertFra", "ftdSok.side",
  ],
  de: ["flythjelp.handling.videresend"],
  et: [
    "kontekstChip.allePaa", "timer.sammenlign.timer", "sjekklister.filtrerPaaByggeplass", "maaling.bekreftForslag",
    "tegninger.rotertAuto", "tegninger.rotert", "maler.velgDokumentflytBeskrivelse", "flythjelp.handling.videresend",
  ],
  fi: [
    "maler.badge.erstatterStandard", "kontekstChip.velgFelt", "kontekstChip.allePaa", "timer.ukeSum",
    "timer.sammenlign.timer", "timer.attestering.pivot.avvikOver", "timer.rediger.brukDefault",
    "sjekklister.filtrerPaaByggeplass", "maaling.bekreftForslag", "kontakter.leggTilMedlemITittel",
    "tegninger.rotertAuto", "tegninger.rotert", "maler.velgDokumentflytBeskrivelse", "felt.felttypeIkkeStottet",
    "flythjelp.handling.videresend",
  ],
  fr: [
    "papirkurv.dagerIgjen", "timer.sammenlign.timer", "timer.attestering.container.delvis", "onboarding.aapneSide",
    "firma.timer.oppsett.aapneSide", "livssyklus.sporMalUtenNavn", "felt.original", "flythjelp.handling.videresend",
    "georef.punkt", "admin.firmaDetalj.dagerIgjen", "admin.firmaDetalj.sideAvTotalt", "rapportobjekt.felt.original",
    "ftdSok.side",
  ],
  lt: [
    "timer.sammenlign.timer", "timer.attestering.container.delvis", "timer.attestering.pivot.avvikOver",
    "sjekklister.filtrerPaaByggeplass", "kontakter.leggTilMedlemITittel", "tegninger.rotertAuto", "tegninger.rotert",
    "maler.velgDokumentflytBeskrivelse", "flythjelp.handling.videresend",
  ],
  lv: [
    "maler.badge.erstatterStandard", "kontekstChip.velgFelt", "timer.sammenlign.timer",
    "sjekklister.filtrerPaaByggeplass", "maaling.bekreftForslag", "kontakter.leggTilMedlemITittel",
    "tegninger.rotertAuto", "tegninger.rotert", "maler.velgDokumentflytBeskrivelse", "flythjelp.handling.videresend",
  ],
  pl: [
    "kontekstChip.velgFelt", "papirkurv.velgRad", "timer.attestering.container.delvis",
    "timer.attestering.container.alleBehandlet", "timer.rediger.brukDefault", "maaling.bekreftForslag",
    "kontakter.hmsKortUtloper", "tegninger.rotert", "onboarding.aapneSide", "firma.timer.oppsett.aapneSide",
    "prosjektoppsett.eksport.utloper", "livssyklus.sporMalUtenNavn", "mer.offline.feil",
    "statushandling.bekreftBesvarTil", "statushandling.bekreftHandling", "flythjelp.handling.videresend",
    "maskin.detalj.sidenDato", "admin.firmaDetalj.aktivertDato", "admin.firmaDetalj.faktura.aktivertFra",
    "timer.eksport.maskinNoster", "ftdSok.side",
  ],
  ro: [
    "maler.firmaarkiv.punkter", "timer.antallRader", "seksjonsstatus.urort", "kontakter.leggTilMedlemITittel",
    "dokumentsok.viserAvTotalt", "onboarding.gjenstaar", "firma.onboarding.banner.gjenstaar",
    "firma.timer.oppsett.gjenstaar", "maler.velgDokumentflytBeskrivelse", "prosjektoppsett.eksport.byggerProgresjon",
    "livssyklus.viserAvTotalt", "mer.offline.ferdig", "flythjelp.handling.videresend",
    "maskin.filter.viserAvTotalt", "firma.maskin.import.flereRader", "firma.varelager.import.flereRader",
    "admin.firmaDetalj.sideAvTotalt", "kontrollplan.fremdriftsplan.aktiviteterRessurser", "ftdSok.side",
    "videresend.antallPersoner",
  ],
  ru: [
    "kontekstChip.velgFelt", "timer.splitt.del", "maaling.bekreftForslag", "brukere.domeneAktivHint",
    "brukere.domeneInaktivHint", "kontakter.endreFirmaByttetTekst", "tegninger.nedlasting.forStor",
    "lokasjoner.slett.suksessMedDetaljer", "firma.moduler.oppsettModal.tittel", "firma.moduler.oppsettModal.tekst",
    "firma.innstillinger.redigerVedAttestering.feil", "firma.innstillinger.autoProsjektAdmin.feil",
    "firma.innstillinger.standardArbeidstid.feil", "onboarding.stegNr", "onboarding.aapneSide",
    "firma.timer.oppsett.stegNr", "firma.timer.oppsett.aapneSide", "malbygger.veiBEllers",
    "livssyklus.sporMalUtenNavn", "mer.offline.feil", "oppgaveModal.tittelFraTegning", "felt.vaerVindVerdi",
    "felt.vaerNedborVerdi", "statushandling.bekreftHandling", "flythjelp.handling.videresend",
    "felles.feilOpprettelse", "admin.firmaDetalj.sideAvTotalt", "timer.attestering.reise.avstand",
    "timer.attestering.reise.kjoretid", "ftdSok.chunk", "ftdSok.side",
  ],
  sq: [
    "maler.badge.erstatterStandard", "timer.summering", "timer.summering.heravMaskin",
    "timer.attestering.container.delvis", "onboarding.aapneSide", "firma.timer.oppsett.aapneSide",
    "mer.offline.feil", "statushandling.bekreftHandling", "flythjelp.handling.videresend", "ftdSok.side",
    "videresend.liggerIFlytenMedBall",
  ],
  sv: [
    "firma.malarkiv.slettBekreft", "firma.malarkiv.oppdaterFraArkivBekreft", "malbygger.firmaarkiv.basertPa",
    "kontekstChip.velgFelt", "timer.attestering.container.delvis", "dokumentflyt.bundet.bindTittel",
    "dokumentflyt.bundet.aapneTittel", "kontakter.provenansGruppe", "kontakter.provenansFaggruppe",
    "kontakter.endreFirmaTittel", "kontakter.forslagTekst", "kontakter.leggTilMedlemITittel",
    "dashbord.velkommen", "moduler.deaktiverBekreftTekst", "tegninger.slettBekreft",
    "tegninger.serieGruppe.merkRad", "tegninger.revisjon.fil", "lokasjoner.slett.intro",
    "lokasjoner.slett.bekreftLabel", "lokasjoner.slett.suksess", "lokasjoner.slett.suksessMedDetaljer",
    "firma.avdelinger.slettBekreft", "firma.ansatte.deaktiver.tittel", "firma.kompetanse.typer.slettBekreft",
    "firma.kompetanse.dialog.slettBekreftTekst", "timer.eksport.maskinIkkeEksporterbar",
    "firma.timer.rapport.detaljer.subtotal", "faggrupper.bekreftSlett", "faggrupper.kopierBeskrivelse",
    "maler.slettMalBekreftelse", "hms.hos", "signaturliste.bekreftetAv", "livssyklus.sporMal",
    "oppgaveModal.tittelFraTegning", "statushandling.bekreftHandling", "flythjelp.handling.videresend",
    "dokument.oppretter", "dokument.svarer", "dokument.bestiller", "dokument.utforer",
    "omrade.seksjon.forByggeplass", "omrade.slett.bekreft", "kontrollplan.revisjonAntattVar",
    "firma.maskin.import.varsel.filtrertRad", "firma.varelager.import.varsel.ugyldigRad",
    "firma.kalender.deaktiverBekreft", "firma.oppmotested.slettBekreft", "flyt.sendTil", "flyt.besvarTil",
    "timer.eksport.maskinNoster", "timer.eksport.maskinUtenTimerad", "timer.attestering.arbeidReiseSplit",
    "kontrollplan.fremdriftsplan.aktiviteterRessurser", "videresend.liggerIFlytenMedBall",
  ],
  uk: [
    "timer.attestering.detalj.ikkeRedigerbar", "tegninger.rotert", "onboarding.antallRegistrert",
    "firma.timer.oppsett.antallRegistrert", "malbygger.veiBEllers", "livssyklus.sporMalUtenNavn",
    "statushandling.bekreftHandling", "flythjelp.handling.videresend", "ftdSok.side",
  ],
};

describe("i18n — interpolasjonsvariabler er like i alle språk", () => {
  const nb = les(FASIT);
  const nokler = Object.keys(nb);

  for (const lang of SPRAK.filter((l) => l !== FASIT)) {
    const obj = les(lang);
    const kjent = new Set(KJENT_AVVIK[lang] ?? []);

    it(`${lang}: har samme {{variabler}} som ${FASIT} på alle nøkler (utenom kjent avvik)`, () => {
      const nyeAvvik: string[] = [];
      const staleKjente: string[] = [];
      for (const k of nokler) {
        const nbVerdi = nb[k];
        const langVerdi = obj[k];
        if (nbVerdi === undefined || langVerdi === undefined) continue; // dekkes av nokkelsett.test.ts
        const likt = JSON.stringify(variabler(nbVerdi)) === JSON.stringify(variabler(langVerdi));
        if (kjent.has(k)) {
          if (likt) staleKjente.push(k); // rettet, men ikke fjernet fra KJENT_AVVIK
        } else if (!likt) {
          nyeAvvik.push(`  ${k}: nb=[${variabler(nbVerdi).join(",")}] ${lang}=[${variabler(langVerdi).join(",")}] ("${langVerdi}")`);
        }
      }
      if (nyeAvvik.length) {
        throw new Error(`${lang}.json har ${nyeAvvik.length} NYE nøkler med avvikende {{variabler}} fra nb:\n${nyeAvvik.join("\n")}`);
      }
      if (staleKjente.length) {
        throw new Error(
          `${lang}.json: ${staleKjente.length} nøkler i KJENT_AVVIK er ikke lenger avvikende — fjern dem fra lista (den kan kun krympe): ${staleKjente.join(", ")}`,
        );
      }
      expect(nyeAvvik).toEqual([]);
    });
  }

  // Sanity: fasiten har faktisk interpolerte nøkler (ellers tester vi ingenting).
  it("nb har minst én nøkkel med interpolasjon", () => {
    expect(nokler.some((k) => variabler(nb[k]!).length > 0)).toBe(true);
  });
});

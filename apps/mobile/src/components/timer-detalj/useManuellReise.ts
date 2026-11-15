import { useMemo, useState } from "react";
import {
  erApenOverforing,
  finnDagsramme,
  kontorOverforingOppsett,
  kontorOverforingRetning,
  løsOppmote,
  løsOverforingKort,
  løsReiseKort,
  manuellReiseForklaringTekst,
  periodeDatoFraOverforing,
  planleggOverforing,
  type ManuellReiseSpor,
  type OppmoteResultat,
  type ReiseKortResultat,
  type ReiseRegelsett,
} from "@sitedoc/shared";
import { hentOrganizationSettingLokalt } from "../../services/organizationSettingKatalog";
import { hentOppmotederLokalt } from "../../services/oppmotestedKatalog";
import { hentOppmotePerioderLokalt } from "../../services/oppmotePeriodeKatalog";
import { hentMatriseRadLokalt } from "../../services/reisetidMatriseKatalog";
import { hentReiseGrensepunkterLokalt } from "../../services/reiseGrensepunktKatalog";
import { hentLonnsarterLokalt, hentStandardLonnsartLokalt } from "../../services/timerKatalog";
import { hentOverforingOppslagLokalt } from "../../services/overforingOppslag";
import { hentKontorAvstandLokalt } from "../../services/oppmotestedAvstandKatalog";
import type { DagsforslagOverforingOppslag } from "../../utils/dagsforslag";

/* ============================================================================
 *  POST 2026-11-15 (13) L2 § 7 C: reise-kortet («+ Reise») på mobil.
 *
 *  Den ansatte velger aldri oppmøtested. Hooken leser periodene lokalt
 *  (offline), løser oppmøtestedet med den DELTE `løsOppmote` og regner tid,
 *  kjøretid og lønnsart med `løsReiseKort` — samme funksjoner som web og
 *  Bekreft dag. Overføring første/siste dag i en periode (TILLEGG) regnes med
 *  `løsOverforingKort` fra oppslagene `byggOverforingOppslag` gir.
 *
 *  «Siste valg på enheten» er fjernet (Kenneth-beslutning 7).
 * ============================================================================ */

export type { ManuellReiseSpor };

/** Grå forklaringslinje — delt med web (ordre (11) A). */
export const forklaringTekst = manuellReiseForklaringTekst;

export type ReiseKortValg =
  | { type: "tur" }
  | { type: "retur" }
  | { type: "overforing"; indeks: number }
  /** Del B: overføring til annet kontor (setter/avslutter midlertidig oppmøtested). */
  | { type: "kontor"; oppmotestedId: string };

/** Kallet `registrerOverforing` får når et kontorvalg lagres. */
export type KontorOverforingKall = {
  handling: "start" | "slutt";
  oppmotestedId: string | null;
  /** Periodedato etter kl. 12-regelen. */
  dato: string;
};

function lesRegel(organizationId: string): ReiseRegelsett | null {
  const r = hentOrganizationSettingLokalt(organizationId);
  if (!r) return null;
  return {
    reiseTerskelEnhet: r.reiseTerskelEnhet as ReiseRegelsett["reiseTerskelEnhet"],
    reiseTerskelMin: r.reiseTerskelMin,
    reiseTerskelM: r.reiseTerskelM ?? null,
    reiseUnderTerskelType: r.reiseUnderTerskelType as ReiseRegelsett["reiseUnderTerskelType"],
    reiseOverTerskelType: r.reiseOverTerskelType as ReiseRegelsett["reiseOverTerskelType"],
  };
}

export function useManuellReise({
  organizationId,
  userId,
  dato,
  projectId,
  byggeplassId,
  dagsrader,
  resolverLonnsartId,
  valg,
  skjulOverforingRetninger = [],
  medOverforing,
  kontekstByggeplassId,
}: {
  organizationId: string;
  userId: string;
  /** Sedelens dato (YYYY-MM-DD) — perioden som gjaldt da. */
  dato: string;
  projectId: string;
  /** Byggeplassen reisen går til (kortets valg). null = ikke valgt. */
  byggeplassId: string | null;
  /** Dagens rader — dagsrammen (første fra / siste til) regnes av ikke-reise-radene. */
  dagsrader: readonly { fraTid: string | null; tilTid: string | null; erReise: boolean }[];
  resolverLonnsartId: string | null;
  /** null = standardvalget: første tilbudte overføring, ellers Tur (TILLEGG). */
  valg: ReiseKortValg | null;
  /** Retninger sedelen alt har en overføringsrad for — tilbys ikke igjen. */
  skjulOverforingRetninger?: ReadonlyArray<"ut" | "retur">;
  /** false = kalleren viser overføringen selv (Bekreft dag har den som forslagsrad). */
  medOverforing: boolean;
  /** Kontekst-byggeplassen overføringen til et prosjekt lander på. */
  kontekstByggeplassId: string | null;
}) {
  const regel = useMemo(() => lesRegel(organizationId), [organizationId]);
  const oppmotesteder = useMemo(() => hentOppmotederLokalt(organizationId), [organizationId]);
  // Teller: perioder leses på nytt etter en overføring (optimistisk skriving).
  const [periodeVersjon, setPeriodeVersjon] = useState(0);
  const perioder = useMemo(
    () => hentOppmotePerioderLokalt(userId, organizationId),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- periodeVersjon tvinger ny lesing
    [userId, organizationId, periodeVersjon],
  );
  const grensepunkter = useMemo(
    () => hentReiseGrensepunkterLokalt(organizationId),
    [organizationId],
  );
  const standardLonnsartId = useMemo(
    () => hentStandardLonnsartLokalt(organizationId)?.id ?? null,
    [organizationId],
  );
  const lonnsartNavn = useMemo(
    () => new Map(hentLonnsarterLokalt(organizationId).map((l) => [l.id, l.navn])),
    [organizationId],
  );

  // Manuell dag har ingen GPS-start → gpsStartKontorId null.
  const oppmote: OppmoteResultat = useMemo(
    () => løsOppmote(dato, projectId, perioder, null),
    [dato, projectId, perioder],
  );

  const overforinger: DagsforslagOverforingOppslag[] = useMemo(
    () =>
      medOverforing
        ? hentOverforingOppslagLokalt({
            organizationId,
            datoer: [dato],
            perioder,
            destinasjonByggeplassId: null,
            kontekstByggeplassId,
          })
        : [],
    [medOverforing, organizationId, dato, perioder, kontekstByggeplassId],
  );

  // Overføringene som tilbys; indeksen peker inn i `overforinger`.
  const overforingValg = overforinger
    .map((o, indeks) => ({ o, indeks }))
    .filter(({ o }) => !skjulOverforingRetninger.includes(o.overforing.retning));
  const forsteOverforing = overforingValg[0]?.indeks ?? null;
  const aktivtValg: ReiseKortValg =
    valg ?? (forsteOverforing != null ? { type: "overforing", indeks: forsteOverforing } : { type: "tur" });

  const ramme = useMemo(() => finnDagsramme(dagsrader), [dagsrader]);

  // Del B: «Overføring til annet kontor» — cachen speiler bare aktive kontorer.
  const kontorOppsett = useMemo(
    () => kontorOverforingOppsett(dato, projectId, perioder, oppmotesteder.map((o) => o.id)),
    [dato, projectId, perioder, oppmotesteder],
  );
  const apenOverforing = useMemo(() => perioder.find(erApenOverforing) ?? null, [perioder]);
  const kontorValg = aktivtValg.type === "kontor" && kontorOppsett ? aktivtValg.oppmotestedId : null;
  const kontorRetning = kontorValg && kontorOppsett ? kontorOverforingRetning(kontorOppsett, kontorValg) : null;

  const resultat: ReiseKortResultat = useMemo(() => {
    const felles = {
      dagStart: ramme.dagStart,
      dagSlutt: ramme.dagSlutt,
      regel,
      grensepunkter,
      resolverLonnsartId,
      standardLonnsartId,
    };
    if (kontorValg && kontorOppsett && kontorRetning) {
      const celle = hentKontorAvstandLokalt(kontorOppsett.fraKontorId, kontorValg);
      return løsOverforingKort({
        ...felles,
        overforing: {
          retning: kontorRetning === "tur" ? "ut" : "retur",
          fra: { type: "kontor", oppmotestedId: kontorOppsett.fraKontorId },
          til: { type: "kontor", oppmotestedId: kontorValg },
          // Tur: settes til den nye periodens id ved lagring. Retur: perioden som avsluttes.
          periodeId: kontorRetning === "retur" ? (apenOverforing?.id ?? null) : null,
        },
        oppmotestedId: kontorOppsett.fraKontorId,
        kjoretidMin: celle?.kjoretidMin ?? null,
        avstandM: celle?.avstandM ?? null,
      });
    }
    if (aktivtValg.type === "overforing") {
      const o = overforinger[aktivtValg.indeks];
      if (o) {
        return løsOverforingKort({
          ...felles,
          overforing: o.overforing,
          oppmotestedId: o.oppmotestedId,
          kjoretidMin: o.celle?.kjoretidMin ?? null,
          avstandM: o.celle?.avstandM ?? null,
        });
      }
    }
    return løsReiseKort({
      ...felles,
      retning: aktivtValg.type === "retur" ? "retur" : "tur",
      oppmote,
      byggeplassId,
      kjoretidFor: (o, b) => hentMatriseRadLokalt(o, b)?.kjoretidMin ?? null,
      avstandFor: (o, b) => hentMatriseRadLokalt(o, b)?.avstandM ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- aktivtValg er avledet av valg + overforinger
  }, [valg, forsteOverforing, overforinger, kontorOppsett, apenOverforing, ramme, regel, grensepunkter, resolverLonnsartId, standardLonnsartId, oppmote, byggeplassId]);

  // Oppmøtestedet vises som tekst bare når firmaet har flere (§ 7 C).
  const oppmotestedNavn =
    oppmotesteder.length > 1 && (oppmote.kilde === "fast" || oppmote.kilde === "midlertidig" || oppmote.kilde === "gps")
      ? (oppmotesteder.find((o) => o.id === oppmote.oppmotestedId)?.navn ?? null)
      : null;

  // Kallet lagringen gjør, og om serveren ville avvist det (admin-satt midlertidig).
  const kontorKall: KontorOverforingKall | null =
    kontorValg && kontorRetning
      ? {
          handling: kontorRetning === "tur" ? "start" : "slutt",
          oppmotestedId: kontorRetning === "tur" ? kontorValg : null,
          dato: periodeDatoFraOverforing(dato, resultat.fraTid, kontorRetning),
        }
      : null;
  const kontorKonflikt =
    kontorKall != null && planleggOverforing(perioder, kontorKall).utfall === "konflikt";

  const kontorNavn = (id: string) => oppmotesteder.find((o) => o.id === id)?.navn ?? "";

  return {
    kontorOppsett,
    kontorKall,
    kontorKonflikt,
    apenOverforing,
    kontorNavn,
    lastPerioderPaaNytt: () => setPeriodeVersjon((v) => v + 1),
    oppmote,
    oppmotestedNavn,
    overforinger,
    overforingValg,
    aktivtValg,
    resultat,
    lonnsartNavn: (id: string | null) => (id ? (lonnsartNavn.get(id) ?? null) : null),
  };
}

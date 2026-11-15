"use client";

import { useMemo } from "react";
import {
  byggOverforingOppslag,
  erApenOverforing,
  finnDagsramme,
  kontorOverforingOppsett,
  kontorOverforingRetning,
  løsOppmote,
  løsOverforingKort,
  løsReiseKort,
  periodeDatoFraOverforing,
  planleggOverforing,
  type DagsforslagOverforingCelle,
  type DagsforslagOverforingOppslag,
  type OppmoteResultat,
  type ReiseKortResultat,
  type ReiseRegelsett,
} from "@sitedoc/shared";
import { trpc } from "@/lib/trpc";

/* ============================================================================
 *  POST 2026-11-15 (13) L2 § 7 C: reise-kortet («+ Reise») på web.
 *
 *  Samme regel som mobilens `useManuellReise` — kun datakilden er tRPC i
 *  stedet for lokal cache. Den ansatte velger aldri oppmøtested: periodene
 *  (`oppmotePeriode.hentMine`) løses med den DELTE `løsOppmote`, og tid,
 *  kjøretid og lønnsart regnes med `løsReiseKort`. Overføring første/siste dag
 *  i en periode (TILLEGG) regnes med `løsOverforingKort` fra
 *  `byggOverforingOppslag` — samme oppslag som mobil og Bekreft dag.
 *
 *  «Siste valg på enheten» (lagret i nettleseren) er fjernet (Kenneth-beslutning 7).
 * ============================================================================ */

export type ReiseKortValg =
  | { type: "tur" }
  | { type: "retur" }
  | { type: "overforing"; indeks: number }
  /** Del B: overføring til annet kontor (setter/avslutter midlertidig oppmøtested). */
  | { type: "kontor"; oppmotestedId: string };

/** Kallet `oppmotePeriode.overforing` får når et kontorvalg lagres (uten id/organizationId). */
export type KontorOverforingKall = {
  handling: "start" | "slutt";
  oppmotestedId: string | null;
  /** Periodedato etter kl. 12-regelen. */
  dato: string;
};

export type ReiseKortByggeplass = { id: string; projectId: string; name: string | null };

export function useManuellReiseWeb({
  organizationId,
  dato,
  projectId,
  byggeplassId,
  byggeplasser,
  prosjektNavn,
  dagsrader,
  resolverLonnsartId,
  valg,
  skjulOverforingRetninger = [],
}: {
  organizationId: string;
  /** Sedelens dato (YYYY-MM-DD) — perioden som gjaldt da. */
  dato: string;
  projectId: string;
  /** Byggeplassen reisen går til (kortets valg). null = ikke valgt. */
  byggeplassId: string | null;
  /** Firmaets byggeplasser (alle prosjekter) — overføringens byggeplass-ende. */
  byggeplasser: readonly ReiseKortByggeplass[];
  prosjektNavn: (projectId: string) => string;
  /** Dagens rader — dagsrammen regnes av ikke-reise-radene. */
  dagsrader: readonly { fraTid: string | null; tilTid: string | null; erReise: boolean }[];
  resolverLonnsartId: string | null;
  /** null = standardvalget: første tilbudte overføring, ellers Tur (TILLEGG). */
  valg: ReiseKortValg | null;
  /** Retninger sedelen alt har en overføringsrad for — tilbys ikke igjen. */
  skjulOverforingRetninger?: ReadonlyArray<"ut" | "retur">;
}) {
  const aktivert = !!organizationId;
  const q = { organizationId };
  const opt = { enabled: aktivert };
  const defaultsQ = trpc.organisasjon.hentArbeidstidDefaults.useQuery(q, opt);
  const stederQ = trpc.oppmotested.hentForFirma.useQuery(q, opt);
  const matriseQ = trpc.oppmotested.hentMatriseForFirma.useQuery(q, opt);
  const kontorQ = trpc.oppmotested.hentKontorAvstanderForFirma.useQuery(q, opt);
  const perioderQ = trpc.oppmotePeriode.hentMine.useQuery(q, opt);
  const lonnsarterQ = trpc.timer.lonnsart.list.useQuery(q, opt);

  // RETUR (11) vilkår 1 (lønn): resultatet er bare gyldig når ALT det bygger
  // på er lastet. Kalleren sperrer Lagre til status er «klar» — aldri stille
  // tilbakefall.
  const oppslag = [defaultsQ, stederQ, matriseQ, kontorQ, perioderQ, lonnsarterQ];
  const regelStatus: "klar" | "laster" | "feilet" = oppslag.some((x) => x.isError)
    ? "feilet"
    : oppslag.every((x) => x.data !== undefined)
      ? "klar"
      : "laster";

  const defaults = defaultsQ.data;
  const regel = useMemo<ReiseRegelsett | null>(() => {
    if (!defaults) return null;
    return {
      reiseTerskelEnhet: defaults.reiseTerskelEnhet as ReiseRegelsett["reiseTerskelEnhet"],
      reiseTerskelMin: defaults.reiseTerskelMin,
      reiseTerskelM: defaults.reiseTerskelM ?? null,
      reiseUnderTerskelType:
        defaults.reiseUnderTerskelType as ReiseRegelsett["reiseUnderTerskelType"],
      reiseOverTerskelType:
        defaults.reiseOverTerskelType as ReiseRegelsett["reiseOverTerskelType"],
    };
  }, [defaults]);
  const grensepunkter = useMemo(
    () => (defaults?.reiseGrenser ?? []).map((g) => ({ grenseM: g.grenseM, lonnsartId: g.lonnsartId })),
    [defaults],
  );
  const lonnsarter = lonnsarterQ.data;
  // Samme definisjon som mobilens `hentStandardLonnsartLokalt`: aktiv + erStandardvalg.
  const standardLonnsartId = useMemo(
    () => (lonnsarter ?? []).find((l) => l.aktiv && l.erStandardvalg)?.id ?? null,
    [lonnsarter],
  );
  const lonnsartNavn = useMemo(
    () => new Map((lonnsarter ?? []).map((l) => [l.id, l.navn])),
    [lonnsarter],
  );
  const steder = useMemo(() => stederQ.data ?? [], [stederQ.data]);
  const perioder = useMemo(() => perioderQ.data?.perioder ?? [], [perioderQ.data]);

  const matrise = useMemo(() => {
    const m = new Map<string, DagsforslagOverforingCelle>();
    for (const c of matriseQ.data ?? []) {
      m.set(`${c.oppmotestedId}|${c.byggeplassId}`, { kjoretidMin: c.kjoretidMin, avstandM: c.avstandM ?? null });
    }
    return m;
  }, [matriseQ.data]);
  // Kontor↔kontor lagres normalisert (fra < til) — slå opp begge veier.
  const kontorAvstand = useMemo(() => {
    const m = new Map<string, DagsforslagOverforingCelle>();
    for (const r of kontorQ.data ?? []) {
      if (r.kjoretidMin == null) continue;
      const celle = { kjoretidMin: r.kjoretidMin, avstandM: r.avstandM ?? null };
      m.set(`${r.fraOppmotestedId}|${r.tilOppmotestedId}`, celle);
      m.set(`${r.tilOppmotestedId}|${r.fraOppmotestedId}`, celle);
    }
    return m;
  }, [kontorQ.data]);

  // Manuell dag har ingen GPS-start → gpsStartKontorId null.
  const oppmote: OppmoteResultat = useMemo(
    () => løsOppmote(dato, projectId, perioder, null),
    [dato, projectId, perioder],
  );

  const overforinger: DagsforslagOverforingOppslag[] = useMemo(
    () =>
      byggOverforingOppslag({
        datoer: [dato],
        perioder,
        destinasjonByggeplassId: null,
        kontekstByggeplassId: byggeplassId,
        byggeplasserForProsjekt: (pid) =>
          byggeplasser.filter((b) => b.projectId === pid).map((b) => ({ id: b.id, navn: b.name })),
        kontorNavn: (id) => steder.find((o) => o.id === id)?.navn ?? "",
        prosjektNavn,
        kontorAvstand: (x, y) => kontorAvstand.get(`${x}|${y}`) ?? null,
        matrise: (o, b) => matrise.get(`${o}|${b}`) ?? null,
      }),
    // prosjektNavn er en ren oppslagsfunksjon fra kalleren.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dato, perioder, byggeplassId, byggeplasser, steder, kontorAvstand, matrise],
  );

  // Overføringene som tilbys; indeksen peker inn i `overforinger`.
  const overforingValg = overforinger
    .map((o, indeks) => ({ o, indeks }))
    .filter(({ o }) => !skjulOverforingRetninger.includes(o.overforing.retning));
  const forsteOverforing = overforingValg[0]?.indeks ?? null;
  const aktivtValg: ReiseKortValg =
    valg ?? (forsteOverforing != null ? { type: "overforing", indeks: forsteOverforing } : { type: "tur" });

  const ramme = useMemo(() => finnDagsramme(dagsrader), [dagsrader]);

  // Del B: «Overføring til annet kontor» — `hentForFirma` gir bare aktive kontorer.
  const kontorOppsett = useMemo(
    () => kontorOverforingOppsett(dato, projectId, perioder, steder.map((o) => o.id)),
    [dato, projectId, perioder, steder],
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
      const celle = kontorAvstand.get(`${kontorOppsett.fraKontorId}|${kontorValg}`) ?? null;
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
      kjoretidFor: (o, b) => matrise.get(`${o}|${b}`)?.kjoretidMin ?? null,
      avstandFor: (o, b) => matrise.get(`${o}|${b}`)?.avstandM ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- aktivtValg er avledet av valg + overforinger
  }, [valg, forsteOverforing, overforinger, kontorOppsett, apenOverforing, kontorAvstand, ramme, regel, grensepunkter, resolverLonnsartId, standardLonnsartId, oppmote, byggeplassId, matrise]);

  // Oppmøtestedet vises som tekst bare når firmaet har flere (§ 7 C).
  const oppmotestedNavn =
    steder.length > 1 && (oppmote.kilde === "fast" || oppmote.kilde === "midlertidig" || oppmote.kilde === "gps")
      ? (steder.find((o) => o.id === oppmote.oppmotestedId)?.navn ?? null)
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

  return {
    kontorOppsett,
    kontorKall,
    kontorKonflikt,
    apenOverforing,
    kontorNavn: (id: string) => steder.find((o) => o.id === id)?.navn ?? "",
    regelStatus,
    oppmote,
    oppmotestedNavn,
    overforinger,
    overforingValg,
    aktivtValg,
    resultat,
    lonnsartNavn: (id: string | null) => (id ? (lonnsartNavn.get(id) ?? null) : null),
  };
}

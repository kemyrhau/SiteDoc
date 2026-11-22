"use client";

import { useMemo } from "react";
import {
  effektivKortByggeplass,
  arbeidsreiseKortId,
  egetReiseKort,
  erApenOverforing,
  jobberFraArbeidsrader,
  kortIdNokkel,
  kortPaaSedelFraRader,
  velgReiseKort,
  finnDagsramme,
  kontorOverforingOppsett,
  løsOppmote,
  løsReiseKort,
  klokkeTilMin,
  minTilKlokke,
  planleggOverforing,
  tilIsoDato,
  type DagsforslagOverforingCelle,
  type OppmotePeriodeInput,
  type OppmoteResultat,
  type ReiseKortResultat,
  type ReiseRegelsett,
  type ReiseKategori,
  type ReiseKortInput,
} from "@sitedoc/shared";
import { trpc } from "@/lib/trpc";

/* ============================================================================
 *  POST 2026-11-15 (13) L2 § 7 C: reise-kortet («+ Reise») på web.
 *
 *  Samme regel som mobilens `useManuellReise` — kun datakilden er tRPC i
 *  stedet for lokal cache. Den ansatte velger aldri oppmøtested: periodene
 *  (`oppmotePeriode.hentMine`) løses med den DELTE `løsOppmote`, og tid,
 *  kjøretid og lønnsart regnes med `løsReiseKort`.
 *
 *  § 8.22 punkt 2 (Kenneth 2026-11-21, svar 1A): reise til annet kontor har ingen egen
 *  reisetype eller kortregel på PC. Arbeideren kan sette et midlertidig oppmøtested selv
 *  («Fra et annet kontor fra i dag», `annetKontorId`): reisen regnes og lagres som vanlig
 *  reise fra det kontoret, og `oppmotePeriode.overforing` setter perioden fra sedeldatoen.
 *
 *  «Siste valg på enheten» (lagret i nettleseren) er fjernet (Kenneth-beslutning 7).
 * ============================================================================ */

export type ReiseKortValg = { type: "tur" } | { type: "retur" };

/** Kallet `oppmotePeriode.overforing` får når «Fra et annet kontor fra i dag» lagres. */
export type KontorOverforingKall = {
  handling: "start";
  oppmotestedId: string;
  /** Sedeldatoen: perioden gjelder fra i dag. */
  dato: string;
};

export type ReiseKortByggeplass = { id: string; projectId: string; name: string | null };

/** w15b: en rad på sedelen slik linja «havner i» og overlapp-sperren leser den. */
export type ReiseHavnerRad = {
  fraTid: string | null;
  erReise: boolean;
  kortId?: string | null;
  projectId?: string | null;
  ecoId?: string | null;
  /** Radens egen byggeplass; den effektive regnes med sedelens. */
  byggeplassId?: string | null;
  /** ms */
  opprettet?: number;
  attestertStatus?: string | null;
};

/** w15f (F55): maskin-, tillegg- og utleggsrader på sedelen — kort som ikke har arbeid. */
export type ReiseHavnerAnnenRad = {
  kortId: string | null;
  projectId: string | null;
  ecoId: string | null;
  byggeplassId: string | null;
  /** ms */
  opprettet: number;
};

export type ReiseHavnerI =
  | { type: "jobb"; kortId: string; byggeplassId: string | null; projectId: string }
  /** w15f (F55): et kort som finnes, men ikke har arbeid (bare maskin, tillegg eller utlegg). */
  | { type: "kort"; kortId: string; byggeplassId: string | null; projectId: string }
  | { type: "eget"; projectId: string };

/**
 * w15b: hvilket kort reisen havner i — det serveren gjør i `sikreKortId`
 * (`apps/api/src/services/timer/kortId.ts`) etter lagring, regnet før lagring:
 *  - reise (`erReise`): den delte `velgReiseKort` på dagens jobber; `null` → eget kort.
 *  - under terskel (`erReise` false): raden er arbeid og står i kortet med samme
 *    nøkkel (prosjekt, effektiv byggeplass, underprosjekt), ellers eget kort.
 * Linja følger regelen den kaller — endres `velgReiseKort` (w15c), endres linja.
 * § 8.22 punkt 3: en lagret reise (`lagret`) med uendret nøkkel blir i kortet den står i —
 * regelen gjelder bare ny reise og reise der prosjekt, byggeplass eller underprosjekt rettes.
 * w15f (F55): med `andreRader` og `eier` ser linja også kort uten arbeid. Reise uten jobb får
 * `egetReiseKort` (serveren, `kortId.ts`); har en maskin-, tillegg- eller utleggsrad den id-en,
 * står reisen i det kortet. Under terskel brukes `losKortId`-regelen mot alle radtypene.
 */
export function reiseHavnerI(args: {
  rader: readonly ReiseHavnerRad[];
  /** w15f (F55): maskin, tillegg og utlegg på sedelen. */
  andreRader?: readonly ReiseHavnerAnnenRad[];
  /** w15f (F55): sedelens eier og dato (ÅÅÅÅ-MM-DD) — kort-id-en regnes som på serveren. */
  eier?: { userId: string; dato: string } | null;
  sedelByggeplass: { id: string; projectId: string } | null;
  reise: {
    projectId: string;
    ecoId: string | null;
    byggeplassId: string | null;
    retning: "ut" | "retur" | null;
    fraTid: string | null;
    erReise: boolean;
  };
  /** O1 (§ 8.22): jobben vinduet ble åpnet fra. Under terskel står turen i den jobben når
   *  nøkkelen er lik (`arbeidsreiseKortId`), ellers i eldste jobb med nøkkelen som før. */
  jobbKortId?: string | null;
  /** § 8.22 punkt 3: reiseraden slik den er lagret (ved retting). Utelatt = ny reise. */
  lagret?: {
    kortId: string | null;
    projectId: string | null;
    byggeplassId: string | null;
    ecoId: string | null;
    erReise: boolean;
  } | null;
}): ReiseHavnerI {
  const { rader, sedelByggeplass, reise } = args;
  const andre = (args.andreRader ?? []).map((r) => ({
    kortId: r.kortId,
    nokkel: kortIdNokkel({
      projectId: r.projectId,
      byggeplassId: effektivKortByggeplass(r.projectId, r.byggeplassId, sedelByggeplass),
      ecoId: r.ecoId,
    }),
    opprettet: r.opprettet,
  }));
  const jobber = jobberFraArbeidsrader(
    rader
      .filter((r) => !r.erReise)
      .map((r) => ({
        kortId: r.kortId ?? null,
        projectId: r.projectId ?? null,
        ecoId: r.ecoId ?? null,
        byggeplassId: effektivKortByggeplass(r.projectId ?? null, r.byggeplassId, sedelByggeplass),
        fraTid: r.fraTid,
        opprettet: r.opprettet ?? 0,
        attestertStatus: r.attestertStatus ?? null,
      })),
  );
  const reiseNokkel = {
    projectId: reise.projectId,
    byggeplassId: effektivKortByggeplass(reise.projectId, reise.byggeplassId, sedelByggeplass),
    ecoId: reise.ecoId,
  };
  let kortId: string | null;
  // F55: kortet uten arbeid reisen havner i, når den ikke står i en jobb.
  let annetKort: string | null = null;
  const lagret = args.lagret;
  const lagretKort =
    reise.erReise &&
    lagret?.erReise &&
    lagret.kortId &&
    kortIdNokkel({
      projectId: lagret.projectId,
      byggeplassId: effektivKortByggeplass(lagret.projectId, lagret.byggeplassId, sedelByggeplass),
      ecoId: lagret.ecoId,
    }) === kortIdNokkel(reiseNokkel)
      ? lagret.kortId
      : null;
  if (lagretKort) {
    kortId = lagretKort;
    if (!jobber.some((j) => j.kortId === lagretKort) && andre.some((r) => r.kortId === lagretKort))
      annetKort = lagretKort;
  } else if (reise.erReise) {
    kortId = velgReiseKort(
      {
        projectId: reise.projectId,
        ecoId: reise.ecoId,
        // Effektiv byggeplass, som serveren (w15c).
        byggeplassId: effektivKortByggeplass(reise.projectId, reise.byggeplassId, sedelByggeplass),
        retning: reise.retning,
        fraTid: reise.fraTid,
      },
      jobber,
    );
    if (!kortId && args.eier) {
      const egen = egetReiseKort({
        userId: args.eier.userId,
        dato: args.eier.dato,
        nokkel: reiseNokkel,
        jobbKortIder: jobber.map((j) => j.kortId),
      });
      annetKort = andre.some((r) => r.kortId === egen) ? egen : null;
    }
  } else {
    const nokkel = kortIdNokkel(reiseNokkel);
    kortId =
      arbeidsreiseKortId(reiseNokkel, jobber, args.jobbKortId) ??
      jobber.find((j) => kortIdNokkel(j) === nokkel)?.kortId ??
      null;
    if (!kortId) annetKort = kortPaaSedelFraRader(andre).find((k) => k.nokkel === nokkel)?.kortId ?? null;
  }
  const jobb = kortId ? jobber.find((j) => j.kortId === kortId) : undefined;
  if (jobb) return { type: "jobb", kortId: jobb.kortId, byggeplassId: jobb.byggeplassId, projectId: reise.projectId };
  if (annetKort) return { type: "kort", kortId: annetKort, byggeplassId: reiseNokkel.byggeplassId, projectId: reise.projectId };
  return { type: "eget", projectId: reise.projectId };
}

/**
 * Gate (123) vilkår 1 (§ 8.22: «kjøring før første sted eller etter siste sted er reise»):
 * på byggeplassperiodens første dag er Tur en vanlig reise, og på siste dag er Retur det.
 * Reisen regnes fra hjemstedet — samme hjemsted som `finnOverforinger` bruker
 * (`løsOppmote` uten byggeplassperioden). Mellomdagene, og Retur første dag / Tur siste
 * dag, beholder `byggeplass` (sperret). Ingen egen kortregel, ingen periodekall.
 */
export function oppmoteForReise(
  dato: string,
  projectId: string,
  retning: "tur" | "retur",
  perioder: readonly OppmotePeriodeInput[],
  periodeOppmote: OppmoteResultat,
): OppmoteResultat {
  if (periodeOppmote.kilde !== "byggeplass") return periodeOppmote;
  const p = perioder.find((q) => {
    if (q.type !== "byggeplass" || q.projectId !== projectId) return false;
    const fra = tilIsoDato(q.fraDato);
    const til = q.tilDato != null ? tilIsoDato(q.tilDato) : null;
    return retning === "tur" ? fra === dato : til === dato;
  });
  if (!p) return periodeOppmote;
  const hjem = løsOppmote(dato, null, perioder.filter((q) => q !== p), null);
  return hjem.kilde === "ikkeValgt" || hjem.kilde === "byggeplass" ? periodeOppmote : hjem;
}

/**
 * O8 (§ 8.22 punkt 2): kjøretidsforslaget rundes til firmaets tidsrunding (15/30/60 min) —
 * til nærmeste intervall, men aldri ned til 0 når det finnes en reise. null/0 = ingen runding.
 * 37 min med 30 → 30; 50 → 60; 4 → 30.
 */
export function rundKjoretidForslag(kjoretidMin: number, rundingMin: number | null | undefined): number {
  if (!rundingMin || kjoretidMin <= 0) return kjoretidMin;
  return Math.max(rundingMin, Math.round(kjoretidMin / rundingMin) * rundingMin);
}

/**
 * O8 (§ 8.22 punkt 2): reiseforslaget med avrundet varighet. Bare FORSLAGET rundes: tider
 * arbeideren har skrevet, står som de er. Retningen gjelder etter avrunding — «Til byggeplass»
 * holder Slutt (jobbstart) og flytter Start, «Fra byggeplass» holder Start og flytter Slutt.
 * Terskelen og sporets kjøretid står på firmaets kjøretid (urørt).
 */
export function løsReiseKortAvrundet(inn: ReiseKortInput, rundingMin: number | null | undefined): ReiseKortResultat {
  const forslag = løsReiseKort(inn);
  if (!rundingMin || forslag.kjoretidMin == null || forslag.fraTid == null) return forslag;
  if (inn.startTid && inn.sluttTid) return forslag;
  const k = forslag.kjoretidMin;
  const d = rundKjoretidForslag(k, rundingMin);
  if (d === k) return forslag;
  const forslagFra = klokkeTilMin(forslag.fraTid);
  if (forslagFra == null) return forslag;
  const naar = inn.naar ?? (inn.retning === "tur" ? "forArbeid" : "etterArbeid");
  // Skrevet start står; ellers: før arbeid ankres slutten (start = anker − d), etter arbeid starten.
  const fra = klokkeTilMin(inn.startTid) ?? (naar === "forArbeid" ? forslagFra + k - d : forslagFra);
  const til = klokkeTilMin(inn.sluttTid) ?? fra + d;
  if (fra < 0 || til > 24 * 60) {
    return { ...forslag, timer: 0, fraTid: null, tilTid: null, klassifisering: null, spor: null, sperre: "utenforDognet" };
  }
  return løsReiseKort({ ...inn, startTid: minTilKlokke(fra), sluttTid: minTilKlokke(til) });
}

export function useManuellReiseWeb({
  organizationId,
  dato,
  projectId,
  byggeplassId,
  dagsrader,
  resolverLonnsartId,
  valg,
  annetKontorId = null,
  startTid = null,
  sluttTid = null,
  kategoriValg = null,
}: {
  organizationId: string;
  /** Sedelens dato (YYYY-MM-DD) — perioden som gjaldt da. */
  dato: string;
  projectId: string;
  /** Byggeplassen reisen går til (kortets valg). null = ikke valgt. */
  byggeplassId: string | null;
  /** Dagens rader — dagsrammen regnes av ikke-reise-radene. */
  dagsrader: readonly { fraTid: string | null; tilTid: string | null; erReise: boolean }[];
  resolverLonnsartId: string | null;
  /** null = Tur. */
  valg: ReiseKortValg | null;
  /** «Fra et annet kontor fra i dag» (§ 8.22, svar 1A). null = oppmøtestedet perioden gir. */
  annetKontorId?: string | null;
  /** w15b: arbeiderens rettede start/slutt (HH:MM). null = forslaget. */
  startTid?: string | null;
  sluttTid?: string | null;
  /** O1 TILLEGG: arbeiderens valg reisetid/arbeidstid. null = regelen (terskelen) foreslår. */
  kategoriValg?: ReiseKategori | null;
}) {
  const aktivert = !!organizationId;
  const q = { organizationId };
  const opt = { enabled: aktivert };
  const defaultsQ = trpc.organisasjon.hentArbeidstidDefaults.useQuery(q, opt);
  const stederQ = trpc.oppmotested.hentForFirma.useQuery(q, opt);
  const matriseQ = trpc.oppmotested.hentMatriseForFirma.useQuery(q, opt);
  const perioderQ = trpc.oppmotePeriode.hentMine.useQuery(q, opt);
  const lonnsarterQ = trpc.timer.lonnsart.list.useQuery(q, opt);

  // RETUR (11) vilkår 1 (lønn): resultatet er bare gyldig når ALT det bygger
  // på er lastet. Kalleren sperrer Lagre til status er «klar» — aldri stille
  // tilbakefall.
  const oppslag = [defaultsQ, stederQ, matriseQ, perioderQ, lonnsarterQ];
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
  // Manuell dag har ingen GPS-start → gpsStartKontorId null.
  const periodeOppmote: OppmoteResultat = useMemo(
    () => løsOppmote(dato, projectId, perioder, null),
    [dato, projectId, perioder],
  );

  const aktivtValg: ReiseKortValg = valg ?? { type: "tur" };
  const ramme = useMemo(() => finnDagsramme(dagsrader), [dagsrader]);

  // «Fra et annet kontor fra i dag» — `hentForFirma` gir bare aktive kontorer.
  const kontorOppsett = useMemo(
    () => kontorOverforingOppsett(dato, projectId, perioder, steder.map((o) => o.id)),
    [dato, projectId, perioder, steder],
  );
  const apenOverforing = useMemo(() => perioder.find(erApenOverforing) ?? null, [perioder]);
  const valgtKontor = annetKontorId && kontorOppsett?.andre.includes(annetKontorId) ? annetKontorId : null;
  // Reisen regnes fra det valgte kontoret, som om perioden alt var satt.
  const retning = aktivtValg.type === "retur" ? "retur" : "tur";
  const oppmote: OppmoteResultat = useMemo(
    () =>
      valgtKontor
        ? { kilde: "midlertidig", oppmotestedId: valgtKontor }
        : oppmoteForReise(dato, projectId, retning, perioder, periodeOppmote),
    [valgtKontor, dato, projectId, retning, perioder, periodeOppmote],
  );

  // O8: firmaets tidsrunding (null = ingen runding).
  const rundingMin = defaults?.tidsrundingMinutter ?? null;
  const resultat: ReiseKortResultat = useMemo(
    () =>
      løsReiseKortAvrundet({
        dagStart: ramme.dagStart,
        dagSlutt: ramme.dagSlutt,
        regel,
        grensepunkter,
        resolverLonnsartId,
        standardLonnsartId,
        startTid,
        sluttTid,
        kategoriValg,
        retning,
        oppmote,
        byggeplassId,
        kjoretidFor: (o, b) => matrise.get(`${o}|${b}`)?.kjoretidMin ?? null,
        avstandFor: (o, b) => matrise.get(`${o}|${b}`)?.avstandM ?? null,
      }, rundingMin),
    [retning, ramme, regel, grensepunkter, resolverLonnsartId, standardLonnsartId, oppmote, byggeplassId, matrise, startTid, sluttTid, kategoriValg, rundingMin],
  );

  // Oppmøtestedet vises som tekst bare når firmaet har flere (§ 7 C).
  const oppmotestedNavn =
    steder.length > 1 && (oppmote.kilde === "fast" || oppmote.kilde === "midlertidig" || oppmote.kilde === "gps")
      ? (steder.find((o) => o.id === oppmote.oppmotestedId)?.navn ?? null)
      : null;

  // Kallet lagringen gjør, og om serveren ville avvist det (admin-satt midlertidig).
  const kontorKall: KontorOverforingKall | null = valgtKontor
    ? { handling: "start", oppmotestedId: valgtKontor, dato }
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
    aktivtValg,
    resultat,
    lonnsartNavn: (id: string | null) => (id ? (lonnsartNavn.get(id) ?? null) : null),
  };
}

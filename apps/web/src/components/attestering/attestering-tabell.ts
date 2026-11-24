import {
  grupperPaaKort,
  visProsjektnummer,
  overlappBlokkererAttestering,
  timerTabellVerdi,
  antallUnderlinjer,
  beregnJobbMaskinBrudd,
  doegnOverArbeid,
  maskinJobbNokkel,
  erArbeidstidReise,
  erFravaerArt,
  erOvertidsnivaa,
  reiseUnderTerskel,
  type ReiseUnderTerskel,
  type TimerTabellLinje,
  type TimerTabellKolKey,
  type TimerTabellMaskin,
  type TimerTabellVare,
  type KortLinjeGruppe,
} from "@sitedoc/shared";
import type { AttUke } from "./ukelinje";
import type { MaskinRad, RadProsjekt, TilleggRad, TimerRad } from "./attestering-buckets";
import { radIKontekst } from "./attestering-buckets";
import { sedelKreverVurdering } from "./sedel-vurdering";

/**
 * Modellen bak firma-attesteringens Sedler-fane (spec prosjektkort-kortid § 12.6 d2b-1,
 * § 12.8.5). Ren funksjon: sedlene fra `hentTilAttesteringFirma` → dag (dagseddel) →
 * prosjektsedler (kort, via `grupperPaaKort`, T35) → linjer (H10: timeraden med sine
 * maskiner og varer). Ingen egen bøtting på underprosjekt eller radtype.
 *
 * Komponenten (`AttesteringTabell`) tegner modellen med `TimerRadTabell`; her ligger
 * alt som kan testes uten DOM: hva en linje viser, hva ✓ sender, sperrer, filter og
 * utvalget.
 */

export type RadIder = { timerIder: string[]; maskinIder: string[]; tilleggIder: string[] };

type Rettet = { felt: string; foer: string | number | null; avNavn: string | null; ved: Date | string };
type Beriket = {
  kortId: string | null;
  createdAt?: Date | string | null;
  byggeplassNavn?: string | null;
  underprosjekt?: { proAdmId: string | null; kortNavn: string | null; navn: string | null } | null;
  rettedeFelter?: Rettet[];
};
type MedProsjektnummer = { project?: (NonNullable<RadProsjekt> & { projectNumber?: string | null }) | null };

export type AttTimer = TimerRad & Beriket & MedProsjektnummer;
export type AttMaskin = MaskinRad & Beriket & MedProsjektnummer & { utleieEnhet?: string | null; manglerTimerad?: boolean };
export type AttTillegg = TilleggRad & Beriket & MedProsjektnummer;
export type AttVare = {
  id: string;
  navn: string | null;
  enhet: string | null;
  antall: number;
  projectId: string | null;
  sheetTimerId: string | null;
  kortId: string | null;
  attestert: boolean;
  createdAt?: Date | string | null;
};
export type AttUtlegg = {
  id: string;
  belop: unknown;
  expenseCategory: { navn: string } | null;
  kortId: string | null;
  projectId?: string | null;
  /** Ordre d2b-2: prosjektlista gir prosjektet; `null` = annet prosjekt uten tilgang. */
  project?: MedProsjektnummer["project"];
  /**
   * Ordre d2b-3 (d): kvitteringene, server-signert. Serveren sender dem bare på rader
   * brukeren kan attestere; ellers `[]`.
   */
  vedlegg?: AttVedlegg[];
};
export type AttVedlegg = { id: string; fileName: string; mimeType: string; fileUrl: string };

export type AttSedel = {
  id: string;
  dato: Date | string;
  totaltimer: number;
  /** Dagsnormen; null der kilden ikke har den (detaljsiden) — da står ingen «av norm»-tekst. */
  dagsnorm: number | null;
  pauseMin: number;
  tilleggHarKrav: boolean;
  redigerTillatt: boolean;
  manglerMaskinforerbevis: boolean;
  normStatus?: "server" | "cachet" | "ukjent" | null;
  konfliktVentendeSiden?: Date | string | null;
  ansatt: { id: string; name: string | null; email: string; ansattnummer: string | null; avdelingId: string | null } | null;
  prosjekt?: RadProsjekt;
  timer: AttTimer[];
  maskiner: AttMaskin[];
  tillegg: AttTillegg[];
  utlegg: AttUtlegg[];
  varer?: AttVare[];
  ukeAvvikRadIder?: string[];
  /** A4: ukas regnestykke fra serveren (ukelinja, «N t kan trekkes» på dagen). */
  uke?: AttUke | null;
  /**
   * A4 (B53 A): attestert dag vist under ukelinja på fanen «Venter», fordi uka har ukevarsel.
   * Dagen er låst som på fanen «Attestert» og har ↺.
   */
  attestertVisning?: boolean;
  fravaerKanAttesteres?: boolean;
  /** w7 (B15): sedelen er attestantens egen og firmaet sier Nei — vises, men kan ikke attesteres/rettes. */
  egneTimer?: boolean;
  /** w10a (A6): dagens «Kommentar» (`DailySheet.beskrivelse`), vist i kortet som «Kommentar til dagen». */
  beskrivelse?: string | null;
};

/** Oppslag og tekster modellen trenger (komponenten sender `t()` og katalogene). */
export interface AttDeps {
  lonnsartNavn: (id: string) => string;
  aktivitetNavn: (id: string) => string;
  maskinNavn: (id: string) => string;
  tilleggNavn: (id: string) => string;
  avdelingNavn: (id: string | null) => string | null;
  /** Sedelens sperre-tekst (B10 fraværstak), eller null. */
  normtakLinje: (s: AttSedel) => string | null;
  /**
   * Ukeavvikets tekst på en merket linje (T29/T39), eller null. `linjeTimer` = timene på linja;
   * A4b: «kan trekkes» begrenses til dem.
   */
  ukeAvvikTekst: (s: AttSedel, linjeTimer: number) => string | null;
  /** w9: forklaringen på merket «Maskin over arbeid» — «Maskin 7,5 t, arbeid 4,5 t». */
  maskinOverArbeidForklaring: (maskinTimer: number, arbeidTimer: number) => string;
  /**
   * A3 (§ 4.17 del D, B55): merket «Reise under terskel» med forklaringen. Uten den får
   * reiselinja ikke merke (testene som ikke gjelder A3).
   */
  reiseUnderTerskelMerke?: (u: ReiseUnderTerskel) => AvvikMerke;
  tekst: {
    forslagSperre: string;
    maskinUtenTimerad: string;
    maskinforerbevis: string;
    /** w1 (B7): korte merker i Avvik på skjerm; forklaringen vises på hover/trykk. */
    merkeUtenTimerad: string;
    merkeUtenTimeradForklaring: string;
    merkeUtenForerbevis: string;
    /** w9 (B21 A / B23 B): jobbens maskiner har flere timer enn arbeidet. */
    merkeMaskinOverArbeid: string;
    tilleggskrav: string;
    tilByggherre: string;
    fravaerUtenProsjekt: string;
    /** Rad på et prosjekt brukeren ikke har tilgang til (R13: navnet sendes ikke). */
    annetProsjekt: string;
    reise: string;
    /** w12 (§ 4.11 C1): reiselinja uten underprosjekt i en jobb som har ett. */
    utenUnderprosjekt: string;
    statusVenter: string;
    statusAttestert: string;
    statusReturnert: string;
  };
}

export type AttKilde =
  | { type: "timer"; rad: AttTimer; maskiner: AttMaskin[]; varer: AttVare[] }
  | { type: "maskin"; rad: AttMaskin }
  | { type: "vare"; rad: AttVare }
  | { type: "tillegg"; rad: AttTillegg }
  | { type: "utlegg"; rad: AttUtlegg };

/**
 * Ett avvik slik skjermen viser det (w1, B7). Med `forklaring` tegnes et kort merke på
 * én linje, og forklaringen vises når pekeren holdes over (trykk på berøringsskjerm).
 * Uten `forklaring` står teksten som før.
 */
/**
 * Et merke med forklaring på hover. `linjer` (A4b): forklaringen vist som én opplysning pr.
 * linje uten bryting inne i linja; `forklaring` er de samme delene på én linje (tekstflater).
 */
export type AvvikMerke = { tekst: string; forklaring: string | null; linjer?: readonly string[] };

export interface AttLinje {
  nokkel: string;
  sheetId: string;
  kortNokkel: string;
  linje: TimerTabellLinje;
  kilde: AttKilde;
  /** Det ✓, retur og gjenåpne sender for linja (R10): timeraden + maskinene på den. */
  radIder: RadIder;
  /** Vare- og utleggslinjer har ingen egen ✓ — de følger kortet (R10). */
  harHandling: boolean;
  ventende: boolean;
  attestert: boolean;
  /** Grunnen til at datoen er sperret (B10/V19, R11), eller null. */
  sperre: string | null;
  projectId: string | null;
  /** Felt → verdien før retting (T57: «var 5,00» i cella). */
  rettet: Record<string, string | number | null>;
  /** Avvikene som merker på skjermen (w1). `linje.avvik` bærer hele teksten (filter, ukeoversikt). */
  avvikMerker: AvvikMerke[];
}

export interface AttKort {
  nokkel: string;
  sheetId: string;
  /** Kortets prosjekt (K2: ett prosjekt pr. kort); null = fravær uten prosjekt. */
  projectId: string | null;
  prosjektnummer: string;
  prosjekt: string;
  underprosjekt: string | null;
  byggeplass: string | null;
  /**
   * Kortet har bare reiserader: reise alene i et kort (w12, § 4.11 C7) eller den gamle blokken
   * «Reise» for reise uten kort-id (C9). Jobbraden sier «Reise», og kortet har ikke
   * underprosjektvalget i hodet.
   */
  reise: boolean;
  linjer: AttLinje[];
}

export interface AttDag {
  sedel: AttSedel;
  dato: string;
  ansatt: string;
  ansattnr: string | null;
  sperre: string | null;
  kort: AttKort[];
}

const tall = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));

export function isoDato(d: Date | string): string {
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return new Date(d).toISOString().slice(0, 10);
}

/**
 * Datoen slik attesteringens skjerm viser den (w1, tillegget til B7): «17.11.». Året står
 * i årsvelgeren ved ukevalget. Spenner tabellen over flere år (prosjektets attestering har
 * ikke ukevalg), står året med — «17.11.2026» — så to datoer aldri ser like ut.
 * Eksporten har egen formatering og beholder året (`timer-rapport-eksport.ts`).
 */
export function visDato(iso: string, medAar: boolean): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return medAar ? `${m[3]}.${m[2]}.${m[1]}` : `${m[3]}.${m[2]}.`;
}

/** Har tabellen dager fra mer enn ett kalenderår? Da må året stå i datoen. */
export function spennerFlereAar(dager: readonly { dato: string }[]): boolean {
  return new Set(dager.map((d) => d.dato.slice(0, 4))).size > 1;
}

function underprosjektTekst(rad: Partial<Beriket> & { externalCostObjectId?: string | null }, tilByggherre: string): string | null {
  const u = rad.underprosjekt;
  if (!u) return null;
  const navn = [u.proAdmId, u.kortNavn ?? u.navn].filter(Boolean).join(" · ");
  // «Til byggherre» (STOPP a): synlig tekst i cella, ikke bare et merke i kortet.
  return navn ? `${navn} · ${tilByggherre}` : tilByggherre;
}

function maskinTilLinje(m: AttMaskin, deps: AttDeps): TimerTabellMaskin {
  return {
    id: m.id,
    navn: deps.maskinNavn(m.vehicleId),
    fraTid: m.fraTid,
    tilTid: m.tilTid,
    timer: tall(m.timer),
    mengde: tall(m.mengde),
    enhet: m.enhet,
    utenTimerad: m.manglerTimerad === true,
  };
}

function vareTilLinje(v: AttVare): TimerTabellVare {
  return { id: v.id, navn: v.navn, enhet: v.enhet, mengde: v.antall };
}

function linjeStatus(attestertStatus: string | null | undefined, deps: AttDeps): string {
  if (attestertStatus === "attestert") return deps.tekst.statusAttestert;
  if (attestertStatus === "returnert") return deps.tekst.statusReturnert;
  return deps.tekst.statusVenter;
}

function rettetMap(r: Partial<Beriket> | undefined): Record<string, string | number | null> {
  const ut: Record<string, string | number | null> = {};
  for (const f of r?.rettedeFelter ?? []) if (!(f.felt in ut)) ut[f.felt] = f.foer;
  return ut;
}

/**
 * w9 (B21 A, B23 B, S2): merket «Maskin over arbeid» pr. jobb (`maskinJobbNokkel`).
 * Førermaskinene (sum) over jobbens arbeid = gammelt brudd; hver døgn-maskin for seg
 * over arbeidet = varsel. Samme delte regel som serveren. Bare jobber med ventende
 * rader får merket — det stopper ikke ✓. Eldre rader uten jobb vurderes i bøtta
 * (prosjekt + underprosjekt, med pause) og merkes på samlekortet.
 */
export function maskinOverArbeidMerker(s: AttSedel, deps: AttDeps): Map<string, AvvikMerke> {
  const timer = s.timer.map((r) => ({
    kortId: r.kortId,
    projectId: r.projectId,
    externalCostObjectId: r.externalCostObjectId ?? null,
    timer: tall(r.timer) ?? 0,
    erReise: r.erReise === true,
  }));
  const maskin = s.maskiner.map((m) => ({
    kortId: m.kortId,
    projectId: m.projectId,
    externalCostObjectId: m.externalCostObjectId ?? null,
    timer: tall(m.timer) ?? 0,
    utleieEnhet: m.utleieEnhet ?? null,
  }));
  const ventende = new Set(
    [...s.timer, ...s.maskiner]
      .filter((r) => r.attestertStatus === "pending")
      .map((r) => maskinJobbNokkel({ kortId: r.kortId, projectId: r.projectId, externalCostObjectId: r.externalCostObjectId ?? null })),
  );
  const forklaringer = new Map<string, string[]>();
  const legg = (nokkel: string, maskinTimer: number, arbeidTimer: number) => {
    if (!ventende.has(nokkel)) return;
    const liste = forklaringer.get(nokkel) ?? [];
    liste.push(deps.maskinOverArbeidForklaring(maskinTimer, arbeidTimer));
    forklaringer.set(nokkel, liste);
  };
  for (const b of beregnJobbMaskinBrudd(timer, maskin, s.pauseMin)) legg(b.nokkel, b.maskinSum, b.arbeidSum);
  for (const d of doegnOverArbeid(timer, maskin, s.pauseMin)) legg(d.nokkel, d.maskinTimer, d.arbeidSum);
  return new Map(
    [...forklaringer].map(([nokkel, liste]) => [nokkel, { tekst: deps.tekst.merkeMaskinOverArbeid, forklaring: liste.join(" · ") }]),
  );
}

/** Bygg dag → kort → linjer for sedlene (sortert på dato, så ansatt). */
export function byggAttesteringModell(sedler: readonly AttSedel[], deps: AttDeps): AttDag[] {
  const sortert = [...sedler].sort(
    (a, b) =>
      isoDato(a.dato).localeCompare(isoDato(b.dato)) ||
      (a.ansatt?.name ?? "").localeCompare(b.ansatt?.name ?? "", "nb"),
  );
  return sortert.map((s) => byggDag(s, deps));
}

function byggDag(s: AttSedel, deps: AttDeps): AttDag {
  const dato = isoDato(s.dato);
  const ansatt = s.ansatt?.name ?? s.ansatt?.email ?? "";
  const ansattnr = s.ansatt?.ansattnummer ?? null;
  const avdeling = deps.avdelingNavn(s.ansatt?.avdelingId ?? null);
  const forslag = overlappBlokkererAttestering(s.konfliktVentendeSiden ?? null) ? deps.tekst.forslagSperre : null;
  const normtak = deps.normtakLinje(s);
  const sperre = [normtak, forslag].filter(Boolean).join(" · ") || null;
  const ukeIder = new Set(s.ukeAvvikRadIder ?? []);
  const maskinOverArbeid = maskinOverArbeidMerker(s, deps);

  const gruppering = grupperPaaKort<AttTimer, AttMaskin, AttVare, AttTillegg, AttUtlegg>({
    timer: s.timer,
    maskiner: s.maskiner,
    varer: s.varer ?? [],
    tillegg: s.tillegg,
    utlegg: s.utlegg,
  });

  // `prosjekt`: objektet = navn og nummer; `null` med projectId = annet prosjekt uten
  // tilgang (prosjektlista, R13); `undefined` = ikke oppgitt (vare).
  const felles = (projectId: string | null | undefined, prosjekt: MedProsjektnummer["project"], beriket: Partial<Beriket> & { externalCostObjectId?: string | null }) => ({
    dato,
    ansatt,
    ansattnr,
    prosjektnummer: visProsjektnummer(prosjekt ?? null) || null,
    prosjekt:
      prosjekt?.name ??
      (projectId === null ? deps.tekst.fravaerUtenProsjekt : projectId && prosjekt === null ? deps.tekst.annetProsjekt : ""),
    avdeling,
    byggeplass: beriket.byggeplassNavn ?? null,
    underprosjekt: beriket.externalCostObjectId ? underprosjektTekst(beriket, deps.tekst.tilByggherre) : null,
    kort: null,
  });

  const lagLinje = (g: KortLinjeGruppe<AttTimer, AttMaskin, AttVare, AttTillegg, AttUtlegg>, kortNokkel: string, i: number): AttLinje => {
    const avvik: string[] = [];
    const avvikMerker: AvvikMerke[] = [];
    // Hele teksten i `avvik`; merket (kort tekst + forklaring) i `avvikMerker`.
    const leggTilAvvik = (tekst: string, merke?: AvvikMerke) => {
      avvik.push(tekst);
      avvikMerker.push(merke ?? { tekst, forklaring: null });
    };
    const utenTimerad = () =>
      leggTilAvvik(deps.tekst.maskinUtenTimerad, { tekst: deps.tekst.merkeUtenTimerad, forklaring: deps.tekst.merkeUtenTimeradForklaring });
    const utenForerbevis = () =>
      leggTilAvvik(deps.tekst.maskinforerbevis, { tekst: deps.tekst.merkeUtenForerbevis, forklaring: deps.tekst.maskinforerbevis });
    const nokkel = `${s.id}:${g.type}:${g.rad.id}`;
    const base = { nokkel, sheetId: s.id, kortNokkel, sperre, avvikMerker };
    // w9: «Maskin over arbeid» på jobbens linjer med maskin; jobbraden samler merkene.
    const overArbeid = (rad: { kortId: string | null; projectId: string | null; externalCostObjectId?: string | null }) => {
      const merke = maskinOverArbeid.get(maskinJobbNokkel({ ...rad, externalCostObjectId: rad.externalCostObjectId ?? null }));
      if (merke) leggTilAvvik(`${merke.tekst} (${merke.forklaring ?? ""})`, merke);
    };
    if (g.type === "timer" || g.type === "reise") {
      // w12 (§ 4.11 C1): reiselinja er en timelinje uten maskiner og varer (K6).
      const r = g.rad;
      const gMaskiner = g.type === "timer" ? g.maskiner : [];
      const gVarer = g.type === "timer" ? g.varer : [];
      const maskiner = gMaskiner.map((m) => maskinTilLinje(m, deps));
      if (sperre) leggTilAvvik(sperre);
      if (ukeIder.has(r.id)) {
        const ukeTekst = deps.ukeAvvikTekst(s, tall(r.timer) ?? 0);
        if (ukeTekst) leggTilAvvik(ukeTekst);
      }
      if (maskiner.some((m) => m.utenTimerad)) utenTimerad();
      if (maskiner.length > 0 && s.manglerMaskinforerbevis) utenForerbevis();
      if (maskiner.length > 0) overArbeid(r);
      // A3 (B55): reise under terskelen, ført som reisetid — attestanten vurderer føringen.
      const underTerskel = reiseUnderTerskel(r);
      if (underTerskel && deps.reiseUnderTerskelMerke) {
        const merke = deps.reiseUnderTerskelMerke(underTerskel);
        leggTilAvvik(merke.tekst, merke);
      }
      const ventende = r.attestertStatus === "pending";
      return {
        ...base,
        kilde: { type: "timer", rad: r, maskiner: gMaskiner, varer: gVarer },
        radIder: { timerIder: [r.id], maskinIder: gMaskiner.map((m) => m.id), tilleggIder: [] },
        harHandling: true,
        ventende,
        attestert: r.attestertStatus === "attestert",
        projectId: r.projectId,
        rettet: { ...rettetMap(r), ...Object.fromEntries(gMaskiner.flatMap((m) => Object.entries(rettetMap(m)).map(([f, v]) => [`maskin.${m.id}.${f}`, v]))) },
        linje: {
          id: r.id,
          type: "timer",
          ...felles(r.projectId, r.project, r),
          betegnelse: deps.lonnsartNavn(r.lonnsartId),
          aktivitet: deps.aktivitetNavn(r.aktivitetId),
          fraTid: r.fraTid,
          tilTid: r.tilTid,
          timer: tall(r.timer),
          pauseMin: r.pauseMin ?? null,
          maskiner,
          varer: gVarer.map(vareTilLinje),
          antall: null,
          belop: null,
          lonnsartType: null,
          satsEnhet: null,
          erReise: r.erReise ?? null,
          beskrivelse: r.beskrivelse,
          status: linjeStatus(r.attestertStatus, deps),
          avvik,
        },
      };
    }
    if (g.type === "maskin") {
      const m = g.rad;
      const ml = maskinTilLinje(m, deps);
      if (sperre) leggTilAvvik(sperre);
      if (ml.utenTimerad) utenTimerad();
      if (s.manglerMaskinforerbevis) utenForerbevis();
      overArbeid(m);
      return {
        ...base,
        kilde: { type: "maskin", rad: m },
        radIder: { timerIder: [], maskinIder: [m.id], tilleggIder: [] },
        harHandling: true,
        ventende: m.attestertStatus === "pending",
        attestert: m.attestertStatus === "attestert",
        projectId: m.projectId,
        rettet: Object.fromEntries(Object.entries(rettetMap(m)).map(([f, v]) => [`maskin.${m.id}.${f}`, v])),
        linje: tomLinje(m.id, "maskin", { ...felles(m.projectId, m.project, m), fraTid: m.fraTid, tilTid: m.tilTid, maskiner: [ml], status: linjeStatus(m.attestertStatus, deps), avvik }),
      };
    }
    if (g.type === "tillegg") {
      const r = g.rad;
      if (sperre) leggTilAvvik(sperre);
      if (s.tilleggHarKrav) leggTilAvvik(deps.tekst.tilleggskrav);
      return {
        ...base,
        kilde: { type: "tillegg", rad: r },
        radIder: { timerIder: [], maskinIder: [], tilleggIder: [r.id] },
        harHandling: true,
        ventende: r.attestertStatus === "pending",
        attestert: r.attestertStatus === "attestert",
        projectId: r.projectId,
        rettet: rettetMap(r),
        linje: tomLinje(r.id, "tillegg", {
          ...felles(r.projectId, r.project, r),
          betegnelse: deps.tilleggNavn(r.tilleggId),
          antall: tall(r.antall),
          beskrivelse: r.kommentar,
          status: linjeStatus(r.attestertStatus, deps),
          avvik,
        }),
      };
    }
    if (g.type === "vare") {
      const v = g.rad;
      return {
        ...base,
        kilde: { type: "vare", rad: v },
        radIder: { timerIder: [], maskinIder: [], tilleggIder: [] },
        harHandling: false,
        ventende: !v.attestert,
        attestert: v.attestert,
        projectId: v.projectId,
        rettet: {},
        linje: tomLinje(v.id, "vare", { ...felles(v.projectId, undefined, {}), varer: [vareTilLinje(v)], status: v.attestert ? deps.tekst.statusAttestert : deps.tekst.statusVenter, avvik }),
      };
    }
    const u = g.rad;
    void i;
    return {
      ...base,
      kilde: { type: "utlegg", rad: u },
      radIder: { timerIder: [], maskinIder: [], tilleggIder: [] },
      harHandling: false,
      ventende: false,
      attestert: false,
      projectId: u.projectId ?? null,
      rettet: {},
      linje: tomLinje(u.id, "utlegg", {
        ...felles(u.projectId, u.project, {}),
        betegnelse: u.expenseCategory?.navn ?? "",
        belop: tall(u.belop),
        status: "",
        avvik,
      }),
    };
  };

  const kort: AttKort[] = [];
  const erReiselinje = (l: AttLinje) => l.kilde.type === "timer" && l.kilde.rad.erReise === true;
  const leggTilKort = (nokkel: string, linjer: AttLinje[]) => {
    if (linjer.length === 0) return;
    const forste = linjer[0]!.linje;
    // F31 (w15c): et kort er reise når det har reise og ikke arbeid (timer eller maskin) —
    // tillegg og utlegg i reisekortet gjør det ikke til en jobb uten timer.
    const reise =
      linjer.some(erReiselinje) &&
      !linjer.some((l) => (l.kilde.type === "timer" && l.kilde.rad.erReise !== true) || l.kilde.type === "maskin");
    // C1 (B34 B): reise uten underprosjekt i en jobb med underprosjekt står som «Uten».
    if (!reise && forste.underprosjekt) {
      for (const l of linjer) if (erReiselinje(l) && !l.linje.underprosjekt) l.linje = { ...l.linje, underprosjekt: deps.tekst.utenUnderprosjekt };
    }
    kort.push({
      nokkel,
      sheetId: s.id,
      projectId: linjer[0]!.projectId,
      prosjektnummer: forste.prosjektnummer ?? "",
      prosjekt: forste.prosjekt,
      underprosjekt: forste.underprosjekt,
      byggeplass: forste.byggeplass,
      reise,
      linjer,
    });
  };

  // Reise uten kort-id (skal ikke finnes etter w12-utfyllingen) står i egen blokk først, som
  // før — den skjules aldri (§ 4.11 C9). Reise med kort-id står sist i jobbens kort (C1).
  if (gruppering.reise.length > 0) {
    const nokkel = `${s.id}:reise`;
    leggTilKort(nokkel, gruppering.reise.map((r, i) => lagLinje({ type: "reise", rad: r }, nokkel, i)));
  }
  for (const k of gruppering.kort) {
    const nokkel = `${s.id}:${k.kortId}`;
    leggTilKort(nokkel, k.linjer.map((g, i) => lagLinje(g, nokkel, i)));
  }
  if (gruppering.utenKort.length > 0) {
    const nokkel = `${s.id}:utenKort`;
    leggTilKort(nokkel, gruppering.utenKort.map((g, i) => lagLinje(g, nokkel, i)));
  }

  return { sedel: s, dato, ansatt, ansattnr, sperre, kort };
}

function tomLinje(id: string, type: TimerTabellLinje["type"], over: Partial<TimerTabellLinje> & Pick<TimerTabellLinje, "dato" | "ansatt" | "prosjekt" | "status" | "avvik">): TimerTabellLinje {
  return {
    id,
    type,
    ansattnr: null,
    prosjektnummer: null,
    avdeling: null,
    byggeplass: null,
    underprosjekt: null,
    kort: null,
    betegnelse: "",
    aktivitet: null,
    fraTid: null,
    tilTid: null,
    timer: null,
    pauseMin: null,
    maskiner: [],
    varer: [],
    antall: null,
    belop: null,
    lonnsartType: null,
    satsEnhet: null,
    erReise: null,
    beskrivelse: null,
    ...over,
  };
}

/* ------------------------------------------------------------------ */
/*  Summer                                                              */
/* ------------------------------------------------------------------ */

/**
 * O15 pkt 5 (vedtak § Dagsvisningen pkt 5, R10): kortet har bare reise — reisetid eller reise
 * ført som arbeidstid (vedtak Reisevinduet pkt 16: en reise forblir reise) — og ingen maskin.
 * Tillegg og utlegg gjør det ikke til en jobb (F31). Brukes bare til tellingen «2 jobber · 1 reise»
 * og hoveren (pkt 7); `kort.reise`, `jobbTimer` og C1 er urørt.
 */
export function erBareReiseKort(kort: Pick<AttKort, "linjer">): boolean {
  const timer = kort.linjer.flatMap((l) => (l.kilde.type === "timer" ? [l.kilde] : []));
  return (
    timer.length > 0 &&
    timer.every((k) => k.rad.erReise === true || erArbeidstidReise(k.rad)) &&
    !kort.linjer.some((l) => l.kilde.type === "maskin" || (l.kilde.type === "timer" && l.kilde.maskiner.length > 0))
  );
}

/**
 * Summene for et utvalg linjer. `timer` er alle timer (dagsraden, gruppen); `reise` er
 * reiselinjenes del av dem — jobbraden viser `timer − reise` og «reise X t» i grått (§ 4.11 C4).
 */
export function sumLinjer(linjer: readonly AttLinje[]): { timer: number; maskintimer: number; reise: number } {
  let timer = 0;
  let maskintimer = 0;
  let reise = 0;
  for (const l of linjer) {
    if (l.linje.type === "timer") {
      timer += l.linje.timer ?? 0;
      if (l.linje.erReise) reise += l.linje.timer ?? 0;
    }
    for (const m of l.linje.maskiner) maskintimer += m.timer ?? 0;
  }
  return { timer, maskintimer, reise };
}

/* ------------------------------------------------------------------ */
/*  Oversiktsraden (A1, plan § 4.17 del B): normmerket, lønnsartmerkene  */
/*  og varselet på linja                                                */
/* ------------------------------------------------------------------ */

/** Lønnsarten slik oversiktsraden trenger den (katalogen `timer.lonnsart.list`). */
export type LonnsartInfo = { navn?: string | null; type?: string | null; overtidsnivaa?: number | null };
export type LonnsartOppslag = (id: string) => LonnsartInfo | undefined;

/**
 * Varselet en linje bærer (A1, punkt 3 og 8): overtid og fravær er gule — på lønnsartmerket i
 * oversiktsraden og på linja. Null = vanlig linje, ingen farge.
 */
export type LinjeVarsel = "overtid" | "fravaer" | "reise";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function linjeVarsel(l: AttLinje, lonnsart: LonnsartOppslag): LinjeVarsel | null {
  if (l.kilde.type !== "timer") return null;
  const r = l.kilde.rad;
  // A3 (B55): reise under terskelen ført som reisetid er gul; annen reise er ikke det.
  if (r.erReise === true) return reiseUnderTerskel(r) ? "reise" : null;
  const art = lonnsart(r.lonnsartId);
  if (erFravaerArt(art ? { type: art.type ?? null } : null)) return "fravaer";
  if (erOvertidsnivaa(art?.overtidsnivaa)) return "overtid";
  return null;
}

/**
 * Dagens timer slik normmerket måler dem (A1, punkt 1 og 2; § 8.22): arbeid uten reise, fravær
 * som fyller normen, og reisen for seg. `avvik` = arbeid + fravær − dagsnorm (null uten norm).
 * Reise ført som arbeidstid er arbeid (vedtak reisevinduet punkt 20). Samme oppdeling som
 * serverens fraværstak (`vurderFravaerNormtak`): reise teller ikke, fravær er lønnsart av typen fravær.
 */
export interface DagensTimer {
  arbeid: number;
  overtid: number;
  fravaer: number;
  reise: number;
  /** Alt som er ført: arbeid + fravær + reise. */
  sum: number;
  norm: number | null;
  avvik: number | null;
}

export function dagensTimer(
  rader: readonly { timer: unknown; erReise?: boolean | null; lonnsartId: string }[],
  norm: number | null,
  lonnsart: LonnsartOppslag,
): DagensTimer {
  let arbeid = 0;
  let overtid = 0;
  let fravaer = 0;
  let reise = 0;
  for (const r of rader) {
    const t = tall(r.timer) ?? 0;
    const art = lonnsart(r.lonnsartId);
    if (r.erReise === true) reise += t;
    else if (erFravaerArt(art ? { type: art.type ?? null } : null)) fravaer += t;
    else {
      arbeid += t;
      if (erOvertidsnivaa(art?.overtidsnivaa)) overtid += t;
    }
  }
  arbeid = round2(arbeid);
  fravaer = round2(fravaer);
  reise = round2(reise);
  return {
    arbeid,
    overtid: round2(overtid),
    fravaer,
    reise,
    sum: round2(arbeid + fravaer + reise),
    norm,
    avvik: norm == null ? null : round2(arbeid + fravaer - norm),
  };
}

/** Ett lønnsartmerke på oversiktsraden: «Overtid 50 % 2,5», med linjene bak tallet. */
export interface LonnsartMerke {
  nokkel: string;
  navn: string;
  timer: number;
  varsel: LinjeVarsel | null;
  linjer: { fraTid: string | null; tilTid: string | null; timer: number }[];
}

/**
 * Lønnsartmerkene for et utvalg linjer (A1, punkt 6): ett merke pr. lønnsart med timene,
 * reisen for seg. Bare timelinjer; tillegg og utlegg står på linjene som før. Rekkefølgen
 * følger klokkeslettet.
 */
export function lonnsartMerker(linjer: readonly AttLinje[], lonnsart: LonnsartOppslag): LonnsartMerke[] {
  const timer = linjer
    .filter((l) => l.kilde.type === "timer")
    .sort((a, b) => (a.linje.fraTid ?? "").localeCompare(b.linje.fraTid ?? ""));
  const ut = new Map<string, LonnsartMerke>();
  for (const l of timer) {
    if (l.kilde.type !== "timer") continue;
    const r = l.kilde.rad;
    const nokkel = `${r.lonnsartId}:${r.erReise === true ? "reise" : ""}`;
    let m = ut.get(nokkel);
    if (!m) {
      m = { nokkel, navn: l.linje.betegnelse, timer: 0, varsel: null, linjer: [] };
      ut.set(nokkel, m);
    }
    const t = l.linje.timer ?? 0;
    m.timer = round2(m.timer + t);
    m.varsel = m.varsel ?? linjeVarsel(l, lonnsart);
    m.linjer.push({ fraTid: l.linje.fraTid, tilTid: l.linje.tilTid, timer: t });
  }
  return [...ut.values()];
}

/* ------------------------------------------------------------------ */
/*  Navnefeltet i dagsrad og jobbrad (O13, vedtak § Dagsvisningen pkt 2) */
/* ------------------------------------------------------------------ */

/**
 * Kolonnene navnefeltet legger seg over (B14c B): de er tomme i dagsraden og jobbraden.
 * A1 (§ 4.17): Betegnelse og Fra–til bærer lønnsartmerkene (`LONNSART_KOLONNER`) og er ikke lenger
 * en del av navnefeltet. A2: Prosjekt-kolonnen er navnefeltets hjem i standardoppsettet; Pr.nr. og
 * Underprosjekt, valgt i «Velg parameter», står i feltet når de står ved siden av.
 */
export const NAVNEFELT_KOLONNER: readonly TimerTabellKolKey[] = ["prosjekt", "prosjektnummer", "underprosjekt"];

/** A1: lønnsartmerkene i oversiktsraden står i Betegnelse og over Fra–til når den står rett etter. */
export const LONNSART_KOLONNER: readonly TimerTabellKolKey[] = ["betegnelse", "fraTil"];

/**
 * Feltet med lønnsartmerkene (A1): fra Betegnelse og over de av `LONNSART_KOLONNER` som står
 * rett etter. Null når Betegnelse er skjult.
 */
export function lonnsartPlass(kolonner: readonly TimerTabellKolKey[]): { fra: TimerTabellKolKey; antall: number } | null {
  const start = kolonner.indexOf("betegnelse");
  if (start === -1) return null;
  let slutt = start;
  while (slutt + 1 < kolonner.length && LONNSART_KOLONNER.includes(kolonner[slutt + 1]!)) slutt++;
  return { fra: "betegnelse", antall: slutt - start + 1 };
}

/**
 * Hvor prosjektnavnet står i dagsraden og jobbraden, for brukerens kolonneoppsett (R2):
 *  - `spenn`: over de synlige av `NAVNEFELT_KOLONNER` (Prosjekt, Pr.nr., Underprosjekt) som står
 *    sammenhengende fra den første synlige av dem;
 *  - `kolonne`: ingen av dem synlige → første synlige tekstkolonne etter Ansatt, utenom
 *    lønnsartfeltet (`lonnsartPlass`);
 *  - `ansatt`: finnes ingen → i Ansatt-cella under navnet.
 * `tomme`: cellene som står tomme i dagsraden og jobbraden — feltets kolonner utenfor feltet
 * (brukeren har flyttet en annen kolonne mellom), og Byggeplass, som hoveren på navnet bærer.
 * `utenfor` (avvikskolonnen) er aldri i feltet og aldri tom.
 */
export type NavnefeltPlass =
  | { type: "spenn"; fra: TimerTabellKolKey; antall: number; tomme: ReadonlySet<TimerTabellKolKey> }
  | { type: "kolonne"; kolonne: TimerTabellKolKey; tomme: ReadonlySet<TimerTabellKolKey> }
  | { type: "ansatt"; tomme: ReadonlySet<TimerTabellKolKey> };

const IKKE_NAVNEKOLONNE: ReadonlySet<TimerTabellKolKey> = new Set<TimerTabellKolKey>(["dato", "ansatt", "ansattnr", "avvik"]);

export function navnefeltPlass(
  kolonner: readonly TimerTabellKolKey[],
  erTall: (k: TimerTabellKolKey) => boolean,
  utenfor?: TimerTabellKolKey,
): NavnefeltPlass {
  // `utenfor`: kolonnen som bærer avviket når Avvik er skjult (Betegnelse). Den står utenfor
  // feltet med avviket sitt, og feltet slutter foran den (gate O13 trinn 2, vilkår 1).
  const feltKol = new Set(NAVNEFELT_KOLONNER.filter((k) => k !== utenfor));
  const tomme = new Set<TimerTabellKolKey>(["byggeplass"]);
  const start = kolonner.findIndex((k) => feltKol.has(k));
  if (start !== -1) {
    let slutt = start;
    while (slutt + 1 < kolonner.length && feltKol.has(kolonner[slutt + 1]!)) slutt++;
    for (let i = 0; i < kolonner.length; i++) if (feltKol.has(kolonner[i]!) && (i < start || i > slutt)) tomme.add(kolonner[i]!);
    return { type: "spenn", fra: kolonner[start]!, antall: slutt - start + 1, tomme };
  }
  const etterAnsatt = kolonner.indexOf("ansatt");
  // Gate A1–A3 vilkår 1: kolonnene lønnsartfeltet ligger over, er opptatt — spennet tegnes
  // først, så navnet ville ikke stått der.
  const lp = lonnsartPlass(kolonner);
  const lStart = lp ? kolonner.indexOf(lp.fra) : -1;
  const iLonnsartFelt = (i: number) => lp != null && i >= lStart && i < lStart + lp.antall;
  const kolonne = kolonner.find((k, i) => i > etterAnsatt && !erTall(k) && !IKKE_NAVNEKOLONNE.has(k) && k !== utenfor && !iLonnsartFelt(i));
  if (kolonne) {
    tomme.delete(kolonne);
    return { type: "kolonne", kolonne, tomme };
  }
  return { type: "ansatt", tomme };
}

/**
 * Linjas lønnsartnavn over de tomme cellene foran Betegnelse (B14c B): Betegnelse spenner
 * bakover over kolonnene i navnefeltet som står tomme på linja (`skjul`, verdien står i raden
 * over), så navnet ikke kuttes. Står en av dem med verdi (annet underprosjekt), stopper spennet der.
 */
export function linjeSpenn(
  plass: NavnefeltPlass,
  kolonner: readonly TimerTabellKolKey[],
  skjul: readonly TimerTabellKolKey[],
): { fra: TimerTabellKolKey; til: TimerTabellKolKey } | undefined {
  if (plass.type !== "spenn") return undefined;
  const fraI = kolonner.indexOf(plass.fra);
  const b = kolonner.indexOf("betegnelse");
  // A1: Betegnelse står rett etter navnefeltet (ikke lenger inni det).
  if (b === -1 || b < fraI || b > fraI + plass.antall) return undefined;
  let fra = b;
  while (fra - 1 >= fraI && skjul.includes(kolonner[fra - 1]!)) fra--;
  return fra < b ? { fra: kolonner[fra]!, til: "betegnelse" } : undefined;
}

/* ------------------------------------------------------------------ */
/*  Filter (R8, T42)                                                    */
/* ------------------------------------------------------------------ */

/** Filteret på Avvik-kolonnen: «krever vurdering» (dagens knapp) og «har avvik». */
export const AVVIK_FILTER = { kreverVurdering: "kreverVurdering", harAvvik: "harAvvik" } as const;

/** Kolonner med avkrysningsfilter (verdiene som finnes i utvalget). */
export const FILTER_KOLONNER: readonly TimerTabellKolKey[] = [
  "dato", "ansatt", "ansattnr", "prosjektnummer", "prosjekt", "avdeling", "byggeplass", "underprosjekt",
  "type", "betegnelse", "aktivitet", "maskin", "enhet", "vare", "vareenhet", "status",
];

/** Alle verdier en linje har i kolonnen (alle underlinjer, T41). */
export function linjeVerdier(k: TimerTabellKolKey, l: TimerTabellLinje): string[] {
  const ut: string[] = [];
  const n = antallUnderlinjer(l);
  for (let u = 0; u < n; u++) {
    const v = timerTabellVerdi(k, l, u);
    if (v !== null && v !== "") ut.push(String(v));
  }
  return ut;
}

/** Verdiene som finnes i utvalget, sortert. */
export function filterAlternativer(dager: readonly AttDag[], k: TimerTabellKolKey): string[] {
  const sett = new Set<string>();
  for (const d of dager) for (const kort of d.kort) for (const l of kort.linjer) for (const v of linjeVerdier(k, l.linje)) sett.add(v);
  return [...sett].sort((a, b) => a.localeCompare(b, "nb", { numeric: true }));
}

export interface AttFilter {
  verdier: Record<string, string>;
  beskrivelseSok: string;
}

function linjeTreffer(l: AttLinje, sedel: AttSedel, f: AttFilter): boolean {
  for (const [k, verdi] of Object.entries(f.verdier)) {
    if (!verdi) continue;
    const valgt = new Set(verdi.split(","));
    if (k === "avvik") {
      const ok =
        (valgt.has(AVVIK_FILTER.kreverVurdering) &&
          // Uten kjent dagsnorm vurderes ikke «over normen»: predikatet krever dagsnorm > 0,
          // så 0 = ukjent. (d2b-2 sendte uendelig, som ga «ført ≠ norm» på alt — rettet i d2b-3.)
          sedelKreverVurdering({ ...sedel, dagsnorm: sedel.dagsnorm ?? 0 })) ||
        (valgt.has(AVVIK_FILTER.harAvvik) && l.linje.avvik.length > 0);
      if (!ok) return false;
      continue;
    }
    // En linje treffer når én av underlinjene treffer (T41).
    if (!linjeVerdier(k as TimerTabellKolKey, l.linje).some((v) => valgt.has(v))) return false;
  }
  const sok = f.beskrivelseSok.trim().toLowerCase();
  if (sok && !(l.linje.beskrivelse ?? "").toLowerCase().includes(sok)) return false;
  return true;
}

/** Filtrer: kortene består, men bare med linjene som treffer; kort og dager uten treff faller bort. */
export function filtrerModell(dager: readonly AttDag[], f: AttFilter): AttDag[] {
  const ut: AttDag[] = [];
  for (const d of dager) {
    const kort = d.kort
      .map((k) => ({ ...k, linjer: k.linjer.filter((l) => linjeTreffer(l, d.sedel, f)) }))
      .filter((k) => k.linjer.length > 0);
    if (kort.length > 0) ut.push({ ...d, kort });
  }
  return ut;
}

/* ------------------------------------------------------------------ */
/*  Handlinger (R10, R11, T30, T43)                                     */
/* ------------------------------------------------------------------ */

export function slaaSammen(linjer: readonly AttLinje[]): RadIder {
  const ut: RadIder = { timerIder: [], maskinIder: [], tilleggIder: [] };
  for (const l of linjer) {
    ut.timerIder.push(...l.radIder.timerIder);
    ut.maskinIder.push(...l.radIder.maskinIder);
    ut.tilleggIder.push(...l.radIder.tilleggIder);
  }
  return ut;
}

export const antallRader = (r: RadIder) => r.timerIder.length + r.maskinIder.length + r.tilleggIder.length;

/**
 * Kan linja velges i denne konteksten (F1, `radIKontekst`)? Firma-admin har ingen kontekst; prosjektlederen har sine prosjekter (w10b).
 * w7 (B15): aldri på attestantens egen sedel (`egneTimer`) — knappene skjules, linja tones ned og
 * «Attester utvalget» hopper over den. Serveren håndhever det samme (`krevIkkeEgenSedel`).
 */
export function linjeIKontekst(l: AttLinje, sedel: AttSedel, prosjektKontekst?: ReadonlySet<string>): boolean {
  if (sedel.egneTimer) return false;
  return radIKontekst(l.projectId, prosjektKontekst, sedel.fravaerKanAttesteres);
}

/**
 * Utvalget: ventende linjer med handling, uten sperre (R11). Sperrede linjer sendes
 * aldri — serveren avviser hele kallet (HM30); antallet som ble stående, meldes.
 */
export function byggUtvalg(
  linjer: readonly AttLinje[],
  sedelFor: (sheetId: string) => AttSedel | undefined,
  prosjektKontekst?: ReadonlySet<string>,
): { radIder: RadIder; antallLinjer: number; stoende: number } {
  const kandidater = linjer.filter((l) => {
    const s = sedelFor(l.sheetId);
    return l.harHandling && l.ventende && !!s && linjeIKontekst(l, s, prosjektKontekst);
  });
  const sendes = kandidater.filter((l) => !l.sperre);
  return { radIder: slaaSammen(sendes), antallLinjer: sendes.length, stoende: kandidater.length - sendes.length };
}

/**
 * «Attester utvalget» tar hele jobber (w10a, B30 A): de avkryssede blant `synligeKort`, eller
 * alle når ingen er krysset av. Hver jobb slås opp i den UFILTRERTE modellen (`dager`), så
 * linjer som filteret skjuler, sendes med. Linjene går så gjennom `byggUtvalg` som før:
 * ventende, i kontekst, uten sperre. `antallJobber` teller jobber med minst én linje som sendes.
 */
export function byggJobbUtvalg(
  dager: readonly AttDag[],
  synligeKort: readonly string[],
  valgte: ReadonlySet<string>,
  sedelFor: (sheetId: string) => AttSedel | undefined,
  prosjektKontekst?: ReadonlySet<string>,
): { radIder: RadIder; antallJobber: number; stoende: number } {
  const kortFor = new Map<string, AttKort>();
  for (const d of dager) for (const k of d.kort) kortFor.set(k.nokkel, k);
  const krysset = synligeKort.filter((n) => valgte.has(n));
  const grunnlag = krysset.length > 0 ? krysset : synligeKort;
  const linjer: AttLinje[] = [];
  let antallJobber = 0;
  for (const n of grunnlag) {
    const kort = kortFor.get(n);
    if (!kort) continue;
    if (byggUtvalg(kort.linjer, sedelFor, prosjektKontekst).antallLinjer > 0) antallJobber++;
    linjer.push(...kort.linjer);
  }
  const u = byggUtvalg(linjer, sedelFor, prosjektKontekst);
  return { radIder: u.radIder, antallJobber, stoende: u.stoende };
}

/* ------------------------------------------------------------------ */
/*  Grupperinger (R12, d2b-2): dag · prosjekt · ansatt                   */
/* ------------------------------------------------------------------ */

export type Gruppering = "dag" | "prosjekt" | "ansatt";

export interface AttGruppe {
  nokkel: string;
  tittel: string;
  dager: AttDag[];
}

const UTEN_PROSJEKT = "uten-prosjekt";

/**
 * Samme modell, annen gruppering. «Etter prosjekt» grupperer på **radens** prosjekt
 * (HM12/T28): et kort deles om radene står på flere prosjekter, så hver gruppe har bare
 * sitt prosjekts rader. «Etter ansatt» samler den ansattes dager. «dag» = ingen gruppe.
 */
export function grupperModell(dager: readonly AttDag[], gruppering: Gruppering): AttGruppe[] | null {
  if (gruppering === "dag") return null;
  const grupper = new Map<string, { tittel: string; dager: Map<string, AttDag> }>();
  const iGruppe = (nokkel: string, tittel: string) => {
    let g = grupper.get(nokkel);
    if (!g) {
      g = { tittel, dager: new Map() };
      grupper.set(nokkel, g);
    }
    return g;
  };

  for (const d of dager) {
    if (gruppering === "ansatt") {
      const id = d.sedel.ansatt?.id ?? d.ansatt;
      const tittel = d.ansattnr ? `${d.ansatt} (${d.ansattnr})` : d.ansatt;
      iGruppe(id, tittel).dager.set(d.sedel.id, d);
      continue;
    }
    for (const k of d.kort) {
      // K2: ett prosjekt pr. kort — delingen slår bare til om et kort likevel har flere.
      const pidAv = (l: AttLinje) => l.projectId ?? UTEN_PROSJEKT;
      const pider = [...new Set(k.linjer.map(pidAv))];
      for (const pid of pider) {
        const linjer = k.linjer.filter((l) => pidAv(l) === pid);
        const forste = linjer[0]!.linje;
        const tittel = [forste.prosjektnummer, forste.prosjekt].filter(Boolean).join(" ");
        const g = iGruppe(pid, tittel);
        const delKort: AttKort = {
          ...k,
          nokkel: pider.length > 1 ? `${k.nokkel}:${pid}` : k.nokkel,
          projectId: pid === UTEN_PROSJEKT ? null : pid,
          prosjektnummer: forste.prosjektnummer ?? "",
          prosjekt: forste.prosjekt,
          linjer,
        };
        const dag = g.dager.get(d.sedel.id);
        g.dager.set(d.sedel.id, dag ? { ...dag, kort: [...dag.kort, delKort] } : { ...d, kort: [delKort] });
      }
    }
  }

  return [...grupper.entries()]
    .map(([nokkel, g]) => ({ nokkel, tittel: g.tittel, dager: [...g.dager.values()] }))
    .sort(
      (a, b) =>
        Number(a.nokkel === UTEN_PROSJEKT) - Number(b.nokkel === UTEN_PROSJEKT) ||
        a.tittel.localeCompare(b.tittel, "nb", { numeric: true }),
    );
}

/* ------------------------------------------------------------------ */
/*  Ukeoversikten (R12, R18, T45)                                      */
/* ------------------------------------------------------------------ */

export interface UkeRad {
  nokkel: string;
  navn: string;
  /** Ansatt-id når raden er én ansatt (norm og hover-dagskort). */
  ansattId: string | null;
  /** Timer pr. dato (ISO) = summen av tabellens timerlinjer den dagen (T45). */
  perDag: Record<string, number>;
  sum: number;
  /** Dagene raden bygger på, pr. dato — hover-dagskortet. */
  dagerPrDato: Record<string, AttDag[]>;
  under: UkeRad[];
}

type Bidrag = { nokkel: string; navn: string; ansattId: string | null; dato: string; timer: number; dag: AttDag };

function samle(bidrag: readonly Bidrag[]): UkeRad[] {
  const rader = new Map<string, UkeRad>();
  for (const b of bidrag) {
    let r = rader.get(b.nokkel);
    if (!r) {
      r = { nokkel: b.nokkel, navn: b.navn, ansattId: b.ansattId, perDag: {}, sum: 0, dagerPrDato: {}, under: [] };
      rader.set(b.nokkel, r);
    }
    r.perDag[b.dato] = (r.perDag[b.dato] ?? 0) + b.timer;
    r.sum += b.timer;
    const liste = r.dagerPrDato[b.dato] ?? [];
    if (!liste.includes(b.dag)) liste.push(b.dag);
    r.dagerPrDato[b.dato] = liste;
  }
  return [...rader.values()].sort((a, b) => a.navn.localeCompare(b.navn, "nb", { numeric: true }));
}

/**
 * Ukeoversiktens rader fra tabellens linjer: timene føres på **radens** prosjekt (HM12)
 * og er summen av tabellens timerlinjer for samme dag (T45). Akse «ansatt» har prosjektene
 * under hver ansatt; akse «prosjekt» har de ansatte under hvert prosjekt.
 */
export function byggUkeoversikt(dager: readonly AttDag[], akse: "ansatt" | "prosjekt"): UkeRad[] {
  const bidrag: (Bidrag & { under: Omit<Bidrag, "dag"> })[] = [];
  for (const d of dager) {
    const ansattId = d.sedel.ansatt?.id ?? d.ansatt;
    for (const k of d.kort) {
      for (const l of k.linjer) {
        if (l.linje.type !== "timer") continue;
        const timer = l.linje.timer ?? 0;
        const pid = l.projectId ?? UTEN_PROSJEKT;
        const pNavn = [l.linje.prosjektnummer, l.linje.prosjekt].filter(Boolean).join(" ");
        const ansatt = { nokkel: ansattId, navn: d.ansatt, ansattId };
        const prosjekt = { nokkel: pid, navn: pNavn, ansattId: null };
        const [topp, under] = akse === "ansatt" ? [ansatt, prosjekt] : [prosjekt, ansatt];
        bidrag.push({ ...topp, dato: d.dato, timer, dag: d, under: { ...under, dato: d.dato, timer } });
      }
    }
  }
  const topp = samle(bidrag);
  for (const r of topp) {
    r.under = samle(bidrag.filter((b) => b.nokkel === r.nokkel).map((b) => ({ ...b.under, dag: b.dag })));
  }
  return topp;
}

import {
  grupperPaaKort,
  visProsjektnummer,
  overlappBlokkererAttestering,
  timerTabellVerdi,
  antallUnderlinjer,
  type TimerTabellLinje,
  type TimerTabellKolKey,
  type TimerTabellMaskin,
  type TimerTabellVare,
  type KortLinjeGruppe,
} from "@sitedoc/shared";
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
  fravaerKanAttesteres?: boolean;
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
  /** Ukeavvikets tekst med ukenummer og normens navn (T29/T39), eller null. */
  ukeAvvikTekst: (s: AttSedel) => string | null;
  tekst: {
    forslagSperre: string;
    maskinUtenTimerad: string;
    maskinforerbevis: string;
    tilleggskrav: string;
    tilByggherre: string;
    fravaerUtenProsjekt: string;
    /** Rad på et prosjekt brukeren ikke har tilgang til (R13: navnet sendes ikke). */
    annetProsjekt: string;
    reise: string;
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
  const ukeTekst = deps.ukeAvvikTekst(s);
  const ukeIder = new Set(s.ukeAvvikRadIder ?? []);

  const gruppering = grupperPaaKort<AttTimer, AttMaskin, AttVare, AttTillegg, AttUtlegg>({
    timer: s.timer,
    maskiner: s.maskiner,
    varer: s.varer ?? [],
    tillegg: s.tillegg,
    utlegg: s.utlegg,
  });

  // `prosjekt`: objektet = navn og nummer; `null` med projectId = annet prosjekt uten
  // tilgang (prosjektlista, R13); `undefined` = ikke oppgitt (vare, firmalistens utlegg).
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
    const nokkel = `${s.id}:${g.type}:${g.rad.id}`;
    const base = { nokkel, sheetId: s.id, kortNokkel, sperre };
    if (g.type === "timer") {
      const r = g.rad;
      const maskiner = g.maskiner.map((m) => maskinTilLinje(m, deps));
      if (sperre) avvik.push(sperre);
      if (ukeTekst && ukeIder.has(r.id)) avvik.push(ukeTekst);
      if (maskiner.some((m) => m.utenTimerad)) avvik.push(deps.tekst.maskinUtenTimerad);
      if (maskiner.length > 0 && s.manglerMaskinforerbevis) avvik.push(deps.tekst.maskinforerbevis);
      const ventende = r.attestertStatus === "pending";
      return {
        ...base,
        kilde: { type: "timer", rad: r, maskiner: g.maskiner, varer: g.varer },
        radIder: { timerIder: [r.id], maskinIder: g.maskiner.map((m) => m.id), tilleggIder: [] },
        harHandling: true,
        ventende,
        attestert: r.attestertStatus === "attestert",
        projectId: r.projectId,
        rettet: { ...rettetMap(r), ...Object.fromEntries(g.maskiner.flatMap((m) => Object.entries(rettetMap(m)).map(([f, v]) => [`maskin.${m.id}.${f}`, v]))) },
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
          varer: g.varer.map(vareTilLinje),
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
      if (sperre) avvik.push(sperre);
      if (ml.utenTimerad) avvik.push(deps.tekst.maskinUtenTimerad);
      if (s.manglerMaskinforerbevis) avvik.push(deps.tekst.maskinforerbevis);
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
      if (sperre) avvik.push(sperre);
      if (s.tilleggHarKrav) avvik.push(deps.tekst.tilleggskrav);
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
  const leggTilKort = (nokkel: string, linjer: AttLinje[]) => {
    if (linjer.length === 0) return;
    const forste = linjer[0]!.linje;
    kort.push({
      nokkel,
      sheetId: s.id,
      projectId: linjer[0]!.projectId,
      prosjektnummer: forste.prosjektnummer ?? "",
      prosjekt: forste.prosjekt,
      underprosjekt: forste.underprosjekt,
      byggeplass: forste.byggeplass,
      linjer,
    });
  };

  // Reise først (G8: reisen står før arbeidet den fører til).
  if (gruppering.reise.length > 0) {
    const nokkel = `${s.id}:reise`;
    leggTilKort(nokkel, gruppering.reise.map((r, i) => lagLinje({ type: "timer", rad: r, maskiner: [], varer: [] }, nokkel, i)));
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

export function sumLinjer(linjer: readonly AttLinje[]): { timer: number; maskintimer: number } {
  let timer = 0;
  let maskintimer = 0;
  for (const l of linjer) {
    if (l.linje.type === "timer") timer += l.linje.timer ?? 0;
    for (const m of l.linje.maskiner) maskintimer += m.timer ?? 0;
  }
  return { timer, maskintimer };
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

/** Kan linja velges i denne konteksten (F1, `radIKontekst`)? Firmaattesteringen har ingen kontekst. */
export function linjeIKontekst(l: AttLinje, sedel: AttSedel, prosjektKontekst?: string): boolean {
  return radIKontekst(l.projectId, prosjektKontekst, sedel.fravaerKanAttesteres);
}

/**
 * Utvalget: ventende linjer med handling, uten sperre (R11). Sperrede linjer sendes
 * aldri — serveren avviser hele kallet (HM30); antallet som ble stående, meldes.
 */
export function byggUtvalg(
  linjer: readonly AttLinje[],
  sedelFor: (sheetId: string) => AttSedel | undefined,
  prosjektKontekst?: string,
): { radIder: RadIder; antallLinjer: number; stoende: number } {
  const kandidater = linjer.filter((l) => {
    const s = sedelFor(l.sheetId);
    return l.harHandling && l.ventende && !!s && linjeIKontekst(l, s, prosjektKontekst);
  });
  const sendes = kandidater.filter((l) => !l.sperre);
  return { radIder: slaaSammen(sendes), antallLinjer: sendes.length, stoende: kandidater.length - sendes.length };
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

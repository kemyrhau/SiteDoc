// ============================================================================
//  Kort-gruppering og linjer (kort-id-spec § 12.2 G1–G11, R3, R16).
//
//  `grupperPaaKort` legger én sedels rader i kort: `kortId` bestemmer kortet,
//  `sheetTimerId` bestemmer linja i kortet. En timelinje bærer maskinene og
//  varene som er koblet til den. Maskin og vare uten gyldig kobling, tillegg og
//  utlegg er egne linjer. Reise med kortId (w12, B32 B) står sist i kortet,
//  utreise før retur; reise uten kortId står i egen blokk som før; andre rader
//  uten kortId i «Uten kort». Ingen rad skjules: antall rader inn = antall rader
//  ut (G9). Kortets hode, rekkefølge og alder leses fra arbeidsradene (§ 4.11
//  del A punkt 7) — samme rekkefølge som regelen i `reiseKort.ts`.
//
//  `byggKortRader` gjør grupperingen om til en flat liste linjer i
//  visningsrekkefølge, med maskinens felter for seg og merket «uten timerad»
//  (R24). Kolonnelista (§ 12.6.2) er ikke her — den kommer i d2b-1.
//  `kortId` er bare nøkkel og skrives aldri ut (G11).
// ============================================================================

import { erGyldigTimeradKobling, maskinKreverTimerad } from "./maskinKobling";
import { jobbRekkefolge } from "./reiseKort";

type Tidspunkt = Date | string | null | undefined;

/** Det alle radtyper må ha for å grupperes. */
export interface KortRadBase {
  id: string;
  kortId: string | null;
  fraTid?: string | null;
  createdAt?: Tidspunkt;
}

export interface KortTimerInn extends KortRadBase {
  erReise?: boolean | null;
  /** `"ut"` | `"retur"` | null — ordner reiselinjene i kortet (utreise før retur). */
  reiseRetning?: string | null;
  projectId?: string | null;
  externalCostObjectId?: string | null;
  byggeplassId?: string | null;
}

export interface KortKobletInn extends KortRadBase {
  sheetTimerId?: string | null;
}

export interface KortInn<T, M, V, Ti, U> {
  timer: readonly T[];
  maskiner?: readonly M[];
  varer?: readonly V[];
  tillegg?: readonly Ti[];
  utlegg?: readonly U[];
}

export type KortLinjeGruppe<T, M, V, Ti, U> =
  | { type: "timer"; rad: T; maskiner: M[]; varer: V[] }
  | { type: "maskin"; rad: M }
  | { type: "vare"; rad: V }
  | { type: "tillegg"; rad: Ti }
  | { type: "utlegg"; rad: U }
  /** w12: reiserad i jobbens kort (sist, utreise før retur). */
  | { type: "reise"; rad: T };

export interface KortGruppe<T, M, V, Ti, U> {
  kortId: string;
  /** G2: kortets hode leses fra første arbeidsrad (ellers første linje). */
  hode: { projectId: string | null; externalCostObjectId: string | null; byggeplassId: string | null } | null;
  linjer: KortLinjeGruppe<T, M, V, Ti, U>[];
}

export interface KortGruppering<T, M, V, Ti, U> {
  kort: KortGruppe<T, M, V, Ti, U>[];
  /** G8: reiserader UTEN kortId (skal ikke finnes etter w12-utfyllingen), sortert på fraTid. */
  reise: T[];
  /** G9: andre rader uten kortId, hver som egen linje. */
  utenKort: KortLinjeGruppe<T, M, V, Ti, U>[];
}

const ms = (t: Tidspunkt): number => {
  if (t == null) return Number.POSITIVE_INFINITY;
  const v = typeof t === "string" ? Date.parse(t) : t.getTime();
  return Number.isFinite(v) ? v : Number.POSITIVE_INFINITY;
};

/** Ført rekkefølge: opprettet, så id. */
const etterFoert = (a: KortRadBase, b: KortRadBase): number =>
  ms(a.createdAt) - ms(b.createdAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** G3: fraTid; uten tid sist; likt → opprettet, så id. */
const etterTid = (a: KortRadBase, b: KortRadBase): number => {
  const fa = a.fraTid ?? null;
  const fb = b.fraTid ?? null;
  if (fa !== null && fb === null) return -1;
  if (fa === null && fb !== null) return 1;
  if (fa !== null && fb !== null && fa !== fb) return fa < fb ? -1 : 1;
  return etterFoert(a, b);
};

/** Reiselinjene i kortet: utreise, så uten retning, så retur; innen hver etter tid. */
const reiseRang = (r: { reiseRetning?: string | null }): number =>
  r.reiseRetning === "ut" ? 0 : r.reiseRetning === "retur" ? 2 : 1;
const etterReise = (a: KortTimerInn, b: KortTimerInn): number => reiseRang(a) - reiseRang(b) || etterTid(a, b);

function hodeFra(rad: unknown): KortGruppe<unknown, unknown, unknown, unknown, unknown>["hode"] {
  if (!rad || typeof rad !== "object") return null;
  const r = rad as Record<string, unknown>;
  const s = (v: unknown): string | null => (typeof v === "string" ? v : null);
  return {
    projectId: s(r.projectId),
    externalCostObjectId: s(r.externalCostObjectId),
    byggeplassId: s(r.byggeplassId),
  };
}

export function grupperPaaKort<
  T extends KortTimerInn,
  M extends KortKobletInn = KortKobletInn,
  V extends KortKobletInn = KortKobletInn,
  Ti extends KortRadBase = KortRadBase,
  U extends KortRadBase = KortRadBase,
>(inn: KortInn<T, M, V, Ti, U>): KortGruppering<T, M, V, Ti, U> {
  type Linje = KortLinjeGruppe<T, M, V, Ti, U>;
  const reise: T[] = [];
  const utenKort: Linje[] = [];
  const perKort = new Map<
    string,
    { timer: T[]; maskiner: M[]; varer: V[]; tillegg: Ti[]; utlegg: U[]; reise: T[] }
  >();
  const kortFor = (kortId: string) => {
    let k = perKort.get(kortId);
    if (!k) {
      k = { timer: [], maskiner: [], varer: [], tillegg: [], utlegg: [], reise: [] };
      perKort.set(kortId, k);
    }
    return k;
  };

  for (const t of inn.timer) {
    if (t.erReise) {
      if (t.kortId == null) reise.push(t);
      else kortFor(t.kortId).reise.push(t);
    }
    else if (t.kortId == null) utenKort.push({ type: "timer", rad: t, maskiner: [], varer: [] });
    else kortFor(t.kortId).timer.push(t);
  }
  for (const m of inn.maskiner ?? []) {
    if (m.kortId == null) utenKort.push({ type: "maskin", rad: m });
    else kortFor(m.kortId).maskiner.push(m);
  }
  for (const v of inn.varer ?? []) {
    if (v.kortId == null) utenKort.push({ type: "vare", rad: v });
    else kortFor(v.kortId).varer.push(v);
  }
  for (const ti of inn.tillegg ?? []) {
    if (ti.kortId == null) utenKort.push({ type: "tillegg", rad: ti });
    else kortFor(ti.kortId).tillegg.push(ti);
  }
  for (const u of inn.utlegg ?? []) {
    if (u.kortId == null) utenKort.push({ type: "utlegg", rad: u });
    else kortFor(u.kortId).utlegg.push(u);
  }

  const kort: KortGruppe<T, M, V, Ti, U>[] = [];
  const rekkefolge = new Map<string, { kortId: string; forsteTid: string | null; eldste: number }>();
  for (const [kortId, k] of perKort) {
    const timer = [...k.timer].sort(etterTid);
    const timerIder = new Set(timer.map((t) => t.id));
    const paaLinje = new Map<string, { maskiner: M[]; varer: V[] }>(
      timer.map((t) => [t.id, { maskiner: [], varer: [] }]),
    );
    const egneMaskiner: M[] = [];
    const egneVarer: V[] = [];
    // G4/G5: kobling til en timerad i SAMME kort → på linja; ellers egen linje.
    for (const m of [...k.maskiner].sort(etterFoert)) {
      if (m.sheetTimerId && timerIder.has(m.sheetTimerId)) paaLinje.get(m.sheetTimerId)!.maskiner.push(m);
      else egneMaskiner.push(m);
    }
    for (const v of [...k.varer].sort(etterFoert)) {
      if (v.sheetTimerId && timerIder.has(v.sheetTimerId)) paaLinje.get(v.sheetTimerId)!.varer.push(v);
      else egneVarer.push(v);
    }
    const linjer: Linje[] = [
      ...timer.map((t): Linje => ({ type: "timer", rad: t, ...paaLinje.get(t.id)! })),
      ...egneMaskiner.sort(etterTid).map((m): Linje => ({ type: "maskin", rad: m })),
      ...egneVarer.sort(etterTid).map((v): Linje => ({ type: "vare", rad: v })),
      ...[...k.tillegg].sort(etterFoert).map((ti): Linje => ({ type: "tillegg", rad: ti })),
      ...[...k.utlegg].sort(etterFoert).map((u): Linje => ({ type: "utlegg", rad: u })),
      ...[...k.reise].sort(etterReise).map((r): Linje => ({ type: "reise", rad: r })),
    ];
    // G2: hodet fra første arbeidsrad; uten arbeid fra første linje som ikke er reise; reise
    // alene i kortet gir hodet fra reisen (§ 4.11 del C punkt 7).
    const hodeRad = timer[0] ?? linjer.find((l) => l.type !== "reise")?.rad ?? linjer[0]?.rad ?? null;
    // G7 (w12): rekkefølge og alder fra arbeidsradene, som regelen; kort uten arbeid fra alle linjer.
    const arbeid = timer.length > 0 ? timer : linjer.map((l) => l.rad as KortRadBase);
    rekkefolge.set(kortId, {
      kortId,
      forsteTid: (timer[0] ?? (linjer[0]?.rad as KortRadBase | undefined))?.fraTid ?? null,
      eldste: Math.min(...arbeid.map((r) => ms(r.createdAt))),
    });
    kort.push({ kortId, hode: hodeFra(hodeRad), linjer });
  }

  // G7: første arbeidsrads fraTid; uten tid etter; likt → eldste arbeidsrad, så kortId.
  kort.sort((a, b) => jobbRekkefolge(rekkefolge.get(a.kortId)!, rekkefolge.get(b.kortId)!));

  reise.sort(etterTid);
  utenKort.sort((a, b) => etterTid(a.rad as KortRadBase, b.rad as KortRadBase));
  return { kort, reise, utenKort };
}

// ----------------------------------------------------------------------------
//  byggKortRader — linjene i visningsrekkefølge (R3, R16)
// ----------------------------------------------------------------------------

type Tall = number | string | { toString(): string } | null | undefined;
const tall = (v: Tall): number | null => {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : null;
};

export interface KortRadTimerInn extends KortTimerInn {
  sheetId?: string | null;
  timer: Tall;
  tilTid?: string | null;
  attestertStatus?: string | null;
}
export interface KortRadMaskinInn extends KortKobletInn {
  sheetId?: string | null;
  vehicleId?: string | null;
  tilTid?: string | null;
  timer: Tall;
  mengde?: Tall;
  enhet?: string | null;
  /** Maskinens faktureringsenhet fra maskinregisteret («time» | «doegn» | null). */
  utleieEnhet?: string | null;
}
export interface KortRadVareInn extends KortKobletInn {
  vareId?: string | null;
  antall: Tall;
}

/** Én maskin slik den står på en linje — mengde og enhet i egne felter. */
export interface KortLinjeMaskin {
  id: string;
  vehicleId: string | null;
  fraTid: string | null;
  tilTid: string | null;
  timer: number;
  mengde: number | null;
  enhet: string | null;
  utleieEnhet: string | null;
  /** R24: krever timerad og mangler gyldig kobling («Maskin uten timerad»). */
  utenTimerad: boolean;
}
export interface KortLinjeVare {
  id: string;
  vareId: string | null;
  antall: number;
}

export interface KortRadLinje {
  type: "timer" | "maskin" | "vare" | "tillegg" | "utlegg" | "reise";
  blokk: "kort" | "reise" | "utenKort";
  /** Nøkkel for gruppering; skrives aldri ut (G11). */
  kortId: string | null;
  /** Radens id (timeradens id på en timelinje). */
  id: string;
  fraTid: string | null;
  tilTid: string | null;
  /** Timer på timelinja; null på andre linjer. */
  timer: number | null;
  /** På en timelinje: de koblede, i ført rekkefølge. På en maskinlinje: maskinen selv. */
  maskiner: KortLinjeMaskin[];
  varer: KortLinjeVare[];
}

export function byggKortRader<
  T extends KortRadTimerInn,
  M extends KortRadMaskinInn = KortRadMaskinInn,
  V extends KortRadVareInn = KortRadVareInn,
  Ti extends KortRadBase = KortRadBase,
  U extends KortRadBase = KortRadBase,
>(inn: KortInn<T, M, V, Ti, U>): KortRadLinje[] {
  const g = grupperPaaKort<T, M, V, Ti, U>(inn);
  const timerader = inn.timer.map((t) => ({
    id: t.id,
    sheetId: t.sheetId ?? null,
    kortId: t.kortId,
    projectId: t.projectId ?? null,
    timer: tall(t.timer) ?? 0,
    erReise: t.erReise ?? false,
    attestertStatus: t.attestertStatus ?? null,
  }));
  const tilMaskin = (m: M): KortLinjeMaskin => ({
    id: m.id,
    vehicleId: m.vehicleId ?? null,
    fraTid: m.fraTid ?? null,
    tilTid: m.tilTid ?? null,
    timer: tall(m.timer) ?? 0,
    mengde: tall(m.mengde),
    enhet: m.enhet ?? null,
    utleieEnhet: m.utleieEnhet ?? null,
    utenTimerad: maskinKreverTimerad(m.utleieEnhet) && !erGyldigTimeradKobling(m, timerader),
  });
  const tilVare = (v: V): KortLinjeVare => ({ id: v.id, vareId: v.vareId ?? null, antall: tall(v.antall) ?? 0 });

  const linje = (l: KortLinjeGruppe<T, M, V, Ti, U>, blokk: KortRadLinje["blokk"]): KortRadLinje => {
    const rad = l.rad as KortRadBase & { tilTid?: string | null };
    const felles = {
      type: l.type,
      blokk,
      kortId: rad.kortId,
      id: rad.id,
      fraTid: rad.fraTid ?? null,
      tilTid: rad.tilTid ?? null,
      timer: null as number | null,
      maskiner: [] as KortLinjeMaskin[],
      varer: [] as KortLinjeVare[],
    };
    switch (l.type) {
      case "timer":
        return {
          ...felles,
          timer: tall(l.rad.timer) ?? 0,
          maskiner: l.maskiner.map(tilMaskin),
          varer: l.varer.map(tilVare),
        };
      case "reise":
        return { ...felles, timer: tall(l.rad.timer) ?? 0 };
      case "maskin":
        return { ...felles, maskiner: [tilMaskin(l.rad)] };
      case "vare":
        return { ...felles, varer: [tilVare(l.rad)] };
      default:
        return felles;
    }
  };

  return [
    ...g.kort.flatMap((k) => k.linjer.map((l) => linje(l, "kort"))),
    ...g.reise.map((t) => linje({ type: "timer", rad: t, maskiner: [], varer: [] }, "reise")),
    ...g.utenKort.map((l) => linje(l, "utenKort")),
  ];
}

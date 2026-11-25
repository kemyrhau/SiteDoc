/**
 * D2h (plan § 4.16 del H, Kenneth 2026-11-25): «↶ Angre del opp».
 *
 * Kort B som kom fra «Del opp» (`del_jobb` i aktivitetsloggen) kan slås sammen med kort A
 * igjen. Verdiene hentes fra historikken «Del opp» skrev (raden slik den var), ikke fra en sum.
 * Ett steg tilbake: bare siste deling i kjeden kan angres. Regelen her er ren (testes uten
 * database); lasting står i `lastAngreGrunnlag`, skrivingen i `dagsseddel.ts` (`angreDelJobb`).
 *
 * Nye `del_jobb`-poster har `kortIdA`, `kortIdB` og `fraSheetTimerId` for maskin og vare som ble
 * koblet om. Eldre poster kjennes på `delt`/`tilB`: kort A fra historikken, kort B fra radene.
 */
import type { Context } from "../../trpc/context";

export type AngreFeil = "manglerB" | "manglerA" | "venter" | "rettet" | "annetKort";

/** Tekstene serveren avviser med (vises i kortet). */
export const ANGRE_FEILTEKST: Record<AngreFeil, string> = {
  manglerB: "Kortet finnes ikke på dagsseddelen. Last siden på nytt.",
  manglerA: "Kort A finnes ikke på dagsseddelen. Last siden på nytt.",
  venter: "Delingen kan bare angres når alle linjene i begge kortene venter på attestering. Gjenåpne linjene først.",
  rettet: "Kort A eller B er rettet etter delingen (fra–til, pause, timer eller lønnsart). Delingen kan ikke angres. Rett linjene tilbake først.",
  annetKort: "Kort B har linjer fra et annet kort. Flytt dem tilbake først.",
};

export const ANGRE_IKKE_SISTE = "Kort B er delt videre. Angre den siste delingen først.";
export const ANGRE_IKKE_DELT = "Kortet kom ikke fra «Del opp». Last siden på nytt.";

export type Omkobling = { id: string; fraSheetTimerId: string | null };

export interface DelOppOpphav {
  postId: string;
  ved: Date;
  kortIdA: string;
  kortIdB: string;
  delt: string[];
  tilB: string[];
  maskinDelt: { id: string; timerA: number; timerB: number; nyId: string | null }[];
  /** Maskin koblet om til en rad i A. `fraSheetTimerId` null = eldre post (ukjent). */
  maskinOmkoblet: Omkobling[];
  vareOmkoblet: Omkobling[];
  etterPrRad: Record<string, Record<string, unknown>>;
}

export type LoggPost = { id: string; action: string; payload: unknown; createdAt: Date };
export type HistorikkPost = { radType: string; originalRadId: string; snapshot: unknown; erstattetVed: Date };

export type TimerTilstand = {
  id: string;
  kortId: string | null;
  parentRadId: string | null;
  attestertStatus: string | null;
  erReise: boolean;
  projectId: string | null;
  lonnsartId: string | null;
  fraTid: string | null;
  tilTid: string | null;
  timer: unknown;
  pauseMin: number | null;
};
export type MaskinTilstand = { id: string; kortId: string | null; attestertStatus: string | null; timer: unknown };
export type LinjeTilstand = { id: string; kortId: string | null; venter: boolean };
export type VareTilstand = LinjeTilstand & { antall: number };

export interface AngreTilstand {
  timer: TimerTilstand[];
  tillegg: (LinjeTilstand & { attestertStatus: string | null })[];
  maskiner: MaskinTilstand[];
  utlegg: LinjeTilstand[];
  varer: VareTilstand[];
}

export type FlyttPost = {
  radType: "maskin" | "tillegg" | "utlegg" | "reise" | "vare";
  radId: string;
  nyId: string | null;
  fraKortId: string | null;
  tilKortId: string;
  ved: Date;
};

export type InnFlyttet = { radType: FlyttPost["radType"]; id: string; slaaSammenMed: string | null };

export interface AngrePlan {
  /** Del B av hver delte timerrad (slettes; del A får verdiene fra historikken). */
  bDeler: string[];
  /** Linjer flyttet fra A til B etter delingen — tilbake til A. */
  innFlyttet: InnFlyttet[];
}

const streng = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const strenger = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const tall = (v: unknown): number => Number(v ?? 0);

function omkoblinger(v: unknown): Omkobling[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x): Omkobling[] => {
    if (typeof x === "string") return [{ id: x, fraSheetTimerId: null }];
    const o = x as Record<string, unknown> | null;
    const id = streng(o?.id);
    return id ? [{ id, fraSheetTimerId: streng(o?.fraSheetTimerId) }] : [];
  });
}

/** Raden slik den var da «Del opp» ble lagret: siste historikkpost før loggposten. */
export function snapshotFoer(
  historikk: readonly HistorikkPost[],
  radType: string,
  id: string,
  ved: Date,
): Record<string, unknown> | null {
  const treff = historikk
    .filter((h) => h.radType === radType && h.originalRadId === id && h.erstattetVed.getTime() <= ved.getTime())
    .sort((a, b) => b.erstattetVed.getTime() - a.erstattetVed.getTime())[0];
  return treff ? ((treff.snapshot ?? {}) as Record<string, unknown>) : null;
}

/** «Del opp»-postene som ikke er angret, eldste først. */
export function delOppOpphav(
  poster: readonly LoggPost[],
  timer: readonly Pick<TimerTilstand, "id" | "kortId" | "parentRadId">[],
  historikk: readonly HistorikkPost[],
): DelOppOpphav[] {
  const angret = new Set(
    poster.filter((p) => p.action === "angre_del_jobb").map((p) => streng((p.payload as Record<string, unknown> | null)?.delJobbId)),
  );
  const ut: DelOppOpphav[] = [];
  for (const p of [...poster].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    if (p.action !== "del_jobb" || angret.has(p.id)) continue;
    const pl = (p.payload ?? {}) as Record<string, unknown>;
    const delt = strenger(pl.delt);
    const tilB = strenger(pl.tilB);
    const etterPrRad = (pl.etterPrRad ?? {}) as Record<string, Record<string, unknown>>;
    const forsteSnap = [...delt, ...tilB].map((id) => snapshotFoer(historikk, "timer", id, p.createdAt)).find(Boolean);
    const kortIdA = streng(pl.kortIdA) ?? streng(forsteSnap?.kortId);
    if (!kortIdA) continue;
    const kortIdB =
      streng(pl.kortIdB) ??
      timer.find((r) => tilB.includes(r.id))?.kortId ??
      timer.find((r) => r.parentRadId && delt.includes(r.parentRadId) && r.kortId !== kortIdA && r.id in etterPrRad)?.kortId ??
      null;
    if (!kortIdB) continue;
    const maskinDelt = (Array.isArray(pl.maskinDelt) ? pl.maskinDelt : []).flatMap((x) => {
      const o = x as Record<string, unknown> | null;
      const id = streng(o?.id);
      return id ? [{ id, timerA: tall(o?.timerA), timerB: tall(o?.timerB), nyId: streng(o?.nyId) }] : [];
    });
    ut.push({
      postId: p.id,
      ved: p.createdAt,
      kortIdA,
      kortIdB,
      delt,
      tilB,
      maskinDelt,
      maskinOmkoblet: omkoblinger(pl.maskinOmkoblet),
      vareOmkoblet: omkoblinger(pl.vareOmkoblet),
      etterPrRad,
    });
  }
  return ut;
}

/**
 * Ett steg tilbake: delingen som laget kort B, når verken A eller B er delt videre etterpå.
 * `null` med `delt: true` = B kom fra «Del opp», men er delt videre.
 */
export function finnAngreOpphav(
  alle: readonly DelOppOpphav[],
  kortIdB: string,
): { opphav: DelOppOpphav | null; deltVidere: boolean } {
  const o = [...alle].reverse().find((x) => x.kortIdB === kortIdB);
  if (!o) return { opphav: null, deltVidere: false };
  const senere = alle.some((q) => q.ved.getTime() > o.ved.getTime() && (q.kortIdA === o.kortIdA || q.kortIdA === o.kortIdB));
  return senere ? { opphav: null, deltVidere: true } : { opphav: o, deltVidere: false };
}

/** «→ Kort B»-postene (`flytt_linje`) etter delingen. */
export function flyttPoster(poster: readonly LoggPost[], etter: Date): FlyttPost[] {
  return poster
    .filter((p) => p.action === "flytt_linje" && p.createdAt.getTime() >= etter.getTime())
    .flatMap((p): FlyttPost[] => {
      const pl = (p.payload ?? {}) as Record<string, unknown>;
      const radType = pl.radType as FlyttPost["radType"];
      const radId = streng(pl.radId);
      const tilKortId = streng(pl.tilKortId);
      if (!radId || !tilKortId || !["maskin", "tillegg", "utlegg", "reise", "vare"].includes(radType)) return [];
      return [{ radType, radId, nyId: streng(pl.nyId), fraKortId: streng(pl.fraKortId), tilKortId, ved: p.createdAt }];
    })
    .sort((a, b) => a.ved.getTime() - b.ved.getTime());
}

/** Sammenlignbar verdi: tall (også Decimal som streng) med to desimaler, ellers teksten. */
function norm(v: unknown): string | number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : NaN;
  if (!Number.isNaN(n)) return Math.round(n * 100) / 100;
  return String(v);
}

const TIMER_FELT = ["fraTid", "tilTid", "pauseMin", "timer", "lonnsartId"] as const;

/** Raden har verdiene «Del opp» satte (B sitt underprosjekt teller ikke — det er det angringen fjerner). */
function urort(rad: Record<string, unknown> | undefined, etter: Record<string, unknown> | undefined, felt: readonly string[]): boolean {
  if (!rad || !etter) return false;
  return felt.every((f) => !(f in etter) || norm(rad[f]) === norm(etter[f]));
}

/**
 * Kan delingen angres, og hva skal skrives? Rekkefølgen på avvisningene: B finnes, A finnes,
 * alle linjene venter (knappen skjules), rettet etter delingen, linjer fra et tredje kort.
 */
export function vurderAngre(
  o: DelOppOpphav,
  t: AngreTilstand,
  flytt: readonly FlyttPost[],
): { feil: AngreFeil } | { plan: AngrePlan } {
  const A = o.kortIdA;
  const B = o.kortIdB;
  const iKort = (k: string | null) => k === A || k === B;
  const iB = (k: string | null) => k === B;
  const harB = [...t.timer, ...t.tillegg, ...t.maskiner, ...t.utlegg, ...t.varer].some((r) => iB(r.kortId));
  if (!harB) return { feil: "manglerB" };
  if (!t.timer.some((r) => r.kortId === A)) return { feil: "manglerA" };

  const venter =
    t.timer.filter((r) => iKort(r.kortId)).every((r) => r.attestertStatus === "pending") &&
    t.tillegg.filter((r) => iKort(r.kortId)).every((r) => r.attestertStatus === "pending") &&
    t.maskiner.filter((r) => iKort(r.kortId)).every((r) => r.attestertStatus === "pending") &&
    t.varer.filter((r) => iKort(r.kortId)).every((r) => r.venter);
  if (!venter) return { feil: "venter" };

  // Rettet etter delingen: radene «Del opp» skrev har ikke lenger verdiene den satte.
  const timerPr = new Map(t.timer.map((r) => [r.id, r]));
  const maskinPr = new Map(t.maskiner.map((r) => [r.id, r]));
  const bDeler: string[] = [];
  for (const d of o.delt) {
    const a = timerPr.get(d);
    if (!a || a.kortId !== A || !urort(a, o.etterPrRad[d], TIMER_FELT)) return { feil: "rettet" };
    const b = t.timer.filter((r) => r.parentRadId === d && r.kortId === B && r.id in o.etterPrRad);
    if (b.length !== 1 || !urort(b[0], o.etterPrRad[b[0]!.id], TIMER_FELT)) return { feil: "rettet" };
    bDeler.push(b[0]!.id);
  }
  for (const id of o.tilB) {
    const r = timerPr.get(id);
    if (!r || r.kortId !== B || !urort(r, o.etterPrRad[id], TIMER_FELT)) return { feil: "rettet" };
  }
  for (const m of o.maskinDelt) {
    const a = maskinPr.get(m.id);
    if (!a || !iKort(a.kortId) || !urort(a, o.etterPrRad[m.id], ["timer"])) return { feil: "rettet" };
    if (m.nyId) {
      const b = maskinPr.get(m.nyId);
      if (!b || !iKort(b.kortId) || !urort(b, o.etterPrRad[m.nyId], ["timer"])) return { feil: "rettet" };
    }
  }

  // Linjene i B som ikke kom fra delingen: flyttet fra A etterpå (tilbake til A), ellers et tredje kort.
  const egne = new Set<string>([...bDeler, ...o.tilB, ...o.maskinDelt.map((m) => m.nyId ?? m.id)]);
  const varePr = new Map(t.varer.map((v) => [v.id, v]));
  const innFlyttet: InnFlyttet[] = [];
  const iBUtenEgne: { radType: FlyttPost["radType"] | "timer"; id: string }[] = [
    ...t.timer.filter((r) => iB(r.kortId)).map((r) => ({ radType: r.erReise ? ("reise" as const) : ("timer" as const), id: r.id })),
    ...t.tillegg.filter((r) => iB(r.kortId)).map((r) => ({ radType: "tillegg" as const, id: r.id })),
    ...t.maskiner.filter((r) => iB(r.kortId)).map((r) => ({ radType: "maskin" as const, id: r.id })),
    ...t.utlegg.filter((r) => iB(r.kortId)).map((r) => ({ radType: "utlegg" as const, id: r.id })),
    ...t.varer.filter((r) => iB(r.kortId)).map((r) => ({ radType: "vare" as const, id: r.id })),
  ].filter((l) => !egne.has(l.id));
  for (const l of iBUtenEgne) {
    if (l.radType === "timer") return { feil: "annetKort" };
    const inn = [...flytt].reverse().find((f) => f.tilKortId === B && f.radType === l.radType && (f.radId === l.id || f.nyId === l.id));
    if (!inn || inn.fraKortId !== A) return { feil: "annetKort" };
    // Vare delt med mengde: den nye linja slås sammen med kilden når kilden står i A og venter.
    const kilde = l.radType === "vare" && inn.nyId === l.id ? varePr.get(inn.radId) : undefined;
    innFlyttet.push({ radType: l.radType, id: l.id, slaaSammenMed: kilde && kilde.kortId === A && kilde.venter ? kilde.id : null });
  }
  return { plan: { bDeler, innFlyttet } };
}

/** Feilene som skjuler knappen; de andre viser den og avvises først ved klikk (skissen, del 4). */
export const SKJULER_KNAPP: ReadonlySet<AngreFeil> = new Set(["manglerB", "manglerA", "venter"]);

export interface AngreGrunnlag {
  opphav: DelOppOpphav[];
  poster: LoggPost[];
  tilstand: AngreTilstand;
  historikk: HistorikkPost[];
}

type Klienter = Pick<Context, "prisma" | "prismaTimer" | "prismaVarelager">;

/**
 * Logg, rader og historikk for sedlene som har «Del opp». Sedler uten `del_jobb` får ingen
 * oppføring (ingen flere spørringer for dem).
 */
export async function lastAngreGrunnlag(k: Klienter, sheetIds: readonly string[]): Promise<Map<string, AngreGrunnlag>> {
  const ut = new Map<string, AngreGrunnlag>();
  if (sheetIds.length === 0) return ut;
  const logg = (await k.prisma.activity.findMany({
    where: { targetType: "DailySheet", targetId: { in: [...sheetIds] }, action: { in: ["del_jobb", "angre_del_jobb", "flytt_linje"] } },
    select: { id: true, targetId: true, action: true, payload: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })) as (LoggPost & { targetId: string })[];
  const medDeling = [...new Set(logg.filter((l) => l.action === "del_jobb").map((l) => l.targetId))];
  if (medDeling.length === 0) return ut;

  const ikkeErstattet = { attestertStatus: { not: "erstattet" } } as const;
  const [timer, tillegg, maskiner, utlegg, varer, historikk] = await Promise.all([
    k.prismaTimer.sheetTimer.findMany({
      where: { sheetId: { in: medDeling }, ...ikkeErstattet },
      select: {
        id: true, sheetId: true, kortId: true, parentRadId: true, attestertStatus: true, erReise: true, projectId: true,
        lonnsartId: true, fraTid: true, tilTid: true, timer: true, pauseMin: true,
      },
    }),
    k.prismaTimer.sheetTillegg.findMany({ where: { sheetId: { in: medDeling }, ...ikkeErstattet }, select: { id: true, sheetId: true, kortId: true, attestertStatus: true } }),
    k.prismaTimer.sheetMachine.findMany({ where: { sheetId: { in: medDeling }, ...ikkeErstattet }, select: { id: true, sheetId: true, kortId: true, attestertStatus: true, timer: true } }),
    k.prismaTimer.sheetUtlegg.findMany({ where: { sheetId: { in: medDeling } }, select: { id: true, sheetId: true, kortId: true } }),
    k.prismaVarelager.vareforbruk.findMany({
      where: { dagsseddelId: { in: medDeling } },
      select: { id: true, dagsseddelId: true, kortId: true, attestertSnapshot: true, antall: true },
    }),
    k.prismaTimer.sheetRadHistorikk.findMany({
      where: { sheetId: { in: medDeling }, radType: { in: ["timer", "maskin"] } },
      select: { radType: true, originalRadId: true, sheetId: true, snapshot: true, erstattetVed: true },
    }),
  ]);
  for (const sheetId of medDeling) {
    const poster = logg.filter((l) => l.targetId === sheetId);
    const tilstand: AngreTilstand = {
      timer: timer.filter((r) => r.sheetId === sheetId).map((r) => ({ ...r, timer: r.timer.toString() })),
      tillegg: tillegg.filter((r) => r.sheetId === sheetId).map((r) => ({ ...r, venter: r.attestertStatus === "pending" })),
      maskiner: maskiner.filter((r) => r.sheetId === sheetId).map((r) => ({ ...r, timer: r.timer?.toString() ?? null })),
      utlegg: utlegg.filter((r) => r.sheetId === sheetId).map((r) => ({ ...r, venter: true })),
      varer: varer
        .filter((v) => v.dagsseddelId === sheetId)
        .map((v) => ({ id: v.id, kortId: v.kortId, venter: v.attestertSnapshot === null, antall: Number(v.antall) })),
    };
    const hist = historikk.filter((h) => h.sheetId === sheetId);
    ut.set(sheetId, { opphav: delOppOpphav(poster, tilstand.timer, hist), poster, tilstand, historikk: hist });
  }
  return ut;
}

/** Kort-id-ene som får «↶ Angre del opp» pr. sedel (lista og detaljen). */
export async function angreDelOppKort(k: Klienter, sheetIds: readonly string[]): Promise<Map<string, string[]>> {
  const grunnlag = await lastAngreGrunnlag(k, sheetIds);
  const ut = new Map<string, string[]>();
  for (const [sheetId, g] of grunnlag) {
    const kort = [...new Set(g.opphav.map((o) => o.kortIdB))].filter((b) => {
      const { opphav } = finnAngreOpphav(g.opphav, b);
      if (!opphav) return false;
      const v = vurderAngre(opphav, g.tilstand, flyttPoster(g.poster, opphav.ved));
      return !("feil" in v && SKJULER_KNAPP.has(v.feil));
    });
    if (kort.length > 0) ut.set(sheetId, kort);
  }
  return ut;
}

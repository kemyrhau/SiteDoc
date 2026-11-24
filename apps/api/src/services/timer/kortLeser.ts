// ============================================================================
//  Kort-leser (kort-id-spec § 12.2 «Serveren leverer», ordre d2a punkt 5).
//
//  Felles oppslag for attesteringens tre lesere og rapportens detaljEksport:
//  - maskinens navn og enhet (`utleieEnhet`) — flyttet fra rapport.ts,
//  - byggeplass- og underprosjektnavn for alle sedelens prosjekter — flyttet
//    fra rapport.ts,
//  - varer pr. sedel (firma-isolert; varelager av → tom liste),
//  - rettede felter pr. rad (sammenlignet med siste historikkpost).
//
//  Oppslagene er batchet og filtrerer ikke på tilgang selv: kalleren sender
//  bare sedler brukeren alt har rett til å se. Underprosjekt er firma-scopet.
// ============================================================================

import type { Context } from "../../trpc/context";
import { erVarelagerAktivert } from "../varelager/moduleGate";

type KjerneKlient = Pick<Context["prisma"], "byggeplass" | "externalCostObject" | "user">;
type MaskinKlient = Pick<Context["prismaMaskin"], "equipment">;
type VareKlient = Pick<Context["prismaVarelager"], "vareforbruk">;
type TimerKlient = Pick<Context["prismaTimer"], "sheetRadHistorikk">;

const unike = (ider: Iterable<string | null | undefined>): string[] =>
  Array.from(new Set(Array.from(ider).filter((id): id is string => id != null)));

// ---------------------------------------------------------------------------
//  Maskin (flyttet fra rapport.ts detaljEksport)
// ---------------------------------------------------------------------------

export interface UtstyrOppslag {
  /** «merke modell», ellers internNavn, ellers id — samme navn-form som dagskortet. */
  navn: Map<string, string>;
  /** «time» | «doegn» | null. null = ukjent, aldri gjettet. */
  utleieEnhet: Map<string, string | null>;
}

export async function hentUtstyrOppslag(
  prismaMaskin: MaskinKlient,
  vehicleIder: Iterable<string | null | undefined>,
): Promise<UtstyrOppslag> {
  const navn = new Map<string, string>();
  const utleieEnhet = new Map<string, string | null>();
  const ider = unike(vehicleIder);
  if (ider.length === 0) return { navn, utleieEnhet };
  const utstyr = await prismaMaskin.equipment.findMany({
    where: { id: { in: ider } },
    select: { id: true, merke: true, modell: true, internNavn: true, utleieEnhet: true },
  });
  for (const e of utstyr) {
    const base = `${e.merke ?? ""} ${e.modell ?? ""}`.trim();
    navn.set(e.id, base || e.internNavn || e.id);
    utleieEnhet.set(e.id, e.utleieEnhet ?? null);
  }
  return { navn, utleieEnhet };
}

// ---------------------------------------------------------------------------
//  Byggeplass og underprosjekt (flyttet fra rapport.ts detaljEksport)
// ---------------------------------------------------------------------------

export async function hentByggeplassNavn(
  prisma: KjerneKlient,
  byggeplassIder: Iterable<string | null | undefined>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ider = unike(byggeplassIder);
  if (ider.length === 0) return map;
  const plasser = await prisma.byggeplass.findMany({
    where: { id: { in: ider } },
    select: { id: true, name: true },
  });
  for (const b of plasser) map.set(b.id, b.name);
  return map;
}

export interface UnderprosjektNavn {
  proAdmId: string;
  kortNavn: string;
  /** «proAdmId · kortNavn» — formen rapporten viser. */
  navn: string;
}

/** Firma-scopet: et underprosjekt fra et annet firma slås aldri opp. */
export async function hentUnderprosjektNavn(
  prisma: KjerneKlient,
  ecoIder: Iterable<string | null | undefined>,
  organizationId: string | readonly string[],
): Promise<Map<string, UnderprosjektNavn>> {
  const map = new Map<string, UnderprosjektNavn>();
  const ider = unike(ecoIder);
  if (ider.length === 0) return map;
  const orgIder = typeof organizationId === "string" ? [organizationId] : [...organizationId];
  const ecoer = await prisma.externalCostObject.findMany({
    where: { id: { in: ider }, organizationId: { in: orgIder } },
    select: { id: true, kortNavn: true, proAdmId: true },
  });
  for (const e of ecoer) {
    map.set(e.id, { proAdmId: e.proAdmId, kortNavn: e.kortNavn, navn: `${e.proAdmId} · ${e.kortNavn}` });
  }
  return map;
}

/** Radene leserne beriker med byggeplass- og underprosjektnavn. */
type RadMedSted = { byggeplassId?: string | null; externalCostObjectId?: string | null };

export interface KortStedNavn {
  byggeplass: Map<string, string>;
  underprosjekt: Map<string, UnderprosjektNavn>;
}

/** Navn på byggeplass og underprosjekt for alle radene på et sett sedler. */
export async function hentKortStedNavn(
  prisma: KjerneKlient,
  sedler: ReadonlyArray<{
    organizationId: string;
    byggeplassId?: string | null;
    rader: ReadonlyArray<RadMedSted>;
  }>,
): Promise<KortStedNavn> {
  const byggeplassIder = sedler.flatMap((s) => [s.byggeplassId, ...s.rader.map((r) => r.byggeplassId)]);
  const ecoIder = sedler.flatMap((s) => s.rader.map((r) => r.externalCostObjectId));
  const [byggeplass, underprosjekt] = await Promise.all([
    hentByggeplassNavn(prisma, byggeplassIder),
    hentUnderprosjektNavn(prisma, ecoIder, unike(sedler.map((s) => s.organizationId))),
  ]);
  return { byggeplass, underprosjekt };
}

/** Feltene leserne legger på hver rad: navn på byggeplass og underprosjekt. */
export function stedFelter(
  navn: KortStedNavn,
  rad: RadMedSted,
): { byggeplassNavn: string | null; underprosjekt: UnderprosjektNavn | null } {
  return {
    byggeplassNavn: rad.byggeplassId ? (navn.byggeplass.get(rad.byggeplassId) ?? null) : null,
    underprosjekt: rad.externalCostObjectId ? (navn.underprosjekt.get(rad.externalCostObjectId) ?? null) : null,
  };
}

// ---------------------------------------------------------------------------
//  Varer pr. sedel
// ---------------------------------------------------------------------------

export interface SedelVare {
  id: string;
  vareId: string;
  navn: string;
  enhet: string;
  antall: number;
  projectId: string;
  sheetTimerId: string | null;
  kortId: string | null;
  byggeplassId: string | null;
  externalCostObjectId: string | null;
  attestert: boolean;
  createdAt: Date;
}

/**
 * Varer ført på sedlene (`dagsseddelId`). Bare varer fra sedelens eget firmas
 * varekatalog kommer med; er varelager av for firmaet, er lista tom.
 */
export async function hentVarerForSedler(
  prismaVarelager: VareKlient,
  sedler: ReadonlyArray<{ id: string; organizationId: string }>,
): Promise<Map<string, SedelVare[]>> {
  const resultat = new Map<string, SedelVare[]>(sedler.map((s) => [s.id, []]));
  if (sedler.length === 0) return resultat;
  const orgIder = unike(sedler.map((s) => s.organizationId));
  const aktive = new Set<string>();
  await Promise.all(
    orgIder.map(async (org) => {
      if (await erVarelagerAktivert(org)) aktive.add(org);
    }),
  );
  const orgPerSedel = new Map(sedler.map((s) => [s.id, s.organizationId]));
  const sedelIder = sedler.filter((s) => aktive.has(s.organizationId)).map((s) => s.id);
  if (sedelIder.length === 0) return resultat;
  const rader = await prismaVarelager.vareforbruk.findMany({
    where: { dagsseddelId: { in: sedelIder } },
    select: {
      id: true,
      vareId: true,
      antall: true,
      projectId: true,
      sheetTimerId: true,
      kortId: true,
      byggeplassId: true,
      externalCostObjectId: true,
      attestertSnapshot: true,
      dagsseddelId: true,
      createdAt: true,
      vare: { select: { navn: true, enhet: true, organizationId: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  for (const r of rader) {
    if (!r.dagsseddelId) continue;
    // Firma-grense: varen må være fra sedelens firmas katalog.
    if (r.vare.organizationId !== orgPerSedel.get(r.dagsseddelId)) continue;
    resultat.get(r.dagsseddelId)?.push({
      id: r.id,
      vareId: r.vareId,
      navn: r.vare.navn,
      enhet: r.vare.enhet,
      antall: Number(r.antall),
      projectId: r.projectId,
      sheetTimerId: r.sheetTimerId ?? null,
      kortId: r.kortId ?? null,
      byggeplassId: r.byggeplassId ?? null,
      externalCostObjectId: r.externalCostObjectId ?? null,
      attestert: r.attestertSnapshot !== null,
      createdAt: r.createdAt,
    });
  }
  return resultat;
}

// ---------------------------------------------------------------------------
//  Rettede felter (R21, «Retting i cellen — lagring og logg»)
// ---------------------------------------------------------------------------

/** Historikkposter med denne markøren i snapshot er gjenåpninger, ikke rettinger. */
export const HISTORIKK_HENDELSE_GJENAAPNET = "gjenaapnet";

/**
 * R1 b3 (Kenneth 2026-11-23): arbeideren slettet raden på returnert dag (`fjernTimerRad`,
 * `slettKort`). Sporet for leder, ingen retting — en gjenværende rad med raden som forelder skal
 * ikke få «rettet»-felt av den.
 */
export const HISTORIKK_HENDELSE_SLETTET = "slettet";

export type RadType = "timer" | "tillegg" | "maskin";

/** Feltene attestanten kan rette i cellen (R21). */
export const RETTBARE_FELT: Record<RadType, readonly string[]> = {
  timer: ["lonnsartId", "aktivitetId", "fraTid", "tilTid", "timer", "pauseMin"],
  maskin: ["vehicleId", "timer", "mengde", "enhet", "fraTid", "tilTid"],
  tillegg: ["antall"],
};

export interface RettetFelt {
  felt: string;
  /** Verdien før rettingen, slik den sto i historikken. */
  foer: string | number | null;
  avUserId: string | null;
  avNavn: string | null;
  ved: Date;
}

type RadForRetting = { id: string; parentRadId?: string | null };

const normaliser = (v: unknown): string | number | null => {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    // Decimal serialiseres som streng i snapshot; tall sammenlignes som tall.
    const n = Number(v);
    return v.trim() !== "" && Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(v.trim()) ? n : v;
  }
  if (typeof v === "object" && "toString" in (v as object)) return normaliser((v as { toString(): string }).toString());
  return String(v);
};

/**
 * Pr. rad: feltene som er rettet, regnet ved å sammenligne raden med siste
 * historikkpost for den (originalRadId = radens id, eller forelderens id for
 * rader laget av den gamle rettemåten). Gjenåpninger hoppes over. En rad som
 * bare fikk post fordi en annen rad ble rettet, gir tom liste.
 */
export async function hentRettedeFelter(
  prismaTimer: TimerKlient,
  prisma: Pick<KjerneKlient, "user">,
  rader: ReadonlyArray<{ type: RadType; rad: RadForRetting }>,
): Promise<Map<string, RettetFelt[]>> {
  const resultat = new Map<string, RettetFelt[]>();
  if (rader.length === 0) return resultat;
  const nokler = unike(rader.flatMap(({ rad }) => [rad.id, rad.parentRadId ?? null]));
  const poster = await prismaTimer.sheetRadHistorikk.findMany({
    where: { originalRadId: { in: nokler } },
    select: { radType: true, originalRadId: true, snapshot: true, erstattetAvUserId: true, erstattetVed: true },
    orderBy: { erstattetVed: "desc" },
  });
  const sistePr = new Map<string, (typeof poster)[number]>();
  for (const p of poster) {
    const snap = p.snapshot as Record<string, unknown> | null;
    if (snap && (snap.hendelse === HISTORIKK_HENDELSE_GJENAAPNET || snap.hendelse === HISTORIKK_HENDELSE_SLETTET)) continue;
    const nokkel = `${p.radType}:${p.originalRadId}`;
    if (!sistePr.has(nokkel)) sistePr.set(nokkel, p);
  }
  const brukerIder = unike(Array.from(sistePr.values()).map((p) => p.erstattetAvUserId));
  const brukere =
    brukerIder.length > 0
      ? await prisma.user.findMany({ where: { id: { in: brukerIder } }, select: { id: true, name: true, email: true } })
      : [];
  const navn = new Map(brukere.map((b) => [b.id, b.name ?? b.email ?? null]));

  for (const { type, rad } of rader) {
    const post = sistePr.get(`${type}:${rad.id}`) ?? (rad.parentRadId ? sistePr.get(`${type}:${rad.parentRadId}`) : undefined);
    if (!post) {
      resultat.set(rad.id, []);
      continue;
    }
    const snap = (post.snapshot ?? {}) as Record<string, unknown>;
    const felter: RettetFelt[] = [];
    for (const felt of RETTBARE_FELT[type]) {
      if (!(felt in snap)) continue;
      const foer = normaliser(snap[felt]);
      if (foer !== normaliser((rad as Record<string, unknown>)[felt])) {
        felter.push({
          felt,
          foer,
          avUserId: post.erstattetAvUserId ?? null,
          avNavn: post.erstattetAvUserId ? (navn.get(post.erstattetAvUserId) ?? null) : null,
          ved: post.erstattetVed,
        });
      }
    }
    resultat.set(rad.id, felter);
  }
  return resultat;
}

// ---------------------------------------------------------------------------
//  Merket «Korrigert av» hos arbeideren (w15g, plan § 4.15 del F, F76–F80)
//
//  Arbeiderens to lesere (`hentMedId`, `list`) får pr. rad feltene en annen enn
//  eieren har korrigert, med verdien før og etter. Regnes hver gang, lagres ikke.
//  - Kilder: historikken (verdien før hver retting) og aktivitetsloggen (verdien
//    attestanten satte, og bytte av underprosjekt som ikke står i historikken, F78).
//  - «Før» er verdien før FØRSTE korrigering av feltet (F76); «etter» er verdien
//    attestanten satte sist, lest fra loggen (`rett_rad_felt`/`rediger_sedel_rader`
//    sitt `nyeSnapshot`). Finnes den ikke der («Del opp», ✂), gjelder neste
//    korrigerings «før», ellers verdien nå. Arbeiderens senere verdi står aldri
//    som attestantens (LØSNING GODKJENT w15g punkt 4).
//  - Prosjekt, byggeplass og underprosjekt regnes med (F77). `RETTBARE_FELT` og
//    attestantens «var …» er urørt.
//  - Bare andre enn eieren regnes; gjenåpninger hoppes over.
// ---------------------------------------------------------------------------

type Verdi = string | number | null;

/** Feltene arbeiderens merke regner (F77: R21-feltene + sted). */
export const KORRIGERBARE_FELT: Record<RadType, readonly string[]> = {
  timer: [...RETTBARE_FELT.timer, "projectId", "byggeplassId", "externalCostObjectId"],
  maskin: [...RETTBARE_FELT.maskin, "projectId", "byggeplassId", "externalCostObjectId"],
  tillegg: [...RETTBARE_FELT.tillegg, "projectId", "byggeplassId", "externalCostObjectId"],
};

/** Feltene som er id-er; serveren gir navnet (arbeideren er kanskje ikke medlem der). */
const ID_FELT = new Set(["lonnsartId", "aktivitetId", "projectId", "byggeplassId", "externalCostObjectId", "vehicleId"]);

export interface KorrigertFelt {
  felt: string;
  foer: Verdi;
  etter: Verdi;
  /** Navnet for id-felt (lønnsart, prosjekt …); null for tall og klokkeslett. */
  foerTekst: string | null;
  etterTekst: string | null;
}

export interface Korrigering {
  /** Navnet til den som korrigerte sist; null = ukjent (slettet bruker). Aldri e-post. */
  avNavn: string | null;
  avUserId: string | null;
  ved: Date;
  felter: KorrigertFelt[];
}

export type KorrigeringerPrRad = Record<RadType, Record<string, Korrigering>>;

/** En korrigering av én rad, slik kildene gir den. */
export interface KorrigeringsHendelse {
  radType: RadType;
  ved: Date;
  avUserId: string | null;
  /** Verdiene før korrigeringen. Bare feltene som står her, regnes. */
  foer: Record<string, unknown>;
  /** Verdiene korrigeringen satte, når loggen har dem. */
  etter: Record<string, unknown> | null;
  /**
   * Verdiene pr. rad-id når én korrigering ga flere rader (✂ `splitt_rad`, «Del opp» `del_jobb`).
   * Går foran `etter` for raden den gjelder.
   */
  etterPrRad?: Readonly<Record<string, Record<string, unknown>>> | null;
  /** Gjelder hendelsen raden? */
  gjelder: (rad: RadForKorrigering) => boolean;
}

export type RadForKorrigering = {
  id: string;
  parentRadId?: string | null;
  kortId?: string | null;
  erReise?: boolean | null;
} & Record<string, unknown>;

/**
 * Sammenlignbar verdi for merket: tall rundes til to desimaler, som kolonnene lagrer dem —
 * loggen har tallet slik klienten sendte det (4,0833), historikken slik det ble lagret (4,08).
 */
const verdi = (v: unknown): Verdi => {
  const n = normaliser(v);
  return typeof n === "number" ? Math.round(n * 100) / 100 : n;
};

const harFelt = (o: Record<string, unknown> | null, felt: string) => o !== null && Object.prototype.hasOwnProperty.call(o, felt);

/**
 * Ren regel (testes uten database): pr. rad feltene som er korrigert, med før/etter og
 * hvem/når fra siste korrigering. Feltet tas med bare når «før» ≠ «etter» — fram og
 * tilbake gir ingen merke.
 */
export function regnKorrigeringer(
  rader: ReadonlyArray<{ type: RadType; rad: RadForKorrigering }>,
  hendelser: readonly KorrigeringsHendelse[],
  navn: ReadonlyMap<string, string | null>,
): Map<string, Korrigering> {
  const resultat = new Map<string, Korrigering>();
  const sortert = [...hendelser].sort((a, b) => a.ved.getTime() - b.ved.getTime());
  for (const { type, rad } of rader) {
    const egne = sortert.filter((h) => h.radType === type && h.gjelder(rad));
    if (egne.length === 0) continue;
    const felter: Omit<KorrigertFelt, "foerTekst" | "etterTekst">[] = [];
    let siste: KorrigeringsHendelse | null = null;
    for (const felt of KORRIGERBARE_FELT[type]) {
      const medFelt = egne.filter((h) => harFelt(h.foer, felt));
      // Verdien hendelse i satte: loggens verdi, ellers neste korrigerings «før», ellers nå.
      const etterFor = (i: number): Verdi => {
        const h = medFelt[i]!;
        const satt = h.etterPrRad?.[rad.id] ?? h.etter;
        if (harFelt(satt, felt)) return verdi(satt![felt]);
        const neste = medFelt[i + 1];
        return neste ? verdi(neste.foer[felt]) : verdi(rad[felt]);
      };
      const rorte = medFelt.map((h, i) => ({ h, i })).filter(({ h, i }) => verdi(h.foer[felt]) !== etterFor(i));
      if (rorte.length === 0) continue;
      const foer = verdi(rorte[0]!.h.foer[felt]);
      const sist = rorte[rorte.length - 1]!;
      const etter = etterFor(sist.i);
      if (foer === etter) continue;
      felter.push({ felt, foer, etter });
      if (!siste || sist.h.ved > siste.ved) siste = sist.h;
    }
    if (felter.length === 0 || !siste) continue;
    resultat.set(`${type}:${rad.id}`, {
      avUserId: siste.avUserId,
      avNavn: siste.avUserId ? (navn.get(siste.avUserId) ?? null) : null,
      ved: siste.ved,
      felter: felter.map((f) => ({ ...f, foerTekst: null, etterTekst: null })),
    });
  }
  return resultat;
}

export type KorrigeringKlienter = {
  prisma: Pick<Context["prisma"], "user" | "activity" | "project" | "byggeplass" | "externalCostObject">;
  prismaTimer: Pick<Context["prismaTimer"], "sheetRadHistorikk" | "lonnsart" | "aktivitet">;
  prismaMaskin: MaskinKlient;
};

export type SedelForKorrigering = {
  id: string;
  userId: string;
  organizationId: string;
  timer: ReadonlyArray<RadForKorrigering>;
  tillegg: ReadonlyArray<RadForKorrigering>;
  maskiner: ReadonlyArray<RadForKorrigering>;
};

const RETTE_HANDLINGER = ["rett_rad_felt", "rediger_sedel_rader", "splitt_rad", "del_jobb", "flytt_linje"] as const;

/**
 * Verdiene en rad fikk, slik merket regner dem — skrives pr. rad-id i loggen fra ✂ og «Del opp»
 * (`etterPrRad`), så «etter» er det attestanten satte, ikke det raden har senere.
 */
export function korrigerbareVerdier(type: RadType, rad: Record<string, unknown>): Record<string, Verdi> {
  const ut: Record<string, Verdi> = {};
  for (const felt of KORRIGERBARE_FELT[type]) if (harFelt(rad, felt)) ut[felt] = normaliser(rad[felt]);
  return ut;
}
/** Loggposten for en retting skrives rett etter transaksjonen; vinduet tåler treg skriving. */
const LOGG_VINDU_MS = 60_000;

type Postering = { radType: string; originalRadId: string; sheetId: string; snapshot: unknown; erstattetAvUserId: string | null; erstattetVed: Date };
type LoggPost = { actorUserId: string | null; targetType: string; targetId: string; action: string; payload: unknown; createdAt: Date };

/** Kildene for et sett sedler: tre spørringer uansett antall (historikk, logg, navn). */
async function lastKorrigeringsHendelser(
  k: KorrigeringKlienter,
  sedler: readonly SedelForKorrigering[],
): Promise<{ hendelser: Map<string, KorrigeringsHendelse[]>; navn: Map<string, string | null> }> {
  const hendelser = new Map<string, KorrigeringsHendelse[]>(sedler.map((s) => [s.id, []]));
  const navn = new Map<string, string | null>();
  if (sedler.length === 0) return { hendelser, navn };
  const eier = new Map(sedler.map((s) => [s.id, s.userId]));
  const sedelIder = sedler.map((s) => s.id);
  const radIder = unike(
    sedler.flatMap((s) => [...s.timer, ...s.tillegg].flatMap((r) => [r.id, r.parentRadId ?? null])),
  );
  const [poster, logg] = await Promise.all([
    k.prismaTimer.sheetRadHistorikk.findMany({
      where: { sheetId: { in: sedelIder } },
      select: { radType: true, originalRadId: true, sheetId: true, snapshot: true, erstattetAvUserId: true, erstattetVed: true },
    }) as Promise<Postering[]>,
    k.prisma.activity.findMany({
      where: {
        OR: [
          { targetType: "DailySheet", targetId: { in: sedelIder }, action: { in: [...RETTE_HANDLINGER, "jobb.eco-flyttet"] } },
          ...(radIder.length > 0
            ? [{ targetType: { in: ["sheet_timer", "sheet_tillegg"] }, targetId: { in: radIder }, action: { in: ["timer.eco-flyttet", "tillegg.eco-flyttet"] } }]
            : []),
        ],
      },
      select: { actorUserId: true, targetType: true, targetId: true, action: true, payload: true, createdAt: true },
    }) as Promise<LoggPost[]>,
  ]);
  const retteLogg = logg.filter((l) => (RETTE_HANDLINGER as readonly string[]).includes(l.action));
  const nokkel = (rad: RadForKorrigering, n: string) => rad.id === n || rad.parentRadId === n;

  for (const p of poster) {
    if (!p.erstattetAvUserId || p.erstattetAvUserId === eier.get(p.sheetId)) continue;
    const snap = (p.snapshot ?? {}) as Record<string, unknown>;
    if (snap.hendelse === HISTORIKK_HENDELSE_GJENAAPNET || snap.hendelse === HISTORIKK_HENDELSE_SLETTET) continue;
    if (p.radType !== "timer" && p.radType !== "tillegg" && p.radType !== "maskin") continue;
    const radType = p.radType as RadType;
    // Verdien attestanten satte: loggposten for samme retting (samme person, samme sedel, rett etter).
    const t0 = p.erstattetVed.getTime();
    const treff = retteLogg
      .filter((l) => l.targetId === p.sheetId && l.actorUserId === p.erstattetAvUserId && l.createdAt.getTime() >= t0 && l.createdAt.getTime() - t0 <= LOGG_VINDU_MS)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    const payload = (treff?.payload ?? null) as { nyeSnapshot?: unknown; etterPrRad?: Record<string, Record<string, unknown>> } | null;
    // ✂, «Del opp» og «→ Kort B» (D2b): verdiene pr. rad-id (eldre poster uten dem faller tilbake på raden nå).
    const etterPrRad = treff && (treff.action === "splitt_rad" || treff.action === "del_jobb" || treff.action === "flytt_linje") ? (payload?.etterPrRad ?? null) : null;
    const nye = treff && !etterPrRad && payload?.nyeSnapshot && !Array.isArray(payload.nyeSnapshot)
      ? ((payload.nyeSnapshot as Record<string, unknown>)[radType] as Array<Record<string, unknown>> | undefined)
      : undefined;
    const etter = nye?.find((r) => r.originalId === p.originalRadId) ?? null;
    hendelser.get(p.sheetId)?.push({
      radType,
      ved: p.erstattetVed,
      avUserId: p.erstattetAvUserId,
      foer: snap,
      etter,
      etterPrRad,
      gjelder: (rad) => nokkel(rad, p.originalRadId),
    });
  }

  // F78: bytte av underprosjekt står bare i loggen.
  const radTilSedel = new Map<string, string>();
  for (const s of sedler) for (const r of [...s.timer, ...s.tillegg]) {
    radTilSedel.set(r.id, s.id);
    if (r.parentRadId) radTilSedel.set(r.parentRadId, s.id);
  }
  for (const l of logg) {
    const p = (l.payload ?? {}) as { fraEcoId?: string | null; tilEcoId?: string | null; kortId?: string | null };
    const sedelId = l.action === "jobb.eco-flyttet" ? l.targetId : radTilSedel.get(l.targetId);
    if (!sedelId || !l.actorUserId || l.actorUserId === eier.get(sedelId)) continue;
    const foer = { externalCostObjectId: p.fraEcoId ?? null };
    const etter = { externalCostObjectId: p.tilEcoId ?? null };
    const liste = hendelser.get(sedelId);
    if (!liste) continue;
    if (l.action === "jobb.eco-flyttet") {
      // Hele jobben: timer (ikke reise), tillegg og maskin med jobbens kort-id (flyttHeleJobben).
      const kortId = p.kortId ?? null;
      if (!kortId) continue;
      for (const radType of ["timer", "tillegg", "maskin"] as const) {
        liste.push({ radType, ved: l.createdAt, avUserId: l.actorUserId, foer, etter, gjelder: (rad) => rad.kortId === kortId && rad.erReise !== true });
      }
    } else if (l.action === "timer.eco-flyttet" || l.action === "tillegg.eco-flyttet") {
      const radType: RadType = l.action === "timer.eco-flyttet" ? "timer" : "tillegg";
      liste.push({ radType, ved: l.createdAt, avUserId: l.actorUserId, foer, etter, gjelder: (rad) => nokkel(rad, l.targetId) });
    }
  }

  const aktorer = unike(Array.from(hendelser.values()).flat().map((h) => h.avUserId));
  if (aktorer.length > 0) {
    const brukere = await k.prisma.user.findMany({ where: { id: { in: aktorer } }, select: { id: true, name: true } });
    // Navnet, aldri e-postadressen (del F «Uten navn»).
    for (const b of brukere) navn.set(b.id, b.name?.trim() || null);
  }
  return { hendelser, navn };
}

const raderMedType = (s: SedelForKorrigering) => [
  ...s.timer.map((rad) => ({ type: "timer" as const, rad })),
  ...s.tillegg.map((rad) => ({ type: "tillegg" as const, rad })),
  ...s.maskiner.map((rad) => ({ type: "maskin" as const, rad })),
];

/** Navn på id-feltene (lønnsart, aktivitet, prosjekt, byggeplass, underprosjekt, maskin). */
async function slaaOppTekster(k: KorrigeringKlienter, organizationId: string, felter: KorrigertFelt[]): Promise<void> {
  const ider = (felt: string) => unike(felter.filter((f) => f.felt === felt).flatMap((f) => [f.foer, f.etter].map((v) => (typeof v === "string" ? v : null))));
  const [lonnsart, aktivitet, prosjekt, byggeplass, eco, utstyr] = await Promise.all([
    ider("lonnsartId").length ? k.prismaTimer.lonnsart.findMany({ where: { id: { in: ider("lonnsartId") } }, select: { id: true, navn: true } }) : [],
    ider("aktivitetId").length ? k.prismaTimer.aktivitet.findMany({ where: { id: { in: ider("aktivitetId") } }, select: { id: true, navn: true } }) : [],
    ider("projectId").length
      ? k.prisma.project.findMany({ where: { id: { in: ider("projectId") } }, select: { id: true, name: true, projectNumber: true, internalProjectNumber: true } })
      : [],
    hentByggeplassNavn(k.prisma, ider("byggeplassId")),
    hentUnderprosjektNavn(k.prisma, ider("externalCostObjectId"), organizationId),
    hentUtstyrOppslag(k.prismaMaskin, ider("vehicleId")),
  ]);
  const tekst = new Map<string, string>();
  for (const l of lonnsart) tekst.set(`lonnsartId:${l.id}`, l.navn);
  for (const a of aktivitet) tekst.set(`aktivitetId:${a.id}`, a.navn);
  for (const p of prosjekt) tekst.set(`projectId:${p.id}`, [p.internalProjectNumber ?? p.projectNumber, p.name].filter(Boolean).join(" "));
  for (const [id, n] of byggeplass) tekst.set(`byggeplassId:${id}`, n);
  for (const [id, n] of eco) tekst.set(`externalCostObjectId:${id}`, n.navn);
  for (const [id, n] of utstyr.navn) tekst.set(`vehicleId:${id}`, n);
  for (const f of felter) {
    if (!ID_FELT.has(f.felt)) continue;
    f.foerTekst = typeof f.foer === "string" ? (tekst.get(`${f.felt}:${f.foer}`) ?? null) : null;
    f.etterTekst = typeof f.etter === "string" ? (tekst.get(`${f.felt}:${f.etter}`) ?? null) : null;
  }
}

/**
 * Arbeiderens leser for dagen (`hentMedId`): korrigeringene pr. radtype og rad-id, med navn på
 * id-feltene. Kalleren sender bare sedelen når den innloggede er eieren (isolasjon, F80).
 */
export async function hentKorrigeringer(k: KorrigeringKlienter, sedel: SedelForKorrigering): Promise<KorrigeringerPrRad> {
  const ut: KorrigeringerPrRad = { timer: {}, tillegg: {}, maskin: {} };
  const { hendelser, navn } = await lastKorrigeringsHendelser(k, [sedel]);
  const regnet = regnKorrigeringer(raderMedType(sedel), hendelser.get(sedel.id) ?? [], navn);
  if (regnet.size === 0) return ut;
  await slaaOppTekster(k, sedel.organizationId, Array.from(regnet.values()).flatMap((r) => r.felter));
  for (const [n, kor] of regnet) {
    const [type, id] = n.split(":") as [RadType, string];
    ut[type][id] = kor;
  }
  return ut;
}

/**
 * SL2 (plan § 4.18 del D, «Slettet og korrigert»): korrigeringene for et sett sedler i ett firma,
 * pr. sedel, regnet som merket «Korrigert av» (samme kilder og samme regel, B73). Tre spørringer
 * for kildene og én runde navneoppslag uansett antall sedler. Kalleren sender bare sedler
 * brukeren har rett til å se.
 */
export async function hentKorrigeringerForSedler(
  k: KorrigeringKlienter,
  organizationId: string,
  sedler: readonly SedelForKorrigering[],
): Promise<Map<string, Map<string, Korrigering>>> {
  const ut = new Map<string, Map<string, Korrigering>>();
  if (sedler.length === 0) return ut;
  const { hendelser, navn } = await lastKorrigeringsHendelser(k, sedler);
  for (const s of sedler) {
    const regnet = regnKorrigeringer(raderMedType(s), hendelser.get(s.id) ?? [], navn);
    if (regnet.size > 0) ut.set(s.id, regnet);
  }
  const felter = Array.from(ut.values()).flatMap((m) => Array.from(m.values()).flatMap((r) => r.felter));
  if (felter.length > 0) await slaaOppTekster(k, organizationId, felter);
  return ut;
}

export interface DagKorrigertAv {
  /** Navnet til den som korrigerte sist på dagen; null = ukjent. */
  navn: string | null;
  /** Flere enn én person har korrigert linjer på dagen («m.fl.»). */
  flere: boolean;
}

/**
 * Lista bak Mine timer (`list`): pr. dag hvem som korrigerte sist, og om flere har korrigert.
 * Tre spørringer uansett antall dager. Kalleren sender bare egne sedler (isolasjon, F80).
 */
export async function hentKorrigertAvPrDag(
  k: Omit<KorrigeringKlienter, "prismaMaskin">,
  sedler: readonly SedelForKorrigering[],
): Promise<Map<string, DagKorrigertAv>> {
  const ut = new Map<string, DagKorrigertAv>();
  const { hendelser, navn } = await lastKorrigeringsHendelser(k as KorrigeringKlienter, sedler);
  for (const s of sedler) {
    const regnet = Array.from(regnKorrigeringer(raderMedType(s), hendelser.get(s.id) ?? [], navn).values());
    if (regnet.length === 0) continue;
    const siste = regnet.reduce((a, b) => (b.ved > a.ved ? b : a));
    const personer = new Set(regnet.map((r) => r.avUserId ?? "ukjent"));
    ut.set(s.id, { navn: siste.avNavn, flere: personer.size > 1 });
  }
  return ut;
}

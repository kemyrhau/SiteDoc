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
    if (snap && snap.hendelse === HISTORIKK_HENDELSE_GJENAAPNET) continue;
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

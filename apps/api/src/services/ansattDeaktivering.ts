import type { Prisma } from "@sitedoc/db";
import { aktivtMedlemWhere } from "../trpc/tilgangskontroll";
import { avsluttProsjektmedlem, tellRestdokumenterHosPerson } from "./prosjektmedlemskap";
import { hmsSakIderSomFlyttes } from "./hmsAnsvarlig";
import {
  FLYTMEDLEM_SELECT,
  hentGjenvarendeILeddet,
  tellAndreBindingerILeddet,
} from "./flytFjerning";

/**
 * Deaktivering slår gjennom (ordre 2026-11-05 (6), L3 — spec-fjerning-deaktivering.md § 2 pkt 3/5).
 *
 * Hybrid: `OrganizationMember.status` er fortsatt porten. I tillegg avsluttes (periodeSlutt) de
 * prosjektmedlemskapene personen har I KRAFT AV firma X — prosjekter X eier eller deltar i som
 * `ProjectOrganization` (B5) — og rad-idene legges i Activity-payloaden, slik at reaktivering
 * gjenåpner nøyaktig de samme radene.
 *
 * Kenneths vilkår (svar 6a): personen kan ha sluttet i X og blitt ansatt i Y med samme bruker.
 * Ved tvil avsluttes ikke raden.
 *  (a) prosjekter der et annet AKTIVT firma Y for personen er eier eller deltaker røres aldri;
 *  (b) prosjektmedlemskap opprettet etter at personen ble ansatt i et Y som er NYERE enn
 *      ansettelsen i X, røres aldri.
 * Reaktivering gjenåpner bare rader med `periodeSlutt` nøyaktig lik deaktiveringstidspunktet
 * (noen andre har ikke endret dem), og (a) vurderes på nytt mot dagens aktive firmaer.
 *
 * Ballen og hovedansvaret flyttes ikke tilbake ved reaktivering — det er en flytbeslutning.
 */

type Db = Prisma.TransactionClient;

export type HoppOverGrunn = "annet_firma_deltar" | "opprettet_etter_nytt_firma" | "endret_siden";

interface BerortRad {
  projectId: string;
  projectName: string;
  projectMemberId: string;
}

export interface Berorte {
  berorte: BerortRad[];
  hoppetOver: Array<BerortRad & { grunn: HoppOverGrunn }>;
}

export interface AvsluttetProsjekt {
  projectId: string;
  projectMemberId: string;
  flytMedlemIder: string[];
  faggruppeKoblingIder: string[];
  gruppeMedlemIder: string[];
  dokumentflytter: Array<{
    id: string;
    medlemId: string;
    nyHovedansvarligPmId: string | null;
    dokumentIder: string[];
  }>;
  /** M3: åpne dokumenter utenom flytpekerne — ballen gikk til innsender, eller til ingen. */
  mottaker?: { tilInnsender: string[]; utenMottaker: string[] };
}

/** Activity-payload for `ansatt_deaktivert` (M5: alle koblinger som avsluttes er navngitt). */
export interface DeaktiveringsPayload {
  targetUserId: string;
  organizationId: string;
  avsluttetVed: string;
  prosjekter: AvsluttetProsjekt[];
  projectMemberIder: string[];
  flytMedlemIder: string[];
  faggruppeKoblingIder: string[];
  gruppeMedlemIder: string[];
  hoppetOver: Array<{ projectId: string; grunn: HoppOverGrunn }>;
}

/** Firmaene som deltar i hvert prosjekt: eier + ProjectOrganization. */
async function hentProsjektFirmaer(db: Db, projectIder: string[]) {
  if (projectIder.length === 0) return new Map<string, { name: string; firmaer: Set<string> }>();
  const prosjekter = await db.project.findMany({
    where: { id: { in: projectIder } },
    select: {
      id: true,
      name: true,
      primaryOrganizationId: true,
      projectOrganizations: { select: { organizationId: true } },
    },
  });
  return new Map(
    prosjekter.map((p) => [
      p.id,
      {
        name: p.name,
        firmaer: new Set([
          ...(p.primaryOrganizationId ? [p.primaryOrganizationId] : []),
          ...p.projectOrganizations.map((po) => po.organizationId),
        ]),
      },
    ]),
  );
}

/** Personens andre aktive ansettelser (ikke X). */
function hentAndreAktiveFirmaer(db: Db, userId: string, organizationId: string) {
  return db.organizationMember.findMany({
    where: { userId, status: "aktiv", organizationId: { not: organizationId } },
    select: { organizationId: true, createdAt: true },
  });
}

/**
 * Hvilke aktive prosjektmedlemskap personen har i kraft av X, og hvilke som skånes etter
 * vilkår (a)/(b). Prosjekter uten X som eier eller deltaker er ikke med i noen av listene.
 */
export async function finnBerorteProsjekter(
  db: Db,
  args: { userId: string; organizationId: string },
): Promise<Berorte> {
  const [xAnsettelse, andre, medlemskap] = await Promise.all([
    db.organizationMember.findUnique({
      where: { userId_organizationId: { userId: args.userId, organizationId: args.organizationId } },
      select: { createdAt: true },
    }),
    hentAndreAktiveFirmaer(db, args.userId, args.organizationId),
    db.projectMember.findMany({
      where: { userId: args.userId, ...aktivtMedlemWhere },
      select: { id: true, projectId: true, createdAt: true },
    }),
  ]);
  const prosjekter = await hentProsjektFirmaer(db, medlemskap.map((m) => m.projectId));
  const andreIder = new Set(andre.map((a) => a.organizationId));

  // (b): ankeret er den tidligste ansettelsen i et firma som er NYERE enn X.
  const xFra = xAnsettelse?.createdAt.getTime() ?? 0;
  const nyere = andre.map((a) => a.createdAt.getTime()).filter((t) => t > xFra);
  const anker = nyere.length > 0 ? Math.min(...nyere) : null;

  const resultat: Berorte = { berorte: [], hoppetOver: [] };
  for (const m of medlemskap) {
    const p = prosjekter.get(m.projectId);
    if (!p || !p.firmaer.has(args.organizationId)) continue;
    const rad = { projectId: m.projectId, projectName: p.name, projectMemberId: m.id };
    if ([...p.firmaer].some((f) => andreIder.has(f))) {
      resultat.hoppetOver.push({ ...rad, grunn: "annet_firma_deltar" });
    } else if (anker !== null && m.createdAt.getTime() > anker) {
      resultat.hoppetOver.push({ ...rad, grunn: "opprettet_etter_nytt_firma" });
    } else {
      resultat.berorte.push(rad);
    }
  }
  return resultat;
}

/**
 * Avslutter personens medlemskap i X sine prosjekter (ProjectMember, DokumentflytMedlem,
 * FaggruppeKobling, ProjectGroupMember) i kallerens transaksjon. Ballen flyttes etter B7.
 * Returnerer payloaden som skal i Activity-raden.
 */
export async function avsluttMedlemskapForPerson(
  tx: Db,
  args: { userId: string; organizationId: string },
  naa: Date = new Date(),
): Promise<DeaktiveringsPayload> {
  const { berorte, hoppetOver } = await finnBerorteProsjekter(tx, args);
  const prosjekter: AvsluttetProsjekt[] = [];
  for (const b of berorte) {
    const aktiv = { projectMemberId: b.projectMemberId, ...aktivtMedlemWhere };
    const [flyt, faggrupper, grupper] = await Promise.all([
      tx.dokumentflytMedlem.findMany({ where: aktiv, select: { id: true } }),
      tx.faggruppeKobling.findMany({ where: aktiv, select: { id: true } }),
      tx.projectGroupMember.findMany({ where: aktiv, select: { id: true } }),
    ]);
    const resultat = await avsluttProsjektmedlem(
      tx,
      { id: b.projectMemberId, userId: args.userId, projectId: b.projectId },
      naa,
    );
    prosjekter.push({
      projectId: b.projectId,
      projectMemberId: b.projectMemberId,
      flytMedlemIder: flyt.map((r) => r.id),
      faggruppeKoblingIder: faggrupper.map((r) => r.id),
      gruppeMedlemIder: grupper.map((r) => r.id),
      dokumentflytter: resultat.flyt.map((f) => ({
        id: f.dokumentflytId,
        medlemId: f.medlemId,
        nyHovedansvarligPmId: f.nyHovedansvarligPmId,
        dokumentIder: f.dokumentIder,
      })),
      mottaker: resultat.mottaker,
    });
  }
  return {
    targetUserId: args.userId,
    organizationId: args.organizationId,
    avsluttetVed: naa.toISOString(),
    prosjekter,
    projectMemberIder: prosjekter.map((p) => p.projectMemberId),
    flytMedlemIder: prosjekter.flatMap((p) => p.flytMedlemIder),
    faggruppeKoblingIder: prosjekter.flatMap((p) => p.faggruppeKoblingIder),
    gruppeMedlemIder: prosjekter.flatMap((p) => p.gruppeMedlemIder),
    hoppetOver: hoppetOver.map((h) => ({ projectId: h.projectId, grunn: h.grunn })),
  };
}

/** Leser payloaden defensivt — eldre `ansatt_deaktivert`-rader (før L3) har ingen prosjekter. */
export function lesDeaktiveringsPayload(payload: unknown): DeaktiveringsPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Partial<DeaktiveringsPayload>;
  if (typeof p.avsluttetVed !== "string" || !Array.isArray(p.prosjekter)) return null;
  return p as DeaktiveringsPayload;
}

/**
 * Reaktivering: gjenåpner nøyaktig radene i payloaden — bare de som fortsatt har
 * `periodeSlutt` lik deaktiveringstidspunktet, og bare i prosjekter der ingen annen aktiv
 * ansettelse (a) nå deltar. Et prosjektmedlem som er endret siden, skåner også underradene.
 */
export async function gjenapneMedlemskapFraPayload(
  tx: Db,
  payload: DeaktiveringsPayload,
): Promise<{ gjenapnet: string[]; hoppetOver: Array<{ projectId: string; grunn: HoppOverGrunn }> }> {
  const avsluttetVed = new Date(payload.avsluttetVed);
  const [andre, prosjekter] = await Promise.all([
    hentAndreAktiveFirmaer(tx, payload.targetUserId, payload.organizationId),
    hentProsjektFirmaer(tx, payload.prosjekter.map((p) => p.projectId)),
  ]);
  const andreIder = new Set(andre.map((a) => a.organizationId));

  const gjenapnet: string[] = [];
  const hoppetOver: Array<{ projectId: string; grunn: HoppOverGrunn }> = [];
  for (const p of payload.prosjekter) {
    const firmaer = prosjekter.get(p.projectId)?.firmaer ?? new Set<string>();
    if ([...firmaer].some((f) => andreIder.has(f))) {
      hoppetOver.push({ projectId: p.projectId, grunn: "annet_firma_deltar" });
      continue;
    }
    const uendret = { periodeSlutt: avsluttetVed };
    const pm = await tx.projectMember.updateMany({
      where: { id: p.projectMemberId, ...uendret },
      data: { periodeSlutt: null },
    });
    if (pm.count === 0) {
      hoppetOver.push({ projectId: p.projectId, grunn: "endret_siden" });
      continue;
    }
    if (p.flytMedlemIder.length > 0) {
      await tx.dokumentflytMedlem.updateMany({
        where: { id: { in: p.flytMedlemIder }, ...uendret },
        data: { periodeSlutt: null },
      });
    }
    if (p.faggruppeKoblingIder.length > 0) {
      await tx.faggruppeKobling.updateMany({
        where: { id: { in: p.faggruppeKoblingIder }, ...uendret },
        data: { periodeSlutt: null },
      });
    }
    if (p.gruppeMedlemIder.length > 0) {
      await tx.projectGroupMember.updateMany({
        where: { id: { in: p.gruppeMedlemIder }, ...uendret },
        data: { periodeSlutt: null },
      });
    }
    gjenapnet.push(p.projectId);
  }
  return { gjenapnet, hoppetOver };
}

/**
 * Forhåndsvisning for DeaktiverModal: berørte prosjekter, aktive flytledd, ledd der personen
 * står alene (ballen havner på leddet), åpne dokumenter som går til innsender (M3), og
 * prosjekter som skånes etter vilkåret.
 */
export async function forhandsvisDeaktivering(
  db: Db,
  args: { userId: string; organizationId: string },
) {
  const { berorte, hoppetOver } = await finnBerorteProsjekter(db, args);
  // Ordre (11): HMS-saker som blir hos HMS-gruppa — samme utvalg som sweepen i settAnsattStatus.
  const hmsSaker = await hmsSakIderSomFlyttes(db, {
    ...args,
    avsluttesProjectMemberIder: berorte.map((b) => b.projectMemberId),
  });
  const flytrader = berorte.length === 0
    ? []
    : await db.dokumentflytMedlem.findMany({
        where: { projectMemberId: { in: berorte.map((b) => b.projectMemberId) }, ...aktivtMedlemWhere },
        select: { ...FLYTMEDLEM_SELECT, dokumentflyt: { select: { name: true, projectId: true } } },
      });
  const prosjektNavn = new Map(berorte.map((b) => [b.projectId, b.projectName]));
  const alene: Array<{ prosjektNavn: string; flytNavn: string; rolle: string }> = [];
  for (const rad of flytrader) {
    const [andrePersoner, andreBindinger] = await Promise.all([
      hentGjenvarendeILeddet(db, rad),
      tellAndreBindingerILeddet(db, rad),
    ]);
    if (andrePersoner.length === 0 && andreBindinger === 0) {
      alene.push({
        prosjektNavn: prosjektNavn.get(rad.dokumentflyt.projectId) ?? "",
        flytNavn: rad.dokumentflyt.name,
        rolle: rad.rolle,
      });
    }
  }
  // M3: dokumenter hos personen som B7 ikke flytter (uten flyt / faggruppe-ledd) går til innsender.
  const gruppeLedd = berorte.length === 0
    ? []
    : await db.dokumentflytMedlem.findMany({
        where: { hovedansvarligPersonId: { in: berorte.map((b) => b.projectMemberId) }, ...aktivtMedlemWhere },
        select: { dokumentflytId: true },
      });
  const flyterMedPeker = [...new Set([...flytrader, ...gruppeLedd].map((r) => r.dokumentflytId))];
  let antallTilInnsender = 0;
  for (const b of berorte) {
    antallTilInnsender += await tellRestdokumenterHosPerson(db, {
      projectId: b.projectId,
      userId: args.userId,
      flyterMedPeker,
      unntatt: hmsSaker,
    });
  }
  return {
    prosjekter: berorte.map((b) => ({ id: b.projectId, navn: b.projectName })),
    antallFlytledd: flytrader.length,
    antallTilInnsender,
    antallHmsSaker: hmsSaker.length,
    alene,
    hoppetOver: hoppetOver.map((h) => ({ id: h.projectId, navn: h.projectName, grunn: h.grunn })),
  };
}

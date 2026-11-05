import type { Prisma } from "@sitedoc/db";
import { aktivtMedlemWhere } from "../trpc/tilgangskontroll";
import { APENT_DOKUMENT_WHERE } from "./flytFjerning";
import { loggMedlemsendring } from "./prosjektmedlemskap";

type Db = Prisma.TransactionClient;

/** Historikklinja på hver sak sweepen flytter. */
export const HMS_ROLLE_FJERNET_KOMMENTAR =
  "HMS-ansvarlig-rollen er fjernet i firmaet — saken ligger hos prosjektets HMS-behandlere";

/**
 * Ordre (9): åpne HMS-saker der personen har ballen som behandler i prosjektene firma-rollen
 * `hms_ansvarlig` gir tilgang til — de med `primaryOrganizationId` = firmaet (samme avgrensning
 * som `erHmsAdmin` → `harFirmaHmsTilgang`). Har personen ballen som melder (eget dokument,
 * utenfor Ledd 2), er det ikke rollen som ga den, og saken står urørt.
 */
function hmsSakerHosPersonWhere(organizationId: string, userId: string) {
  return {
    recipientUserId: userId,
    ...APENT_DOKUMENT_WHERE,
    template: { domain: "hms", project: { primaryOrganizationId: organizationId } },
    OR: [{ aktivPosisjon: 2 }, { bestillerUserId: { not: userId } }],
  };
}

type Sak = { id: string; status: string; recipientGroupId: string | null; template: { projectId: string } };

/**
 * Sakene som mister personpekeren når rollen fjernes: prosjekter der personen fortsatt er
 * HMS-behandler uten firma-rollen (prosjekt-admin eller aktivt medlem av en HMS-gruppe — de to
 * første grenene i `erHmsAdmin`) beholder ballen hos personen. Delt av forhåndsvisning og sweep,
 * så antallet i modalen er det sweepen treffer.
 */
async function finnSakerSomFlyttes(
  db: Db,
  args: { organizationId: string; userId: string },
): Promise<{ sjekklister: Sak[]; oppgaver: Sak[] }> {
  const where = hmsSakerHosPersonWhere(args.organizationId, args.userId);
  const select = { id: true, status: true, recipientGroupId: true, template: { select: { projectId: true } } };
  // Utvalget krever en HMS-mal, så `template` er alltid satt — filteret gjør det synlig for TS.
  const medMal = <T extends { template: { projectId: string } | null }>(rader: T[]) =>
    rader.filter((r): r is T & Sak => r.template !== null);
  const [sjekklister, oppgaver] = await Promise.all([
    db.checklist.findMany({ where, select }).then(medMal),
    db.task.findMany({ where: where as Prisma.TaskWhereInput, select }).then(medMal),
  ]);
  const prosjektIder = [...new Set([...sjekklister, ...oppgaver].map((s) => s.template.projectId))];
  if (prosjektIder.length === 0) return { sjekklister: [], oppgaver: [] };

  const medlemskap = await db.projectMember.findMany({
    where: { userId: args.userId, projectId: { in: prosjektIder }, ...aktivtMedlemWhere },
    select: {
      projectId: true,
      role: true,
      groupMemberships: { where: aktivtMedlemWhere, select: { group: { select: { domains: true } } } },
    },
  });
  const beholder = new Set(
    medlemskap
      .filter((m) =>
        m.role === "admin" ||
        m.groupMemberships.some((gm) => Array.isArray(gm.group.domains) && (gm.group.domains as unknown[]).includes("hms")),
      )
      .map((m) => m.projectId),
  );
  const flyttes = (s: Sak) => !beholder.has(s.template.projectId);
  return { sjekklister: sjekklister.filter(flyttes), oppgaver: oppgaver.filter(flyttes) };
}

/** Antall til fjern-modalen for firma-HMS-ansvarlig — samme utvalg som sweepen. */
export async function tellHmsSakerHosPerson(
  db: Db,
  args: { organizationId: string; userId: string },
): Promise<number> {
  const { sjekklister, oppgaver } = await finnSakerSomFlyttes(db, args);
  return sjekklister.length + oppgaver.length;
}

/**
 * Ordre (9), A (Kenneth via orkestrator 2026-11-05): når firma-rollen fjernes, mister personen
 * personpekeren på sakene over. Ballen blir liggende på Ledd 2 (HMS-gruppa, `recipientGroupId`
 * urørt), hver sak får en historikklinje, og hvert berørt prosjekt får Activity
 * `hms_ansvarlig_fjernet`. Kjøres i samme transaksjon som rolleendringen.
 */
export async function flyttHmsSakerVedRollefjerning(
  tx: Db,
  ctx: { userId: string; ipAddress: string | null; userAgent: string | null },
  args: { organizationId: string; userId: string },
): Promise<{ sjekklister: string[]; oppgaver: string[] }> {
  const { sjekklister, oppgaver } = await finnSakerSomFlyttes(tx, args);

  if (sjekklister.length > 0) {
    await tx.checklist.updateMany({ where: { id: { in: sjekklister.map((s) => s.id) } }, data: { recipientUserId: null } });
  }
  if (oppgaver.length > 0) {
    await tx.task.updateMany({ where: { id: { in: oppgaver.map((s) => s.id) } }, data: { recipientUserId: null } });
  }
  const historikk = (s: Sak) => ({
    senderId: ctx.userId,
    recipientUserId: null,
    recipientGroupId: s.recipientGroupId,
    fromStatus: s.status,
    toStatus: s.status,
    comment: HMS_ROLLE_FJERNET_KOMMENTAR,
  });
  for (const s of sjekklister) await tx.documentTransfer.create({ data: { checklistId: s.id, ...historikk(s) } });
  for (const s of oppgaver) await tx.documentTransfer.create({ data: { taskId: s.id, ...historikk(s) } });

  const perProsjekt = new Map<string, { sjekklister: string[]; oppgaver: string[] }>();
  for (const [liste, saker] of [["sjekklister", sjekklister], ["oppgaver", oppgaver]] as const) {
    for (const s of saker) {
      const p = perProsjekt.get(s.template.projectId) ?? { sjekklister: [], oppgaver: [] };
      p[liste].push(s.id);
      perProsjekt.set(s.template.projectId, p);
    }
  }
  for (const [projectId, saker] of perProsjekt) {
    await loggMedlemsendring(tx, ctx, {
      projectId,
      targetType: "hms_ansvarlig",
      targetId: args.userId,
      action: "hms_ansvarlig_fjernet",
      payload: { organizationId: args.organizationId, ...saker },
    });
  }
  return { sjekklister: sjekklister.map((s) => s.id), oppgaver: oppgaver.map((s) => s.id) };
}

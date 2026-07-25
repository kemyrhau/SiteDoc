/**
 * Auto-prosjektadmin (B Kloss 2b, 2026-07-24).
 *
 * Firma-innstillingen OrganizationSetting.autoProsjektAdmin styrer om firmaets
 * firma-admin(er) automatisk skal legges som ProjectMember.role=admin ved
 * oppretting av NYE prosjekter. Løser hierarki-invarianten (firma-admin ≥
 * prosjektadmin i eget firma) via MEDLEMSKAP — ikke via flyt-nivå. Automatiserer
 * bare omveien (manuell selv-tildeling via medlem.leggTil → O-3a firma-fallback).
 *
 * Kanter (rettighetsmatrise-config-design § 1b):
 *  - Kun NYE prosjekter — ingen backfill på eksisterende.
 *  - Firma-admin utnevnt ETTER oppretting dekkes ikke (omvei: manuell tildeling).
 *  - Standalone-prosjekt (organizationId = null) = no-op.
 *  - Firma-grense server-side: firma-admin-oppslag ALLTID på prosjektets egen
 *    org (aldri cross-org).
 *
 * Kalles INNE i samme $transaction som prosjektopprettingen, ETTER at
 * oppretter-medlemmet er laget (så dedup fanger oppretteren).
 */
import { type Prisma } from "@sitedoc/db";

type TxClient = Prisma.TransactionClient;

export async function autoLeggFirmaAdmins(
  tx: TxClient,
  projectId: string,
  organizationId: string | null,
): Promise<void> {
  // Standalone-prosjekt: ingen firma → no-op.
  if (!organizationId) return;

  const setting = await tx.organizationSetting.findUnique({
    where: { organizationId },
    select: { autoProsjektAdmin: true },
  });
  // "av" / ingen innstilling = dagens oppførsel (kun oppretteren).
  if (setting?.autoProsjektAdmin !== "alle_firma_admins") return;

  // Firma-admins for DENNE org (aldri cross-org).
  const firmaAdmins = await tx.organizationMember.findMany({
    where: { organizationId, firmaRoller: { has: "firma_admin" } },
    select: { userId: true },
  });
  if (firmaAdmins.length === 0) return;

  // Dedup mot eksisterende medlemmer (oppretteren, evt. andre).
  const eksisterende = await tx.projectMember.findMany({
    where: { projectId },
    select: { userId: true },
  });
  const finnes = new Set(eksisterende.map((m) => m.userId));

  const nyeUserIds = firmaAdmins
    .map((a) => a.userId)
    .filter((userId) => !finnes.has(userId));
  if (nyeUserIds.length === 0) return;

  await tx.projectMember.createMany({
    data: nyeUserIds.map((userId) => ({ projectId, userId, role: "admin" })),
    skipDuplicates: true,
  });
}

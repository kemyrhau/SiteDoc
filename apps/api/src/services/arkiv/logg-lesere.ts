/**
 * Arkivmal — logg-lesere (PRISMA-LAG).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ARKITEKTUR-GRENSE (gatet av cowork 2026-08-12) — les før du flytter dette:
 *
 *   Rendrer-containeren (fase 3) er en REN HTML→PDF-konverter. Den har INGEN
 *   databasetilgang — ingen Prisma, ingen DATABASE_URL. Api-et leser data (disse
 *   leserne) + bygger HTML via det rene laget (@sitedoc/pdf/arkivmal) + eksponerer
 *   enkeltdokument-API-et; containeren mottar ferdig HTML og returnerer PDF.
 *
 *   Derfor bor leserne her i apps/api og ikke i en delt pakke: de har bare én
 *   konsument. Ser du senere behov for at containeren leser selv — MELD DET SOM
 *   FUNN framfor å legge Prisma i containeren; det ville endre sikkerhetsflaten
 *   fundamentalt (207-lærdommen gjelder containerens FIL_SIGNING_SECRET for
 *   signering, ikke DATABASE_URL for lesing).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { PrismaClient } from "@sitedoc/db";
import type { PrismaClient as PrismaTimerClient } from "@sitedoc/db-timer";
import { avledHandling } from "@sitedoc/pdf";
import type { HendelseRad, RåEndring, PunktRad, RevisjonRad } from "@sitedoc/pdf";

/** Peker på ett underveis-dokument (sjekkliste ELLER oppgave). */
export type DokumentRef = { checklistId: string } | { taskId: string };

const erSjekkliste = (ref: DokumentRef): ref is { checklistId: string } =>
  "checklistId" in ref;

/**
 * Lag 1 — Hendelseslogg. `DocumentTransfer` (alltid) + `TaskComment` (kun
 * oppgave; sjekkliste har ingen frittstående kommentar). Kronologisk stigende.
 * `antallFeltendringer` settes senere av combineren (`byggArkivLogg`).
 */
export async function lesHendelseslogg(
  prisma: PrismaClient,
  ref: DokumentRef,
): Promise<HendelseRad[]> {
  const where = erSjekkliste(ref)
    ? { checklistId: ref.checklistId }
    : { taskId: ref.taskId };

  const transfers = await prisma.documentTransfer.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      sender: { select: { name: true } },
      recipientUser: { select: { name: true } },
      recipientGroup: { select: { name: true } },
    },
  });

  const hendelser: HendelseRad[] = transfers.map((t) => ({
    tidspunkt: t.createdAt.toISOString(),
    aktor: t.sender?.name ?? "—",
    aktorRolle: t.senderRolle,
    handling: avledHandling(t.fromStatus, t.toStatus),
    fraStatus: t.fromStatus,
    tilStatus: t.toStatus,
    til: t.recipientUser?.name ?? t.recipientGroup?.name ?? t.recipientEnterpriseName ?? null,
    flyt: t.dokumentflytName,
    kommentar: t.comment,
    kilde: "transfer",
    antallFeltendringer: 0,
  }));

  if (!erSjekkliste(ref)) {
    const kommentarer = await prisma.taskComment.findMany({
      where: { taskId: ref.taskId },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true } } },
    });
    for (const k of kommentarer) {
      hendelser.push({
        tidspunkt: k.createdAt.toISOString(),
        aktor: k.user?.name ?? "—",
        handling: "Kommentar",
        kommentar: k.content,
        kilde: "kommentar",
        antallFeltendringer: 0,
      });
    }
    hendelser.sort((a, b) => a.tidspunkt.localeCompare(b.tidspunkt));
  }

  return hendelser;
}

/**
 * Lag 2 — Endringslogg (feltdiff). Gatet på malens `enableChangeLog`:
 * `false` → `[]` (seksjonen utelates i stillhet; lag 1 dekker
 * sporbarhetsminimumet). Flat liste — combineren grupperer i økter.
 */
export async function lesEndringslogg(
  prisma: PrismaClient,
  ref: DokumentRef,
  enableChangeLog: boolean,
): Promise<RåEndring[]> {
  if (!enableChangeLog) return [];

  const rader = erSjekkliste(ref)
    ? await prisma.checklistChangeLog.findMany({
        where: { checklistId: ref.checklistId },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true } } },
      })
    : await prisma.taskChangeLog.findMany({
        where: { taskId: ref.taskId },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true } } },
      });

  return rader.map((r) => ({
    userId: r.userId,
    aktor: r.user?.name ?? "—",
    tidspunkt: r.createdAt.toISOString(),
    feltId: r.fieldId,
    felt: r.fieldLabel,
    fraVerdi: r.oldValue,
    tilVerdi: r.newValue,
  }));
}

/**
 * Kontrollplan — punkt-historikk (`KontrollplanHistorikk`, PUNKT-nivå).
 * Plan-nivå status er ULOGGET → «ærlig linje» håndteres ved render, ikke her.
 */
export async function lesPunktHistorikk(
  prisma: PrismaClient,
  kontrollplanId: string,
): Promise<PunktRad[]> {
  const rader = await prisma.kontrollplanHistorikk.findMany({
    where: { punkt: { kontrollplanId } },
    orderBy: { tidspunkt: "asc" },
    include: {
      bruker: { select: { name: true } },
      punkt: {
        select: {
          sjekklisteMal: { select: { name: true } },
          omrade: { select: { navn: true } },
        },
      },
    },
  });

  return rader.map((r) => ({
    tidspunkt: r.tidspunkt.toISOString(),
    aktor: r.bruker?.name ?? "—",
    handling: r.handling,
    kommentar: r.kommentar,
    punktLabel: [r.punkt?.omrade?.navn, r.punkt?.sjekklisteMal?.name].filter(Boolean).join(" · ") || null,
  }));
}

/**
 * Timer/utlegg — «Revisjoner» (`SheetRadHistorikk`, snapshot-form). Cross-schema
 * (`timer`); `erstattetAvUserId` er SVAK FK → eget navne-oppslag mot kjerne-db.
 */
export async function lesRevisjoner(
  prisma: PrismaClient,
  prismaTimer: PrismaTimerClient,
  sheetId: string,
): Promise<RevisjonRad[]> {
  const rader = await prismaTimer.sheetRadHistorikk.findMany({
    where: { sheetId },
    orderBy: { erstattetVed: "asc" },
  });

  const userIds = [...new Set(rader.map((r) => r.erstattetAvUserId).filter((x): x is string => !!x))];
  const brukere = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  const navn = new Map(brukere.map((u) => [u.id, u.name ?? "—"]));

  return rader.map((r) => ({
    tidspunkt: r.erstattetVed.toISOString(),
    aktor: r.erstattetAvUserId ? navn.get(r.erstattetAvUserId) ?? "—" : "—",
    radType: r.radType,
    snapshot: (r.snapshot ?? {}) as Record<string, unknown>,
  }));
}

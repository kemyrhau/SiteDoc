/**
 * CSV-rådata for dataeksport (fase 2, 2026-08-11).
 *
 * Timer + utlegg som rådata-CSV — Kenneths utvidelse av fabels PDF-sammendrag
 * (kunden kan regne videre selv ved et sluttoppgjør). PDF-sammendraget kommer i
 * fase 3 (rendrer). Overlapper regnskapseksporten bevisst, men er dokumentasjon,
 * ikke regnskaps-linje-integrasjon.
 *
 * Format: `;`-delimiter (norsk Excel bruker komma som desimal) + UTF-8 BOM (så
 * æøå vises riktig i Excel) + RFC-4180-quoting.
 */
import type { PrismaClient } from "@sitedoc/db";
import type { PrismaClient as PrismaTimerClient } from "@sitedoc/db-timer";

const BOM = "﻿";

function csvFelt(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRad(felter: (string | number | null | undefined)[]): string {
  return felter.map(csvFelt).join(";");
}

/** Decimal/desimal → norsk komma ("8.00" → "8,00"). */
function norskTall(v: { toString(): string } | null | undefined): string {
  if (v === null || v === undefined) return "";
  return v.toString().replace(".", ",");
}

function isoDato(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Hent brukernavn for et sett userId-er (kjerne-db) — timer-radene har kun id. */
async function hentBrukernavn(
  prisma: PrismaClient,
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const brukere = await prisma.user.findMany({
    where: { id: { in: [...new Set(userIds)] } },
    select: { id: true, name: true, email: true },
  });
  return new Map(brukere.map((b) => [b.id, b.name ?? b.email ?? b.id]));
}

export async function byggTimerCsv(
  prisma: PrismaClient,
  prismaTimer: PrismaTimerClient,
  projectId: string,
): Promise<string> {
  const rader = await prismaTimer.sheetTimer.findMany({
    where: { projectId },
    select: {
      timer: true,
      fraTid: true,
      tilTid: true,
      beskrivelse: true,
      attestertStatus: true,
      sheet: { select: { dato: true, userId: true } },
      lonnsart: { select: { navn: true } },
      aktivitet: { select: { navn: true } },
    },
    orderBy: { sheet: { dato: "asc" } },
  });

  const navn = await hentBrukernavn(prisma, rader.map((r) => r.sheet.userId));

  const linjer = [
    csvRad(["Dato", "Ansatt", "Lønnsart", "Aktivitet", "Timer", "Fra", "Til", "Beskrivelse", "Attestert"]),
    ...rader.map((r) =>
      csvRad([
        isoDato(r.sheet.dato),
        navn.get(r.sheet.userId) ?? r.sheet.userId,
        r.lonnsart.navn,
        r.aktivitet.navn,
        norskTall(r.timer),
        r.fraTid,
        r.tilTid,
        r.beskrivelse,
        r.attestertStatus,
      ]),
    ),
  ];
  return BOM + linjer.join("\r\n") + "\r\n";
}

export async function byggUtleggCsv(
  prisma: PrismaClient,
  prismaTimer: PrismaTimerClient,
  projectId: string,
): Promise<string> {
  const rader = await prismaTimer.sheetUtlegg.findMany({
    where: { projectId },
    select: {
      belop: true,
      mvaSats: true,
      kommentar: true,
      ordningVedFoering: true,
      sheet: { select: { dato: true, userId: true } },
      expenseCategory: { select: { navn: true } },
    },
    orderBy: { sheet: { dato: "asc" } },
  });

  const navn = await hentBrukernavn(prisma, rader.map((r) => r.sheet.userId));

  const linjer = [
    csvRad(["Dato", "Ansatt", "Kategori", "Beløp", "MVA-sats", "Ordning", "Kommentar"]),
    ...rader.map((r) =>
      csvRad([
        isoDato(r.sheet.dato),
        navn.get(r.sheet.userId) ?? r.sheet.userId,
        r.expenseCategory.navn,
        norskTall(r.belop),
        norskTall(r.mvaSats),
        r.ordningVedFoering,
        r.kommentar,
      ]),
    ),
  ];
  return BOM + linjer.join("\r\n") + "\r\n";
}

/** Antall rader (for manifest-statistikk / hopp over tomme CSV-er). */
export async function tellTimerOgUtlegg(
  prismaTimer: PrismaTimerClient,
  projectId: string,
): Promise<{ timer: number; utlegg: number }> {
  const [timer, utlegg] = await Promise.all([
    prismaTimer.sheetTimer.count({ where: { projectId } }),
    prismaTimer.sheetUtlegg.count({ where: { projectId } }),
  ]);
  return { timer, utlegg };
}

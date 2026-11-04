/**
 * Metadata M-pakke (B-2 + B-3 + B-4) — beriker liste-radene fra `hentForProsjekt`
 * med `statushendelser` (sendt/godkjent/lukket), `utfylling` (sist utfylt av + alle)
 * og `signatur` (kreves/signert/komplett). Alt utledes fra eksisterende tabeller
 * (alternativ U + L i spec-metadata-filter.md) — ingen migrering.
 *
 * Fast antall ekstra spørringer pr. liste (ikke N+1): transfers, endringslogg-grupper,
 * brukernavn, og — kun når lista har SJA-dokumenter — runder + aktive deltakere.
 * Reduksjonene er rene funksjoner i @sitedoc/shared (dokumentMetadata.ts).
 */

import type { PrismaClient } from "@sitedoc/db";
import {
  beregnDokumentSignatur,
  reduserStatushendelser,
  reduserUtfylling,
  type DokumentSignaturstatus,
  type SisteRundeSammendrag,
  type StatusTransferRad,
  type Statushendelser,
  type SynlighetsObjekt,
  type UtfyltGruppe,
  type Utfylling,
} from "@sitedoc/shared";

/** Statusene som bærer sendt/godkjent/lukket (spec § 1.1 U). */
const STATUS_TIL = ["sent", "received", "approved", "closed"];

export interface MetadataKilde {
  id: string;
  terminal: string | null;
  data: unknown;
  innholdsVersjon: number;
  // `config` er Prisma-Json; formen er strukturelt lik SynlighetsObjekt.
  template: { enableChangeLog: boolean; objects: { id: string; type: string; config: unknown; parentId: string | null }[] } | null;
}

export interface Dokumentmetadata {
  statushendelser: Statushendelser;
  utfylling: Utfylling | null;
  signatur: DokumentSignaturstatus | null;
}

type Dokumenttype = "checklist" | "task";

function grupper<T>(rader: readonly T[], nokkel: (r: T) => string | null): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rader) {
    const k = nokkel(r);
    if (!k) continue;
    const liste = m.get(k);
    if (liste) liste.push(r);
    else m.set(k, [r]);
  }
  return m;
}

export async function berikMedMetadata<T extends MetadataKilde>(
  prisma: PrismaClient,
  type: Dokumenttype,
  dokumenter: T[],
): Promise<(T & Dokumentmetadata)[]> {
  if (dokumenter.length === 0) return [];
  const ider = dokumenter.map((d) => d.id);
  const loggIder = dokumenter.filter((d) => d.template?.enableChangeLog).map((d) => d.id);
  const sjaIder = dokumenter
    .filter((d) => d.template?.objects.some((o) => o.type === "signature_list"))
    .map((d) => d.id);
  const erSjekkliste = type === "checklist";
  const transferSelect = {
    checklistId: true,
    taskId: true,
    fromStatus: true,
    toStatus: true,
    createdAt: true,
    sender: { select: { id: true, name: true } },
  } as const;
  const rundeSelect = {
    checklistId: true,
    taskId: true,
    rundeNr: true,
    avsluttetAt: true,
    antallDeltakere: true,
    signaturer: { select: { signertVersjon: true, nySignaturKrevdAt: true, bekreftetAvUserId: true } },
  } as const;

  const [transfers, loggGrupper, runder, deltakerTall] = await Promise.all([
    erSjekkliste
      ? prisma.documentTransfer.findMany({
          where: { checklistId: { in: ider }, toStatus: { in: STATUS_TIL } },
          select: transferSelect,
          orderBy: { createdAt: "asc" },
        })
      : prisma.documentTransfer.findMany({
          where: { taskId: { in: ider }, toStatus: { in: STATUS_TIL } },
          select: transferSelect,
          orderBy: { createdAt: "asc" },
        }),
    loggIder.length === 0
      ? Promise.resolve([] as { dokId: string; userId: string; sist: Date }[])
      : erSjekkliste
        ? prisma.checklistChangeLog
            .groupBy({ by: ["checklistId", "userId"], where: { checklistId: { in: loggIder } }, _max: { createdAt: true } })
            .then((r) => r.map((g) => ({ dokId: g.checklistId, userId: g.userId, sist: g._max.createdAt! })))
        : prisma.taskChangeLog
            .groupBy({ by: ["taskId", "userId"], where: { taskId: { in: loggIder } }, _max: { createdAt: true } })
            .then((r) => r.map((g) => ({ dokId: g.taskId, userId: g.userId, sist: g._max.createdAt! }))),
    sjaIder.length === 0
      ? Promise.resolve([])
      : erSjekkliste
        ? prisma.signaturRunde.findMany({ where: { checklistId: { in: sjaIder } }, select: rundeSelect })
        : prisma.signaturRunde.findMany({ where: { taskId: { in: sjaIder } }, select: rundeSelect }),
    sjaIder.length === 0
      ? Promise.resolve([] as { dokId: string; antall: number }[])
      : erSjekkliste
        ? prisma.dokumentDeltaker
            .groupBy({ by: ["checklistId"], where: { checklistId: { in: sjaIder }, fjernetAt: null }, _count: { _all: true } })
            .then((r) => r.map((g) => ({ dokId: g.checklistId!, antall: g._count._all })))
        : prisma.dokumentDeltaker
            .groupBy({ by: ["taskId"], where: { taskId: { in: sjaIder }, fjernetAt: null }, _count: { _all: true } })
            .then((r) => r.map((g) => ({ dokId: g.taskId!, antall: g._count._all }))),
  ]);

  // Navn for loggbrukere — ett oppslag for hele lista.
  const brukerIder = [...new Set(loggGrupper.map((g) => g.userId))];
  const brukere =
    brukerIder.length === 0
      ? []
      : await prisma.user.findMany({ where: { id: { in: brukerIder } }, select: { id: true, name: true } });
  const navn = new Map(brukere.map((b) => [b.id, b.name]));

  const transferPrDok = grupper(transfers, (t) => (erSjekkliste ? t.checklistId : t.taskId));
  const loggPrDok = grupper(loggGrupper, (g) => g.dokId);
  const runderPrDok = grupper(runder, (r) => (erSjekkliste ? r.checklistId : r.taskId));
  const aktivePrDok = new Map(deltakerTall.map((d) => [d.dokId, d.antall]));

  return dokumenter.map((d) => {
    const dokRunder = runderPrDok.get(d.id) ?? [];
    const siste = dokRunder.reduce<(typeof dokRunder)[number] | null>(
      (best, r) => (!best || r.rundeNr > best.rundeNr ? r : best),
      null,
    );
    // Samme telleregel som signaturliste.ts (brikka i dokumentet): krevd-ny teller ikke,
    // signert (egen rad) og bekreftet (gjest) holdes adskilt.
    const tellende = siste?.signaturer.filter((s) => s.nySignaturKrevdAt === null) ?? [];
    const sammendrag: SisteRundeSammendrag | null = siste
      ? {
          rundeNr: siste.rundeNr,
          avsluttet: siste.avsluttetAt !== null,
          antallSignert: tellende.filter((s) => !s.bekreftetAvUserId).length,
          antallBekreftet: tellende.filter((s) => s.bekreftetAvUserId).length,
          antallSignertFørEndring: tellende.filter((s) => s.signertVersjon < d.innholdsVersjon).length,
          antallDeltakere: siste.antallDeltakere,
        }
      : null;
    const grupperForDok: UtfyltGruppe[] = (loggPrDok.get(d.id) ?? []).map((g) => ({ userId: g.userId, sist: g.sist }));
    return {
      ...d,
      statushendelser: reduserStatushendelser((transferPrDok.get(d.id) ?? []) as StatusTransferRad[], d.terminal),
      utfylling: reduserUtfylling(grupperForDok, navn, d.template?.enableChangeLog ?? false),
      signatur: beregnDokumentSignatur((d.template?.objects ?? []) as SynlighetsObjekt[], d.data, sammendrag, aktivePrDok.get(d.id) ?? 0),
    };
  });
}

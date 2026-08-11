import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@sitedoc/db";
import {
  aggregerLagring,
  dbVolumEstimatBytes,
  manglerStorrelsePerModell,
  type LagringRad,
  type ProsjektAggregat,
} from "@sitedoc/shared";
import { router, protectedProcedure } from "../trpc/trpc";
import { autoriserAdminForFirma } from "../trpc/tilgangskontroll";

/**
 * Lagringsstatistikk (2026-08-11). Aggregering ved forespørsel — SUM(file_size)
 * per prosjekt/modell over de fem fil-modellene. Ingen akkumulert teller (fabel:
 * på ~54 rader er ytelse ikke i spill). Cache 1 time (faktureringsbruken er
 * månedlig avlesning). Ren summeringslogikk i @sitedoc/shared (aggregerLagring).
 *
 * 🔴 ISOLASJONSAKSE = `primaryOrganizationId` (EIERSKAP), IKKE `projectOrganization`
 * (medlemskap). Fakturering følger eierskap: et firma betaler for prosjekter det
 * EIER, ikke prosjekter det bare deltar i via kryssorg-deling. Å bruke
 * projectOrganization ville sendt feil faktura til en deltaker. Dette divergerer
 * BEVISST fra admin.ts trial-deaktivering + sjekklistegrensen (som bruker
 * projectOrganization for PRØVE-deteksjon — et annet spørsmål enn eierskap). Fjerde
 * gang `primaryOrganizationId`-vs-`projectOrganization`-asymmetrien dukker opp; ikke
 * «rett» den tilbake uten å lese denne begrunnelsen. I prod faller de sammen.
 *
 * Foreldreløse bilder (`Image` uten checklist/task — begge FK ON DELETE SET NULL,
 * 24 % av bildene i prod 2026-08-11) er reell diskbruk men kan IKKE attribueres til
 * prosjekt/firma → aldri fakturerbare, men med i «faktisk diskbruk». Derfor:
 * fakturerbart volum ≠ faktisk diskbruk, bevisst og merket i UI.
 */

export interface Snapshot {
  rader: LagringRad[];
  prosjekter: Map<
    string,
    { navn: string; nummer: string | null; primaryOrganizationId: string | null }
  >;
  firmaer: Map<string, string>;
  generertVed: string;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 time
let cache: { snapshot: Snapshot; tid: number } | null = null;

async function byggSnapshot(prisma: PrismaClient): Promise<Snapshot> {
  const [images, drawings, drawingRevisions, pointClouds, ftdDocuments, prosjekterRaw, firmaerRaw] =
    await Promise.all([
      prisma.image.findMany({
        select: {
          fileSize: true,
          checklist: { select: { bestillerFaggruppe: { select: { projectId: true } } } },
          task: { select: { template: { select: { projectId: true } } } },
        },
      }),
      prisma.drawing.findMany({ select: { projectId: true, fileSize: true } }),
      prisma.drawingRevision.findMany({
        select: { fileSize: true, drawing: { select: { projectId: true } } },
      }),
      prisma.pointCloud.findMany({ select: { projectId: true, fileSize: true } }),
      prisma.ftdDocument.findMany({ select: { projectId: true, fileSize: true } }),
      prisma.project.findMany({
        select: { id: true, name: true, projectNumber: true, primaryOrganizationId: true },
      }),
      prisma.organization.findMany({ select: { id: true, name: true } }),
    ]);

  const rader: LagringRad[] = [];
  for (const i of images) {
    // Image har ingen projectId — kobles via checklist ELLER task. Er begge null
    // (foreldreløst, se blokk-kommentar) → projectId=null → foreldreløs-bøtta.
    const pid =
      i.checklist?.bestillerFaggruppe?.projectId ??
      i.task?.template?.projectId ??
      null;
    // Image.fileSize er NOT NULL → alltid målt.
    rader.push({ modell: "images", projectId: pid, bytes: i.fileSize ?? 0, maaltStorrelse: true });
  }
  for (const d of drawings) {
    rader.push({
      modell: "drawings",
      projectId: d.projectId,
      bytes: d.fileSize ?? 0,
      maaltStorrelse: d.fileSize !== null, // DWG-layouts kan være NULL (ukjent, ikke 0)
    });
  }
  for (const dr of drawingRevisions) {
    rader.push({
      modell: "drawing_revisions",
      projectId: dr.drawing?.projectId ?? null,
      bytes: dr.fileSize ?? 0,
      maaltStorrelse: dr.fileSize !== null,
    });
  }
  for (const pc of pointClouds) {
    rader.push({
      modell: "point_clouds",
      projectId: pc.projectId,
      bytes: pc.fileSize ?? 0,
      maaltStorrelse: pc.fileSize !== null,
    });
  }
  for (const f of ftdDocuments) {
    rader.push({
      modell: "ftd_documents",
      projectId: f.projectId,
      bytes: f.fileSize ?? 0,
      maaltStorrelse: f.fileSize !== null,
    });
  }

  const prosjekter = new Map(
    prosjekterRaw.map((p) => [
      p.id,
      { navn: p.name, nummer: p.projectNumber, primaryOrganizationId: p.primaryOrganizationId },
    ]),
  );
  const firmaer = new Map(firmaerRaw.map((o) => [o.id, o.name]));
  return { rader, prosjekter, firmaer, generertVed: new Date().toISOString() };
}

async function hentSnapshot(prisma: PrismaClient): Promise<Snapshot> {
  const naa = Date.now();
  if (cache && naa - cache.tid < CACHE_TTL_MS) return cache.snapshot;
  const snapshot = await byggSnapshot(prisma);
  cache = { snapshot, tid: naa };
  return snapshot;
}

function prosjektUt(agg: ProsjektAggregat, snap: Snapshot) {
  const meta = agg.projectId ? snap.prosjekter.get(agg.projectId) : undefined;
  return {
    projectId: agg.projectId,
    prosjektNavn: meta?.navn ?? null,
    prosjektNummer: meta?.nummer ?? null,
    perModell: agg.perModell,
    totalBytes: agg.totalBytes,
    totalAntall: agg.totalAntall,
  };
}

export const lagringRouter = router({
  // sitedoc-admin: per firma × prosjekt × modell + standalone («uten firma») +
  // foreldreløse. To totaler: fakturerbart (kun firma-eide prosjekter) vs faktisk
  // diskbruk (alt, inkl. standalone + foreldreløse).
  oversikt: protectedProcedure.query(async ({ ctx }) => {
    const bruker = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { role: true },
    });
    if (bruker.role !== "sitedoc_admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Krever SiteDoc-administrator" });
    }
    const snap = await hentSnapshot(ctx.prisma);
    const aggregater = aggregerLagring(snap.rader);

    // Bøtt aggregatene: per firma (eier), standalone (eier=null), foreldreløs (prosjekt=null).
    const perFirma = new Map<
      string,
      { firmaNavn: string; prosjekter: ReturnType<typeof prosjektUt>[]; totalBytes: number; totalAntall: number }
    >();
    const utenFirmaProsjekter: ReturnType<typeof prosjektUt>[] = [];
    let utenFirmaBytes = 0;
    let utenFirmaAntall = 0;
    let foreldreloseBytes = 0;
    let foreldreloseAntall = 0;

    for (const agg of aggregater) {
      if (agg.projectId === null) {
        foreldreloseBytes += agg.totalBytes;
        foreldreloseAntall += agg.totalAntall;
        continue;
      }
      const meta = snap.prosjekter.get(agg.projectId);
      const orgId = meta?.primaryOrganizationId ?? null;
      if (!orgId) {
        utenFirmaProsjekter.push(prosjektUt(agg, snap));
        utenFirmaBytes += agg.totalBytes;
        utenFirmaAntall += agg.totalAntall;
        continue;
      }
      let firma = perFirma.get(orgId);
      if (!firma) {
        firma = {
          firmaNavn: snap.firmaer.get(orgId) ?? orgId,
          prosjekter: [],
          totalBytes: 0,
          totalAntall: 0,
        };
        perFirma.set(orgId, firma);
      }
      firma.prosjekter.push(prosjektUt(agg, snap));
      firma.totalBytes += agg.totalBytes;
      firma.totalAntall += agg.totalAntall;
    }

    const fakturerbartBytes = [...perFirma.values()].reduce((s, f) => s + f.totalBytes, 0);
    const faktiskDiskbrukBytes = fakturerbartBytes + utenFirmaBytes + foreldreloseBytes;

    return {
      generertVed: snap.generertVed,
      perFirma: [...perFirma.entries()].map(([organizationId, f]) => ({
        organizationId,
        ...f,
      })),
      utenFirma: {
        prosjekter: utenFirmaProsjekter,
        totalBytes: utenFirmaBytes,
        totalAntall: utenFirmaAntall,
      },
      // Reell diskbruk, aldri fakturerbar (kan ikke attribueres til firma).
      foreldrelose: { bytes: foreldreloseBytes, antall: foreldreloseAntall },
      // Bevisst forskjellige: fakturerbart ≠ faktisk diskbruk (foreldreløse + standalone).
      fakturerbartBytes,
      faktiskDiskbrukBytes,
      dbVolumEstimatBytes: dbVolumEstimatBytes(snap.rader),
      // Dekningsgrad: antall filer med UMÅLT størrelse (file_size NULL) per modell.
      // Vises som restpost når > 0 — fakturering mot volumet krever 100 % dekning.
      manglerStorrelse: manglerStorrelsePerModell(snap.rader),
    };
  }),

  // firma-admin: eget firma (primaryOrganizationId), per prosjekt + total antall
  // filer. Foreldreløse/standalone vises IKKE — de tilhører ikke firmaet.
  firmaOversikt: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);
      const snap = await hentSnapshot(ctx.prisma);

      // Prosjekt- id-er firmaet EIER (primaryOrganizationId).
      const egneProsjekt = new Set(
        [...snap.prosjekter.entries()]
          .filter(([, m]) => m.primaryOrganizationId === input.organizationId)
          .map(([id]) => id),
      );
      const egneRader = snap.rader.filter(
        (r) => r.projectId !== null && egneProsjekt.has(r.projectId),
      );
      const aggregater = aggregerLagring(egneRader);

      let totalBytes = 0;
      let totalAntall = 0;
      const prosjekter = aggregater.map((agg) => {
        totalBytes += agg.totalBytes;
        totalAntall += agg.totalAntall;
        return prosjektUt(agg, snap);
      });

      // Total umålte filer i firmaets prosjekter — så kunden ser om volumet er
      // ufullstendig (fakturering mot tallet krever 100 % dekning i firmaet).
      const manglerPerModell = manglerStorrelsePerModell(egneRader);
      const manglerStorrelseAntall = Object.values(manglerPerModell).reduce(
        (s, n) => s + n,
        0,
      );

      return {
        generertVed: snap.generertVed,
        prosjekter,
        totalBytes,
        totalAntall,
        dbVolumEstimatBytes: dbVolumEstimatBytes(egneRader),
        manglerStorrelseAntall,
      };
    }),
});

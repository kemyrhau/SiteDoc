import { z } from "zod";
import { Prisma, prisma } from "@sitedoc/db";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { router, protectedProcedure } from "../trpc/trpc";
import { settMappeTilgangSchema } from "@sitedoc/shared/validation";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import { splittMalebrevPdf } from "../services/pdf-splitting";
import { resolverSpråk, resolverAlleSpråk, finnArvendeUndermapper } from "../services/folder-spraak";
import { prosesserDokument } from "../services/ftd-prosessering";
import { embeddDokumentChunks } from "../services/embedding-service";
import { STOETTEDE_SPRAAK } from "@sitedoc/shared";

const GYLDIGE_SPRAAK = new Set<string>(STOETTEDE_SPRAAK.map((s) => s.kode));

const UPLOADS_DIR = join(process.cwd(), "uploads");

// Fire-and-forget dokumentprosessering, in-process. Tidligere via HTTP-selvkall
// til /prosesser/:documentId — et uautentisert offentlig endepunkt (funnet
// 2026-09-06). Se mengde.ts for full begrunnelse. Autorisasjon gjort i kalleren.
function triggerProsessering(
  documentId: string,
  opts: { bevarVedFeil?: boolean } = {},
) {
  prosesserDokument(prisma, documentId, opts).catch(
    (err) => console.error(`Kunne ikke trigge prosessering for ${documentId}:`, err),
  );
}

// Maks antall dokumenter som prosesseres samtidig ved bulk-reekstraksjon.
// Prosesseringen kjører in-process i api — fyrer vi alle samtidig (f.eks. et
// prosjekt med hundrevis av PDF-er), spiker vi CPU/minne og tar ned serveren
// (RETUR 2026-10-14). Dokumentene settes `pending` opp front (synlig i fillista)
// og plukkes to av gangen.
const REEKSTRAKSJON_SAMTIDIG = 2;

/**
 * Kjør `jobb` for hver id med maks `grense` samtidige — enkel worker-pool uten
 * ny pakke. Fire-and-forget: kalles uten `await` fra mutasjonene så de svarer
 * med en gang, mens køen tømmes i bakgrunnen. Feil pr. dokument svelges (logges)
 * så én feil ikke stopper resten; status pr. dokument føres av `prosesserDokument`.
 */
function kjørMedGrense(
  ider: string[],
  grense: number,
  jobb: (id: string) => Promise<unknown>,
): void {
  let neste = 0;
  const arbeider = async (): Promise<void> => {
    while (neste < ider.length) {
      const id = ider[neste++]!;
      await jobb(id).catch((err) =>
        console.error(`Bulk-reekstraksjon feilet for ${id}:`, err),
      );
    }
  };
  const antall = Math.min(grense, ider.length);
  for (let i = 0; i < antall; i++) void arbeider();
}

/**
 * Tvungen reekstraksjon av et dokumentsett (mappe eller helt prosjekt): kjører
 * full tekstuttrekk + chunking + embedding på nytt fra lagret fil, uansett om
 * dokumentet allerede er `completed`. Brukes for å rette eksisterende PDF-er
 * som står på feil sidetall («side 1» overalt) uten ny opplasting. Gamle chunks
 * bevares atomisk ved feil (`prosesserDokument({ bevarVedFeil: true })`).
 * Hopper over kjørende (pending/processing) og ikke-støttede formater.
 * Kalleren MÅ ha verifisert tilgang til prosjektet.
 */
async function tvingReekstraksjonAv(
  where: Prisma.FtdDocumentWhereInput,
): Promise<{ ok: true; tvunget: number }> {
  const dokumenter = await prisma.ftdDocument.findMany({
    where: {
      ...where,
      isActive: true,
      processingState: { notIn: ["pending", "processing", "unsupported"] },
    },
    select: { id: true },
  });
  if (dokumenter.length === 0) return { ok: true, tvunget: 0 };

  const ider = dokumenter.map((d) => d.id);
  await prisma.ftdDocument.updateMany({
    where: { id: { in: ider } },
    data: { processingState: "pending", processingError: null },
  });
  // Maks REEKSTRAKSJON_SAMTIDIG om gangen — ikke alle i web-prosessen samtidig.
  kjørMedGrense(ider, REEKSTRAKSJON_SAMTIDIG, (id) =>
    prosesserDokument(prisma, id, { bevarVedFeil: true }),
  );
  return { ok: true, tvunget: ider.length };
}

/**
 * Reparer et dokumentsett (mappe eller helt prosjekt): full re-ekstraksjon kun
 * der søkbart innhold mangler (0 chunks / `failed`); ellers kun re-embedding av
 * chunks som ikke er ferdig embeddet. Kjørende/ikke-støttede hoppes over.
 * Kalleren MÅ ha verifisert tilgang til prosjektet.
 */
async function reparerDokumentSett(
  where: Prisma.FtdDocumentWhereInput,
): Promise<{ ok: true; full: number; embedding: number }> {
  const dokumenter = await prisma.ftdDocument.findMany({
    where: {
      ...where,
      isActive: true,
      processingState: { notIn: ["pending", "processing", "unsupported"] },
    },
    select: { id: true, processingState: true },
  });
  if (dokumenter.length === 0) return { ok: true, full: 0, embedding: 0 };

  const ider = dokumenter.map((d) => d.id);
  const stats = await prisma.$queryRaw<
    Array<{ documentId: string; totalt: bigint; udone: bigint }>
  >`
    SELECT document_id AS "documentId",
           COUNT(*) AS totalt,
           COUNT(*) FILTER (WHERE embedding_state <> 'done') AS udone
    FROM ftd_document_chunks
    WHERE document_id IN (${Prisma.join(ider)})
    GROUP BY document_id
  `;
  const statMap = new Map(
    stats.map((s) => [s.documentId, { totalt: Number(s.totalt), udone: Number(s.udone) }]),
  );

  const fullIder: string[] = [];
  const embeddingIder: string[] = [];
  for (const d of dokumenter) {
    const st = statMap.get(d.id);
    const totalt = st?.totalt ?? 0;
    const udone = st?.udone ?? 0;
    if (totalt === 0 || d.processingState === "failed") {
      fullIder.push(d.id); // mangler søkbart innhold → full re-ekstraksjon
    } else if (udone > 0) {
      embeddingIder.push(d.id); // kun re-embedding
    }
  }

  if (fullIder.length > 0) {
    await prisma.ftdDocument.updateMany({
      where: { id: { in: fullIder } },
      data: { processingState: "pending", processingError: null },
    });
    // Maks REEKSTRAKSJON_SAMTIDIG om gangen — ikke alle i web-prosessen samtidig.
    kjørMedGrense(fullIder, REEKSTRAKSJON_SAMTIDIG, (id) =>
      prosesserDokument(prisma, id),
    );
  }
  if (embeddingIder.length > 0) {
    kjørMedGrense(embeddingIder, REEKSTRAKSJON_SAMTIDIG, (id) =>
      embeddDokumentChunks(prisma, id),
    );
  }
  return { ok: true, full: fullIder.length, embedding: embeddingIder.length };
}

export const mappeRouter = router({
  // Hent alle mapper for et prosjekt (flat liste med parentId + tilgangsoppføringer)
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const mapper = await ctx.prisma.folder.findMany({
        where: { projectId: input.projectId },
        include: {
          kontrakt: { select: { id: true, navn: true } },
          accessEntries: {
            include: {
              faggruppe: { select: { id: true, name: true, color: true } },
              group: { select: { id: true, name: true } },
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
        orderBy: { name: "asc" },
      });
      // Tell kun aktive dokumenter per mappe
      const tellinger = await ctx.prisma.$queryRaw<Array<{ folder_id: string; antall: bigint }>>`
        SELECT folder_id, count(*) as antall FROM ftd_documents
        WHERE project_id = ${input.projectId} AND is_active = true AND folder_id IS NOT NULL
        GROUP BY folder_id
      `;
      const tellMap = new Map(tellinger.map((t) => [t.folder_id, Number(t.antall)]));

      // Beregn effektive målspråk for alle mapper (arv)
      const språkMap = resolverAlleSpråk(mapper.map((m) => ({
        id: m.id,
        parentId: m.parentId,
        languageMode: m.languageMode,
        languages: m.languages as string[],
      })));

      // Hent kildespråk fra prosjektet
      const prosjekt = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { sourceLanguage: true },
      });

      return mapper.map((m) => {
        const effektiv = språkMap.get(m.id);
        return {
          ...m,
          _count: { ftdDocuments: tellMap.get(m.id) ?? 0 },
          effektiveSpraak: effektiv?.languages ?? ["nb"],
          kildesprak: prosjekt?.sourceLanguage ?? "nb",
          spraakArvet: effektiv?.arvet ?? true,
        };
      });
    }),

  // Opprett ny mappe
  opprett: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        name: z.string().min(1).max(255),
        parentId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.folder.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          parentId: input.parentId ?? null,
        },
      });
    }),

  // Oppdater mappe (gi nytt navn)
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);
      return ctx.prisma.folder.update({
        where: { id: input.id },
        data: { name: input.name },
      });
    }),

  // Hent dokumenter med oversettelsesinfo for dokumentleser
  hentDokumenterMedSpraak: protectedProcedure
    .input(z.object({ folderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);

      // Resolve effektive målspråk via arv
      const alleMapper = await ctx.prisma.folder.findMany({
        where: { projectId: mappe.projectId },
        select: { id: true, parentId: true, languageMode: true, languages: true },
      });
      const effektiv = resolverSpråk(input.folderId, alleMapper.map((m) => ({
        id: m.id, parentId: m.parentId, languageMode: m.languageMode,
        languages: m.languages as string[],
      })));

      const dokumenter = await ctx.prisma.ftdDocument.findMany({
        where: { folderId: input.folderId, isActive: true },
        select: { id: true, filename: true, uploadedAt: true },
        orderBy: { uploadedAt: "desc" },
      });

      // Hent tilgjengelige språk og første overskrift per dokument
      const result = await Promise.all(
        dokumenter.map(async (dok) => {
          const språkRader = await ctx.prisma.ftdDocumentBlock.findMany({
            where: { documentId: dok.id },
            select: { language: true },
            distinct: ["language"],
          });

          // Hent første heading per språk for tittel
          const titler: Record<string, string> = {};
          for (const { language } of språkRader) {
            const heading = await ctx.prisma.ftdDocumentBlock.findFirst({
              where: { documentId: dok.id, language, blockType: "heading" },
              orderBy: { sortOrder: "asc" },
              select: { content: true },
            });
            if (heading) titler[language] = heading.content;
          }

          return {
            id: dok.id,
            filename: dok.filename,
            uploadedAt: dok.uploadedAt,
            tilgjengeligeSprak: språkRader.map((r) => r.language),
            titler,
          };
        }),
      );

      return { dokumenter: result, mappeSprak: effektiv.languages };
    }),

  // Hent dokumentblokker for lesevisning
  hentDokumentBlokker: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        language: z.string().min(2).max(5).default("nb"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const dok = await ctx.prisma.ftdDocument.findUniqueOrThrow({
        where: { id: input.documentId },
        select: { projectId: true, filename: true, fileUrl: true, sourceLanguage: true },
      });
      await verifiserProsjektmedlem(ctx.userId, dok.projectId);

      const blokker = await ctx.prisma.ftdDocumentBlock.findMany({
        where: { documentId: input.documentId, language: input.language },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          sortOrder: true,
          pageNumber: true,
          blockType: true,
          content: true,
          headingLevel: true,
          imageUrl: true,
        },
      });

      // Finn tilgjengelige språk for dette dokumentet
      const språkRader = await ctx.prisma.ftdDocumentBlock.findMany({
        where: { documentId: input.documentId },
        select: { language: true },
        distinct: ["language"],
      });

      // Oversettelsesjobber per målspråk (for 2c-språkpiller: «…»-fremdrift
      // på språk som er under oversettelse men ennå ikke har blokker).
      const jobbRader = await ctx.prisma.ftdTranslationJob.findMany({
        where: { documentId: input.documentId },
        select: { targetLang: true, status: true, blocksDone: true, blocksTotal: true },
      });

      return {
        blokker,
        tilgjengeligeSprak: språkRader.map((r) => r.language),
        filename: dok.filename,
        fileUrl: dok.fileUrl,
        sourceLanguage: dok.sourceLanguage,
        projectId: dok.projectId,
        jobber: jobbRader,
      };
    }),

  // Oppdater dokumentspråk for mappen
  // Estimer oversettelseskostnad for en mappe
  estimerOversettelse: protectedProcedure
    .input(z.object({ folderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);

      // Tell ord i alle aktive dokumenter i mappen
      const stats = await ctx.prisma.$queryRaw<Array<{ antall_dok: bigint; totalt_ord: bigint }>>`
        SELECT
          COUNT(DISTINCT d.id) as antall_dok,
          COALESCE(SUM(d.word_count), 0) as totalt_ord
        FROM ftd_documents d
        WHERE d.folder_id = ${input.folderId} AND d.is_active = true
      `;
      const antallDok = Number(stats[0]?.antall_dok ?? 0);
      let totaltOrd = Number(stats[0]?.totalt_ord ?? 0);

      // Hvis word_count er 0, estimer fra blokker
      if (totaltOrd === 0 && antallDok > 0) {
        const blokkStats = await ctx.prisma.$queryRaw<Array<{ totalt_tegn: bigint }>>`
          SELECT COALESCE(SUM(LENGTH(content)), 0) as totalt_tegn
          FROM ftd_document_blocks b
          JOIN ftd_documents d ON d.id = b.document_id
          WHERE d.folder_id = ${input.folderId} AND d.is_active = true
            AND b.language = d.source_language
            AND b.block_type IN ('heading', 'text', 'caption')
        `;
        const tegn = Number(blokkStats[0]?.totalt_tegn ?? 0);
        totaltOrd = Math.round(tegn / 5); // Gjennomsnitt 5 tegn per ord
      }

      const totaltTegn = totaltOrd * 5; // Estimat tilbake til tegn

      return {
        antallDokumenter: antallDok,
        totaltOrd,
        totaltTegn,
        // Prisestimater per motor per ekstra språk
        perSpraak: {
          "opus-mt": { pris: 0, valuta: "NOK", label: "Gratis" },
          "google": { pris: 0, valuta: "NOK", label: "Gratis" },
          "deepl": {
            // DeepL Free: 500k tegn/mnd gratis, deretter €25/mln tegn
            pris: totaltTegn > 500000 ? Math.round((totaltTegn - 500000) * 0.00025) : 0,
            valuta: "NOK",
            label: totaltTegn > 500000 ? `~${Math.round((totaltTegn - 500000) * 0.00025)} NOK` : "Gratis (under 500k tegn)",
          },
        },
      };
    }),

  oppdaterSpraak: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        languages: z.array(z.string().min(2).max(5)).min(1),
        languageMode: z.enum(["inherit", "custom"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Valider at alle språkkoder er støttet
      const ugyldigSpraak = input.languages.find((l) => !GYLDIGE_SPRAAK.has(l));
      if (ugyldigSpraak) throw new Error(`Ustøttet språk: ${ugyldigSpraak}`);

      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);
      // Hent prosjektets kildespråk og sørg for at det er inkludert
      const prosjekt = await ctx.prisma.project.findUniqueOrThrow({
        where: { id: mappe.projectId },
        select: { sourceLanguage: true },
      });
      const srcLang = prosjekt.sourceLanguage ?? "nb";
      const languages = Array.from(new Set([srcLang, ...input.languages]));

      // Hent gamle språk for opprydding
      const gammelMappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.id },
        select: { languages: true },
      });
      const gamleSpråk = new Set(gammelMappe.languages as string[]);
      const fjernedeSpråk = [...gamleSpråk].filter((l) => !languages.includes(l));

      const result = await ctx.prisma.folder.update({
        where: { id: input.id },
        data: {
          languages,
          languageMode: input.languageMode ?? "custom",
        },
      });

      // Rydd opp fjernede språk: slett oversettelsesblokker og avbryt jobber
      if (fjernedeSpråk.length > 0) {
        const dokIder = await ctx.prisma.ftdDocument.findMany({
          where: { folderId: input.id, isActive: true },
          select: { id: true },
        });
        const docIds = dokIder.map((d) => d.id);
        if (docIds.length > 0) {
          await ctx.prisma.ftdDocumentBlock.deleteMany({
            where: { documentId: { in: docIds }, language: { in: fjernedeSpråk } },
          });
          await ctx.prisma.ftdTranslationJob.deleteMany({
            where: { documentId: { in: docIds }, targetLang: { in: fjernedeSpråk } },
          });
        }
      }

      return result;
    }),

  // Sett språkmodus til "inherit" (arv fra forelder)
  settSpraakArv: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);
      return ctx.prisma.folder.update({
        where: { id: input.id },
        data: { languageMode: "inherit" },
      });
    }),

  // Omfang for oversettelses-panelet (2b): dokumenter i mappen + arvende
  // undermapper, og hvor mange som mangler minst ett målspråk («gjenstående»).
  oversettelseOmfang: protectedProcedure
    .input(z.object({ folderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);

      const alleMapper = (
        await ctx.prisma.folder.findMany({
          where: { projectId: mappe.projectId },
          select: { id: true, parentId: true, languageMode: true, languages: true },
        })
      ).map((m) => ({
        id: m.id,
        parentId: m.parentId,
        languageMode: m.languageMode,
        languages: m.languages as string[],
      }));

      const effektiv = resolverSpråk(input.folderId, alleMapper);
      const malSprak = effektiv.languages;
      const undermappeIder = finnArvendeUndermapper(input.folderId, alleMapper);

      const iMappe = await ctx.prisma.ftdDocument.count({
        where: { folderId: input.folderId, isActive: true },
      });
      const iUndermapper =
        undermappeIder.length > 0
          ? await ctx.prisma.ftdDocument.count({
              where: { folderId: { in: undermappeIder }, isActive: true },
            })
          : 0;

      // Tell «gjenstående»: dokumenter (i omfanget) som mangler minst ett målspråk.
      let gjenstaaende = 0;
      const alleFolderIder = [input.folderId, ...undermappeIder];
      const docs = await ctx.prisma.ftdDocument.findMany({
        where: { folderId: { in: alleFolderIder }, isActive: true },
        select: { id: true, sourceLanguage: true },
      });
      if (docs.length > 0 && malSprak.length > 1) {
        const docIds = docs.map((d) => d.id);
        const blokkSprak = await ctx.prisma.$queryRaw<
          Array<{ document_id: string; language: string }>
        >`
          SELECT DISTINCT document_id, language FROM ftd_document_blocks
          WHERE document_id IN (${Prisma.join(docIds)})
        `;
        const språkPerDok = new Map<string, Set<string>>();
        for (const r of blokkSprak) {
          if (!språkPerDok.has(r.document_id)) språkPerDok.set(r.document_id, new Set());
          språkPerDok.get(r.document_id)!.add(r.language);
        }
        for (const d of docs) {
          const har = språkPerDok.get(d.id) ?? new Set<string>();
          // Kun OVERSETTBARE dokumenter teller: må ha kildespråk-blokker (parset).
          // Uparsede filer (.xls/.pdf uten blokker) kan ikke oversettes — batchen
          // (oversettGjenstaaende) hopper over dem (antallBlokker===0), så de skal
          // heller ikke telles her. Ellers står N fast og «Oversett N» gjør ingenting.
          if (!har.has(d.sourceLanguage)) continue;
          const mangler = malSprak.some((l) => l !== d.sourceLanguage && !har.has(l));
          if (mangler) gjenstaaende++;
        }
      }

      return { iMappe, iUndermapper, gjenstaaende, malSprak, kildesprak: effektiv };
    }),

  // Batch-oversett gjenstående dokumenter i mappen + arvende undermapper (2b).
  // Try/catch per dokument — én feil stopper ikke batchen.
  oversettGjenstaaende: protectedProcedure
    .input(z.object({ folderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);

      const modul = await ctx.prisma.projectModule.findUnique({
        where: {
          projectId_moduleSlug: { projectId: mappe.projectId, moduleSlug: "oversettelse" },
        },
      });
      if (modul?.status !== "aktiv") {
        return { opprettet: 0, feilet: 0, modulInaktiv: true };
      }

      const alleMapper = (
        await ctx.prisma.folder.findMany({
          where: { projectId: mappe.projectId },
          select: { id: true, parentId: true, languageMode: true, languages: true },
        })
      ).map((m) => ({
        id: m.id,
        parentId: m.parentId,
        languageMode: m.languageMode,
        languages: m.languages as string[],
      }));

      const malSprak = resolverSpråk(input.folderId, alleMapper).languages;
      const undermappeIder = finnArvendeUndermapper(input.folderId, alleMapper);
      const alleFolderIder = [input.folderId, ...undermappeIder];

      const docs = await ctx.prisma.ftdDocument.findMany({
        where: { folderId: { in: alleFolderIder }, isActive: true },
        select: { id: true, sourceLanguage: true },
      });

      let opprettet = 0;
      let feilet = 0;
      for (const d of docs) {
        try {
          const manglendeSpråk = malSprak.filter((l) => l !== d.sourceLanguage);
          if (manglendeSpråk.length === 0) continue;
          const antallBlokker = await ctx.prisma.ftdDocumentBlock.count({
            where: { documentId: d.id, language: d.sourceLanguage },
          });
          if (antallBlokker === 0) continue;
          for (const lang of manglendeSpråk) {
            // Hopp over språk som allerede er oversatt (blokker finnes).
            const finnes = await ctx.prisma.ftdDocumentBlock.count({
              where: { documentId: d.id, language: lang },
            });
            if (finnes > 0) continue;
            await ctx.prisma.ftdTranslationJob.upsert({
              where: { documentId_targetLang: { documentId: d.id, targetLang: lang } },
              create: {
                id: `${d.id}-${lang}`,
                documentId: d.id,
                targetLang: lang,
                blocksTotal: antallBlokker,
                status: "pending",
              },
              update: { status: "pending", blocksTotal: antallBlokker, blocksDone: 0, error: null },
            });
            opprettet++;
          }
        } catch {
          feilet++;
        }
      }

      return { opprettet, feilet, modulInaktiv: false };
    }),

  // Oversett ett dokument til ett målspråk (2c «+ Oversett»-pille).
  // Upserter en pending-jobb — worker plukker opp og bruker prosjektets
  // gjeldende motor fra config.motor (rører ALDRI config her, i motsetning til
  // reOversettDokument som eksplisitt setter motoren fra brukerens motorvalg).
  oversettDokument: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        targetLang: z.string().min(2).max(5),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const dok = await ctx.prisma.ftdDocument.findUniqueOrThrow({
        where: { id: input.documentId },
        select: { projectId: true, sourceLanguage: true, isActive: true },
      });
      await verifiserProsjektmedlem(ctx.userId, dok.projectId);

      // Deaktiverte dokumenter oversettes ikke (speiler isActive-filteret i
      // oversettGjenstaaende og resten av mappe.ts).
      if (!dok.isActive) {
        return { status: "inaktiv" as const, blokker: 0 };
      }

      if (input.targetLang === dok.sourceLanguage) {
        return { status: "kilde" as const, blokker: 0 };
      }

      const modul = await ctx.prisma.projectModule.findUnique({
        where: {
          projectId_moduleSlug: { projectId: dok.projectId, moduleSlug: "oversettelse" },
        },
      });
      if (modul?.status !== "aktiv") {
        return { status: "modulInaktiv" as const, blokker: 0 };
      }

      // Krever at kildeblokker finnes (ellers er dokumentet ikke lesbart ennå).
      const antallBlokker = await ctx.prisma.ftdDocumentBlock.count({
        where: { documentId: input.documentId, language: dok.sourceLanguage },
      });
      if (antallBlokker === 0) {
        return { status: "ingenKilde" as const, blokker: 0 };
      }

      await ctx.prisma.ftdTranslationJob.upsert({
        where: {
          documentId_targetLang: { documentId: input.documentId, targetLang: input.targetLang },
        },
        create: {
          id: `${input.documentId}-${input.targetLang}`,
          documentId: input.documentId,
          targetLang: input.targetLang,
          blocksTotal: antallBlokker,
          status: "pending",
        },
        update: { status: "pending", blocksTotal: antallBlokker, blocksDone: 0, error: null },
      });

      return { status: "queued" as const, blokker: antallBlokker };
    }),

  // Slett mappe (kaskaderer til undermapper)
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);
      return ctx.prisma.folder.delete({ where: { id: input.id } });
    }),

  // Hent dokumenter for en mappe (bruker FtdDocument)
  hentDokumenter: protectedProcedure
    .input(z.object({ folderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);

      // Resolve effektive målspråk via arv
      const alleMapper = await ctx.prisma.folder.findMany({
        where: { projectId: mappe.projectId },
        select: { id: true, parentId: true, languageMode: true, languages: true },
      });
      const effektiv = resolverSpråk(input.folderId, alleMapper.map((m) => ({
        id: m.id, parentId: m.parentId, languageMode: m.languageMode,
        languages: m.languages as string[],
      })));

      const docs = await ctx.prisma.ftdDocument.findMany({
        where: { folderId: input.folderId, isActive: true },
        orderBy: { uploadedAt: "desc" },
      });

      // Hent embedding-status per dokument
      if (docs.length === 0) return { dokumenter: [], mappeSprak: effektiv.languages };
      const docIds = docs.map((d) => d.id);
      const embeddingStats = await ctx.prisma.$queryRaw<
        Array<{ documentId: string; totalt: bigint; embedded: bigint; feilet: bigint }>
      >`
        SELECT
          document_id AS "documentId",
          COUNT(*) AS totalt,
          COUNT(*) FILTER (WHERE embedding_state = 'done') AS embedded,
          COUNT(*) FILTER (WHERE embedding_state = 'failed') AS feilet
        FROM ftd_document_chunks
        WHERE document_id IN (${Prisma.join(docIds)})
        GROUP BY document_id
      `;

      const statsMap = new Map(
        embeddingStats.map((s) => [
          s.documentId,
          { totalt: Number(s.totalt), embedded: Number(s.embedded), feilet: Number(s.feilet) },
        ]),
      );

      // Hent oversettelsestatus per dokument (kun for mapper med flere språk)
      const mappeSprak = effektiv.languages;
      const harOversettelse = mappeSprak.length > 1;
      let oversettStatusMap = new Map<
        string,
        { tilgjengelig: string[]; pågår: boolean; jobber: Array<{ lang: string; status: string }> }
      >();

      if (harOversettelse) {
        // Tilgjengelige språk per dokument
        const blokkSprak = await ctx.prisma.$queryRaw<
          Array<{ document_id: string; language: string }>
        >`
          SELECT DISTINCT document_id, language FROM ftd_document_blocks
          WHERE document_id IN (${Prisma.join(docIds)})
        `;
        // Jobb-status per dokument+språk (alle statuser — chip-presisjon).
        const jobber = await ctx.prisma.ftdTranslationJob.findMany({
          where: { documentId: { in: docIds } },
          select: { documentId: true, targetLang: true, status: true },
        });

        const språkPerDok = new Map<string, Set<string>>();
        for (const r of blokkSprak) {
          if (!språkPerDok.has(r.document_id)) språkPerDok.set(r.document_id, new Set());
          språkPerDok.get(r.document_id)!.add(r.language);
        }
        const jobberPerDok = new Map<string, Array<{ lang: string; status: string }>>();
        for (const j of jobber) {
          if (!jobberPerDok.has(j.documentId)) jobberPerDok.set(j.documentId, []);
          jobberPerDok.get(j.documentId)!.push({ lang: j.targetLang, status: j.status });
        }

        oversettStatusMap = new Map(
          docIds.map((id) => [id, {
            tilgjengelig: [...(språkPerDok.get(id) ?? [])],
            pågår: (jobberPerDok.get(id) ?? []).some(
              (j) => j.status === "pending" || j.status === "processing",
            ),
            jobber: jobberPerDok.get(id) ?? [],
          }]),
        );
      }

      // Hent prosjektets kildespråk for avvik-sjekk
      const prosjekt = await ctx.prisma.project.findUnique({
        where: { id: mappe.projectId },
        select: { sourceLanguage: true },
      });

      return {
        dokumenter: docs.map((d) => ({
          ...d,
          chunksTotalt: statsMap.get(d.id)?.totalt ?? 0,
          chunksEmbedded: statsMap.get(d.id)?.embedded ?? 0,
          chunksEmbeddingFeilet: statsMap.get(d.id)?.feilet ?? 0,
          oversettelse: oversettStatusMap.get(d.id) ?? null,
        })),
        mappeSprak,
        prosjektKildesprak: prosjekt?.sourceLanguage ?? "nb",
      };
    }),

  // Hent tilgangskonfigurasjon for én mappe
  hentTilgang: protectedProcedure
    .input(z.object({ folderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const mappeForTilgang = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappeForTilgang.projectId);
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
        select: {
          id: true,
          accessMode: true,
          accessEntries: {
            include: {
              faggruppe: { select: { id: true, name: true, color: true } },
              group: { select: { id: true, name: true } },
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
      return mappe;
    }),

  // Sett tilgang for en mappe (erstatter alle oppføringer)
  settTilgang: protectedProcedure
    .input(settMappeTilgangSchema)
    .mutation(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);
      return ctx.prisma.$transaction(async (tx) => {
        await tx.folder.update({
          where: { id: input.folderId },
          data: { accessMode: input.accessMode },
        });

        await tx.folderAccess.deleteMany({
          where: { folderId: input.folderId },
        });

        if (input.accessMode === "custom" && input.entries.length > 0) {
          await tx.folderAccess.createMany({
            data: input.entries.map((entry) => ({
              folderId: input.folderId,
              accessType: entry.accessType,
              faggruppeId: entry.faggruppeId ?? null,
              groupId: entry.groupId ?? null,
              userId: entry.userId ?? null,
            })),
          });
        }

        return tx.folder.findUniqueOrThrow({
          where: { id: input.folderId },
          include: {
            accessEntries: {
              include: {
                faggruppe: { select: { id: true, name: true, color: true } },
                group: { select: { id: true, name: true } },
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        });
      });
    }),

  // Bekreft dokumentspråk ved avvik — oppdaterer sourceLanguage og trigger oversettelse
  bekreftDokumentSpraak: protectedProcedure
    .input(z.object({
      documentId: z.string(),
      bekreftSpraak: z.string().min(2).max(5),
      skipOversettelse: z.boolean().optional(), // Bekreft språk men ikke oversett
    }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.ftdDocument.findUniqueOrThrow({
        where: { id: input.documentId },
        select: { id: true, projectId: true, folderId: true, sourceLanguage: true, detectedLanguage: true },
      });
      await verifiserProsjektmedlem(ctx.userId, doc.projectId);

      const gammeltSpråk = doc.sourceLanguage;
      const nyttSpråk = input.bekreftSpraak;

      // Tell blokker FØR re-merking (blokker ligger i gammelt språk)
      const antallBlokker = await ctx.prisma.ftdDocumentBlock.count({
        where: { documentId: input.documentId, language: gammeltSpråk },
      });

      // Oppdater dokumentets kildespråk og merk som bekreftet
      await ctx.prisma.ftdDocument.update({
        where: { id: input.documentId },
        data: {
          sourceLanguage: nyttSpråk,
          languageConfirmed: true,
        },
      });

      // Hvis kildespråk endret seg, re-merk blokker
      if (gammeltSpråk !== nyttSpråk) {
        await ctx.prisma.ftdDocumentBlock.updateMany({
          where: { documentId: input.documentId, language: gammeltSpråk },
          data: { language: nyttSpråk },
        });
      }

      // Trigger oversettelsesoppdrag hvis mappen har flere språk (og bruker ikke hoppet over)
      if (doc.folderId && !input.skipOversettelse && antallBlokker > 0) {
        const alleMapper = await ctx.prisma.folder.findMany({
          where: { projectId: doc.projectId },
          select: { id: true, parentId: true, languageMode: true, languages: true },
        });
        const effektiv = resolverSpråk(doc.folderId, alleMapper.map((m) => ({
          id: m.id, parentId: m.parentId, languageMode: m.languageMode,
          languages: m.languages as string[],
        })));

        const ekstraSpråk = effektiv.languages.filter((l) => l !== nyttSpråk);
        if (ekstraSpråk.length > 0) {
          const modul = await ctx.prisma.projectModule.findUnique({
            where: { projectId_moduleSlug: { projectId: doc.projectId, moduleSlug: "oversettelse" } },
          });
          if (modul?.status === "aktiv") {
            for (const lang of ekstraSpråk) {
              await ctx.prisma.ftdTranslationJob.upsert({
                where: { documentId_targetLang: { documentId: input.documentId, targetLang: lang } },
                create: {
                  id: `${input.documentId}-${lang}`,
                  documentId: input.documentId,
                  targetLang: lang,
                  blocksTotal: antallBlokker,
                  status: "pending",
                },
                update: {
                  status: "pending",
                  blocksTotal: antallBlokker,
                  blocksDone: 0,
                  error: null,
                },
              });
            }
          }
        }
      }

      return { ok: true };
    }),

  // Slett dokument fra mappe (soft-delete + fjern chunks/spec-poster)
  slettDokument: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.ftdDocument.findUniqueOrThrow({
        where: { id: input.documentId },
      });
      await verifiserProsjektmedlem(ctx.userId, doc.projectId);
      await ctx.prisma.ftdDocumentChunk.deleteMany({ where: { documentId: input.documentId } });
      await ctx.prisma.ftdSpecPost.deleteMany({ where: { documentId: input.documentId } });
      await ctx.prisma.ftdDocumentBlock.deleteMany({ where: { documentId: input.documentId } });
      await ctx.prisma.ftdTranslationJob.deleteMany({ where: { documentId: input.documentId } });
      return ctx.prisma.ftdDocument.update({
        where: { id: input.documentId },
        data: { isActive: false },
      });
    }),

  // Last opp dokument til mappe — oppretter FtdDocument + trigger prosessering
  lastOppDokument: protectedProcedure
    .input(
      z.object({
        folderId: z.string().uuid(),
        name: z.string().min(1),
        fileUrl: z.string(),
        fileType: z.string(),
        fileSize: z.number().int().nonnegative(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);

      // Sjekk om dokument med samme filnavn finnes (soft-slettet)
      const eksisterende = await ctx.prisma.ftdDocument.findUnique({
        where: {
          projectId_filename: {
            projectId: mappe.projectId,
            filename: input.name,
          },
        },
      });

      let doc;
      if (eksisterende) {
        doc = await ctx.prisma.ftdDocument.update({
          where: { id: eksisterende.id },
          data: {
            isActive: true,
            folderId: input.folderId,
            fileUrl: input.fileUrl,
            filetype: input.fileType,
            fileSize: input.fileSize,
            processingState: "pending",
            processingError: null,
          },
        });
        await ctx.prisma.ftdDocumentChunk.deleteMany({ where: { documentId: doc.id } });
      } else {
        doc = await ctx.prisma.ftdDocument.create({
          data: {
            projectId: mappe.projectId,
            folderId: input.folderId,
            filename: input.name,
            fileUrl: input.fileUrl,
            filetype: input.fileType,
            fileSize: input.fileSize,
          },
        });
      }

      // Trigger prosessering på API-serveren (ren Node-kontekst)
      triggerProsessering(doc.id);

      return doc;
    }),

  // Reprosesser ett dokument. Mangler søkbart innhold (0 chunks / `failed`) → full
  // tekstuttrekk på nytt (idempotent; prosesserDokument sletter før ny kjøring).
  // Har chunks men embedding er ufullstendig/feilet → kun re-embedding (unngår dyr
  // re-ekstraksjon/OCR). Tilgang = prosjektmedlem, som opplasting.
  reprosesserDokument: protectedProcedure
    .input(
      z.object({
        // FtdDocument.id er cuid (schema.prisma), IKKE uuid — `.uuid()` avviste
        // ALLE ekte dokument-id-er, så «Prosesser på nytt» pr. dokument var
        // ødelagt (RETUR 2026-10-14). `min(1)` som de andre ftd-documentId-ene.
        documentId: z.string().min(1),
        // Tving full re-ekstraksjon selv om dokumentet er `completed` med chunks
        // (f.eks. retting av feil sidetall uten ny opplasting).
        tvingReekstraksjon: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.ftdDocument.findUniqueOrThrow({
        where: { id: input.documentId },
        select: { id: true, projectId: true, processingState: true },
      });
      await verifiserProsjektmedlem(ctx.userId, doc.projectId);

      // Tvungen reekstraksjon: full ny kjøring uansett tilstand. Gamle chunks
      // bevares atomisk ved feil (`bevarVedFeil`) → dokumentet ender aldri tomt.
      if (input.tvingReekstraksjon) {
        if (doc.processingState === "unsupported") {
          return { ok: true, modus: "hoppet" as const };
        }
        await ctx.prisma.ftdDocument.update({
          where: { id: doc.id },
          data: { processingState: "pending", processingError: null },
        });
        triggerProsessering(doc.id, { bevarVedFeil: true });
        return { ok: true, modus: "full-tving" as const };
      }

      const chunkCount = await ctx.prisma.ftdDocumentChunk.count({
        where: { documentId: doc.id },
      });

      if (chunkCount > 0 && doc.processingState === "completed") {
        // Ekstraksjon ok — bare embedding mangler/feilet. Re-embed pending/failed.
        embeddDokumentChunks(ctx.prisma, doc.id).catch((err) =>
          console.error(`Re-embedding feilet for ${doc.id}:`, err),
        );
        return { ok: true, modus: "embedding" as const };
      }

      await ctx.prisma.ftdDocument.update({
        where: { id: doc.id },
        data: { processingState: "pending", processingError: null },
      });
      triggerProsessering(doc.id);
      return { ok: true, modus: "full" as const };
    }),

  // Reprosesser alle dokumenter i en mappe. Standard: full re-ekstraksjon kun der
  // søkbart innhold mangler (0 chunks / `failed`), ellers kun re-embedding.
  // `tvingReekstraksjon`: full ny kjøring for ALLE dokumenter (gamle chunks bevares
  // ved feil) — for å rette feil sidetall uten ny opplasting. Kjørende/ikke-støttet
  // hoppes over. Tilgang = prosjektmedlem, som opplasting.
  reprosesserMappe: protectedProcedure
    .input(
      z.object({
        folderId: z.string().uuid(),
        tvingReekstraksjon: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);

      if (input.tvingReekstraksjon) {
        const res = await tvingReekstraksjonAv({ folderId: input.folderId });
        return { ok: true, full: res.tvunget, embedding: 0 };
      }
      return reparerDokumentSett({ folderId: input.folderId });
    }),

  // Reprosesser alle dokumenter i et helt prosjekt (på tvers av mapper). Samme
  // semantikk som reprosesserMappe, men prosjekt-scopet. `tvingReekstraksjon`
  // tvinger full ny kjøring av ALLE dokumenter (feil sidetall-retting i bulk).
  // Tilgang = prosjektmedlem, som opplasting/reprosessering.
  reprosesserProsjekt: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        tvingReekstraksjon: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      if (input.tvingReekstraksjon) {
        const res = await tvingReekstraksjonAv({ projectId: input.projectId });
        return { ok: true, full: res.tvunget, embedding: 0 };
      }
      return reparerDokumentSett({ projectId: input.projectId });
    }),

  /**
   * Samlet reprosesserings-status for et prosjekt — driver fremdriftsteksten ved
   * «Prosesser alle dokumenter på nytt» og deaktiverer knappen mens noe kjører
   * (overlever sideoppdatering, siden tilstanden utledes av DB-radene, ikke klient-state).
   * `pågår` = dokumenter i pending/processing. `feilet` = røde dokumenter som IKKE kjører
   * (failed, lagret feilårsak, eller minst én chunk med embedding `failed`). Disjunkte sett.
   */
  reprosesseringStatus: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const rows = await ctx.prisma.$queryRaw<
        Array<{ totalt: bigint; pagar: bigint; feilet: bigint; ustottet: bigint }>
      >`
        SELECT COUNT(*) AS totalt,
               COUNT(*) FILTER (WHERE d.processing_state IN ('pending', 'processing')) AS pagar,
               COUNT(*) FILTER (WHERE d.processing_state = 'unsupported') AS ustottet,
               COUNT(*) FILTER (
                 WHERE d.processing_state NOT IN ('pending', 'processing')
                   AND (
                     d.processing_state = 'failed'
                     OR d.processing_error IS NOT NULL
                     OR EXISTS (
                       SELECT 1 FROM ftd_document_chunks c
                       WHERE c.document_id = d.id AND c.embedding_state = 'failed'
                     )
                   )
               ) AS feilet
        FROM ftd_documents d
        WHERE d.project_id = ${input.projectId} AND d.is_active = true
      `;
      const r = rows[0];
      const totalt = Number(r?.totalt ?? 0);
      const pågår = Number(r?.pagar ?? 0);
      const feilet = Number(r?.feilet ?? 0);
      const ustøttet = Number(r?.ustottet ?? 0);
      return { totalt, pågår, feilet, ustøttet, ferdig: totalt - pågår };
    }),

  settKontrakt: protectedProcedure
    .input(
      z.object({
        folderId: z.string().uuid(),
        kontraktId: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);
      return ctx.prisma.folder.update({
        where: { id: input.folderId },
        data: { kontraktId: input.kontraktId },
      });
    }),

  /** Splitt alle PDFer i en mappe per NS-kode/postnr. Bruker OCR-data fra chunks. */
  splittDokumenter: protectedProcedure
    .input(z.object({ folderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
        select: { id: true, projectId: true, kontraktId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);

      // Finn alle PDFer i mappen
      const dokumenter = await ctx.prisma.ftdDocument.findMany({
        where: { folderId: input.folderId, isActive: true, filetype: "application/pdf" },
        include: { chunks: { select: { chunkText: true, pageNumber: true }, orderBy: { chunkIndex: "asc" } } },
      });

      let totaltFiler = 0;

      for (const dok of dokumenter) {
        if (!dok.fileUrl || dok.chunks.length === 0) continue;

        // Bygg sideData fra eksisterende chunks (OCR allerede kjørt)
        const sideData: Array<{ side: number; tekst: string }> = [];
        for (const chunk of dok.chunks) {
          sideData.push({ side: chunk.pageNumber ?? sideData.length + 1, tekst: chunk.chunkText });
        }

        try {
          const filsti = join(UPLOADS_DIR, dok.fileUrl.replace(/^\/uploads\//, ""));
          const buffer = await readFile(filsti);
          const antall = await splittMalebrevPdf(
            ctx.prisma, mappe.projectId, input.folderId, buffer, sideData, dok.filename ?? "ukjent.pdf", dok.id,
          );
          totaltFiler += antall;
        } catch (err) {
          console.error(`Splitting feilet for ${dok.filename}:`, err);
        }
      }

      return { splitted: totaltFiler, dokumenter: dokumenter.length };
    }),
});

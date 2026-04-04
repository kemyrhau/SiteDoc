# Implementeringsplan: Fil-til-database som modul i SiteDoc

> Dato: 2026-03-28
> Status: Godkjent for implementering
> Strategi: Full integrasjon — frontend, database og backend som SiteDoc-modul

## Prinsipp

Fil-til-database blir en **modul** i SiteDoc. Tabellene lever i SiteDoc sin PostgreSQL. Når modulen ikke er aktiv for et prosjekt, sover dataene — ingen UI vises, ingen spørringer kjøres. Når den aktiveres, får prosjektet tilgang til mengde/økonomi, dokumentsøk og NS-oppslag.

**Mapper er grunnlaget.** Filer lastes opp i SiteDoc sin mappestruktur. Tilgang til mapper styrer hva brukeren kan søke i og hvilke økonomidata de ser. Tilgangen settes på person- og gruppenivå. Feltarbeid-administratorer har tilgang til alle mapper innenfor prosjektet.

```
┌─────────────────────────────────────────────────────────────┐
│                    SiteDoc PostgreSQL                        │
│                                                             │
│  Eksisterende tabeller        FtD-modul-tabeller            │
│  ┌──────────────────┐        ┌──────────────────────┐      │
│  │ projects         │◄──FK──│ ftd_documents         │      │
│  │ enterprises      │◄──FK──│ ftd_spec_posts        │      │
│  │ folders          │◄──FK──│ ftd_nota_periods      │      │
│  │ folder_access    │        │ ftd_nota_posts        │      │
│  │ project_members  │        │ ftd_document_chunks   │      │
│  │ project_modules  │        │ ftd_nota_comments     │      │
│  │ ...              │        └──────────────────────┘      │
│  └──────────────────┘                                       │
│                                                             │
│  project_modules.moduleSlug = "okonomi" → aktiverer UI      │
│  project_modules.moduleSlug = "dokumentsok" → aktiverer UI  │
│  Ingen aktiv modul → tabellene sover                        │
└─────────────────────────────────────────────────────────────┘

Tilgangsflyt:
  Bruker → har tilgang til mapper? → ser dokumenter i de mappene
       → søk filtrerer på tilgjengelige mapper
       → økonomi filtrerer på tilgjengelige mapper

  Feltarbeid-admin → har tilgang til ALLE mapper i prosjektet
```

## Designbeslutninger (avklart 2026-03-28)

1. **Mapper med tilgangskontroll** er grunnlaget for søk og økonomi
2. **FtdDocument kobles til Folder** via `folderId` — ikke løs filsti
3. **Tilgang settes på person/gruppe-nivå** — ikke direkte på entreprise
4. **Feltarbeid-administratorer** har tilgang til alle mapper innenfor prosjektet
5. **enterpriseId** beholdes på `NotaPeriod` (eier av nota) — tilgang styres via mapper
6. **Kryss-prosjekt søk** for firmaadmin (`company_admin`) er mulig fremtidig uten strukturendringer — `Organization → OrganizationProject → Project → FtdDocument` er allerede på plass
7. **Alle tabeller har `projectId`** — prosjektisolering er innebygd

---

## Steg 1: Database — Prisma-modeller

### 1.1 Mapper-tilgangskontroll (bygge ut eksisterende)

SiteDoc har allerede `Folder` og `FolderAccess` i Prisma-skjemaet. Tilgangskontroll for mapper bygges ut med person/gruppe-nivå:

```prisma
// EKSISTERENDE — utvides om nødvendig:
model FolderAccess {
  id           String   @id @default(uuid())
  folderId     String   @map("folder_id")
  // Gjensidig eksklusiv: én av disse settes
  userId       String?  @map("user_id")        // Person-tilgang
  groupId      String?  @map("group_id")        // Gruppe-tilgang
  permission   String   @default("read")        // "read" | "write" | "admin"
  createdAt    DateTime @default(now()) @map("created_at")

  folder       Folder        @relation(fields: [folderId], references: [id], onDelete: Cascade)
  user         User?         @relation(fields: [userId], references: [id], onDelete: Cascade)
  group        ProjectGroup? @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@unique([folderId, userId])
  @@unique([folderId, groupId])
  @@map("folder_access")
}
```

**Tilgangslogikk:**

```
hentTilgjengeligeMapper(userId, projectId):
  1. Er bruker feltarbeid-admin?  → returner ALLE mapper i prosjektet
  2. Er bruker prosjektadmin?     → returner ALLE mapper i prosjektet
  3. Ellers:
     a) Finn direkte FolderAccess med userId
     b) Finn brukerens grupper → finn FolderAccess med groupId
     c) Returner union av a) og b)
```

### 1.2 FtD-modeller

**Fil:** `packages/db/prisma/schema.prisma`

Nye modeller med `ftd_`-prefix for å unngå navnekollisjon:

```prisma
// ============================================================
// FTD-MODUL: Dokumenthåndtering og mengde/økonomi
// Tabellene er aktive kun når modul "okonomi" eller
// "dokumentsok" er aktivert for prosjektet.
// Dokumenter lever i mapper — tilgang til mapper styrer
// søkbarhet og synlighet av økonomidata.
// ============================================================

model FtdDocument {
  id              String   @id @default(cuid())
  projectId       String   @map("project_id")
  folderId        String?  @map("folder_id")
  filename        String
  fileUrl         String?  @map("file_url")
  filetype        String?
  docType         String?  @map("doc_type")
  isActive        Boolean  @default(true) @map("is_active")
  fileHash        String?  @map("file_hash")
  standardNumber  String?  @map("standard_number")
  pageCount       Int?     @map("page_count")
  wordCount       Int?     @map("word_count")
  uploadedAt      DateTime @default(now()) @map("uploaded_at")

  project         Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  folder          Folder?          @relation(fields: [folderId], references: [id], onDelete: SetNull)
  chunks          FtdDocumentChunk[]
  specPosts       FtdSpecPost[]

  @@unique([projectId, filename])
  @@index([folderId])
  @@map("ftd_documents")
}

model FtdDocumentChunk {
  id              String   @id @default(cuid())
  documentId      String   @map("document_id")
  chunkIndex      Int      @map("chunk_index")
  chunkText       String   @map("chunk_text")
  pageNumber      Int?     @map("page_number")
  sectionTitle    String?  @map("section_title")
  sectionLevel    Int?     @map("section_level")
  pageHeading     String?  @map("page_heading")
  nsCode          String?  @map("ns_code")
  headingNumber   String?  @map("heading_number")
  embeddingState  String   @default("pending") @map("embedding_state")
  profile         String?

  document        FtdDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId])
  @@index([embeddingState])
  @@index([nsCode])
  @@map("ftd_document_chunks")
}

model FtdSpecPost {
  id              String   @id @default(cuid())
  projectId       String   @map("project_id")
  documentId      String?  @map("document_id")
  postnr          String?
  beskrivelse     String?
  enhet           String?
  mengdeAnbud     Decimal? @map("mengde_anbud") @db.Decimal(18, 2)
  enhetspris      Decimal? @db.Decimal(18, 2)
  sumAnbud        Decimal? @map("sum_anbud") @db.Decimal(18, 2)
  nsKode          String?  @map("ns_kode")
  nsTittel        String?  @map("ns_tittel")
  fullNsTekst     String?  @map("full_ns_tekst")
  eksternNotat    String?  @map("ekstern_notat")

  project         Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  document        FtdDocument?  @relation(fields: [documentId], references: [id], onDelete: SetNull)
  notaPoster      FtdNotaPost[]
  kommentarer     FtdNotaComment[]

  @@index([projectId])
  @@map("ftd_spec_posts")
}

model FtdNotaPeriod {
  id               String    @id @default(cuid())
  projectId        String    @map("project_id")
  enterpriseId     String?   @map("enterprise_id")
  periodeNr        Int       @map("periode_nr")
  periodeStart     DateTime? @map("periode_start")
  periodeSlutt     DateTime? @map("periode_slutt")
  type             String    @default("a_nota")   // "a_nota" | "t_nota"
  kildeFilnavn     String?   @map("kilde_filnavn")
  totalMengdeDenne Decimal?  @map("total_mengde_denne") @db.Decimal(18, 2)
  totalVerdiDenne  Decimal?  @map("total_verdi_denne") @db.Decimal(18, 2)
  totalMvaDenne    Decimal?  @map("total_mva_denne") @db.Decimal(18, 2)
  totalSumDenne    Decimal?  @map("total_sum_denne") @db.Decimal(18, 2)
  importertAv      String?   @map("importert_av")
  createdAt        DateTime  @default(now()) @map("created_at")

  project          Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  enterprise       Enterprise?  @relation(fields: [enterpriseId], references: [id], onDelete: SetNull)
  poster           FtdNotaPost[]
  kommentarer      FtdNotaComment[]

  @@index([projectId])
  @@index([enterpriseId])
  @@map("ftd_nota_periods")
}

model FtdNotaPost {
  id              String   @id @default(cuid())
  periodId        String   @map("period_id")
  specPostId      String   @map("spec_post_id")
  mengdeDenne     Decimal? @map("mengde_denne") @db.Decimal(18, 2)
  mengdeTotal     Decimal? @map("mengde_total") @db.Decimal(18, 2)
  mengdeForrige   Decimal? @map("mengde_forrige") @db.Decimal(18, 2)
  verdiDenne      Decimal? @map("verdi_denne") @db.Decimal(18, 2)
  verdiTotal      Decimal? @map("verdi_total") @db.Decimal(18, 2)
  verdiForrige    Decimal? @map("verdi_forrige") @db.Decimal(18, 2)
  prosentFerdig   Decimal? @map("prosent_ferdig") @db.Decimal(18, 2)
  mvaDenne        Decimal? @map("mva_denne") @db.Decimal(18, 2)
  sumDenne        Decimal? @map("sum_denne") @db.Decimal(18, 2)
  mengdeAnbud     Decimal? @map("mengde_anbud") @db.Decimal(18, 2)
  enhetspris      Decimal? @db.Decimal(18, 2)
  sumAnbud        Decimal? @map("sum_anbud") @db.Decimal(18, 2)

  period          FtdNotaPeriod @relation(fields: [periodId], references: [id], onDelete: Cascade)
  specPost        FtdSpecPost   @relation(fields: [specPostId], references: [id], onDelete: Cascade)

  @@index([periodId])
  @@index([specPostId])
  @@map("ftd_nota_posts")
}

model FtdNotaComment {
  id              String   @id @default(cuid())
  specPostId      String?  @map("spec_post_id")
  periodId        String?  @map("period_id")
  commentText     String   @map("comment_text")
  createdAt       DateTime @default(now()) @map("created_at")

  specPost        FtdSpecPost?   @relation(fields: [specPostId], references: [id], onDelete: Cascade)
  period          FtdNotaPeriod? @relation(fields: [periodId], references: [id], onDelete: Cascade)

  @@map("ftd_nota_comments")
}
```

**Relasjoner til eksisterende modeller** — legg til i eksisterende modeller:

```prisma
// I model Project, legg til:
  ftdDocuments     FtdDocument[]
  ftdSpecPosts     FtdSpecPost[]
  ftdNotaPeriods   FtdNotaPeriod[]

// I model Enterprise, legg til:
  ftdNotaPeriods   FtdNotaPeriod[]

// I model Folder, legg til:
  ftdDocuments     FtdDocument[]

// I model User (hvis ikke allerede), legg til:
  folderAccess     FolderAccess[]

// I model ProjectGroup (hvis ikke allerede), legg til:
  folderAccess     FolderAccess[]
```

---

## Steg 2: Modulregistrering

**Fil:** `packages/shared/src/types/index.ts`

```typescript
// Legg til i PROSJEKT_MODULER:
{
  slug: "okonomi",
  navn: "Økonomi",
  beskrivelse: "Mengdeoversikt, A-nota/T-nota, budsjettimport og avviksanalyse",
  kategori: "funksjon",
  ikon: "BarChart3",
  maler: [],
},
{
  slug: "dokumentsok",
  navn: "Dokumentsøk",
  beskrivelse: "Søk i prosjektdokumenter med fulltekst og AI-embeddings",
  kategori: "funksjon",
  ikon: "FileSearch",
  maler: [],
},
```

---

## Steg 3: tRPC-routere (ekte, ikke proxy)

### 3.0 Mapper-tilgangsfilter (gjenbrukbar hjelpefunksjon)

**Fil:** `apps/api/src/services/folder-tilgang.ts`

```typescript
import type { PrismaClient } from "@sitedoc/db";

/**
 * Returnerer liste med folder-IDer brukeren har tilgang til.
 * null = tilgang til alt (feltarbeid-admin / prosjektadmin)
 */
export async function hentTilgjengeligeMappeIder(
  prisma: PrismaClient,
  userId: string,
  projectId: string
): Promise<string[] | null> {
  // 1. Sjekk om bruker er prosjektadmin
  const medlem = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  if (!medlem) return []; // Ingen tilgang
  if (medlem.role === "owner" || medlem.role === "admin") return null; // Alt

  // 2. Sjekk om bruker er i feltarbeid-admin-gruppen
  const grupper = await prisma.projectGroup.findMany({
    where: {
      projectId,
      slug: "feltarbeid-admin",
      members: { some: { projectMember: { userId } } },
    },
  });
  if (grupper.length > 0) return null; // Feltarbeid-admin → alt

  // 3. Finn mapper via direkte tilgang + gruppetilgang
  const brukerGrupper = await prisma.projectGroup.findMany({
    where: {
      projectId,
      members: { some: { projectMember: { userId } } },
    },
    select: { id: true },
  });

  const tilganger = await prisma.folderAccess.findMany({
    where: {
      folder: { projectId },
      OR: [
        { userId },
        { groupId: { in: brukerGrupper.map(g => g.id) } },
      ],
    },
    select: { folderId: true },
  });

  return [...new Set(tilganger.map(t => t.folderId))];
}

/**
 * Bygger Prisma WHERE-filter for FtdDocument basert på mappetilgang.
 */
export function byggMappeTilgangsFilter(
  mappeIder: string[] | null
): Record<string, unknown> {
  if (mappeIder === null) return {}; // Admin — ingen filter
  return { folderId: { in: mappeIder } };
}
```

### 3.1 Mengde-router

**Fil:** `apps/api/src/routes/mengde.ts`

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import { hentTilgjengeligeMappeIder, byggMappeTilgangsFilter } from "../services/folder-tilgang";

export const mengdeRouter = router({

  hentDokumenter: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const mappeIder = await hentTilgjengeligeMappeIder(ctx.prisma, ctx.userId, input.projectId);
      return ctx.prisma.ftdDocument.findMany({
        where: {
          projectId: input.projectId,
          isActive: true,
          ...byggMappeTilgangsFilter(mappeIder),
        },
        include: { folder: { select: { id: true, name: true } } },
        orderBy: { uploadedAt: "desc" },
      });
    }),

  hentPerioder: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      enterpriseId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.ftdNotaPeriod.findMany({
        where: {
          projectId: input.projectId,
          ...(input.enterpriseId ? { enterpriseId: input.enterpriseId } : {}),
        },
        include: { enterprise: { select: { id: true, name: true, color: true } } },
        orderBy: { periodeNr: "asc" },
      });
    }),

  hentSpecPoster: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      periodId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const specPosts = await ctx.prisma.ftdSpecPost.findMany({
        where: { projectId: input.projectId },
        include: {
          notaPoster: input.periodId
            ? { where: { periodId: input.periodId } }
            : false,
        },
        orderBy: { postnr: "asc" },
      });
      return specPosts;
    }),

  hentAvviksanalyse: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      // Hent budsjett (SpecPost) og første A-nota periode
      const specPosts = await ctx.prisma.ftdSpecPost.findMany({
        where: { projectId: input.projectId },
      });
      const forstePeriode = await ctx.prisma.ftdNotaPeriod.findFirst({
        where: { projectId: input.projectId, type: "a_nota" },
        orderBy: { periodeNr: "asc" },
        include: { poster: true },
      });

      if (!forstePeriode) return { rows: [], summary: null };

      // Bygg avviksanalyse (budsjett vs kontrakt)
      const kontraktMap = new Map(
        forstePeriode.poster.map(p => [p.specPostId, p])
      );

      const rows = specPosts.map(sp => {
        const kp = kontraktMap.get(sp.id);
        const mengdeAnbud = Number(sp.mengdeAnbud ?? 0);
        const mengdeKontrakt = kp ? Number(kp.mengdeAnbud ?? 0) : 0;
        const sumAnbud = Number(sp.sumAnbud ?? 0);
        const sumKontrakt = kp ? Number(kp.sumAnbud ?? 0) : 0;

        let status: "Match" | "Endret" | "Ny" | "Fjernet";
        if (!kp) status = "Fjernet";
        else if (sumAnbud === sumKontrakt && mengdeAnbud === mengdeKontrakt) status = "Match";
        else status = "Endret";

        return {
          postnr: sp.postnr,
          beskrivelse: sp.beskrivelse,
          enhet: sp.enhet,
          mengdeAnbud, mengdeKontrakt,
          mengdeDiff: mengdeKontrakt - mengdeAnbud,
          sumAnbud, sumKontrakt,
          sumDiff: sumKontrakt - sumAnbud,
          status,
        };
      });

      // Poster i kontrakt som ikke finnes i budsjett → "Ny"
      for (const [specPostId, kp] of kontraktMap) {
        if (!specPosts.find(sp => sp.id === specPostId)) {
          rows.push({
            postnr: null, beskrivelse: "Ny post",
            enhet: null,
            mengdeAnbud: 0, mengdeKontrakt: Number(kp.mengdeAnbud ?? 0),
            mengdeDiff: Number(kp.mengdeAnbud ?? 0),
            sumAnbud: 0, sumKontrakt: Number(kp.sumAnbud ?? 0),
            sumDiff: Number(kp.sumAnbud ?? 0),
            status: "Ny" as const,
          });
        }
      }

      return {
        rows,
        summary: {
          totalAnbud: rows.reduce((s, r) => s + r.sumAnbud, 0),
          totalKontrakt: rows.reduce((s, r) => s + r.sumKontrakt, 0),
          totalDiff: rows.reduce((s, r) => s + r.sumDiff, 0),
          antallMatch: rows.filter(r => r.status === "Match").length,
          antallEndret: rows.filter(r => r.status === "Endret").length,
          antallNy: rows.filter(r => r.status === "Ny").length,
          antallFjernet: rows.filter(r => r.status === "Fjernet").length,
        },
      };
    }),

  lagreNotat: protectedProcedure
    .input(z.object({ specPostId: z.string(), tekst: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.ftdSpecPost.update({
        where: { id: input.specPostId },
        data: { eksternNotat: input.tekst },
      });
    }),

  importerNota: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      enterpriseId: z.string().uuid(),
      parsedData: z.unknown(),
      type: z.enum(["a_nota", "t_nota"]).default("a_nota"),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      // Parsing-logikk — enten port fra Python eller kall Python-worker
      // Se steg 6 for parsing-strategi
      throw new Error("TODO: Implementer nota-import");
    }),

  slettPeriode: protectedProcedure
    .input(z.object({ periodId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.ftdNotaPeriod.delete({
        where: { id: input.periodId },
      });
    }),
});
```

### 3.2 Dokumentsøk-router

**Fil:** `apps/api/src/routes/ftdSok.ts`

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";

export const ftdSokRouter = router({

  sokDokumenter: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      query: z.string().min(1),
      limit: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      // Mapper-tilgangskontroll: søk kun i dokumenter brukeren har tilgang til
      const mappeIder = await hentTilgjengeligeMappeIder(ctx.prisma, ctx.userId, input.projectId);
      const mappeFilter = byggMappeTilgangsFilter(mappeIder);

      // Fase 1: ILIKE-søk (enkelt, fungerer umiddelbart)
      // Fase 2: PostgreSQL FTS med tsvector
      // Fase 3: pgvector for semantisk søk
      return ctx.prisma.ftdDocumentChunk.findMany({
        where: {
          document: {
            projectId: input.projectId,
            ...mappeFilter,
          },
          chunkText: { contains: input.query, mode: "insensitive" },
        },
        include: {
          document: { select: { filename: true, fileUrl: true, docType: true, folderId: true } },
        },
        take: input.limit,
      });
    }),

  hentDokumentChunks: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.ftdDocumentChunk.findMany({
        where: { documentId: input.documentId },
        orderBy: { chunkIndex: "asc" },
      });
    }),

  nsKoder: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      prefix: z.string().default(""),
    }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const chunks = await ctx.prisma.ftdDocumentChunk.findMany({
        where: {
          document: { projectId: input.projectId },
          nsCode: { startsWith: input.prefix, not: null },
        },
        select: { nsCode: true },
        distinct: ["nsCode"],
        orderBy: { nsCode: "asc" },
      });
      return chunks.map(c => c.nsCode!);
    }),

  nsChunks: protectedProcedure
    .input(z.object({ nsCode: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.ftdDocumentChunk.findMany({
        where: { nsCode: input.nsCode },
        include: {
          document: { select: { filename: true } },
        },
        orderBy: { chunkIndex: "asc" },
      });
    }),
});
```

### 3.3 Registrer i hovedrouter

**Fil:** `apps/api/src/trpc/router.ts`

```typescript
import { mengdeRouter } from "../routes/mengde";
import { ftdSokRouter } from "../routes/ftdSok";

export const appRouter = router({
  // ... eksisterende
  mengde: mengdeRouter,
  ftdSok: ftdSokRouter,
});
```

---

## Steg 4: TypeScript-typer

**Fil:** `packages/shared/src/types/ftd.ts`

```typescript
// Avviksanalyse
export interface AvviksRad {
  postnr: string | null;
  beskrivelse: string | null;
  enhet: string | null;
  mengdeAnbud: number;
  mengdeKontrakt: number;
  mengdeDiff: number;
  sumAnbud: number;
  sumKontrakt: number;
  sumDiff: number;
  status: "Match" | "Endret" | "Ny" | "Fjernet";
}

export interface AvviksOppsummering {
  totalAnbud: number;
  totalKontrakt: number;
  totalDiff: number;
  antallMatch: number;
  antallEndret: number;
  antallNy: number;
  antallFjernet: number;
}

export interface AvviksanalyseResultat {
  rows: AvviksRad[];
  summary: AvviksOppsummering | null;
}
```

Eksporter fra `packages/shared/src/index.ts`.

---

## Steg 5: Frontend-komponenter

### 5.1 Oversikt — hva kopieres, hva endres

```
FtD-kilde                              SiteDoc-mål                           Endring
──────────                             ───────────                           ───────
components/mengde/
  spec-post-table.tsx                  components/mengde/spec-post-table.tsx  Hook → trpc.mengde
  deviation-analysis-panel.tsx         components/mengde/avviksanalyse.tsx    Hook → trpc.mengde
  summary-panel.tsx                    components/mengde/oppsummering.tsx     Hook → trpc.mengde
  import-dialog.tsx                    components/mengde/import-dialog.tsx    Hook + entreprise-velger
  note-editor.tsx                      components/mengde/notat-editor.tsx     Hook → trpc.mengde
  ns-code-panel.tsx                    components/mengde/ns-kode-panel.tsx    Hook → trpc.ftdSok
  project-selectors.tsx                DROPPES                               Erstattes av ProsjektKontekst

components/search/
  search-form.tsx                      components/ftd-sok/sok-skjema.tsx      Hook → trpc.ftdSok
  hit-list.tsx                         components/ftd-sok/treff-liste.tsx     Kun type-endring
  full-text-panel.tsx                  components/ftd-sok/fulltekst.tsx       Hook → trpc.ftdSok
  document-list.tsx                    components/ftd-sok/dokumentliste.tsx   Hook → trpc.ftdSok

components/documents/
  chunk-panel.tsx                      components/ftd-sok/chunk-panel.tsx     Hook → trpc.ftdSok
  metadata-panel.tsx                   components/ftd-sok/metadata-panel.tsx  Hook → trpc.ftdSok

components/ns-search/
  code-autocomplete.tsx                components/ftd-sok/ns-autocomplete.tsx Hook → trpc.ftdSok
  ns-context-panel.tsx                 components/ftd-sok/ns-kontekst.tsx     Hook → trpc.ftdSok
  spec-post-table.tsx                  components/ftd-sok/ns-poster.tsx       Hook → trpc.ftdSok

components/import/
  file-dropzone.tsx                    components/mengde/fil-dropzone.tsx     Hook → trpc.mengde
  job-progress.tsx                     components/mengde/import-fremdrift.tsx Hook → trpc.mengde
```

### 5.2 Hook-erstatningsmønster

Alle komponenter bruker samme mønster:

```typescript
// FØR (FtD — TanStack Query + fetch):
import { useSpecPosts } from "@/lib/hooks";
const { data, isLoading } = useSpecPosts(params);

// ETTER (SiteDoc — tRPC):
const { data, isLoading } = trpc.mengde.hentSpecPoster.useQuery(
  { projectId, periodId },
  { enabled: !!projectId && !!periodId }
);
```

### 5.3 ProsjektKontekst erstatter ProjectSelectors

FtD sin `ProjectSelectors` (prosjekt → dokument → periode dropdowns) erstattes med:

```typescript
// SiteDoc har allerede ProsjektKontekst med aktivt prosjekt
const { prosjekt } = useProsjektKontekst();

// Nye velgere for mengde-modulen:
<EntrepriseVelger                    // Eksisterende SiteDoc-komponent
  projectId={prosjekt.id}
  value={enterpriseId}
  onChange={setEnterpriseId}
/>
<PeriodeVelger                       // Ny komponent
  projectId={prosjekt.id}
  enterpriseId={enterpriseId}
  value={periodId}
  onChange={setPeriodId}
/>
```

---

## Steg 6: Nye sider

### 6.1 Økonomi-side

**Fil:** `apps/web/src/app/dashbord/[prosjektId]/okonomi/page.tsx`

```
┌──────────────────────────────────────────────────────────┐
│ Økonomi                                    [Importer ▲]  │
├──────────────────────────────────────────────────────────┤
│ Entreprise: [Bygg ▾]   Periode: [A-nota #3 – Mars ▾]    │
├──────────────────────────────────────────────────────────┤
│ [Oversikt] [Avviksanalyse]                               │
│                                                          │
│ ┌─ Oversikt ───────────────────────────────────────────┐ │
│ │ Nr    │ Beskrivelse      │ Mengde │ Verdi   │ %      │ │
│ │ 21.1  │ Grunnarbeid      │ 150    │ 245 000 │ 67%    │ │
│ │ 21.2  │ Betongarbeid     │ 80     │ 180 000 │ 45%    │ │
│ │ ...   │                  │        │         │        │ │
│ └────────────────────────────────────────────────────────┘ │
│ ┌─ Oppsummering ─┐  ┌─ Notat / NS-info ───────────────┐ │
│ │ Sum: 2 450 000  │  │ Merknad for valgt post...       │ │
│ │ MVA: 612 500    │  │ NS 3420 21.2: Betongarbeid...   │ │
│ └─────────────────┘  └─────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 6.2 Dokumentsøk-side

**Fil:** `apps/web/src/app/dashbord/[prosjektId]/sok/page.tsx`

```
┌──────────────────────────────────────────────────────────┐
│ Dokumentsøk                                              │
├──────────────────────────────────────────────────────────┤
│ [🔍 Søk i prosjektdokumenter...              ] [Søk]    │
│                                                          │
│ 3 treff                                                  │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 📄 NS3420_kap21.pdf · side 14                       │ │
│ │ "...betongkvalitet iht. tabell 21.2, minimum B35..."│ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ 📄 Mengdebeskrivelse.xlsx                           │ │
│ │ "...post 21.2 Betongarbeid, enhet m³..."            │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## Steg 7: Sidebar og navigasjon

**Fil:** `apps/web/src/components/layout/HovedSidebar.tsx`

```typescript
// Legg til i sidebar-definisjonen (betinget på aktive moduler):
const ftdModuler = [
  { slug: "okonomi", ikon: BarChart3, label: "Økonomi", href: "okonomi" },
  { slug: "dokumentsok", ikon: FileSearch, label: "Søk", href: "sok" },
];

// Vis kun hvis modul er aktiv for prosjektet:
{ftdModuler
  .filter(m => aktiveModuler.some(am => am.moduleSlug === m.slug && am.active))
  .map(m => <SidebarIkon key={m.slug} {...m} />)
}
```

---

## Steg 8: Parsing-worker (Python)

A-nota-parsing, XML-budsjett og mengdebeskrivelse krever Python (regex-tung logikk). Løsning:

### Minimal FastAPI-worker

```python
# ftd-worker/main.py
from fastapi import FastAPI, UploadFile
app = FastAPI()

@app.post("/parse/a-nota")
async def parse_a_nota(file: UploadFile):
    """Parse A-nota Excel → strukturert JSON"""
    # Gjenbruk logikk fra pipeline/profiles/a_nota.py
    ...

@app.post("/parse/xml-budget")
async def parse_xml_budget(file: UploadFile):
    """Parse NS3459 XML → strukturert JSON"""
    ...

@app.post("/parse/mengdebeskrivelse")
async def parse_mengdebeskrivelse(file: UploadFile):
    """Parse mengdebeskrivelse PDF/Word → strukturert JSON"""
    ...
```

**SiteDoc kaller workeren via HTTP:**

```typescript
// apps/api/src/services/ftd-parser.ts
const PARSER_URL = process.env.FTD_PARSER_URL ?? "http://localhost:8001";

export async function parseANota(fileBuffer: Buffer, filename: string) {
  const formData = new FormData();
  formData.append("file", new Blob([fileBuffer]), filename);
  const res = await fetch(`${PARSER_URL}/parse/a-nota`, {
    method: "POST",
    body: formData,
  });
  return res.json();
}
```

---

## Steg 9: Datamigrering (Azure SQL → PostgreSQL)

Engangs-script for å flytte eksisterende data:

```bash
# 1. Eksporter fra Azure SQL
# 2. Transformer IDer (integer → cuid)
# 3. Koble project_id til SiteDoc projects (manuell mapping)
# 4. Koble enterprise_id til SiteDoc enterprises
# 5. Importer til PostgreSQL via Prisma

# Script: scripts/migrere-ftd-data.ts
```

Denne kjøres én gang per prosjekt som allerede har data i FtD.

---

## Implementeringsrekkefølge

```
Uke 1: Database + mapper-tilgang
  ├── FolderAccess-utvidelse (person/gruppe)
  ├── Prisma-modeller for FtD-tabeller (steg 1)
  ├── Prisma-migrering
  ├── folder-tilgang.ts hjelpefunksjon (steg 3.0)
  ├── Modulregistrering (steg 2)
  └── Typer (steg 4)

Uke 2: Backend + frontend grunnlag
  ├── tRPC mengde-router med mappetilgang (steg 3.1)
  ├── tRPC søk-router med mappetilgang (steg 3.2)
  ├── Kopier komponenter (steg 5)
  ├── Erstatt hooks med tRPC-kall
  └── PeriodeVelger-komponent

Uke 3: Sider + navigasjon
  ├── Økonomi-side (steg 6.1)
  ├── Dokumentsøk-side (steg 6.2)
  ├── Sidebar-utvidelse (steg 7)
  ├── Mapper-tilgang innstillingsside
  └── MappeTilgangPanel komponent

Uke 4: Import + parsing
  ├── Python parsing-worker (steg 8)
  ├── Import-dialog tilpasset SiteDoc
  ├── Filopplasting → mappe → FtdDocument
  └── Test import-flyt ende-til-ende

Uke 5: Datamigrering + polish
  ├── Migrerings-script Azure SQL → PostgreSQL (steg 9)
  ├── Test med ekte prosjektdata
  ├── Tilgangskontroll verifisering
  ├── Dokumentasjon (docs/claude/)
  └── Deploy til test.sitedoc.no
```

---

## Sjekkliste

### Database
- [ ] Utvid FolderAccess med userId/groupId/permission (hvis ikke allerede)
- [ ] Opprett Prisma-modeller (6 nye FtD-tabeller)
- [ ] Legg til relasjoner i Project, Enterprise, Folder, User, ProjectGroup
- [ ] Kjør `pnpm db:migrate`
- [ ] Verifiser at eksisterende data ikke påvirkes

### Mapper-tilgangskontroll
- [ ] Opprett `apps/api/src/services/folder-tilgang.ts`
- [ ] Implementer `hentTilgjengeligeMappeIder()` — person/gruppe-nivå
- [ ] Implementer `byggMappeTilgangsFilter()` — Prisma WHERE-filter
- [ ] Feltarbeid-admin bypass (tilgang til alle mapper)
- [ ] Prosjektadmin bypass (tilgang til alle mapper)
- [ ] Verifiser at mapper-tilgang fungerer korrekt

### Backend — tRPC-routere
- [ ] Opprett `apps/api/src/routes/mengde.ts` — med mappetilgangsfilter
- [ ] Opprett `apps/api/src/routes/ftdSok.ts` — med mappetilgangsfilter
- [ ] Registrer i `apps/api/src/trpc/router.ts`
- [ ] Legg til typer i `packages/shared/src/types/ftd.ts`
- [ ] Legg til moduler i PROSJEKT_MODULER

### Frontend — komponenter
- [ ] Kopier mengde-komponenter (6 filer)
- [ ] Kopier søk-komponenter (4 filer)
- [ ] Kopier dokument-komponenter (2 filer)
- [ ] Kopier NS-søk-komponenter (3 filer)
- [ ] Kopier import-komponenter (2 filer)
- [ ] Erstatt alle hooks med tRPC-kall
- [ ] Opprett PeriodeVelger-komponent
- [ ] Opprett MappeTilgangPanel for innstillinger
- [ ] Tilpass styling til SiteDoc-palett

### Frontend — sider og navigasjon
- [ ] Opprett økonomi-side
- [ ] Opprett dokumentsøk-side
- [ ] Opprett mapper-tilgang innstillingsside
- [ ] Utvid HovedSidebar med nye ikoner
- [ ] Legg til modulsjekk for visning

### Python-worker
- [ ] Opprett minimal FastAPI med 3 parse-endepunkter
- [ ] Gjenbruk logikk fra a_nota.py og mengdebeskrivelse.py
- [ ] Dockerfile for worker
- [ ] Env-variabel FTD_PARSER_URL i SiteDoc API

### Datamigrering
- [ ] Script for Azure SQL → PostgreSQL
- [ ] ID-transformasjon (integer → cuid)
- [ ] Prosjekt/entreprise/mappe-mapping
- [ ] Test med produksjonsdata

### Dokumentasjon
- [ ] Oppdater docs/claude/arkitektur.md — mapper-tilgang + FtD-tabeller
- [ ] Oppdater docs/claude/api.md — mengde + ftdSok routere
- [ ] Oppdater docs/claude/forretningslogikk.md — moduler + mappetilgang
- [ ] Oppdater docs/claude/web.md — nye sider + komponenter

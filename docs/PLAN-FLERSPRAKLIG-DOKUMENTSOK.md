# Plan: Flerspråklig dokumentsøk og lesing

## Oversikt

Dokumenter (HMS-prosedyrer, kvalitetsdokumentasjon etc.) lastes opp i mapper som norske PDFer. Arbeidere fra 13 land trenger å søke og lese disse på eget språk. Planen er delt i 6 faser.

## Ny arkitektur

```
Admin: Mappeoppsett → HMS-prosedyrer → Språk: [nb ✓, en ✓, fi ✓]

Dokument lastes opp (norsk PDF)
    ↓
Blokkbasert parsing (pdfjs-dist)
    ↓
Norske blokker: [heading, text, image, caption, table, ...]
    ↓
Oversettelse (OPUS-MT / Google Translate)
    ↓
Engelske blokker + finske blokker
    ↓
Embedding per språk (multilingual-e5-base, 768 dim)
    ↓
Arbeider (fi) søker "turvallisuusmenettelyt"
    ↓
Søk i finske blokker → treff → vis finsk tekst + originale bilder
```

---

## Fase 1: Database-skjema og mappespråk

### 1.1 Ny kolonne på Folder

```prisma
model Folder {
  // ... eksisterende felter ...
  languages Json? @default("[\"nb\"]") // ["nb", "en", "fi", ...]
}
```

### 1.2 Ny modell: FtdDocumentBlock

```prisma
model FtdDocumentBlock {
  id            String  @id @default(cuid())
  documentId    String  @map("document_id")
  sortOrder     Int     @map("sort_order")
  pageNumber    Int     @map("page_number")
  blockType     String  @map("block_type")       // "heading" | "text" | "image" | "caption" | "table"
  language      String  @default("nb")
  content       String                            // Tekst, eller JSON for tabeller
  sourceBlockId String? @map("source_block_id")   // Peker til norsk original (null for nb)
  headingLevel  Int?    @map("heading_level")
  imageUrl      String? @map("image_url")         // S3-URL for bilder

  // Embedding
  embeddingState  String                       @default("pending") @map("embedding_state")
  embeddingVector Unsupported("vector(768)")?  @map("embedding_vector")
  embeddingModel  String?                      @map("embedding_model")

  // Relasjoner
  document     FtdDocument        @relation(fields: [documentId], references: [id], onDelete: Cascade)
  sourceBlock  FtdDocumentBlock?  @relation("BlockTranslation", fields: [sourceBlockId], references: [id], onDelete: Cascade)
  translations FtdDocumentBlock[] @relation("BlockTranslation")

  @@index([documentId, language, sortOrder])
  @@index([embeddingState])
  @@map("ftd_document_blocks")
}
```

### 1.3 Ny modell: FtdTranslationJob

```prisma
model FtdTranslationJob {
  id          String   @id @default(cuid())
  documentId  String   @map("document_id")
  targetLang  String   @map("target_lang")
  status      String   @default("pending")  // pending | processing | done | failed
  error       String?
  blocksTotal Int      @default(0) @map("blocks_total")
  blocksDone  Int      @default(0) @map("blocks_done")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  document FtdDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@unique([documentId, targetLang])
  @@map("ftd_translation_jobs")
}
```

---

## Fase 2: Blokkbasert PDF-parsing

### 2.1 Ny service: `blokk-prosessering.ts`

Bruker `pdfjs-dist` (allerede i prosjektet) med detaljert posisjonsinformasjon:

**Algoritme:**
1. Iterer sider med `getTextContent({ includeMarkedContent: true })`
2. Grupper linjer basert på Y-posisjon og fontstørrelse
3. Klassifiser blokker:
   - **heading**: Større font, bold, nummerert (`3.2.1 Betongarbeid`)
   - **text**: Normal brødtekst
   - **table**: Kolonneposisjonering (gjentatte X-verdier)
   - **caption**: Liten tekst nær bilde-placeholder
4. Bilde-ekstraksjon: `page.getOperatorList()` → lagre i S3
5. Lagre blokker med sortOrder, pageNumber, blockType, language="nb"

### 2.2 Integrasjon med prosesserDokument

```typescript
// Etter eksisterende chunk-generering:
if (dok.folderId) {
  const mappe = await prisma.folder.findUnique({ where: { id: dok.folderId } });
  const languages = (mappe?.languages as string[]) ?? ["nb"];
  if (languages.length > 0) {
    await genererBlokker(prisma, documentId, buffer, ext);
    for (const lang of languages.filter(l => l !== "nb")) {
      await opprettOversettelsesJobb(prisma, documentId, lang);
    }
  }
}
```

---

## Fase 3: Oversettelsespipeline

### 3.1 Oversettelsesserver (Python, port 3303)

Selvhostet Helsinki-NLP/OPUS-MT:

```
POST /translate { "texts": [...], "source": "nb", "target": "en" }
```

**Modellhåndtering:**
- Direkte par: `no-en`, `no-de`, `no-fi`, `no-sv`, `no-ru`, `no-pl`
- Pivot via engelsk for: cs, ro, lt, et, lv, uk (`no→en→target`)
- LRU-cache: maks 3 modeller lastet (~300MB per modell)

### 3.2 TypeScript-service: `oversettelse-service.ts`

```typescript
async function oversettBlokker(documentId: string, targetLang: string) {
  // 1. Hent norske blokker (text/heading/caption)
  // 2. Batch oversettelse (50 blokker per kall)
  // 3. Opprett nye blokker med language=targetLang, sourceBlockId=original.id
  // 4. Bilder og tabeller kopieres (deles mellom språk)
  // 5. Oppdater FtdTranslationJob-status
}
```

### 3.3 Asynkron jobbkjøring

- `FtdTranslationJob` opprettes med `status: "pending"`
- Bakgrunnsløkke poller hvert 5. sekund
- Prosesserer én jobb om gangen
- Frontend viser fremdrift ("Oversetter til finsk... 45/120 blokker")

### 3.4 Nytt språk på eksisterende mappe

1. Admin krysser av finsk i mappeinnstillinger
2. For hvert dokument: opprett `FtdTranslationJob(targetLang: "fi")`
3. Bakgrunnsløkken oversetter
4. Etter oversettelse: generer embeddings for finske blokker

---

## Fase 4: Flerspråklig embedding

### 4.1 Oppgradert Python embedding-server (port 3302)

```python
# Endepunkter:
#   POST /embed          — NorBERT (bakoverkompatibel)
#   POST /embed/model    — Velg modell: { "model": "multilingual-e5-base", "texts": [...] }
#   GET  /models         — Liste over lastede modeller
```

**Modeller:**
- `norbert2` (ltgoslo/norbert2) — 768 dim, norsk (eksisterende)
- `multilingual-e5-base` (intfloat/multilingual-e5-base) — 768 dim, 100+ språk (ny)

**Viktig:** Begge modeller produserer 768-dimensjonale vektorer — ingen skjemaendring nødvendig!

**Minnebruk:**
- NorBERT: ~500MB
- Multilingual E5: ~1.1GB
- Totalt: ~1.6GB (CPU-inferens, ingen GPU nødvendig)

### 4.2 Strategi

- Eksisterende chunks: beholder NorBERT-embeddings (søkes kun med norsk tekst)
- Nye blokker (alle språk): embeddes med multilingual E5
- `FtdDocumentBlock.embeddingModel` lagrer hvilken modell som ble brukt

---

## Fase 5: Flerspråklig søk

### 5.1 Søkeruting

```typescript
hybridSok(query, { language: "fi" })
```

1. **Encode query** med multilingual E5 (fungerer for alle språk)
2. **Vektor-søk** mot `ftd_document_blocks WHERE language = 'fi'`
3. **Fallback** til `language = 'nb'` hvis < 3 treff
4. **Leksikalsk**: `to_tsvector('simple', content)` for ikke-norske språk
5. **Legacy fallback**: Hvis kun chunks (ikke blokker), bruk NorBERT+chunk-pipeline

### 5.2 API

Utvid `aiSok.sok` med `language`-felt. Frontend sender brukerens `i18next.language`.

---

## Fase 6: Dokumentleser (Reader View)

### 6.1 Ny side

`/dashbord/[prosjektId]/dokumenter/[dokumentId]/les`

```
┌─────────────────────────────────┐
│ [🔙] Dokumentnavn    [nb ▾ en] │  ← Språkvelger
├─────────────────────────────────┤
│                                 │
│  3.2 Betongarbeid              │  ← heading (oversatt)
│                                 │
│  Betong skal støpes i henhold  │  ← text (oversatt)
│  til NS-EN 206...              │
│                                 │
│  ┌────────────────────┐         │
│  │   📷 Bilde         │         │  ← image (original, delt)
│  └────────────────────┘         │
│  Figur 3: Armeringsskisse      │  ← caption (oversatt)
│                                 │
│  | Klasse | Fasth. | Sement | │  ← table (original)
│  | B30    | 30 MPa | ...    | │
│                                 │
└─────────────────────────────────┘
```

**Funksjoner:**
- Språkvelger bytter innhold uten sidelast
- Bilder inline fra S3 (felles for alle språk)
- Tabeller som HTML `<table>`
- Mobilvenlig: max-width 700px, god typografi
- Søkeord-highlighting via query-param `?highlight=...`
- Mobil: WebView med `embed=true` parameter

---

## Migrasjonsstrategi

1. **Kun nye tabeller** — ikke-destruktivt, eksisterende data uberørt
2. **Bakoverkompatibelt søk** — sjekk blokker først, fall tilbake til chunks
3. **Gradvis blokk-generering** — nye dokumenter automatisk, eksisterende via admin-knapp
4. **Overgangsperiode** — begge systemer lever side om side

---

## Python-server oppsett

```bash
# Embedding-server (oppgradert, port 3302)
pm2 start ~/norbert-env/bin/python3 --name embedding-server -- embedding-server.py

# Oversettelse-server (ny, port 3303)
pm2 start ~/norbert-env/bin/python3 --name oversettelse-server -- oversettelse-server.py
```

**Minnebruk totalt:**
- NorBERT: ~500MB
- Multilingual E5: ~1.1GB
- 2× OPUS-MT (LRU): ~600MB
- Totalt: ~2.5GB

---

## Filer som endres/opprettes

| # | Fil | Endring |
|---|-----|---------|
| 1 | `packages/db/prisma/schema.prisma` | FtdDocumentBlock, FtdTranslationJob, Folder.languages |
| 2 | Ny migrering | SQL for nye tabeller + Folder.languages |
| 3 | `apps/api/src/services/blokk-prosessering.ts` | NY — blokkbasert PDF-parsing |
| 4 | `apps/api/src/services/oversettelse-service.ts` | NY — oversettelse av blokker |
| 5 | `apps/api/src/services/oversettelse-server.py` | NY — OPUS-MT HTTP-server |
| 6 | `apps/api/src/services/embedding-server.py` | Oppgradert — multi-modell (NorBERT + E5) |
| 7 | `apps/api/src/services/ai-sok-service.ts` | Utvid med språk + blokk-søk |
| 8 | `apps/api/src/routes/mappe.ts` | Språkinnstillinger + dokumentleser-API |
| 9 | `apps/web/.../mapper/page.tsx` | Oversettelsesfremdrift per dokument |
| 10 | `apps/web/.../mappeoppsett/` | Språkvelger per mappe |
| 11 | `apps/web/.../dokumenter/[id]/les/page.tsx` | NY — Reader View |

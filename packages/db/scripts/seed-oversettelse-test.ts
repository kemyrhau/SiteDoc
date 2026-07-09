/**
 * Seed testdata for redesign 2b — oversettelses-tilstander på mapper.
 *
 * Lager mappen «🌐 Oversettelse-test (redesign)» med tre dokumenter som dekker
 * chip-tilstandene som ellers ikke finnes i testdatasettet:
 *   A) grønn «✓» — fullført oversettelse (kildeblokker + målblokker)
 *   B) amber «…» — pågående jobb (kildeblokker + pending FtdTranslationJob)
 *   C) avvik-rad  — detektert språk ≠ kildespråk, ubekreftet (for B8-raden)
 *   D) uparset    — fileUrl uten blokker (2c-leserens tom-tilstand + «Last ned PDF»-knapp)
 *
 * Kjør mot TEST-DB:
 *   DATABASE_URL=<sitedoc_test> pnpm --filter @sitedoc/db exec \
 *     tsx scripts/seed-oversettelse-test.ts
 *
 * Idempotent: sletter en tidligere seed-mappe (samme navn) først.
 * Merk (B): jobb-løkka kan fullføre pending-jobben → chip blir grønn. Det
 * demonstrerer pipelinen ende-til-ende; for et kontrollert amber-øyeblikk viser
 * også «Oversett»-knappens optimistiske oppdatering amber umiddelbart.
 */

import { prisma } from "../src/index";

const SEED_NAVN = "🌐 Oversettelse-test (redesign)";

async function main() {
  const prosjektId = process.env.SEED_PROJECT_ID;
  const prosjekt = prosjektId
    ? await prisma.project.findUniqueOrThrow({ where: { id: prosjektId } })
    : await prisma.project.findFirst({ orderBy: { createdAt: "asc" } });
  if (!prosjekt) throw new Error("Fant ingen prosjekt å seede mot.");

  const src = prosjekt.sourceLanguage ?? "nb";
  const gronnMal = src === "en" ? "sv" : "en"; // et målspråk ≠ kilde
  const amberMal = "lt";

  console.log(`Seeder mot prosjekt ${prosjekt.name} (${prosjekt.id}), kilde=${src}`);

  // Rydd tidligere seed
  const gammel = await prisma.folder.findFirst({
    where: { projectId: prosjekt.id, name: SEED_NAVN },
    select: { id: true },
  });
  if (gammel) {
    const docs = await prisma.ftdDocument.findMany({ where: { folderId: gammel.id }, select: { id: true } });
    for (const d of docs) await prisma.ftdDocument.delete({ where: { id: d.id } }); // SQL-FK cascade: blokker/jobber
    await prisma.folder.delete({ where: { id: gammel.id } });
    console.log(`Slettet tidligere seed-mappe (${docs.length} dok).`);
  }

  // Aktiver oversettelse-modul (så «Oversett»-knappen faktisk skaper jobber)
  await prisma.projectModule.upsert({
    where: { projectId_moduleSlug: { projectId: prosjekt.id, moduleSlug: "oversettelse" } },
    create: { projectId: prosjekt.id, moduleSlug: "oversettelse", status: "aktiv" },
    update: { status: "aktiv" },
  });

  const mappe = await prisma.folder.create({
    data: {
      projectId: prosjekt.id,
      name: SEED_NAVN,
      languageMode: "custom",
      languages: [src, gronnMal, amberMal],
    },
  });

  const lagBlokk = (documentId: string, language: string, sortOrder: number, content: string, sourceBlockId?: string) =>
    prisma.ftdDocumentBlock.create({
      data: { documentId, language, sortOrder, pageNumber: 1, blockType: "text", content, sourceBlockId: sourceBlockId ?? null },
    });

  // A) grønn — fullført oversettelse til gronnMal
  const docA = await prisma.ftdDocument.create({
    data: {
      projectId: prosjekt.id, folderId: mappe.id, filename: "seed-oversatt.txt",
      sourceLanguage: src, processingState: "completed", languageConfirmed: true, wordCount: 6,
    },
  });
  const a1 = await lagBlokk(docA.id, src, 0, "Dette er kildeteksten.");
  await lagBlokk(docA.id, src, 1, "Andre avsnitt i kilden.");
  await lagBlokk(docA.id, gronnMal, 0, "This is the translated text.", a1.id);

  // B) amber — pågående jobb til amberMal (kun kildeblokker foreløpig)
  const docB = await prisma.ftdDocument.create({
    data: {
      projectId: prosjekt.id, folderId: mappe.id, filename: "seed-pagaar.txt",
      sourceLanguage: src, processingState: "completed", languageConfirmed: true, wordCount: 4,
    },
  });
  await lagBlokk(docB.id, src, 0, "Tekst som venter på oversettelse.");
  await prisma.ftdTranslationJob.upsert({
    where: { documentId_targetLang: { documentId: docB.id, targetLang: amberMal } },
    create: { id: `${docB.id}-${amberMal}`, documentId: docB.id, targetLang: amberMal, blocksTotal: 1, status: "pending" },
    update: { status: "pending", blocksTotal: 1, blocksDone: 0, error: null },
  });

  // C) avvik — detektert språk ≠ kilde, ubekreftet
  const avvikSprak = amberMal !== src ? amberMal : "lt";
  const docC = await prisma.ftdDocument.create({
    data: {
      projectId: prosjekt.id, folderId: mappe.id, filename: "seed-avvik.txt",
      sourceLanguage: avvikSprak, detectedLanguage: avvikSprak, languageConfirmed: false,
      processingState: "completed", wordCount: 3,
    },
  });
  await lagBlokk(docC.id, avvikSprak, 0, "Tekstas kuris atrodo lietuviškas.");

  // D) uparset — fileUrl satt, INGEN blokker → 2c-leserens tom-tilstand + «Last ned PDF»
  const docD = await prisma.ftdDocument.create({
    data: {
      projectId: prosjekt.id, folderId: mappe.id, filename: "seed-uparset.pdf",
      fileUrl: "/uploads/seed/seed-uparset.pdf", sourceLanguage: src,
      processingState: "pending", languageConfirmed: false, wordCount: 0,
    },
  });

  console.log(`Ferdig. Mappe: ${SEED_NAVN} (${mappe.id})`);
  console.log(`  A grønn (${gronnMal}✓): ${docA.filename}`);
  console.log(`  B amber (${amberMal}…): ${docB.filename}`);
  console.log(`  C avvik (${avvikSprak}≠${src}): ${docC.filename}`);
  console.log(`  D uparset (fileUrl, 0 blokker): ${docD.filename}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

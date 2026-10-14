/**
 * Reprosesser alle FTD-dokumenter i ett prosjekt — for å rette eksisterende
 * dokumenter uten ny opplasting (f.eks. PDF-er som står på feil sidetall «side 1»
 * overalt fordi de ble prosessert før pagerender-fiksen).
 *
 * Bruk (fra apps/api, så cwd peker på uploads-mappa):
 *   pnpm --filter @sitedoc/api exec tsx scripts/reprosesser-prosjekt.ts <projectId>
 *   pnpm --filter @sitedoc/api exec tsx scripts/reprosesser-prosjekt.ts <projectId> --tving
 *
 *   --tving : full re-ekstraksjon av ALLE dokumenter (også `completed` med chunks).
 *             Gamle chunks bevares atomisk ved feil (bevarVedFeil) — dokumentet
 *             ender aldri tomt. Uten flagget kjøres kun reparasjon (full re-
 *             ekstraksjon der søkbart innhold mangler: 0 chunks / `failed`).
 *
 * Sekvensiell (ett dokument av gangen) for ikke å overbelaste serveren.
 * Embedding trigges fire-and-forget pr. dokument (krever NORBERT_URL i miljøet);
 * sidetall settes under ekstraksjon uavhengig av embedding.
 *
 * I test/prod kjøres dette helst via tRPC-mutasjonen `mappe.reprosesserProsjekt`
 * (den kjører i api-prosessen med riktig uploads-volum og NORBERT_URL).
 */

import { prisma } from "@sitedoc/db";
import { prosesserDokument } from "../src/services/ftd-prosessering";

async function main() {
  const projectId = process.argv[2];
  const tving = process.argv.includes("--tving");
  if (!projectId) {
    console.error("Bruk: tsx scripts/reprosesser-prosjekt.ts <projectId> [--tving]");
    process.exit(1);
  }

  const prosjekt = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });
  if (!prosjekt) {
    console.error(`Fant ikke prosjekt ${projectId}`);
    process.exit(1);
  }

  const dokumenter = await prisma.ftdDocument.findMany({
    where: {
      projectId,
      isActive: true,
      processingState: { notIn: ["pending", "processing", "unsupported"] },
    },
    select: { id: true, filename: true, processingState: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(
    `Prosjekt «${prosjekt.name}»: ${dokumenter.length} dokument(er) å vurdere (tving=${tving})\n`,
  );

  let kjort = 0;
  let hoppet = 0;
  for (const d of dokumenter) {
    if (!tving) {
      const chunks = await prisma.ftdDocumentChunk.count({ where: { documentId: d.id } });
      if (chunks > 0 && d.processingState === "completed") {
        hoppet++;
        continue; // har søkbart innhold → ingen re-ekstraksjon uten --tving
      }
    }
    process.stdout.write(`  [${kjort + 1}] ${d.filename} … `);
    await prosesserDokument(prisma, d.id, { bevarVedFeil: tving });
    const etter = await prisma.ftdDocumentChunk.findMany({
      where: { documentId: d.id },
      select: { pageNumber: true },
    });
    const unikeSider = new Set(etter.map((c) => c.pageNumber ?? 0));
    console.log(`ok (${etter.length} chunks, ${unikeSider.size} unike sidetall)`);
    kjort++;
  }

  console.log(`\nFerdig: ${kjort} prosessert, ${hoppet} hoppet over.`);
  console.log("Embedding kjører videre i bakgrunnen pr. dokument (krever NORBERT_URL).");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

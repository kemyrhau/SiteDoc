/**
 * READ-ONLY audit (S1, prod-opprydding 2026-08-15): tell hvor mange fil-referanser
 * fra SENSITIVE kilder som fortsatt peker på ÅPEN /uploads/-sti (ikke /uploads/privat/),
 * brutt ned PER KILDE og PER FILTYPE (ext). Skriver INGENTING — kun SELECT + telling.
 *
 * Bakgrunn: dagens prod-måling så kun etter `.jpg`. Åpen uploads/ har også pdf, svg,
 * png, xlsx, dwg, ifc, xls m.m. Denne rapporten svarer på: hvilke av dem er referert
 * fra en sensitiv tabell eller fra et feltvedlegg — og skal dermed til privat/.
 *
 * Kilder (samme univers som migrer-sensitive-filer + migrer-bilder):
 *   timer.sheet_tillegg_vedlegg.file_url   (flat)   — kvittering (tillegg)
 *   timer.sheet_utlegg_vedlegg.file_url    (flat)   — kvittering (utlegg)
 *   AnsattKompetanse.vedlegg[].url         (JSON)   — kompetanse-sertifikat
 *   maskin ServiceRecord.vedlegg[].url     (JSON)   — maskin-service
 *   Image.file_url                         (flat)   — mobil-opplastede bilder
 *   Checklist.data / Task.data             (JSON)   — feltvedlegg (bilde + fil)
 *
 * Bruk (på API-serveren; DATABASE_URL må peke rett miljø — normalt prod /sitedoc):
 *   … audit-sensitive-apen-sti.ts
 *
 * Ingen flagg, ingen skriving, ingen disk-berøring. Trygg å kjøre når som helst.
 */

import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";

const PREFIKS = "/uploads/";
const PRIVAT_PREFIKS = "/uploads/privat/";

function erApen(url: unknown): url is string {
  return typeof url === "string" && url.startsWith(PREFIKS) && !url.startsWith(PRIVAT_PREFIKS);
}

function ext(url: string): string {
  const rensk = url.split("?")[0].split("#")[0];
  const punkt = rensk.lastIndexOf(".");
  const skille = rensk.lastIndexOf("/");
  if (punkt <= skille) return "(ingen)";
  return rensk.slice(punkt).toLowerCase();
}

// Rekursiv url-høsting fra vilkårlig JSON (feltvedlegg/vedlegg-arrays):
// samle enhver streng-verdi under nøkkel url/fileUrl/uri som er en åpen /uploads/-sti.
function hostUrler(node: unknown, ut: string[]): void {
  if (Array.isArray(node)) {
    for (const n of node) hostUrler(n, ut);
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if ((k === "url" || k === "fileUrl" || k === "uri") && erApen(v)) ut.push(v);
      else hostUrler(v, ut);
    }
  }
}

type Bøtte = Map<string, number>; // ext → antall

function tell(urler: string[]): { total: number; perExt: Bøtte } {
  const perExt: Bøtte = new Map();
  for (const u of urler) perExt.set(ext(u), (perExt.get(ext(u)) ?? 0) + 1);
  return { total: urler.length, perExt };
}

function skrivBøtte(navn: string, urler: string[]): number {
  const { total, perExt } = tell(urler);
  const detalj = [...perExt.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([e, n]) => `${e}:${n}`)
    .join("  ");
  console.log(`  ${navn.padEnd(38)} ${String(total).padStart(4)}   ${detalj}`);
  return total;
}

async function main() {
  console.log(
    `\n=== READ-ONLY audit: sensitive fil-referanser på ÅPEN /uploads/-sti ===\n` +
      `(peker startsWith /uploads/ og IKKE /uploads/privat/)\n` +
      `Kilde                                   Ant.   per filtype`,
  );

  // 1. timer — tillegg (flat)
  const tillegg = await prismaTimer.sheetTilleggVedlegg.findMany({ select: { fileUrl: true } });
  const tilleggU = tillegg.map((r) => r.fileUrl).filter(erApen);

  // 2. timer — utlegg (flat)
  const utlegg = await prismaTimer.sheetUtleggVedlegg.findMany({ select: { fileUrl: true } });
  const utleggU = utlegg.map((r) => r.fileUrl).filter(erApen);

  // 3. kompetanse (JSON-array)
  const komp = await prisma.ansattKompetanse.findMany({ select: { vedlegg: true } });
  const kompU: string[] = [];
  komp.forEach((r) => hostUrler(r.vedlegg, kompU));

  // 4. maskin (JSON-array)
  const maskin = await prismaMaskin.serviceRecord.findMany({ select: { vedlegg: true } });
  const maskinU: string[] = [];
  maskin.forEach((r) => hostUrler(r.vedlegg, maskinU));

  // 5. bilder (flat)
  const bilder = await prisma.image.findMany({ select: { fileUrl: true } });
  const bilderU = bilder.map((r) => r.fileUrl).filter(erApen);

  // 6. feltvedlegg i sjekkliste/oppgave-data (JSON)
  const checklists = await prisma.checklist.findMany({ select: { data: true } });
  const tasks = await prisma.task.findMany({ select: { data: true } });
  const feltU: string[] = [];
  checklists.forEach((c) => hostUrler(c.data, feltU));
  tasks.forEach((t) => hostUrler(t.data, feltU));

  let sum = 0;
  console.log(`\n  — Sensitive tabeller (timer/kompetanse/maskin) —`);
  sum += skrivBøtte("timer.sheet_tillegg_vedlegg", tilleggU);
  sum += skrivBøtte("timer.sheet_utlegg_vedlegg", utleggU);
  sum += skrivBøtte("AnsattKompetanse.vedlegg[]", kompU);
  sum += skrivBøtte("maskin.ServiceRecord.vedlegg[]", maskinU);
  console.log(`\n  — Feltvedlegg / bilder —`);
  sum += skrivBøtte("Image.file_url", bilderU);
  sum += skrivBøtte("Checklist/Task.data (feltvedlegg)", feltU);

  // Samlet filtype-fordeling på tvers av alle kilder
  const alle = [...tilleggU, ...utleggU, ...kompU, ...maskinU, ...bilderU, ...feltU];
  const { perExt } = tell(alle);
  console.log(`\n  — Samlet per filtype (alle kilder, kan telle en fil flere ganger om delt) —`);
  [...perExt.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([e, n]) => console.log(`  ${e.padEnd(10)} ${n}`));

  console.log(`\n=== Sum referanser på åpen sti: ${sum} ===\n`);
}

main()
  .catch((err) => {
    console.error("Audit feilet:", err);
    process.exit(1);
  })
  .finally(async () => {
    await Promise.all([prisma.$disconnect(), prismaTimer.$disconnect(), prismaMaskin.$disconnect()]);
  });

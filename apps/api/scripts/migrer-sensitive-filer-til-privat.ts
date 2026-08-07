/**
 * Engangs-migrering (S1 Fase 1): flytt EKSISTERENDE sensitive vedlegg-filer fra
 * `/uploads/<x>` til `/uploads/privat/<x>` og oppdater pekeren. Sensitive filer
 * serveres deretter signatur-KUN (uploads/privat/-hooken i server.ts).
 *
 * Tre sensitive typer:
 *   1. SheetTilleggVedlegg.fileUrl        (db-timer, flat string)  — timer-kvittering/utlegg
 *   2. AnsattKompetanse.vedlegg[].url     (db, JSON-array)         — kompetanse-sertifikat
 *   3. ServiceRecord.vedlegg[].url        (db-maskin, JSON-array)  — maskin-service
 *
 * (2) og (3) har ingen opplastings-UI/rute i dag → normalt tomme; migreres
 * defensivt likevel (idempotent no-op om tomme).
 *
 * SIKKER SEKVENS per fil (ingen vindu der peker og fil er uenige):
 *   kopier /uploads/x → /uploads/privat/x  →  verifiser lesbar  →  oppdater peker
 *   →  slett gammel /uploads/x.  Aldri rename-før-peker (ville gitt 404-vindu).
 *
 * IDEMPOTENT: hopper over pekere som allerede er /uploads/privat/. Kan re-kjøres.
 *
 * Bruk (på API-serveren der uploads/ ligger; DATABASE_URL må peke rett miljø):
 *   pnpm --filter @sitedoc/api exec tsx scripts/migrer-sensitive-filer-til-privat.ts          # dry-run (default)
 *   pnpm --filter @sitedoc/api exec tsx scripts/migrer-sensitive-filer-til-privat.ts --utfor  # faktisk flytting
 *
 * ALDRI slett data: kun flytt + oppdater peker. Backup FØR kjøring på prod.
 */

import { join } from "path";
import { access, copyFile, mkdir, unlink } from "fs/promises";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";

const UPLOADS_DIR = process.env.UPLOADS_DIR || join(process.cwd(), "uploads");
const PREFIKS = "/uploads/";
const PRIVAT_PREFIKS = "/uploads/privat/";

const UTFOR = process.argv.includes("--utfor");

let flyttet = 0;
let hoppet = 0;
let feilet = 0;

async function finnes(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Flytt én fil-peker til privat/. Returnerer den NYE URL-en (eller uendret ved
 * skip/feil). Trygg sekvens: kopier → verifiser → (kaller oppdaterer peker) →
 * slett gammel. Selve peker-oppdateringen gjøres av kalleren MELLOM kopiering og
 * sletting via `oppdaterPeker`-callbacken, så pekeren aldri peker på manglende fil.
 */
async function flyttFil(
  gammelUrl: string,
  oppdaterPeker: (nyUrl: string) => Promise<void>,
  kontekst: string,
): Promise<void> {
  // Kun /uploads/-pekere, og ikke allerede privat
  if (!gammelUrl.startsWith(PREFIKS) || gammelUrl.startsWith(PRIVAT_PREFIKS)) {
    hoppet++;
    return;
  }

  const relativ = gammelUrl.slice(PREFIKS.length); // "<uuid>.<ext>"
  const gammelSti = join(UPLOADS_DIR, relativ);
  const nyRelativ = `privat/${relativ}`;
  const nySti = join(UPLOADS_DIR, nyRelativ);
  const nyUrl = `${PRIVAT_PREFIKS}${relativ}`;

  if (!(await finnes(gammelSti))) {
    console.warn(`  ⚠️  MANGLER på disk, hopper: ${gammelUrl} (${kontekst})`);
    feilet++;
    return;
  }

  if (!UTFOR) {
    console.log(`  [dry-run] ville flyttet: ${gammelUrl} → ${nyUrl} (${kontekst})`);
    flyttet++;
    return;
  }

  try {
    await mkdir(join(UPLOADS_DIR, "privat"), { recursive: true });
    // 1) kopier (begge eksisterer nå)
    await copyFile(gammelSti, nySti);
    // 2) verifiser lesbar på ny plass
    if (!(await finnes(nySti))) {
      console.error(`  ❌ kopi ikke verifiserbar: ${nyUrl} (${kontekst})`);
      feilet++;
      return;
    }
    // 3) oppdater peker (nå peker den på en fil som finnes)
    await oppdaterPeker(nyUrl);
    // 4) slett gammel (peker er allerede flyttet — ingen 404-vindu)
    await unlink(gammelSti);
    console.log(`  ✓ ${gammelUrl} → ${nyUrl} (${kontekst})`);
    flyttet++;
  } catch (err) {
    console.error(`  ❌ feil ved flytting av ${gammelUrl} (${kontekst}):`, err);
    feilet++;
  }
}

// --- Type 1: SheetTilleggVedlegg.fileUrl (db-timer) ---
async function migrerTimerVedlegg() {
  const rader = await prismaTimer.sheetTilleggVedlegg.findMany({
    where: { fileUrl: { startsWith: PREFIKS, not: { startsWith: PRIVAT_PREFIKS } } },
    select: { id: true, fileUrl: true },
  });
  console.log(`\nType 1 — timer-kvittering (SheetTilleggVedlegg): ${rader.length} kandidat(er)`);
  for (const r of rader) {
    await flyttFil(
      r.fileUrl,
      async (nyUrl) => {
        await prismaTimer.sheetTilleggVedlegg.update({
          where: { id: r.id },
          data: { fileUrl: nyUrl },
        });
      },
      `SheetTilleggVedlegg ${r.id}`,
    );
  }
}

type VedleggObj = { url?: string; [k: string]: unknown };

// --- Type 2: AnsattKompetanse.vedlegg[].url (db, JSON) ---
async function migrerKompetanseVedlegg() {
  // Henter alle + filtrerer i JS (Prisma JSON-null-filter er en fallgruve).
  const rader = await prisma.ansattKompetanse.findMany({
    select: { id: true, vedlegg: true },
  });
  const medFiler = rader.filter(
    (r) =>
      Array.isArray(r.vedlegg) &&
      (r.vedlegg as VedleggObj[]).some(
        (v) => typeof v?.url === "string" && v.url.startsWith(PREFIKS) && !v.url.startsWith(PRIVAT_PREFIKS),
      ),
  );
  console.log(`\nType 2 — kompetanse-sertifikat (AnsattKompetanse.vedlegg): ${medFiler.length} rad(er) med kandidat-filer`);
  for (const r of medFiler) {
    const arr = r.vedlegg as VedleggObj[];
    const nyArr: VedleggObj[] = [...arr];
    let endret = false;
    for (let i = 0; i < nyArr.length; i++) {
      const v = nyArr[i];
      if (typeof v?.url !== "string") continue;
      const gammel = v.url;
      await flyttFil(
        gammel,
        async (nyUrl) => {
          nyArr[i] = { ...v, url: nyUrl };
          endret = true;
        },
        `AnsattKompetanse ${r.id} [${i}]`,
      );
    }
    if (UTFOR && endret) {
      await prisma.ansattKompetanse.update({
        where: { id: r.id },
        data: { vedlegg: nyArr as object },
      });
    }
  }
}

// --- Type 3: ServiceRecord.vedlegg[].url (db-maskin, JSON) ---
async function migrerMaskinVedlegg() {
  // Henter alle + filtrerer i JS (Prisma JSON-null-filter er en fallgruve).
  const rader = await prismaMaskin.serviceRecord.findMany({
    select: { id: true, vedlegg: true },
  });
  const medFiler = rader.filter(
    (r) =>
      Array.isArray(r.vedlegg) &&
      (r.vedlegg as VedleggObj[]).some(
        (v) => typeof v?.url === "string" && v.url.startsWith(PREFIKS) && !v.url.startsWith(PRIVAT_PREFIKS),
      ),
  );
  console.log(`\nType 3 — maskin-service (ServiceRecord.vedlegg): ${medFiler.length} rad(er) med kandidat-filer`);
  for (const r of medFiler) {
    const arr = r.vedlegg as VedleggObj[];
    const nyArr: VedleggObj[] = [...arr];
    let endret = false;
    for (let i = 0; i < nyArr.length; i++) {
      const v = nyArr[i];
      if (typeof v?.url !== "string") continue;
      await flyttFil(
        v.url,
        async (nyUrl) => {
          nyArr[i] = { ...v, url: nyUrl };
          endret = true;
        },
        `ServiceRecord ${r.id} [${i}]`,
      );
    }
    if (UTFOR && endret) {
      await prismaMaskin.serviceRecord.update({
        where: { id: r.id },
        data: { vedlegg: nyArr as object },
      });
    }
  }
}

async function main() {
  console.log(
    `\n=== Migrering: sensitive filer → /uploads/privat/ ===\n` +
      `Modus: ${UTFOR ? "UTFØR (skriver)" : "DRY-RUN (ingen endring — bruk --utfor)"}\n` +
      `UPLOADS_DIR: ${UPLOADS_DIR}`,
  );

  await migrerTimerVedlegg();
  await migrerKompetanseVedlegg();
  await migrerMaskinVedlegg();

  console.log(
    `\n=== Ferdig ===\n` +
      `Flyttet: ${flyttet} · Hoppet (allerede privat / ikke /uploads): ${hoppet} · Feilet/manglet: ${feilet}\n`,
  );
  if (!UTFOR) console.log("Dette var en DRY-RUN. Kjør med --utfor for å utføre.\n");
}

main()
  .catch((err) => {
    console.error("Migrering feilet:", err);
    process.exit(1);
  })
  .finally(async () => {
    await Promise.all([prisma.$disconnect(), prismaTimer.$disconnect(), prismaMaskin.$disconnect()]);
  });

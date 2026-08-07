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
 * ⚠️ KJENT BEGRENSNING — JSON-array-mønsteret (kompetanse/maskin, type 2+3):
 *   - Peker-oppdatering her er «les rad → muter array-kopi → skriv hele arrayet
 *     tilbake» (se migrerKompetanseVedlegg/migrerMaskinVedlegg). Det ER korrekt
 *     (ikke no-op, ikke kolonne-antagelse), men er det iboende skjøre JSON-mønsteret:
 *     race-utsatt ved samtidige skrivere og uten typegaranti. Trygt her fordi
 *     migreringen er en engangs-offline-kjøring og disse tabellene har ingen aktive
 *     skrivere (ingen opplastings-UI i dag).
 *   - Filer i et JSON-array har INGEN record-id → M1-mønsteret (record-nøklet
 *     sign-query for authz ved emisjon, jf. signerTilleggVedlegg) kan IKKE bygges
 *     for dem. For dagens web-flater dekkes de likevel av sentral signer-middleware
 *     (authz skjer når spørringen returnerer raden; signaturen bæres i JSON-strengen).
 *     Hullet bites først den dagen en JSON-array-fil må konsumeres UTENOM spørrings-
 *     svaret (f.eks. mobil-visning fra lokalt lagret bar URL). Løses av datamodell-
 *     konvergens (egen ordre foran Fase 1b), IKKE innenfor Fase 1.
 *
 * VEI 3 (delt uploads-volum test↔prod): KOPIÉR-UTEN-SLETT er default. Originalen
 * blir stående, så den andre DB-en (som ennå peker /uploads/x) er uberørt. Begge
 * DB-er migreres uavhengig; sletting av foreldreløse originaler er en SEPARAT,
 * senere fase (--rydd-originaler) som kun kjøres når BÅDE DB-er er migrert.
 *
 * SIKKER SEKVENS per fil (migrering, ingen vindu der peker og fil er uenige):
 *   kopier /uploads/x → /uploads/privat/x  →  verifiser lesbar  →  oppdater peker.
 *   (Ingen sletting her — originalen beholdes til opprydding.)
 *
 * IDEMPOTENT: hopper pekere som allerede er /uploads/privat/, og kopiering hopper
 * hvis /uploads/privat/x allerede finnes (den andre DB-en kan ha kopiert den).
 *
 * Bruk (på API-serveren der uploads/ ligger; DATABASE_URL må peke rett miljø):
 *   … migrer-sensitive-filer-til-privat.ts                     # dry-run migrering (default)
 *   … migrer-sensitive-filer-til-privat.ts --utfor             # utfør migrering (kopiér+peker)
 *   … migrer-sensitive-filer-til-privat.ts --rydd-originaler          # dry-run opprydding
 *   … migrer-sensitive-filer-til-privat.ts --rydd-originaler --utfor  # slett foreldreløse originaler
 *
 * ⚠️ --rydd-originaler KUN etter at BÅDE sitedoc OG sitedoc_test er migrert +
 *    verifisert (delt volum). Sletter /uploads/x for filer som nå har privat-tvilling.
 *
 * ALDRI slett data i migreringsfasen. Backup FØR prod-kjøring.
 */

import { join } from "path";
import { access, copyFile, mkdir, readdir, stat, unlink } from "fs/promises";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";

const UPLOADS_DIR = process.env.UPLOADS_DIR || join(process.cwd(), "uploads");
const PREFIKS = "/uploads/";
const PRIVAT_PREFIKS = "/uploads/privat/";

const UTFOR = process.argv.includes("--utfor");
const RYDD = process.argv.includes("--rydd-originaler");

let flyttet = 0;
let hoppet = 0;
let feilet = 0;
let ryddet = 0;

async function finnes(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * VEI 3 — kopiér én fil-peker til privat/ UTEN å slette originalen. Sekvens:
 * kopier → verifiser lesbar → oppdater peker. Originalen beholdes (delt volum:
 * den andre DB-en peker fortsatt på den til den også er migrert). Idempotent:
 * hopper kopiering hvis privat-tvillingen allerede finnes.
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
  const nySti = join(UPLOADS_DIR, `privat/${relativ}`);
  const nyUrl = `${PRIVAT_PREFIKS}${relativ}`;

  const kildeFinnes = await finnes(gammelSti);
  const tvillingFinnes = await finnes(nySti);
  if (!kildeFinnes && !tvillingFinnes) {
    console.warn(`  ⚠️  MANGLER på disk (verken original eller privat), hopper: ${gammelUrl} (${kontekst})`);
    feilet++;
    return;
  }

  if (!UTFOR) {
    console.log(
      `  [dry-run] ville ${tvillingFinnes ? "kun oppdatert peker (tvilling finnes)" : "kopiert + oppdatert peker"}: ${gammelUrl} → ${nyUrl} (${kontekst})`,
    );
    flyttet++;
    return;
  }

  try {
    await mkdir(join(UPLOADS_DIR, "privat"), { recursive: true });
    // 1) kopier hvis tvilling ikke finnes (idempotent — den andre DB-en kan ha kopiert)
    if (!tvillingFinnes) {
      if (!kildeFinnes) {
        console.error(`  ❌ original mangler, kan ikke kopiere: ${gammelUrl} (${kontekst})`);
        feilet++;
        return;
      }
      await copyFile(gammelSti, nySti);
    }
    // 2) verifiser lesbar på ny plass
    if (!(await finnes(nySti))) {
      console.error(`  ❌ kopi ikke verifiserbar: ${nyUrl} (${kontekst})`);
      feilet++;
      return;
    }
    // 3) oppdater peker (fila finnes på privat; originalen beholdes til opprydding)
    await oppdaterPeker(nyUrl);
    console.log(`  ✓ ${gammelUrl} → ${nyUrl} (${kontekst})`);
    flyttet++;
  } catch (err) {
    console.error(`  ❌ feil ved kopiering av ${gammelUrl} (${kontekst}):`, err);
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

// --- Opprydding (VEI 3, separat fase): slett foreldreløse originaler ---
// Disk-drevet: for hver fil i uploads/privat/<navn>, slett tvillingen
// uploads/<navn> hvis den finnes. KUN etter at BÅDE DB-er er migrert.
async function ryddOriginaler() {
  const privatDir = join(UPLOADS_DIR, "privat");
  let filer: string[];
  try {
    filer = await readdir(privatDir);
  } catch {
    console.log("Ingen uploads/privat/-katalog — ingenting å rydde.");
    return;
  }
  for (const navn of filer) {
    const privatSti = join(privatDir, navn);
    // kun toppnivå-filer (sensitive vedlegg er flate uuid-filer)
    try {
      if (!(await stat(privatSti)).isFile()) continue;
    } catch {
      continue;
    }
    const originalSti = join(UPLOADS_DIR, navn);
    if (!(await finnes(originalSti))) {
      hoppet++;
      continue;
    }
    if (!UTFOR) {
      console.log(`  [dry-run] ville slettet foreldreløs original: /uploads/${navn}`);
      ryddet++;
      continue;
    }
    try {
      await unlink(originalSti);
      console.log(`  ✓ slettet original: /uploads/${navn}`);
      ryddet++;
    } catch (err) {
      console.error(`  ❌ kunne ikke slette /uploads/${navn}:`, err);
      feilet++;
    }
  }
}

async function main() {
  if (RYDD) {
    console.log(
      `\n=== Opprydding: slett foreldreløse originaler ===\n` +
        `Modus: ${UTFOR ? "UTFØR (sletter)" : "DRY-RUN (ingen sletting — bruk --utfor)"}\n` +
        `UPLOADS_DIR: ${UPLOADS_DIR}\n` +
        `⚠️  Kjør KUN når BÅDE sitedoc og sitedoc_test er migrert + verifisert (delt volum).`,
    );
    await ryddOriginaler();
    console.log(
      `\n=== Ferdig ===\nSlettet: ${ryddet} · Hoppet (ingen original): ${hoppet} · Feilet: ${feilet}\n`,
    );
    if (!UTFOR) console.log("Dette var en DRY-RUN. Kjør med --rydd-originaler --utfor for å slette.\n");
    return;
  }

  console.log(
    `\n=== Migrering (kopiér-uten-slett): sensitive filer → /uploads/privat/ ===\n` +
      `Modus: ${UTFOR ? "UTFØR (skriver)" : "DRY-RUN (ingen endring — bruk --utfor)"}\n` +
      `UPLOADS_DIR: ${UPLOADS_DIR}`,
  );

  await migrerTimerVedlegg();
  await migrerKompetanseVedlegg();
  await migrerMaskinVedlegg();

  console.log(
    `\n=== Ferdig ===\n` +
      `Kopiert+peker oppdatert: ${flyttet} · Hoppet (allerede privat / ikke /uploads): ${hoppet} · Feilet/manglet: ${feilet}\n` +
      `Originaler beholdt (delt volum). Kjør --rydd-originaler ETTER at begge DB-er er migrert.`,
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

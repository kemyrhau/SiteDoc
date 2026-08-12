/**
 * Engangs-migrering (S1 Fase 1b): flytt BYGGEPLASS-BILDER fra `/uploads/<x>` til
 * `/uploads/privat/<x>` og oppdater ALLE pekere. Bilder ligger to steder:
 *   1. `Image.fileUrl` (flat kolonne)                     — mobil-opplastede bilder
 *   2. `vedlegg[].url` i `checklists.data`/`tasks.data`   — rekursivt (repeater +
 *      attachments-felt), JSON — web + mobil felt-vedlegg
 * Samme fil kan være referert BEGGE steder (28 i_begge i prod) eller kun ett
 * (10 kun_images) — unionen er sannheten, ikke Image-tabellen alene.
 *
 * SØSKENSCRIPT: `migrer-sensitive-filer-til-privat.ts` gjør det samme for S1 Fase 1
 * (timer/kompetanse/maskin-vedlegg). Dette scriptet er Fase 1b (bilder) — eget
 * type-sett, og med et MANIFEST-krav (se under) som søskenet ikke har.
 *
 * 🔴🔴 KOLLISJONSADVARSEL — LES FØR OPPRYDDING:
 * Søskenets opprydding (`migrer-sensitive-filer-til-privat.ts --rydd-originaler`)
 * sletter `/uploads/x` for ENHVER fil som har en privat-tvilling. Etter at DETTE
 * scriptet har kopiert bildene til `privat/`, HAR de en tvilling — så søskenets
 * rydding vil da slette bilde-originalene dine, uten å vite om Fase-1b-
 * verifiseringen er ferdig. Kjør ALDRI søskenets rydding mens denne migreringen
 * pågår eller er uverifisert. Verifiser at den andre S1-migreringen er ferdig og
 * bekreftet før DU rydder — og omvendt. (Ingen kode-kobling mellom dem; denne
 * advarselen er koblingen.)
 *
 * COPY-så-slett (delt uploads-volum test↔prod, jf. søskenscript): kopiér UTEN å
 * slette originalen. Begge stier gyldige gjennom hele operasjonen → null 404-vindu,
 * reversibelt til opprydding. Sekvens per fil: kopiér → verifiser lesbar → oppdater
 * pekere. Sletting av originaler er en SEPARAT, senere fase (--slett-gamle).
 *
 * 🔴 MANIFEST (cowork-krav): `--apply` skriver en manifest-fil med nøyaktig hva som
 * ble kopiert/oppdatert/hoppet over. `--slett-gamle` LESER manifestet og sletter
 * KUN det som står der — reberegner ALDRI unionen (mellom kopi og sletting kan nye
 * bilder ha kommet til / JSON endret / rader slettet; sletting skal skje på samme
 * grunnlag som kopieringen). Manifestet er også Kenneths kvittering.
 *
 * TRE TILSTANDER (prod: union 39 = 28 i_begge + 10 kun_images + 1 foreldreløs):
 *   - fil finnes på disk        → kopiér + oppdater images-peker OG/ELLER JSON-peker
 *   - foreldreløs (fil mangler) → HOPP OVER + rapportér (som eksport `mangler:true`)
 *
 * IDEMPOTENT: `Image.fileUrl`/vedlegg-URL som allerede er privat filtreres bort;
 * kopiering hopper hvis privat-tvillingen finnes. Tom union → manifestet bevares.
 *
 * Bruk (på API-serveren der uploads/ ligger; DATABASE_URL må peke rett miljø):
 *   … migrer-bilder-til-privat.ts                    # dry-run (default)
 *   … migrer-bilder-til-privat.ts --apply            # kopiér + oppdater pekere + skriv manifest
 *   … migrer-bilder-til-privat.ts --slett-gamle      # dry-run opprydding (leser manifest)
 *   … migrer-bilder-til-privat.ts --slett-gamle --apply   # slett originalene i manifestet
 *
 * ⚠️ --slett-gamle KUN etter at sonden (4 curl-former → 401) + innlogget visning +
 *    utskrift er verifisert grønt, og BÅDE sitedoc + sitedoc_test er migrert (delt
 *    volum). ALDRI slett i migreringsfasen. Backup FØR prod-kjøring.
 */

import { join } from "path";
import { access, copyFile, mkdir, unlink, writeFile, readFile } from "fs/promises";
import { prisma, type Prisma } from "@sitedoc/db";

const UPLOADS_DIR = process.env.UPLOADS_DIR || join(process.cwd(), "uploads");
const PREFIKS = "/uploads/";
const PRIVAT_PREFIKS = "/uploads/privat/";

/** DB-navn fra DATABASE_URL (sitedoc / sitedoc_test) — miljø-diskriminator. */
function dbNavn(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? "").pathname.replace(/^\//, "") || "ukjent";
  } catch {
    return "ukjent";
  }
}

// 🔴 Manifestet MÅ ligge i uploads/ — det er det ENESTE som er montert i
// containeren (`docker compose run --rm` sletter resten av container-FS-en, så
// et manifest andre steder er borte før `--slett-gamle` kan lese det). uploads/
// er DELT mellom test og prod, derfor db-navn-suffiks: test og prod overskriver
// ikke hverandres manifest. (uploads/ er gitignorert → ikke i repoet.)
const MANIFEST_STI = join(UPLOADS_DIR, `s1-fase1b-manifest-${dbNavn()}.json`);

const APPLY = process.argv.includes("--apply");
const SLETT_GAMLE = process.argv.includes("--slett-gamle");

function erApen(url: unknown): url is string {
  return typeof url === "string" && url.startsWith(PREFIKS) && !url.startsWith(PRIVAT_PREFIKS);
}
function privatVariant(url: string): string {
  return PRIVAT_PREFIKS + url.slice(PREFIKS.length);
}
function diskSti(url: string): string {
  return join(UPLOADS_DIR, url.slice(PREFIKS.length));
}
async function finnes(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** Rekursivt: samle ethvert `url`-strengfelt (speiler tellings-SQL-ens $.**.url). */
function samleUrler(node: unknown, ut: Set<string>): void {
  if (Array.isArray(node)) {
    node.forEach((n) => samleUrler(n, ut));
  } else if (node !== null && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === "url" && typeof v === "string") ut.add(v);
      else samleUrler(v, ut);
    }
  }
}

/** Rekursivt: bytt `url`-felt som finnes i flyttMap (dyp kopi, muterer ikke). */
function flyttUrler(node: unknown, map: Map<string, string>): unknown {
  if (Array.isArray(node)) return node.map((n) => flyttUrler(n, map));
  if (node !== null && typeof node === "object") {
    const kopi: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      kopi[k] = k === "url" && typeof v === "string" && map.has(v) ? map.get(v)! : flyttUrler(v, map);
    }
    return kopi;
  }
  return node;
}

interface Manifest {
  tidspunkt: string;
  miljo: string;
  kopiert: { apen: string; privat: string }[];
  imagesOppdatert: { apen: string; privat: string; antall: number }[];
  jsonOppdatert: { type: "checklist" | "task"; id: string }[];
  hoppetOver: { apen: string; grunn: string }[];
}

async function slettGamle(): Promise<void> {
  console.log(`Leser manifest: ${MANIFEST_STI} (miljø ${dbNavn()})`);
  let manifest: Manifest;
  try {
    manifest = JSON.parse(await readFile(MANIFEST_STI, "utf-8")) as Manifest;
  } catch {
    console.error(
      `❌ Fant ikke manifestet på ${MANIFEST_STI}. Kjør --apply i DETTE miljøet først ` +
        `(manifestet er db-navn-suffikset og ligger i uploads/). Sletter ingenting.`,
    );
    process.exit(1);
  }
  console.log(`  ${manifest.tidspunkt}, ${manifest.miljo}: ${manifest.kopiert.length} originaler å slette.`);
  let slettet = 0;
  for (const { apen } of manifest.kopiert) {
    if (!APPLY) {
      console.log(`  [dry-run] ville slettet original: ${apen}`);
      continue;
    }
    await unlink(diskSti(apen))
      .then(() => {
        slettet++;
      })
      .catch((e: unknown) => console.warn(`  kunne ikke slette ${apen}: ${(e as Error).message}`));
  }
  console.log(APPLY ? `\nSlettet ${slettet} originaler.` : `\nDry-run: ${manifest.kopiert.length} originaler ville blitt slettet.`);
}

async function main(): Promise<void> {
  if (SLETT_GAMLE) return slettGamle();

  // 1) Union av åpne fil-referanser: images + rekursive vedlegg-URL-er.
  const images = await prisma.image.findMany({
    where: { fileUrl: { startsWith: PREFIKS, not: { startsWith: PRIVAT_PREFIKS } } },
    select: { fileUrl: true },
  });
  const checklists = await prisma.checklist.findMany({ select: { id: true, data: true } });
  const tasks = await prisma.task.findMany({ select: { id: true, data: true } });

  const union = new Set<string>();
  images.forEach((i) => union.add(i.fileUrl));

  const dokMedApen: { type: "checklist" | "task"; id: string; data: Prisma.JsonValue }[] = [];
  for (const c of checklists) {
    const s = new Set<string>();
    samleUrler(c.data, s);
    const apne = [...s].filter(erApen);
    if (apne.length > 0) {
      apne.forEach((u) => union.add(u));
      dokMedApen.push({ type: "checklist", id: c.id, data: c.data });
    }
  }
  for (const t of tasks) {
    const s = new Set<string>();
    samleUrler(t.data, s);
    const apne = [...s].filter(erApen);
    if (apne.length > 0) {
      apne.forEach((u) => union.add(u));
      dokMedApen.push({ type: "task", id: t.id, data: t.data });
    }
  }

  // 2) Disk-sjekk → flyttMap (finnes) / hoppetOver (foreldreløs).
  const flyttMap = new Map<string, string>();
  const hoppetOver: { apen: string; grunn: string }[] = [];
  for (const url of union) {
    if (await finnes(diskSti(url))) flyttMap.set(url, privatVariant(url));
    else hoppetOver.push({ apen: url, grunn: "fil mangler på disk (foreldreløs)" });
  }

  const imgUrler = new Set(images.map((i) => i.fileUrl));
  const vedleggUrler = new Set<string>();
  dokMedApen.forEach((d) => {
    const s = new Set<string>();
    samleUrler(d.data, s);
    [...s].filter(erApen).forEach((u) => vedleggUrler.add(u));
  });
  const iBegge = [...union].filter((u) => imgUrler.has(u) && vedleggUrler.has(u)).length;
  const kunImages = [...union].filter((u) => imgUrler.has(u) && !vedleggUrler.has(u)).length;
  const kunVedlegg = [...union].filter((u) => !imgUrler.has(u) && vedleggUrler.has(u)).length;

  console.log(`\n=== S1 Fase 1b bilde-migrering (${APPLY ? "APPLY" : "DRY-RUN"}) ===`);
  console.log(`Miljø (DB): ${dbNavn()} · manifest-sti: ${MANIFEST_STI}`);
  console.log(`Union åpne fil-referanser: ${union.size}`);
  console.log(`  i_begge: ${iBegge} · kun_images: ${kunImages} · kun_vedlegg: ${kunVedlegg}`);
  console.log(`Finnes på disk (kopieres): ${flyttMap.size} · foreldreløse (hoppes): ${hoppetOver.length}`);
  for (const h of hoppetOver) console.log(`  ⚠️  ${h.apen} — ${h.grunn}`);

  if (!APPLY) {
    console.log(`\nDRY-RUN — ingenting kopiert/skrevet. Kjør med --apply etter gate.`);
    return;
  }

  // 3) Kopiér filer (idempotent — hopper hvis tvilling finnes), verifiser lesbar.
  await mkdir(join(UPLOADS_DIR, "privat"), { recursive: true });
  const kopiert: { apen: string; privat: string }[] = [];
  for (const [apen, privat] of flyttMap) {
    if (!(await finnes(diskSti(privat)))) await copyFile(diskSti(apen), diskSti(privat));
    if (!(await finnes(diskSti(privat)))) {
      console.error(`  ❌ kopi ikke verifiserbar: ${privat}`);
      continue;
    }
    kopiert.push({ apen, privat });
  }

  const kopiertMap = new Map(kopiert.map((k) => [k.apen, k.privat]));

  // 4) Oppdater images.file_url for kopierte.
  const imagesOppdatert: { apen: string; privat: string; antall: number }[] = [];
  for (const { apen, privat } of kopiert) {
    const r = await prisma.image.updateMany({ where: { fileUrl: apen }, data: { fileUrl: privat } });
    if (r.count > 0) imagesOppdatert.push({ apen, privat, antall: r.count });
  }

  // 5) Rekursiv JSONB-rewrite av vedlegg-URL i checklists/tasks (kun kopierte URL-er).
  const jsonOppdatert: { type: "checklist" | "task"; id: string }[] = [];
  for (const d of dokMedApen) {
    const s = new Set<string>();
    samleUrler(d.data, s);
    if (![...s].some((u) => kopiertMap.has(u))) continue;
    const ny = flyttUrler(d.data, kopiertMap) as Prisma.InputJsonValue;
    if (d.type === "checklist") await prisma.checklist.update({ where: { id: d.id }, data: { data: ny } });
    else await prisma.task.update({ where: { id: d.id }, data: { data: ny } });
    jsonOppdatert.push({ type: d.type, id: d.id });
  }

  // 6) Manifest — bevar eksisterende hvis ingenting ble kopiert (idempotent re-run).
  if (kopiert.length === 0) {
    console.log(`\nIngenting kopiert (allerede migrert?) — manifestet ${MANIFEST_STI} bevares urørt.`);
  } else {
    const manifest: Manifest = {
      tidspunkt: new Date().toISOString(),
      miljo: dbNavn(),
      kopiert,
      imagesOppdatert,
      jsonOppdatert,
      hoppetOver,
    };
    await writeFile(MANIFEST_STI, JSON.stringify(manifest, null, 2));
    console.log(`\nManifest skrevet: ${MANIFEST_STI}`);
  }
  console.log(
    `Kopiert ${kopiert.length} · images-pekere oppdatert ${imagesOppdatert.length} · JSON-dok oppdatert ${jsonOppdatert.length} · hoppet ${hoppetOver.length}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

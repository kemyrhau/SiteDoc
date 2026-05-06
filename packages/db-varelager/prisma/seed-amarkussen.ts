/**
 * Engangs-seed for A.Markussen AS varekatalog.
 *
 * Kjøres med (kobling til DB styres av DATABASE_URL):
 *
 *   pnpm --filter @sitedoc/db-varelager exec tsx prisma/seed-amarkussen.ts
 *
 * Idempotent: hver kategori og hver vare sjekkes med findFirst på
 * (organizationId, navn[+enhet]) før INSERT. Re-kjøring oppretter 0 nye rader
 * og overskriver IKKE eksisterende verdier (manuelle pris-justeringer i UI
 * bevares).
 *
 * Default organizationId er A.Markussen AS i prod. Override for test:
 *   SEED_ORG_ID=<uuid> pnpm tsx prisma/seed-amarkussen.ts
 *
 * Forutsetning: Varelager-modul må være aktivert for firmaet via
 * `OrganizationModule(slug="varelager", status="aktiv")` for at radene skal
 * vises i UI. Scriptet sjekker ikke dette — det er kun en datavisnings-
 * forutsetning, ikke en data-integritets-forutsetning.
 *
 * Datakilde: docs/claude/steg-4b-plan.md § 13 (A.Markussen SmartDok-eksport,
 * kartlagt 2026-05-05). 57 varer + 7 kategorier. Heatwork-utleie (6 rader)
 * opprettes manuelt som Equipment per Beslutning 3.
 */

import { prismaVarelager } from "../src";

const ORG_ID =
  process.env.SEED_ORG_ID ?? "4488fe17-7490-409f-9c1c-2827f257c54d"; // A.Markussen AS (prod)

const KATEGORIER = [
  "Grus/pukk/jord",
  "Diverse",
  "Naturstein",
  "Betongstein og elementer",
  "Rør og rørdeler",
  "Deponiavgift",
  "Forbruk",
] as const;

type VareSeed = {
  kategori: (typeof KATEGORIER)[number];
  navn: string;
  varenummer: string | null;
  enhet: string;
  pris: number | null;
};

const VARER: VareSeed[] = [
  // Grus/pukk/jord (36)
  { kategori: "Grus/pukk/jord", navn: "Betong", varenummer: "1", enhet: "m3", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Betong", varenummer: null, enhet: "sekk", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Bærelag 0-22", varenummer: "13", enhet: "m3", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Bærelag 0-22", varenummer: "14", enhet: "tonn", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Jernbanepukk", varenummer: "5", enhet: "m3", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Jernbanepukk", varenummer: "20", enhet: "tonn", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Kabelsand 0-8", varenummer: "10", enhet: "m3", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Kabelsand 0-8", varenummer: "21", enhet: "tonn", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Kult 0-250", varenummer: "6", enhet: "m3", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Kult 0-250", varenummer: "22", enhet: "tonn", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Matjord", varenummer: "2", enhet: "m3", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Matjord", varenummer: "23", enhet: "tonn", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Matjord fra lager Beisfjord", varenummer: "35", enhet: "m3", pris: 100 },
  { kategori: "Grus/pukk/jord", navn: "Natursingel", varenummer: "11", enhet: "m3", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Natursingel", varenummer: "24", enhet: "tonn", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Overskuddsmasser (ren)", varenummer: "7", enhet: "m3", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Overskuddsmasser (ren)", varenummer: "25", enhet: "tonn", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Pukk 0-11", varenummer: "33", enhet: "tonn", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Pukk 0-11", varenummer: "34", enhet: "m3", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Pukk 0-120", varenummer: "31", enhet: "m3", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Pukk 0-120", varenummer: "31", enhet: "tonn", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Pukk 22-120", varenummer: "32", enhet: "m3", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Pukk 22-120", varenummer: "32", enhet: "tonn", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Pukk 22-64", varenummer: "30", enhet: "m3", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Pukk 22-64", varenummer: "30", enhet: "tonn", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Pukk 8-22", varenummer: "4", enhet: "m3", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Pukk 8-22", varenummer: "26", enhet: "tonn", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Salt", varenummer: "12", enhet: "kilo", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Samfengt grus", varenummer: "1", enhet: "m3", pris: 80 },
  { kategori: "Grus/pukk/jord", navn: "Samfengt grus", varenummer: "26", enhet: "tonn", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Snø", varenummer: "9", enhet: "m3", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Snø", varenummer: "27", enhet: "tonn", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Steinmel 0-18", varenummer: "28", enhet: "tonn", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Steinmel 0-18", varenummer: "3", enhet: "m3", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Strøsand", varenummer: "8", enhet: "m3", pris: null },
  { kategori: "Grus/pukk/jord", navn: "Strøsand", varenummer: "29", enhet: "tonn", pris: null },

  // Diverse (7 — «.» utelatt)
  { kategori: "Diverse", navn: "Bark", varenummer: null, enhet: "stk", pris: null },
  { kategori: "Diverse", navn: "Byggegjerde", varenummer: null, enhet: "stk", pris: null },
  { kategori: "Diverse", navn: "Fiberduk", varenummer: null, enhet: "m2", pris: null },
  { kategori: "Diverse", navn: "Gjødsel", varenummer: null, enhet: "sekk", pris: null },
  { kategori: "Diverse", navn: "Heydi Bom Fast 15Kg", varenummer: null, enhet: "sekk", pris: null },
  { kategori: "Diverse", navn: "Heydi KZ Primer", varenummer: null, enhet: "liter", pris: null },
  { kategori: "Diverse", navn: "Kalk", varenummer: null, enhet: "sekk", pris: null },

  // Naturstein (8)
  { kategori: "Naturstein", navn: "Altaskifer", varenummer: "47", enhet: "m2", pris: null },
  { kategori: "Naturstein", navn: "Kantstein 12/30", varenummer: "41", enhet: "meter", pris: null },
  { kategori: "Naturstein", navn: "Kantstein 12/30 buet", varenummer: null, enhet: "meter", pris: null },
  { kategori: "Naturstein", navn: "Murstein Alta", varenummer: "48", enhet: "tonn", pris: null },
  { kategori: "Naturstein", navn: "Platekantstein 30/20", varenummer: "43", enhet: "meter", pris: null },
  { kategori: "Naturstein", navn: "Platekantstein 30/20 buet", varenummer: "44", enhet: "meter", pris: null },
  { kategori: "Naturstein", navn: "Smågatestein 9/11", varenummer: "45", enhet: "m2", pris: null },
  { kategori: "Naturstein", navn: "Storgatestein 14/20/14", varenummer: "46", enhet: "m2", pris: null },

  // Betongstein og elementer (2)
  { kategori: "Betongstein og elementer", navn: "Herregård gråmix helstein", varenummer: "31", enhet: "m2", pris: null },
  { kategori: "Betongstein og elementer", navn: "New Jersey element 2m", varenummer: "32", enhet: "stk", pris: null },

  // Rør og rørdeler (2)
  { kategori: "Rør og rørdeler", navn: "PVC RØR", varenummer: null, enhet: "stk", pris: null },
  { kategori: "Rør og rørdeler", navn: "PVC RØRDELER", varenummer: null, enhet: "meter", pris: null },

  // Deponiavgift (1)
  { kategori: "Deponiavgift", navn: "Deponiavgift", varenummer: "666", enhet: "tonn", pris: null },

  // Forbruk (1)
  { kategori: "Forbruk", navn: "Fugesand", varenummer: null, enhet: "sekk", pris: null },
];

async function seedKategorier(): Promise<Map<string, string>> {
  const navnTilId = new Map<string, string>();
  let opprettet = 0;
  let eksisterte = 0;

  for (const navn of KATEGORIER) {
    const eks = await prismaVarelager.vareKategori.findFirst({
      where: { organizationId: ORG_ID, navn },
      select: { id: true },
    });
    if (eks) {
      navnTilId.set(navn, eks.id);
      eksisterte += 1;
      continue;
    }
    const ny = await prismaVarelager.vareKategori.create({
      data: { organizationId: ORG_ID, navn },
      select: { id: true },
    });
    navnTilId.set(navn, ny.id);
    opprettet += 1;
  }

  console.log(`Kategorier: ${opprettet} opprettet, ${eksisterte} eksisterte`);
  return navnTilId;
}

async function seedVarer(katMap: Map<string, string>): Promise<void> {
  let opprettet = 0;
  let eksisterte = 0;
  let manglerKategori = 0;

  for (const v of VARER) {
    const kategoriId = katMap.get(v.kategori);
    if (!kategoriId) {
      console.warn(
        `  ⚠️  Mangler kategori-id for «${v.kategori}» — hopper over «${v.navn}»`,
      );
      manglerKategori += 1;
      continue;
    }

    const eks = await prismaVarelager.vare.findFirst({
      where: { organizationId: ORG_ID, navn: v.navn, enhet: v.enhet },
      select: { id: true },
    });
    if (eks) {
      eksisterte += 1;
      continue;
    }

    await prismaVarelager.vare.create({
      data: {
        organizationId: ORG_ID,
        navn: v.navn,
        varenummer: v.varenummer,
        enhet: v.enhet,
        pris: v.pris,
        internkostnad: null,
        kategoriId,
      },
    });
    opprettet += 1;
  }

  console.log(
    `Varer: ${opprettet} opprettet, ${eksisterte} eksisterte` +
      (manglerKategori > 0 ? `, ${manglerKategori} hoppet over` : ""),
  );
}

async function main(): Promise<void> {
  console.log(`Seeder Varelager for organizationId=${ORG_ID}`);
  console.log(`(Bruk SEED_ORG_ID-env for å overstyre.)`);
  console.log();

  const katMap = await seedKategorier();
  await seedVarer(katMap);

  console.log();
  console.log("Ferdig.");
  console.log(
    "ℹ️  Husk å aktivere Varelager-modulen for firmaet via /dashbord/firma/moduler",
  );
  console.log(
    "   (eller via OrganizationModule-tabellen) hvis det ikke allerede er gjort —",
  );
  console.log("   ellers vises ikke radene i UI.");
}

main()
  .catch((e) => {
    console.error("Seed feilet:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prismaVarelager.$disconnect();
  });

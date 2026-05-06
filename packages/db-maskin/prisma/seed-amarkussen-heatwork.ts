/**
 * Engangs-seed for A.Markussens 5 Heatwork-utleie-Equipment-rader.
 *
 * Bakgrunn: Heatwork-radene i SmartDok-varekatalogen ble utelatt fra
 * vareforbruk-seed (Beslutning 3 i steg-4b-plan.md — utleie-utstyr hører
 * hjemme i Maskinregisteret med erUtleieobjekt=true). Dette scriptet
 * oppretter de 5 manglende Equipment-radene direkte mot prod-DB i påvente
 * av U6-fix (sitedoc_admin firma-kontekst i UI).
 *
 * Kjøres med:
 *   pnpm --filter @sitedoc/db-maskin exec tsx prisma/seed-amarkussen-heatwork.ts
 *
 * Idempotent: hver rad sjekkes med findFirst på (organizationId, internNummer)
 * før INSERT. Re-kjøring oppretter 0 nye rader.
 *
 * Default ORG_ID = A.Markussen AS (prod). Override:
 *   SEED_ORG_ID=<uuid> pnpm tsx prisma/seed-amarkussen-heatwork.ts
 */

import { prismaMaskin } from "../src";

const ORG_ID =
  process.env.SEED_ORG_ID ?? "4488fe17-7490-409f-9c1c-2827f257c54d"; // A.Markussen AS (prod)

const NOTATER =
  "Heatwork-henger med kjele. Utleieobjekt — registreres per døgn på dagsseddel.";

type HeatworkSeed = {
  internNummer: string;
  type: string;
  internNavn: string;
};

const RADER: HeatworkSeed[] = [
  { internNummer: "7626", type: "Heatwork 3600", internNavn: "Heatwork 7626" },
  { internNummer: "7628", type: "Heatwork 3600", internNavn: "Heatwork 7628" },
  { internNummer: "7630", type: "Heatwork 3600", internNavn: "Heatwork 7630" },
  { internNummer: "7632", type: "Heatwork 3600", internNavn: "Heatwork 7632" },
  { internNummer: "7634", type: "Heatwork MY35", internNavn: "Heatwork 7634" },
];

async function main(): Promise<void> {
  console.log(`Seeder Heatwork-utleie for organizationId=${ORG_ID}`);
  console.log("(Bruk SEED_ORG_ID-env for å overstyre.)");
  console.log();

  let opprettet = 0;
  let eksisterte = 0;

  for (const rad of RADER) {
    const eks = await prismaMaskin.equipment.findFirst({
      where: { organizationId: ORG_ID, internNummer: rad.internNummer },
      select: { id: true },
    });
    if (eks) {
      eksisterte += 1;
      continue;
    }

    await prismaMaskin.equipment.create({
      data: {
        organizationId: ORG_ID,
        kategori: "smautstyr",
        type: rad.type,
        internNavn: rad.internNavn,
        internNummer: rad.internNummer,
        eierskap: "eid",
        status: "tilgjengelig",
        notater: NOTATER,
        erUtleieobjekt: true,
        utleieEnhet: "doegn",
      },
    });
    opprettet += 1;
  }

  console.log(`Heatwork-rader: ${opprettet} opprettet, ${eksisterte} eksisterte`);
  console.log();
  console.log("Ferdig.");
  console.log(
    "ℹ️  Utleiepris (utleieprisPerDogn) settes manuelt i UI når den er fastsatt.",
  );
}

main()
  .catch((e) => {
    console.error("Seed feilet:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prismaMaskin.$disconnect();
  });

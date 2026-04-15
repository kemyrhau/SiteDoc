/**
 * Seed: Sjekklistebibliotek — NS 3420-K:2024 Anleggsgartnerarbeider
 *
 * Kjør: npx tsx prisma/seed-bibliotek.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Hjelpefunksjon for feltdefinisjon
interface FeltDef {
  label: string;
  type: "traffic_light" | "decimal" | "attachments" | "text_field";
  zone: "topptekst" | "datafelter";
  fase?: string;
  config?: Record<string, unknown>;
}

function felt(
  label: string,
  type: FeltDef["type"],
  fase: string,
  config: Record<string, unknown> = {},
): FeltDef {
  return { label, type, zone: "datafelter", fase, config };
}

function trafikklysMedVedlegg(label: string, fase: string): FeltDef[] {
  return [
    felt(label, "traffic_light", fase),
    felt(`${label} — vedlegg`, "attachments", fase),
  ];
}

async function main() {
  console.log("Seeder sjekklistebibliotek...");

  // Opprett standard
  const standard = await prisma.bibliotekStandard.upsert({
    where: { kode: "NS3420-K" },
    update: { navn: "NS 3420-K:2024 Anleggsgartnerarbeider" },
    create: {
      kode: "NS3420-K",
      navn: "NS 3420-K:2024 Anleggsgartnerarbeider",
      sortering: 1,
    },
  });

  // Kapitler
  const kapitler = [
    { kode: "KA", navn: "Innledende arbeider", sortering: 1 },
    { kode: "KB", navn: "Jord og vegetasjon", sortering: 2 },
    { kode: "KC", navn: "Vanningsanlegg, sikring og beskyttelse", sortering: 3 },
    { kode: "KD", navn: "Utendørsbelegg, kanter, renner", sortering: 4 },
  ];

  const kapittelMap: Record<string, string> = {};
  for (const k of kapitler) {
    const kap = await prisma.bibliotekKapittel.upsert({
      where: { id: `seed-${standard.id}-${k.kode}` },
      update: { navn: k.navn, sortering: k.sortering },
      create: {
        id: `seed-${standard.id}-${k.kode}`,
        kode: k.kode,
        navn: k.navn,
        sortering: k.sortering,
        standardId: standard.id,
      },
    });
    kapittelMap[k.kode] = kap.id;
  }

  // Maler med feltdefinisjoner
  const maler: Array<{
    kapittelKode: string;
    navn: string;
    referanse: string;
    beskrivelse?: string;
    felter: FeltDef[];
  }> = [
    {
      kapittelKode: "KA",
      navn: "KA7 – Forberedende arbeider ved gjenbruk",
      referanse: "KA7",
      beskrivelse: "Kontroll av forberedende arbeider ved gjenbruk av materialer",
      felter: [
        felt("Materialer sortert og godkjent for gjenbruk", "traffic_light", "FØR"),
        felt("Dokumentasjon på materialenes opprinnelse", "traffic_light", "FØR"),
        ...trafikklysMedVedlegg("Lagringsplass godkjent", "FØR"),
        felt("Materialer rengjort før gjenbruk", "traffic_light", "UNDER"),
      ],
    },
    {
      kapittelKode: "KB",
      navn: "KB2.2 – Jordarbeider – utlegging av eksterne masser",
      referanse: "KB2.2 / KB2.5",
      beskrivelse: "Kontroll av jordarbeider ved utlegging av eksterne masser",
      felter: [
        felt("Underlag kontrollert", "traffic_light", "FØR"),
        felt("Leveringsdokument OK", "traffic_light", "FØR"),
        felt("Lagtykkelse vekstjord", "decimal", "UNDER", { enhet: "cm", min: 20 }),
        felt("Ingen komprimering av vekstjord", "traffic_light", "UNDER"),
        felt("Planhet – avvik fra planlagt nivå", "decimal", "ETTER", { enhet: "mm", toleranse: 30 }),
        ...trafikklysMedVedlegg("Fritt for stein >30 mm", "ETTER"),
        felt("Ugrasbekjempelse utført", "traffic_light", "ETTER"),
      ],
    },
    {
      kapittelKode: "KB",
      navn: "KB4 – Grasdekke – etablering og kontroll",
      referanse: "KB4",
      beskrivelse: "Kontroll av grasdekke – etablering, vedlikehold og overtakelse",
      felter: [
        felt("Frøblanding/rullegress dokumentert", "traffic_light", "FØR"),
        ...trafikklysMedVedlegg("Jordlag løsgjort og finplanert", "FØR"),
        felt("Fall/helning kontrollert", "decimal", "FØR", { enhet: "%", min: 2.0 }),
        ...trafikklysMedVedlegg("God kontakt frø/plen mot jord", "UNDER"),
        felt("Vannet etter legging/såing", "traffic_light", "UNDER"),
        felt("Markdekningsgrad", "decimal", "ETTER", { enhet: "%", min: 95 }),
        ...trafikklysMedVedlegg("Klippet jevnlig frem til overtakelse", "ETTER"),
      ],
    },
    {
      kapittelKode: "KB",
      navn: "KB6 – Planting – trær, busker og stauder",
      referanse: "KB6 / KB6.1",
      beskrivelse: "Kontroll av planting – trær, busker, stauder og dekkvekster",
      felter: [
        felt("Planter i henhold til NS 4400", "traffic_light", "FØR"),
        felt("Planter saftspente og fuktige ved ankomst", "traffic_light", "FØR"),
        ...trafikklysMedVedlegg("Plantehull riktig dimensjon", "FØR"),
        ...trafikklysMedVedlegg("Rothalsen over jordoverflate", "UNDER"),
        felt("God kontakt rot og jord", "traffic_light", "UNDER"),
        felt("Rotbløyte utført", "traffic_light", "UNDER"),
        ...trafikklysMedVedlegg("Plantefelt fritt for ugras", "ETTER"),
        felt("Oppbinding og støtte montert", "traffic_light", "ETTER"),
      ],
    },
    {
      kapittelKode: "KC",
      navn: "KC3.1 – Oppstøtting og oppbinding av trær",
      referanse: "KC3.1",
      beskrivelse: "Kontroll av oppstøtting og oppbinding av trær",
      felter: [
        felt("Støttetype i henhold til spesifikasjon", "traffic_light", "FØR"),
        ...trafikklysMedVedlegg("Støtte plassert korrekt", "UNDER"),
        felt("Bindmateriale skadefritt for bark", "traffic_light", "UNDER"),
        ...trafikklysMedVedlegg("Kontrollert etter 1 sesong", "ETTER"),
      ],
    },
    {
      kapittelKode: "KD",
      navn: "KD1 – Utendørsbelegg – legging og kontroll",
      referanse: "KD1 / Tabell K11 / Tabell K12",
      beskrivelse: "Kontroll av utendørsbelegg – belegningsstein, heller, asfalt",
      felter: [
        ...trafikklysMedVedlegg("Underlag kontrollert og komprimert", "FØR"),
        felt("Belegningstype som spesifisert", "traffic_light", "FØR"),
        felt("Fall gangarealer", "decimal", "UNDER", { enhet: "%", min: 2.0 }),
        felt("Fall kjørearealer", "decimal", "UNDER", { enhet: "%", min: 2.5 }),
        ...trafikklysMedVedlegg("Fuger rette linjer/jevne kurver", "UNDER"),
        felt("Planhet over 3m – gangarealer", "decimal", "ETTER", { enhet: "mm", toleranse: 3 }),
        felt("Vertikalt sprang ved fuger", "decimal", "ETTER", { enhet: "mm", maks: 2 }),
      ],
    },
  ];

  for (const mal of maler) {
    const kapittelId = kapittelMap[mal.kapittelKode];
    if (!kapittelId) {
      console.error(`Kapittel ${mal.kapittelKode} ikke funnet, hopper over ${mal.navn}`);
      continue;
    }

    // malInnhold: liste over feltdefinisjoner med sortOrder
    const malInnhold = mal.felter.map((f, i) => ({
      ...f,
      sortOrder: i + 1,
    }));

    await prisma.bibliotekMal.upsert({
      where: { id: `seed-${kapittelId}-${mal.referanse.replace(/[\s\/]/g, "-")}` },
      update: {
        navn: mal.navn,
        referanse: mal.referanse,
        beskrivelse: mal.beskrivelse ?? null,
        malInnhold,
      },
      create: {
        id: `seed-${kapittelId}-${mal.referanse.replace(/[\s\/]/g, "-")}`,
        kapittelId,
        navn: mal.navn,
        referanse: mal.referanse,
        beskrivelse: mal.beskrivelse ?? null,
        malInnhold,
      },
    });

    console.log(`  ✓ ${mal.navn}`);
  }

  console.log("Ferdig! Seedet NS 3420-K med", maler.length, "maler.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

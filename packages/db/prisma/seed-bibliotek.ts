/**
 * Seed: Sjekklistebibliotek — NS 3420-K:2024 Anleggsgartnerarbeider
 *
 * Kjør: npx tsx prisma/seed-bibliotek.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface FeltDef {
  label: string;
  type: "traffic_light" | "decimal" | "list_single" | "heading";
  zone: "topptekst" | "datafelter";
  fase?: string;
  config?: Record<string, unknown>;
}

function felt(label: string, type: FeltDef["type"], fase: string, config: Record<string, unknown> = {}): FeltDef {
  return { label, type, zone: "datafelter", fase, config };
}

function valg(label: string, fase: string, options: string[], helpText?: string): FeltDef {
  return felt(label, "list_single", fase, { options, ...(helpText ? { helpText } : {}) });
}

function trafikklys(label: string, fase: string, helpText?: string): FeltDef {
  return felt(label, "traffic_light", fase, helpText ? { helpText } : {});
}

function desimal(label: string, fase: string, config: Record<string, unknown>, helpText?: string): FeltDef {
  return felt(label, "decimal", fase, { ...config, ...(helpText ? { helpText } : {}) });
}

async function main() {
  console.log("Seeder sjekklistebibliotek...");

  await prisma.prosjektBibliotekValg.deleteMany({});
  await prisma.bibliotekMal.deleteMany({});
  await prisma.bibliotekKapittel.deleteMany({});
  await prisma.bibliotekStandard.deleteMany({});

  const standard = await prisma.bibliotekStandard.create({
    data: { kode: "NS3420-K", navn: "NS 3420-K:2024 Anleggsgartnerarbeider", sortering: 1 },
  });

  const kapittelData = [
    { kode: "KA", navn: "Innledende arbeider", sortering: 1 },
    { kode: "KB", navn: "Jord og vegetasjon", sortering: 2 },
    { kode: "KC", navn: "Vanningsanlegg, sikring og beskyttelse", sortering: 3 },
    { kode: "KD", navn: "Utendørsbelegg, kanter, renner", sortering: 4 },
  ];

  const kap: Record<string, string> = {};
  for (const k of kapittelData) {
    const o = await prisma.bibliotekKapittel.create({ data: { ...k, standardId: standard.id } });
    kap[k.kode] = o.id;
  }

  const maler: Array<{
    kapittelKode: string;
    navn: string;
    referanse: string;
    beskrivelse?: string;
    felter: FeltDef[];
  }> = [
    {
      kapittelKode: "KA",
      navn: "KA7 – Gjenbruk av materialer",
      referanse: "KA7",
      beskrivelse: "Kontroll ved gjenbruk av materialer",
      felter: [
        valg("Materialstatus", "FØR",
          ["Sortert og godkjent", "Delvis sortert", "Ikke sortert", "Uegnet"],
          "KA7: Materialer for gjenbruk skal sorteres og godkjennes. Dokumenter opprinnelse."),
        trafikklys("Dokumentasjon på opprinnelse", "FØR"),
        trafikklys("Lagringsplass godkjent", "FØR"),
        trafikklys("Materialer rengjort", "UNDER"),
      ],
    },
    {
      kapittelKode: "KB",
      navn: "KB2 – Jordarbeider",
      referanse: "KB2.2",
      beskrivelse: "Utlegging av eksterne masser",
      felter: [
        valg("Underlagskontroll", "FØR",
          ["Godkjent – jevnt og drenert", "Godkjent med merknad", "Ikke godkjent – krever utbedring"],
          "KB2: Underlag skal kontrolleres og dokumenteres før utlegging av vekstjord."),
        trafikklys("Leveringsdokument kontrollert", "FØR"),
        desimal("Lagtykkelse vekstjord (cm)", "UNDER", { enhet: "cm", min: 20 },
          "KB2.2: Minimum 20 cm. Mål på minst 3 representative punkter."),
        valg("Komprimering", "UNDER",
          ["Ingen komprimering (OK)", "Lett komprimering påkrevd", "Feil: komprimert – må løsgjøres"],
          "Vekstjord skal IKKE komprimeres. Komprimering ødelegger jordstruktur."),
        desimal("Planhet – avvik (mm)", "ETTER", { enhet: "mm", toleranse: 30 },
          "KB2.5 Tabell K4: Avvik fra planlagt nivå maks ±30 mm."),
        trafikklys("Fritt for stein >30 mm", "ETTER"),
        trafikklys("Ugrasbekjempelse utført", "ETTER"),
      ],
    },
    {
      kapittelKode: "KB",
      navn: "KB4 – Grasdekke",
      referanse: "KB4",
      beskrivelse: "Etablering, vedlikehold og overtakelse",
      felter: [
        valg("Type grasetablering", "FØR",
          ["Såing med dokumentert frøblanding", "Rullegress", "Ferdigplen", "Annet"],
          "KB4: Frøblanding eller type rullegress skal dokumenteres."),
        trafikklys("Jordlag løsgjort og finplanert", "FØR"),
        desimal("Fall/helning (%)", "FØR", { enhet: "%", min: 2.0 },
          "Minimum 2 % fall for drenering."),
        trafikklys("God kontakt frø/plen mot jord", "UNDER"),
        trafikklys("Vannet etter legging/såing", "UNDER"),
        desimal("Markdekningsgrad (%)", "ETTER", { enhet: "%", min: 95 },
          "KB4 c4: Minimum 95 % markdekningsgrad ved overtakelse."),
        trafikklys("Klippet jevnlig frem til overtakelse", "ETTER"),
      ],
    },
    {
      kapittelKode: "KB",
      navn: "KB6 – Planting",
      referanse: "KB6",
      beskrivelse: "Trær, busker og stauder",
      felter: [
        valg("Plantekvalitet", "FØR",
          ["Iht. NS 4400 – godkjent", "Avvik fra NS 4400 – dokumentert", "Underkjent"],
          "KB6: Planter skal tilfredsstille NS 4400. Kontroller saftspente og fuktige."),
        trafikklys("Saftspente og fuktige ved ankomst", "FØR"),
        valg("Plantehull", "FØR",
          ["Riktig dimensjon (2× rotklump)", "For lite – utvides", "For stort – fylles"]),
        trafikklys("Rothalsen over jordoverflate", "UNDER",
          "KB6.1 c1: Rothalsen skal ligge over jordoverflaten etter planting og setting av jord."),
        trafikklys("God kontakt rot og jord", "UNDER"),
        trafikklys("Rotbløyte utført", "UNDER"),
        trafikklys("Plantefelt fritt for ugras", "ETTER"),
        trafikklys("Oppbinding/støtte montert", "ETTER", "Ref. KC3.1 for krav til oppstøtting."),
      ],
    },
    {
      kapittelKode: "KC",
      navn: "KC3.1 – Oppstøtting av trær",
      referanse: "KC3.1",
      beskrivelse: "Oppstøtting og oppbinding",
      felter: [
        valg("Støttetype", "FØR",
          ["Trestøtte 1-punkt", "Trestøtte 2-punkt", "Wirestøtte", "Jordanker", "Annet"],
          "KC3.1: Støttetype skal være iht. spesifikasjon."),
        trafikklys("Støtte plassert korrekt", "UNDER"),
        trafikklys("Bindmateriale skadefritt for bark", "UNDER",
          "Bindmateriale skal ikke skade barken. Bruk myk stropp eller gummibeskyttelse."),
        trafikklys("Kontrollert etter 1 sesong", "ETTER"),
      ],
    },
    {
      kapittelKode: "KD",
      navn: "KD1 – Utendørsbelegg",
      referanse: "KD1",
      beskrivelse: "Legging og kontroll av belegning",
      felter: [
        valg("Underlagskontroll", "FØR",
          ["Komprimert og godkjent", "Komprimert med merknad", "Ikke tilstrekkelig – avvik"],
          "KD1: Underlag skal komprimeres og kontrolleres før legging."),
        valg("Belegningstype", "FØR",
          ["Belegningsstein", "Heller", "Asfalt", "Annet"],
          "Kontroller at type stemmer med spesifikasjon."),
        desimal("Fall gangarealer (%)", "UNDER", { enhet: "%", min: 2.0 },
          "Tabell K11: Gangarealer minimum 2,0 % fall."),
        desimal("Fall kjørearealer (%)", "UNDER", { enhet: "%", min: 2.5 },
          "Tabell K11: Kjørearealer minimum 2,5 % fall."),
        trafikklys("Fuger – rette linjer/jevne kurver", "UNDER", "KD1 c5: Fuger skal ha rette linjer og jevne kurver."),
        desimal("Planhet over 3 m (mm)", "ETTER", { enhet: "mm", toleranse: 3 },
          "Tabell K12: Gangarealer ±3 mm over 3 m rettholt."),
        desimal("Vertikalt sprang ved fuger (mm)", "ETTER", { enhet: "mm", maks: 2 },
          "Tabell K12: Maks 2 mm vertikalt sprang ved fuger."),
      ],
    },
  ];

  for (const mal of maler) {
    const kapittelId = kap[mal.kapittelKode]!;
    const malInnhold = mal.felter.map((f, i) => ({ ...f, sortOrder: i + 1 }));
    await prisma.bibliotekMal.create({
      data: { kapittelId, navn: mal.navn, referanse: mal.referanse, beskrivelse: mal.beskrivelse ?? null, malInnhold },
    });
    console.log(`  ✓ ${mal.navn}`);
  }

  console.log("Ferdig!", maler.length, "maler.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

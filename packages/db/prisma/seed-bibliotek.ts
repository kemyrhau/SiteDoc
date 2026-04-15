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
  type: "traffic_light" | "decimal" | "list_single" | "text_field" | "info_text" | "heading";
  zone: "topptekst" | "datafelter";
  fase?: string;
  config?: Record<string, unknown>;
}

function felt(label: string, type: FeltDef["type"], fase: string, config: Record<string, unknown> = {}): FeltDef {
  return { label, type, zone: "datafelter", fase, config };
}

function info(tekst: string, fase: string): FeltDef {
  return { label: tekst, type: "info_text", zone: "datafelter", fase, config: {} };
}

function valg(label: string, fase: string, options: string[]): FeltDef {
  return felt(label, "list_single", fase, { options });
}

async function main() {
  console.log("Seeder sjekklistebibliotek...");

  // Slett eksisterende data for ren re-seed
  await prisma.prosjektBibliotekValg.deleteMany({});
  await prisma.bibliotekMal.deleteMany({});
  await prisma.bibliotekKapittel.deleteMany({});
  await prisma.bibliotekStandard.deleteMany({});

  const standard = await prisma.bibliotekStandard.create({
    data: {
      kode: "NS3420-K",
      navn: "NS 3420-K:2024 Anleggsgartnerarbeider",
      sortering: 1,
    },
  });

  // Kapitler
  const kapittelData = [
    { kode: "KA", navn: "Innledende arbeider", sortering: 1 },
    { kode: "KB", navn: "Jord og vegetasjon", sortering: 2 },
    { kode: "KC", navn: "Vanningsanlegg, sikring og beskyttelse", sortering: 3 },
    { kode: "KD", navn: "Utendørsbelegg, kanter, renner", sortering: 4 },
  ];

  const kap: Record<string, string> = {};
  for (const k of kapittelData) {
    const opprettet = await prisma.bibliotekKapittel.create({
      data: { ...k, standardId: standard.id },
    });
    kap[k.kode] = opprettet.id;
  }

  // ──── Maler ────

  const maler: Array<{
    kapittelKode: string;
    navn: string;
    referanse: string;
    beskrivelse?: string;
    felter: FeltDef[];
  }> = [
    // ── KA7 ──
    {
      kapittelKode: "KA",
      navn: "KA7 – Forberedende arbeider ved gjenbruk",
      referanse: "KA7",
      beskrivelse: "Kontroll av gjenbruksmaterialer iht. NS 3420-K KA7",
      felter: [
        info("NS 3420-K KA7: Ved gjenbruk av materialer skal det dokumenteres at materialene er egnet for formålet. Sortering, rengjøring og lagring skal kontrolleres.", "FØR"),
        valg("Materialstatus", "FØR", ["Sortert og godkjent", "Delvis sortert", "Ikke sortert", "Uegnet for gjenbruk"]),
        felt("Dokumentasjon på opprinnelse", "traffic_light", "FØR"),
        felt("Lagringsplass godkjent", "traffic_light", "FØR"),
        felt("Materialer rengjort", "traffic_light", "UNDER"),
      ],
    },

    // ── KB2.2 ──
    {
      kapittelKode: "KB",
      navn: "KB2 – Jordarbeider – utlegging av masser",
      referanse: "KB2.2 / KB2.5",
      beskrivelse: "Kontroll av jordarbeider ved utlegging av eksterne masser",
      felter: [
        info("NS 3420-K KB2: Vekstjord skal legges ut i riktig tykkelse uten komprimering. Krav til planhet ±30 mm. Underlag skal være kontrollert og dokumentert før utlegging.", "FØR"),
        valg("Underlagskontroll", "FØR", ["Godkjent – jevnt og drenert", "Godkjent med merknad", "Ikke godkjent – krever utbedring"]),
        felt("Leveringsdokument kontrollert", "traffic_light", "FØR"),
        info("Lagtykkelse vekstjord: minimum 20 cm iht. KB2.2. Mål på minst 3 representative punkter.", "UNDER"),
        felt("Lagtykkelse vekstjord (cm)", "decimal", "UNDER", { enhet: "cm", min: 20 }),
        valg("Komprimering", "UNDER", ["Ingen komprimering utført (OK)", "Lett komprimering påkrevd", "Feil: komprimert – må løsgjøres"]),
        info("Planhet: avvik fra planlagt nivå maks ±30 mm iht. KB2.5 Tabell K4.", "ETTER"),
        felt("Planhet – avvik fra nivå (mm)", "decimal", "ETTER", { enhet: "mm", toleranse: 30 }),
        valg("Steinfritt", "ETTER", ["Fritt for stein >30 mm", "Noe stein funnet – fjernet", "Stein >30 mm gjenstår – avvik"]),
        felt("Ugrasbekjempelse utført", "traffic_light", "ETTER"),
      ],
    },

    // ── KB4 ──
    {
      kapittelKode: "KB",
      navn: "KB4 – Grasdekke – etablering og kontroll",
      referanse: "KB4",
      beskrivelse: "Kontroll av grasetablering, vedlikehold og markdekningsgrad",
      felter: [
        info("NS 3420-K KB4: Frøblanding eller rullegress skal dokumenteres. Jordlaget skal løsgjøres og finplaneres med fall ≥2 %. Markdekningsgrad ≥95 % ved overtakelse.", "FØR"),
        valg("Type grasetablering", "FØR", ["Såing med dokumentert frøblanding", "Rullegress", "Ferdigplen", "Annet – spesifiser i kommentar"]),
        felt("Jordlag løsgjort og finplanert", "traffic_light", "FØR"),
        felt("Fall/helning (%)", "decimal", "FØR", { enhet: "%", min: 2.0 }),
        felt("God kontakt frø/plen mot jord", "traffic_light", "UNDER"),
        felt("Vannet etter legging/såing", "traffic_light", "UNDER"),
        info("Markdekningsgrad: minimum 95 % iht. KB4 c4. Bedøm visuelt eller ved prøverute.", "ETTER"),
        felt("Markdekningsgrad (%)", "decimal", "ETTER", { enhet: "%", min: 95 }),
        felt("Klippet jevnlig frem til overtakelse", "traffic_light", "ETTER"),
      ],
    },

    // ── KB6 ──
    {
      kapittelKode: "KB",
      navn: "KB6 – Planting – trær, busker og stauder",
      referanse: "KB6 / KB6.1",
      beskrivelse: "Kontroll av planting iht. NS 4400 og NS 3420-K KB6",
      felter: [
        info("NS 3420-K KB6: Planter skal tilfredsstille NS 4400. Kontroller at planter er saftspente og fuktige. Rothalsen skal ligge over jordoverflaten (KB6.1 c1). Oppbinding ref. KC3.1.", "FØR"),
        valg("Plantekvalitet", "FØR", ["Iht. NS 4400 – godkjent", "Avvik fra NS 4400 – dokumentert", "Underkjent – returneres"]),
        felt("Saftspente og fuktige ved ankomst", "traffic_light", "FØR"),
        valg("Plantehull dimensjon", "FØR", ["Riktig dimensjon (2× rotklump)", "For lite – utvides", "For stort – fylles"]),
        info("KB6.1 c1: Rothalsen skal ligge over jordoverflaten etter planting og setting av jord.", "UNDER"),
        felt("Rothalsen over jordoverflate", "traffic_light", "UNDER"),
        felt("God kontakt rot og jord", "traffic_light", "UNDER"),
        felt("Rotbløyte utført", "traffic_light", "UNDER"),
        felt("Plantefelt fritt for ugras", "traffic_light", "ETTER"),
        felt("Oppbinding/støtte montert (ref. KC3.1)", "traffic_light", "ETTER"),
      ],
    },

    // ── KC3.1 ──
    {
      kapittelKode: "KC",
      navn: "KC3.1 – Oppstøtting og oppbinding av trær",
      referanse: "KC3.1",
      beskrivelse: "Kontroll av støtte og oppbinding for trær",
      felter: [
        info("NS 3420-K KC3.1: Støttetype skal være iht. spesifikasjon. Bindmateriale skal ikke skade barken. Kontroller etter 1 sesong.", "FØR"),
        valg("Støttetype", "FØR", ["Trestøtte 1-punkt", "Trestøtte 2-punkt", "Wirestøtte", "Jordanker", "Annet – spesifiser"]),
        felt("Støtte plassert korrekt", "traffic_light", "UNDER"),
        felt("Bindmateriale skadefritt for bark", "traffic_light", "UNDER"),
        felt("Kontrollert etter 1 sesong", "traffic_light", "ETTER"),
      ],
    },

    // ── KD1 ──
    {
      kapittelKode: "KD",
      navn: "KD1 – Utendørsbelegg – legging og kontroll",
      referanse: "KD1 / Tabell K11 / K12",
      beskrivelse: "Kontroll av belegningsstein, heller og asfalt iht. NS 3420-K KD1",
      felter: [
        info("NS 3420-K KD1: Underlag skal komprimeres og kontrolleres. Fall: gangarealer ≥2 %, kjørearealer ≥2,5 % (Tabell K11). Planhet over 3 m: ±3 mm gangarealer (Tabell K12). Vertikalt sprang ved fuger: maks 2 mm.", "FØR"),
        valg("Underlagskontroll", "FØR", ["Komprimert og godkjent", "Komprimert med merknad", "Ikke tilstrekkelig komprimert – avvik"]),
        valg("Belegningstype", "FØR", ["Belegningsstein iht. spesifikasjon", "Heller iht. spesifikasjon", "Asfalt iht. spesifikasjon", "Avvik fra spesifikasjon – dokumentert"]),
        info("Tabell K11 – Krav til fall: Gangarealer min 2,0 %, kjørearealer min 2,5 %.", "UNDER"),
        felt("Fall gangarealer (%)", "decimal", "UNDER", { enhet: "%", min: 2.0 }),
        felt("Fall kjørearealer (%)", "decimal", "UNDER", { enhet: "%", min: 2.5 }),
        felt("Fuger – rette linjer/jevne kurver", "traffic_light", "UNDER"),
        info("Tabell K12 – Planhet og sprang: Gangarealer ±3 mm over 3 m rettholt. Vertikalt sprang ved fuger maks 2 mm.", "ETTER"),
        felt("Planhet over 3 m – gangarealer (mm)", "decimal", "ETTER", { enhet: "mm", toleranse: 3 }),
        felt("Vertikalt sprang ved fuger (mm)", "decimal", "ETTER", { enhet: "mm", maks: 2 }),
      ],
    },
  ];

  for (const mal of maler) {
    const kapittelId = kap[mal.kapittelKode]!;
    const malInnhold = mal.felter.map((f, i) => ({ ...f, sortOrder: i + 1 }));

    await prisma.bibliotekMal.create({
      data: {
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
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

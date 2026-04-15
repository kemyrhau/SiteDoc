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
    // ── KA7 ──
    {
      kapittelKode: "KA",
      navn: "KA7 – Gjenbruk av materialer",
      referanse: "KA7",
      beskrivelse: "Kontroll ved gjenbruk av materialer",
      felter: [
        valg("Materialstatus", "FØR",
          ["Sortert og godkjent", "Delvis sortert", "Ikke sortert", "Uegnet"],
          "KA7: Materialer for gjenbruk skal sorteres, rengjøres og godkjennes. Dokumenter opprinnelse."),
        trafikklys("Dokumentasjon på opprinnelse", "FØR"),
        trafikklys("Lagringsplass godkjent", "FØR"),
        trafikklys("Materialer rengjort", "UNDER"),
      ],
    },

    // ── KB2 – Jordarbeider ──
    {
      kapittelKode: "KB",
      navn: "KB2 – Jordarbeider",
      referanse: "KB2",
      beskrivelse: "Utlegging av vekstjord — kontroll iht. Tabell K4",
      felter: [
        // FØR
        valg("Formål / planteformål", "FØR",
          [
            "Blomstereng (10 cm vekstjord)",
            "Grasbakke (10 cm vekstjord)",
            "Grasplen (15 cm vekstjord)",
            "Utplantingsplanter (20 cm vekstjord)",
            "Stauder og prydgras (40 cm vekstjord)",
            "Busker (40 cm vekstjord)",
            "Kombinasjonsplantinger (40 cm vekstjord)",
            "Trær (60 cm vekstjord)",
          ],
          "Tabell K4: Velg planteformål — lagtykkelse bestemmes automatisk. Vekstjordlag over 50 cm deles i to lag (moldholdig øverst, moldfattig under)."),
        valg("Underlag", "FØR",
          [
            "Stedlig egnet undergrunnsjord",
            "Steinfylling / berg / tett leire – krever mineraljordlag",
          ],
          "Tabell K4: Oppbyggingen avhenger av om det er stedlig undergrunnsjord eller steinfylling/berg under."),
        valg("Underlagskontroll", "FØR",
          ["Godkjent – jevnt og drenert", "Godkjent med merknad", "Ikke godkjent – krever utbedring"],
          "KB2 c2: Hardpakket undergrunnsjord skal løses. Undergrunn skal ikke komprimeres under utlegging."),
        trafikklys("Leveringsdokument kontrollert", "FØR",
          "Jord skal tilfredsstille Tabell K2 og Figur K3. Kontroller dokumentasjon fra leverandør."),

        // UNDER
        desimal("Lagtykkelse vekstjord (cm)", "UNDER", { enhet: "cm" },
          "Tabell K4 krav: Blomstereng/grasbakke 10 cm, grasplen 15 cm, utplanting 20 cm, stauder/busker 40 cm, trær 60 cm. Mål på minst 3 punkter."),
        valg("Maks steinstørrelse", "UNDER",
          [
            "OK – under 20 mm (gras/blomstereng)",
            "OK – under 60 mm (busker/stauder/utplanting)",
            "OK – under 100 mm (trær)",
            "Avvik – for store steiner funnet",
          ],
          "KB2.2 b3: Maks steinstørrelse: 20 mm for gras, 60 mm for busker/stauder, 100 mm for trær."),
        trafikklys("Jord ikke komprimert", "UNDER",
          "KB2.2: Det er viktig at jorda kun pakkes lett og ikke påføres komprimeringsskader."),

        // ETTER
        desimal("Planhet – avvik (mm)", "ETTER", { enhet: "mm", toleranse: 30 },
          "KB2.5 Tabell K4: Avvik fra planlagt nivå maks ±30 mm."),
        desimal("Fall (%)", "ETTER", { enhet: "%", min: 2.0 },
          "KB2.2 c1: Ferdig overflate skal ha fall på minst 2 % (1:50) hvis ikke annet er spesifisert."),
        trafikklys("Overflate jevn, fritt for ugras", "ETTER",
          "KB c1: Ferdig overflate skal ha jevne flater og skråninger. Dverganger mellom ulike flatetyper skal være jevne."),
      ],
    },

    // ── KB4 – Grasdekke ──
    {
      kapittelKode: "KB",
      navn: "KB4 – Grasdekke",
      referanse: "KB4",
      beskrivelse: "Etablering, vedlikehold, overtakelse",
      felter: [
        valg("Type etablering", "FØR",
          ["Såing – dokumentert frøblanding", "Rullegress", "Ferdigplen"],
          "KB4: Frøblanding eller type rullegress/ferdigplen skal dokumenteres."),
        trafikklys("Jordlag løsgjort og finplanert", "FØR"),
        desimal("Fall (%)", "FØR", { enhet: "%", min: 2.0 },
          "Minimum 2 % fall for drenering."),
        trafikklys("God kontakt frø/plen mot jord", "UNDER"),
        trafikklys("Vannet etter legging/såing", "UNDER"),
        desimal("Markdekningsgrad (%)", "ETTER", { enhet: "%", min: 95 },
          "KB4 c4: Minimum 95 % markdekningsgrad ved overtakelse. Bedøm visuelt eller ved prøverute."),
        trafikklys("Klippet jevnlig frem til overtakelse", "ETTER",
          "KB a1/c3: Prisen inkluderer skjøtsel frem til overtakelse."),
      ],
    },

    // ── KB6 – Planting ──
    {
      kapittelKode: "KB",
      navn: "KB6 – Planting",
      referanse: "KB6",
      beskrivelse: "Trær, busker, stauder – kontroll iht. NS 4400",
      felter: [
        valg("Plantekvalitet", "FØR",
          ["Iht. NS 4400 – godkjent", "Avvik – dokumentert", "Underkjent – returneres"],
          "KB6: Planter skal tilfredsstille NS 4400. Kontroller sortiment, størrelse og kvalitet."),
        trafikklys("Saftspente og fuktige ved ankomst", "FØR"),
        valg("Plantehull", "FØR",
          ["Riktig dimensjon (2× rotklump)", "For lite – må utvides", "For stort – fylles"],
          "Plantehull skal ha dimensjon tilpasset rotklumpen."),
        trafikklys("Rothalsen over jordoverflate", "UNDER",
          "KB6.1 c1: Rothalsen skal ligge over jordoverflaten etter planting og setting av jord."),
        trafikklys("God kontakt rot og jord", "UNDER"),
        trafikklys("Rotbløyte utført", "UNDER"),
        trafikklys("Plantefelt fritt for ugras", "ETTER"),
        trafikklys("Oppbinding/støtte montert", "ETTER", "Ref. KC3.1 for krav til oppstøtting."),
      ],
    },

    // ── KC3.1 ──
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
          "Bruk myk stropp eller gummibeskyttelse – aldri ståltråd direkte mot bark."),
        trafikklys("Kontrollert etter 1 sesong", "ETTER"),
      ],
    },

    // ── KD1 – Utendørsbelegg ──
    {
      kapittelKode: "KD",
      navn: "KD1 – Utendørsbelegg",
      referanse: "KD1",
      beskrivelse: "Legging og kontroll – Tabell K11/K12",
      felter: [
        valg("Underlag", "FØR",
          ["Komprimert og godkjent", "Komprimert med merknad", "Ikke tilstrekkelig – avvik"],
          "KD1: Underlag skal komprimeres og kontrolleres. Settelag iht. Tabell K9."),
        valg("Belegningstype", "FØR",
          ["Belegningsstein", "Heller", "Naturstein", "Asfalt", "Annet"],
          "Kontroller at type og kvalitet stemmer med spesifikasjon."),
        desimal("Fall gangarealer (%)", "UNDER", { enhet: "%", min: 2.0 },
          "Tabell K11: Gangarealer minimum 2,0 % fall."),
        desimal("Fall kjørearealer (%)", "UNDER", { enhet: "%", min: 2.5 },
          "Tabell K11: Kjørearealer minimum 2,5 % fall."),
        trafikklys("Fuger – rette linjer/jevne kurver", "UNDER",
          "KD1 c5: Gjennomgående fuger skal danne rette linjer eller jevne kurver."),
        desimal("Planhet over 3 m (mm)", "ETTER", { enhet: "mm", toleranse: 3 },
          "Tabell K12: Belegningsstein gangarealer ±3 mm, kjørearealer ±5 mm over 3 m rettholt."),
        desimal("Vertikalt sprang fuger (mm)", "ETTER", { enhet: "mm", maks: 2 },
          "Tabell K12: Belegningsstein maks 2 mm, naturstein maks 3 mm."),
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

/**
 * Seed: Sjekklistebibliotek — NS 3420-K og NS 3420-F
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

  interface MalDef {
    kapittelKode: string;
    navn: string;
    referanse: string;
    beskrivelse?: string;
    prioritet?: number; // 1=grunnpakke, 2=utvidet, 3=spesialist
    felter: FeltDef[];
  }

  const maler: MalDef[] = [
    // ── KA7 ──
    {
      kapittelKode: "KA",
      navn: "KA7 – Gjenbruk av materialer",
      referanse: "KA7",
      beskrivelse: "Kontroll ved gjenbruk av materialer (AI-utkast)",
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
      beskrivelse: "Utlegging av vekstjord — kontroll iht. Tabell K4 (AI-utkast)",
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
            "Stedlig jord – godkjent og drenert",
            "Stedlig jord – krever løsgjøring/utbedring",
            "Steinfylling/berg – mineraljordlag påført",
            "Steinfylling/berg – krever mineraljordlag",
          ],
          "Tabell K4: Oppbyggingen avhenger av undergrunn. KB2 c2: Hardpakket jord skal løses. Undergrunn skal ikke komprimeres under utlegging."),
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
      beskrivelse: "Etablering, vedlikehold, overtakelse (AI-utkast)",
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
      beskrivelse: "Trær, busker, stauder – kontroll iht. NS 4400 (AI-utkast)",
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
      beskrivelse: "Oppstøtting og oppbinding (AI-utkast)",
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
      beskrivelse: "Legging og kontroll – Tabell K11/K12 (AI-utkast)",
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

  // ── NS 3420-F:2024 Grunnarbeider ──────────────────────────────────

  const standardF = await prisma.bibliotekStandard.create({
    data: { kode: "NS3420-F", navn: "NS 3420-F:2024 Grunnarbeider", sortering: 2 },
  });

  const kapittelDataF = [
    { kode: "FB", navn: "Graving, spunting, avstiving", sortering: 1 },
    { kode: "FC", navn: "Sprengning", sortering: 2 },
    { kode: "FD", navn: "Fylling og komprimering", sortering: 3 },
    { kode: "FE", navn: "Grøfter for kabler og ledninger", sortering: 4 },
  ];

  const kapF: Record<string, string> = {};
  for (const k of kapittelDataF) {
    const o = await prisma.bibliotekKapittel.create({ data: { ...k, standardId: standardF.id } });
    kapF[k.kode] = o.id;
  }

  const malerF: MalDef[] = [
    // ── FB2 – Graving ──
    {
      kapittelKode: "FB",
      navn: "FB2 – Graving",
      referanse: "FB2",
      beskrivelse: "Graving av byggegrop og grøft — sikring, profil, bunn (AI-utkast)",
      prioritet: 1,
      felter: [
        // FØR
        valg("Kabelpåvisning og grunnforhold", "FØR",
          [
            "Påvist og merket – grunnforhold iht. rapport",
            "Påvist og merket – avvik fra rapport",
            "Ikke påvist – stopp graving",
          ],
          "FB2 b1: Kontroller at kabler/ledninger er påvist og merket i terreng. Sjekk grunnundersøkelse mot prosjektert profil."),
        trafikklys("Graveprofil kontrollert", "FØR",
          "FB2 c1: Kontroller at tegning viser korrekt dybde, bredde og skråningsvinkel. Mål opp og merk med stikk."),

        // UNDER
        valg("Graveskråning og sikring", "UNDER",
          [
            "≤2 m dybde – stabil grunn – OK uten tiltak",
            "≤2 m dybde – ustabil grunn – sikret med skråning/avstiving",
            ">2 m – sand/grus – skråning ≥1:1,5 eller avstivet",
            ">2 m – leire/silt – skråning ≥1:2 eller avstivet",
            ">2 m – spuntet/avstivet – godkjent",
            "Avvik – ikke tilstrekkelig sikret – STOPP",
          ],
          "Arbeidstilsynets forskrift §21-4: Grøfter dypere enn 2 m skal sikres med avstiving eller forsvarlig skråning. Skråningsvinkel avhenger av jordart. Vurder alltid stabiliteten uavhengig av dybde."),
        valg("Vannhåndtering i grøft", "UNDER",
          [
            "Tørt – ingen tiltak nødvendig",
            "Lensing/pumpe etablert – kontrollert",
            "Drenering/avskjæringsgrøft etablert",
            "Vanninntrengning – ustabil skråningsfot – STOPP",
          ],
          "Vann i grøft graver ut skråningsfoten og forårsaker ras. Kontroller ved hver arbeidsstart og etter nedbør. Pump alltid vann før personell går ned."),
        valg("Gravebunn", "UNDER",
          [
            "Riktig kote og jevn bunn",
            "Riktig kote – krever utjevning",
            "Overgravet – krever tilbakefylling",
            "Feil kote – avvik",
          ],
          "FB2 c3: Bunn skal være jevn, fri for løsmasser og på riktig kote. Ikke overgraves – bruk heller utjevningsmasse."),
        desimal("Avvik fra prosjektert profil (mm)", "UNDER", { enhet: "mm" },
          "FB2 c4: Mål avvik fra prosjektert dybde på minst 3 punkter. Toleranse avhenger av prosjektspesifikasjon, typisk ±50 mm."),

        // ETTER
        trafikklys("Gravebunn godkjent for neste operasjon", "ETTER",
          "FB2 c5: Bunn skal godkjennes av ansvarlig før fundament, ledning eller fylling legges. Fotodokumenter."),
        trafikklys("Grøft sikret", "ETTER",
          "Åpne grøfter skal sikres med sperring og skilting. Sikre mot overvann og ras ved nedbør."),
      ],
    },

    // ── FC1 – Sprengning ──
    {
      kapittelKode: "FC",
      navn: "FC1 – Sprengning",
      referanse: "FC1",
      beskrivelse: "Bergsprengning — salveplan, rystelser, profil (AI-utkast)",
      prioritet: 2,
      felter: [
        // FØR
        valg("Salveplan og varsling", "FØR",
          [
            "Salveplan godkjent – alle varslet",
            "Salveplan godkjent – mangler varsling",
            "Salveplan ikke godkjent",
          ],
          "FC1 b1: Salveplan skal være godkjent av bergsprenger med gyldig sertifikat. Naboer og berørte skal være varslet iht. varslingsplan."),
        trafikklys("Rystelsesmåler plassert", "FØR",
          "FC1 b2: Plasser rystelsesmåler på nærmeste bygning/konstruksjon. Dokumenter avstand og grenseverdi (typisk 20 mm/s bolig, NS 8141)."),

        // UNDER
        desimal("Maks rystelsesnivå (mm/s)", "UNDER", { enhet: "mm/s" },
          "FC1 c1: Les av maks rystelse etter salve. Grenseverdier iht. NS 8141: 20 mm/s bolig, 35 mm/s industri, 70 mm/s fjell. Overskridelse → stopp og revurder salveplan."),
        valg("Sprengningsresultat", "UNDER",
          [
            "Iht. profil – ren kontur",
            "Overberg – krever pigging/meisling",
            "Underberg – krever ekstra salve",
            "Blokknedfall – rensk nødvendig",
          ],
          "FC1 c2: Kontroller profil mot tegning. Vurder om det er overberg (for mye fjernet) eller underberg (for lite fjernet)."),

        // ETTER
        trafikklys("Rensk utført og dokumentert", "ETTER",
          "FC1 c3: All løs stein skal fjernes fra skjæring/tak/vegger. Rensk med maskin eller manuelt. Fotodokumenter resultat."),
        desimal("Profilkontroll – avvik (mm)", "ETTER", { enhet: "mm" },
          "FC1 c4: Mål avvik fra prosjektert profil. Typisk toleranse: ±100 mm byggegrop, ±150 mm vegskjæring."),
        valg("Skader på omgivelser", "ETTER",
          [
            "Ingen skader observert",
            "Kosmetisk skade – dokumentert",
            "Konstruktiv skade – stopp og meld",
          ],
          "FC1 c5: Inspiser bygninger og konstruksjoner i sikringssonen etter hver salve. Sammenlign med tilstandsrapport fra før sprengning."),
      ],
    },

    // ── FD2 – Fylling og komprimering ──
    {
      kapittelKode: "FD",
      navn: "FD2 – Fylling og komprimering",
      referanse: "FD2",
      beskrivelse: "Masseutlegging, lagvis komprimering, bæreevne (AI-utkast)",
      prioritet: 1,
      felter: [
        // FØR
        valg("Massetype", "FØR",
          [
            "Sprengstein – dokumentert",
            "Grus/sand – dokumentert",
            "Knust fjell – dokumentert",
            "Lette masser (lettklinker/skumglass)",
            "Avvik – feil massetype",
          ],
          "FD2 b1: Kontroller at tilkjørte masser stemmer med spesifikasjon. Sjekk vareseddel mot bestilling."),
        trafikklys("Underlag klargjort", "FØR",
          "FD2 b2: Underlag skal være fritt for snø, is, organisk materiale og stående vann. Overflate jevnet."),

        // UNDER
        desimal("Lagtykkelse (cm)", "UNDER", { enhet: "cm" },
          "FD2 c1: Mål utlagt lagtykkelse før komprimering. Maks: sprengstein 60 cm, grus/sand 30 cm, lette masser 50 cm."),
        valg("Komprimering", "UNDER",
          [
            "Komprimert iht. instruks – OK",
            "Komprimert – krever flere overfarter",
            "Ikke komprimeringskontrollert",
          ],
          "FD2 c2: Antall overfarter iht. komprimeringsinstruks. Kontroller visuelt – ingen synlig deformasjon under vals."),
        desimal("Komprimeringsgrad (%)", "UNDER", { enhet: "%" },
          "FD2 c3: Standard Proctor eller modifisert Proctor. Krav typisk ≥95 % for bærelag, ≥97 % for forsterkningslag."),

        // ETTER
        desimal("Planhet – avvik (mm)", "ETTER", { enhet: "mm" },
          "FD2 c4: Kontroller med 3 m rettholt. Toleranse: ±30 mm fylling, ±20 mm planum, ±10 mm bærelag."),
        valg("Overflate og drenering", "ETTER",
          [
            "Jevn overflate med fall – OK",
            "Jevn overflate – mangler fall",
            "Ujevn – krever utbedring",
          ],
          "FD2 c5: Ferdig overflate skal ha fall mot dreneringsgrøft/sluk. Ingen vannlommer."),
      ],
    },

    // ── FE1 – Ledningsgrøfter ──
    {
      kapittelKode: "FE",
      navn: "FE1 – Ledningsgrøfter",
      referanse: "FE1",
      beskrivelse: "Grøfter for VA og kabel — profil, fundament, tetthet (AI-utkast)",
      prioritet: 1,
      felter: [
        // FØR
        trafikklys("Eksisterende ledninger påvist", "FØR",
          "FE1 b1: Bestill kabelpåvisning fra netteier. Merk i terreng med spray/stikk. Grav forsiktig innenfor 1 m fra påvist kabel."),
        valg("Grøfteprofil og fundament", "FØR",
          [
            "Iht. tegning – riktig dybde og bredde",
            "Bredde OK – dybde avviker",
            "Begge avviker – krever justering",
          ],
          "FE1 b2: Kontroller at grøfteprofil stemmer med VA-norm eller prosjektert profil. Riktig bredde og dybde."),

        // UNDER
        valg("Fundament og sidefylling", "UNDER",
          [
            "Riktig masse – jevnt fundament",
            "Riktig masse – ujevnt fundament",
            "Feil masse – avvik",
          ],
          "FE1 c1: Ledning skal ligge på jevnt fundament. Sidefylling komprimeres forsiktig i lag. Bruk spesifisert masse (typisk 0–8 mm)."),
        desimal("Ledningsfall (‰)", "UNDER", { enhet: "‰" },
          "FE1 c2: Mål fall med laser eller vater. Minstekrav: spillvann 10 ‰ (DN≤150), overvann 5 ‰. Selvfallsledninger skal ha jevnt fall uten motfall."),
        trafikklys("Gjenfylling lagvis", "UNDER",
          "FE1 c3: Gjenfyll i lag à maks 30 cm. Ikke slipp stein direkte på rør. Bruk beskyttelsesmasse min. 15 cm over ledning."),

        // ETTER
        valg("Tetthetsprøve / trykkprøve", "ETTER",
          [
            "Bestått – ingen lekkasje",
            "Bestått – innenfor toleranse",
            "Ikke bestått – utbedring nødvendig",
          ],
          "FE1 c4: Utfør iht. VA-norm. Trykkprøve: 1,5× driftstrykk i 30 min. Tetthetsprøve: maks tillatt lekkasje iht. NS-EN 1610."),
        trafikklys("Innmåling utført", "ETTER",
          "FE1 c5: Innmål topp rør, bunn grøft og alle knekkpunkt. Lever innmålingsdata til ledningseier (SOSI/GML)."),
        trafikklys("Varselbånd og merking", "ETTER",
          "FE1 c6: Legg varselbånd 30 cm over ledning. Farge: blå=vann, brun=spillvann, grønn=drenering, rød=el, gul=gass."),
      ],
    },

    // ── FB4 – Spunting og avstiving ──
    {
      kapittelKode: "FB",
      navn: "FB4 – Spunting og avstiving",
      referanse: "FB4",
      beskrivelse: "Spuntvegg, avstiving, setningskontroll (AI-utkast)",
      prioritet: 2,
      felter: [
        // FØR
        valg("Spunt levert iht. spesifikasjon", "FØR",
          [
            "Riktig type og dimensjon – godkjent",
            "Riktig type – feil dimensjon",
            "Feil type – stopp og avklar",
          ],
          "FB4 b1: Kontroller spuntprofil, stålkvalitet og lengde mot prosjektert løsning. Vanlige typer: stålspunt (U/Z-profil), sekantpeler, berlinervegg."),
        trafikklys("Nabokontroll utført", "FØR",
          "FB4 b2: Tilstandsregistrering av bygninger og konstruksjoner innenfor influensområdet. Foto + rapport før oppstart."),

        // UNDER
        desimal("Vertikalitet – avvik (mm/m)", "UNDER", { enhet: "mm/m" },
          "FB4 c1: Mål avvik fra lodd etter hvert element. Krav typisk ≤1 % av lengde. Korrigering vanskelig etter nedramming."),
        valg("Tetthet mellom elementer", "UNDER",
          [
            "Tett – ingen synlig lekkasje",
            "Mindre lekkasje – akseptabelt",
            "Lekkasje – krever tetting",
            "Gjennombrudd – STOPP",
          ],
          "FB4 c2: Kontroller låser/skjøter etter ramming. Vannlekkasje indikerer manglende sammenlåsing eller skadet profil."),
        desimal("Stagkraft (kN)", "UNDER", { enhet: "kN" },
          "FB4 c3: Mål stagkraft ved forspenning. Sammenlign med prosjektert verdi. Avvik >10 % → varsle geotekniker/prosjekterende."),

        // ETTER
        valg("Setningskontroll nabolag", "ETTER",
          [
            "Innenfor toleranse",
            "Overvåkes – tiltaksgrense nærmer seg",
            "Tiltak nødvendig – varsle prosjekterende",
          ],
          "FB4 c4: Sammenlign innmåling med nullmåling. Tiltaksgrense typisk 10–20 mm avhengig av konstruksjon."),
        trafikklys("Spuntvegg stabil", "ETTER",
          "FB4 c5: Visuell kontroll av deformasjon, lekkasje og erosjon bak spunt. Fotodokumenter."),
      ],
    },

    // ── FD3 – Grunnforsterkning ──
    {
      kapittelKode: "FD",
      navn: "FD3 – Grunnforsterkning",
      referanse: "FD3",
      beskrivelse: "KC-peler, jetinjeksjon, masseutskifting — kontroll (AI-utkast)",
      prioritet: 2,
      felter: [
        // FØR
        valg("Metode iht. prosjektering", "FØR",
          [
            "Iht. spesifikasjon – godkjent",
            "Avvik fra spesifikasjon – avklar med geotekniker",
          ],
          "FD3 b1: Kontroller at utførelsesmetode stemmer med geoteknisk rapport. Vanlige metoder: KC-peler, jetinjeksjon, masseutskifting, forbelastning med vertikaldren."),
        trafikklys("Grunnundersøkelse verifisert", "FØR",
          "FD3 b2: Kontroller at geoteknisk rapport dekker aktuelt område. Sjekk at antatt jordart og lagfølge stemmer med observert."),

        // UNDER
        desimal("Dybde (m)", "UNDER", { enhet: "m" },
          "FD3 c1: Mål pelehull/injeksjonsdybde mot prosjektert. KC-peler: til antatt fast grunn eller angitt dybde. Avvik >0,5 m → varsle geotekniker."),
        valg("Bindemiddelmengde", "UNDER",
          [
            "Iht. resept – dokumentert",
            "Avvik <10 % – justert",
            "Avvik >10 % – stopp og varsle",
          ],
          "FD3 c2: Bindemiddelforbruk (kg/m) skal logges per pel/punkt. Resept fra geotekniker angir type (kalk, sement, KC) og mengde."),

        // ETTER
        valg("Prøvebelastning", "ETTER",
          [
            "Bestått – bæreevne OK",
            "Marginal – tilleggskontroll",
            "Ikke bestått – tiltak nødvendig",
          ],
          "FD3 c3: Statisk eller dynamisk prøvebelastning iht. geoteknikers anvisning. Dokumenter last-setningskurve."),
        desimal("Setning (mm)", "ETTER", { enhet: "mm" },
          "FD3 c4: Mål setning etter belastning. Sammenlign med beregnet. Typisk krav <25 mm totalsetning, <10 mm differansesetning."),
        trafikklys("Bæreevne dokumentert", "ETTER",
          "FD3 c5: Geotekniker har signert at bæreevne er tilstrekkelig for planlagt konstruksjon."),
      ],
    },
  ];

  for (const mal of [...maler, ...malerF]) {
    const kapittelId = (mal.kapittelKode.startsWith("K") ? kap : kapF)[mal.kapittelKode]!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const malInnhold = mal.felter.map((f, i) => ({ ...f, sortOrder: i + 1 })) as any;
    await prisma.bibliotekMal.create({
      data: { kapittelId, navn: mal.navn, referanse: mal.referanse, beskrivelse: mal.beskrivelse ?? null, prioritet: mal.prioritet ?? 1, malInnhold },
    });
    console.log(`  ✓ ${mal.navn}`);
  }

  console.log("Ferdig!", maler.length + malerF.length, "maler.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

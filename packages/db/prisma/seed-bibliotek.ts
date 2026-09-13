/**
 * Seed: Sjekklistebibliotek — NS 3420-K og NS 3420-F
 *
 * Kjør: npx tsx prisma/seed-bibliotek.ts
 *
 * KUN OPPRETT — aldri oppdater (Kenneth-vedtak 2026-09-11): seeden oppretter det
 * som mangler og RØRER ALDRI en rad som finnes fra før. En mal revidert i databasen
 * (via §6a rå SQL, eller senere /admin/bibliotek) avviker permanent fra denne fila —
 * med vilje. Fila er en startpakke, ikke en fasit; vil du vite hva arkivet inneholder,
 * spør databasen, ikke fila. Aldri deleteMany. ProsjektBibliotekValg (kundens valgte
 * bibliotekmaler) og avstamnings-pekere fra OrganizationTemplate.laantFraBibliotekMalId
 * (SetNull ved sletting) blir stående. Se relay/inbox-seed-kun-opprett.md.
 */
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";

const prisma = new PrismaClient();

/**
 * Miljø-guard — samme prinsipp som deploy-kjedens migrerings-gate
 * (`echo "$DATABASE_URL" | grep -qE "/sitedoc([?]|$)"`). Peker DATABASE_URL mot
 * prod-databasen, kreves en eksplisitt, bevisst bekreftelse — ikke et flagg som
 * er lett å gjenta av vane.
 *
 * MERK (cowork gater formen): lokal sandbox-DB heter også `sitedoc`
 * (`localhost:5432/sitedoc`), så navnet alene skiller ikke prod fra lokal —
 * bare prod fra `sitedoc_test`. Prod nås derfor på VERT, ikke localhost. Guarden
 * regner en localhost/127.0.0.1-vert som lokal sandbox og slipper igjennom;
 * ellers (fjernvert med prod-navnet `sitedoc`) kreves bekreftelse.
 *
 * Bekreftelsen krever `SEED_CONFIRM_DB=<faktisk DB-navn>`, ikke en fast streng.
 * En fast sentinel (f.eks. `JA_JEG_VET`) virker likt mot enhver DB og gjentas lett
 * av vane; et kopiert kall med utelatt/feil DB-navn ABORTERER. Å skrive DB-navnet
 * for hånd er en bevisst handling (Kenneth-vedtak 2026-09-05).
 *
 * Restrisiko å ta stilling til: nås prod via SSH-tunnel til localhost:PORT,
 * regnes den som lokal. Ønsker cowork strengere (f.eks. positiv «jeg er
 * lokal»-markør, eller portkrav 5432) er det en policy-beslutning, ikke en bug.
 */
/** True hvis DATABASE_URL peker mot prod: fjernvert + prod-db-navnet /sitedoc (IKKE /sitedoc_test). */
function erProdDatabase(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  const prodNavn = /\/sitedoc(\?|$)/.test(url);
  const lokalVert = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  return prodNavn && !lokalVert;
}

function avbrytHvisProdUtenBekreftelse(): void {
  if (!erProdDatabase()) return;

  const url = process.env.DATABASE_URL ?? "";
  const dbNavn = url.match(/\/([^/?]+)(?:\?|$)/)?.[1] ?? "sitedoc";
  if (process.env.SEED_CONFIRM_DB !== dbNavn) {
    console.error("⛔ DATABASE_URL peker mot prod-databasen (fjernvert + /sitedoc). Seed avbrutt.");
    console.error("   Selv om seeden er idempotent skal referansedata bygges på test/lokal først.");
    console.error(`   For bevisst prod-kjøring: sett SEED_CONFIRM_DB=${dbNavn} (må matche faktisk DB-navn).`);
    process.exit(1);
  }
  console.warn(`⚠️  Seeder mot prod-databasen «${dbNavn}» (bekreftet via SEED_CONFIRM_DB).`);
}

/**
 * Finn-eller-opprett på (standardId, kode). KUN OPPRETT: finnes kapitlet, returneres
 * id-en uendret — navn/sortering fra fila overskriver aldri en eksisterende rad.
 * `db` injiseres (default: modulens prisma) så testen kan kjøre mot en fake.
 */
async function finnEllerOpprettKapittel(
  db: Pick<PrismaClient, "bibliotekKapittel">,
  standardId: string,
  k: { kode: string; navn: string; sortering: number },
): Promise<string> {
  const eksisterende = await db.bibliotekKapittel.findFirst({ where: { standardId, kode: k.kode } });
  if (eksisterende) return eksisterende.id;
  const opprettet = await db.bibliotekKapittel.create({ data: { ...k, standardId } });
  return opprettet.id;
}

export interface BibliotekMalSeed {
  navn: string;
  referanse: string;
  beskrivelse: string | null;
  prioritet: number;
  verifisert: boolean;
  malInnhold: unknown;
}

/**
 * KUN OPPRETT — aldri oppdater. Finnes malen (kapittelId + referanse) fra før,
 * returneres «finnes» og raden RØRES IKKE (en revidert mal i DB skrives aldri tilbake
 * til fila sitt innhold). Mangler den, opprettes den og «opprettet» returneres.
 *
 * `db` injiseres slik at seeden kjører mot ekte PrismaClient og testen mot en fake —
 * testen verifiserer at en eksisterende rad aldri får create/update (vakten mot at
 * seeden igjen begynner å overskrive).
 */
export async function opprettMalHvisMangler(
  db: Pick<PrismaClient, "bibliotekMal">,
  kapittelId: string,
  mal: BibliotekMalSeed,
): Promise<"opprettet" | "finnes"> {
  const eksisterende = await db.bibliotekMal.findFirst({
    where: { kapittelId, referanse: mal.referanse },
  });
  if (eksisterende) return "finnes";
  await db.bibliotekMal.create({
    data: {
      kapittelId,
      referanse: mal.referanse,
      navn: mal.navn,
      beskrivelse: mal.beskrivelse,
      prioritet: mal.prioritet,
      verifisert: mal.verifisert,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      malInnhold: mal.malInnhold as any,
    },
  });
  return "opprettet";
}

interface FeltDef {
  label: string;
  type: "traffic_light" | "decimal" | "integer" | "list_single" | "heading";
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

function heltall(label: string, fase: string, config: Record<string, unknown> = {}, helpText?: string): FeltDef {
  return felt(label, "integer", fase, { ...config, ...(helpText ? { helpText } : {}) });
}

async function main() {
  console.log("Seeder sjekklistebibliotek (kun opprett — rører aldri eksisterende rader)...");

  avbrytHvisProdUtenBekreftelse();

  // Standard: KUN OPPRETT. `update: {}` → finnes koden, blir raden urørt.
  const standard = await prisma.bibliotekStandard.upsert({
    where: { kode: "NS3420-K" },
    update: {},
    create: { kode: "NS3420-K", navn: "NS 3420-K:2024 Anleggsgartnerarbeider", sortering: 1 },
  });

  const kapittelData = [
    { kode: "KA", navn: "Innledende arbeider", sortering: 1 },
    { kode: "KB", navn: "Jord og vegetasjon", sortering: 2 },
    { kode: "KC", navn: "Vanningsanlegg, sikring og beskyttelse", sortering: 3 },
    { kode: "KD", navn: "Utendørsbelegg, kanter, renner", sortering: 4 },
  ];

  const kap: Record<string, string> = {};
  for (const k of kapittelData) {
    kap[k.kode] = await finnEllerOpprettKapittel(prisma, standard.id, k);
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
      navn: "KA7 – Forberedende arbeider ved gjenbruk av materialer",
      referanse: "KA7",
      beskrivelse: "Rengjøring og sortering av gjenbruksmaterialer (post KA7.2/KA7.3). Gjelder ikke gjenbruk av jord — se KB2.3.",
      felter: [
        valg("Type materiale", "FØR",
          ["Belegningsstein/heller", "Naturstein", "Kantstein", "Murblokk", "Treverk", "Annet – angi i kommentar"],
          "Angi hvilket materiale som gjenbrukes. Mengde og bruksområde står i beskrivelsen (post KA7.2/KA7.3)."),
        valg("Materialstatus", "FØR",
          ["Sortert og godkjent", "Delvis sortert", "Ikke sortert", "Uegnet"],
          "Vurder tilstanden ved mottak/oppstart. Kravene til godkjenning står i prosjektbeskrivelsen. Ta bilde av materialene slik de står."),
        trafikklys("Dokumentasjon på opprinnelse", "FØR",
          "Hvor kommer materialene fra? Legg ved følgeseddel/foto hvis tilgjengelig."),
        trafikklys("Lagringsplass godkjent", "FØR",
          "Tørt, stabilt underlag uten fare for tilsøling eller skade frem til bruk."),
        trafikklys("Materialer rengjort", "UNDER",
          "Rengjort iht. utførelseskrav i beskrivelsen (post KA7.2). Ta bilde etter rengjøring."),
        trafikklys("Materialer sortert", "UNDER",
          "Sortert etter type/kvalitet iht. beskrivelsen (post KA7.3). Uegnede materialer skilt ut. Ta bilde av sorterte fraksjoner."),
        trafikklys("Godkjenningskriterier i beskrivelsen oppfylt", "ETTER",
          "Kontroller mot godkjenningskriteriene i prosjektbeskrivelsen for posten."),
        trafikklys("Dokumentasjonskrav levert", "ETTER",
          "Bilder og øvrig dokumentasjon som beskrivelsen krever er lagt ved dette dokumentet."),
      ],
    },

    // ── KB2 – Vekstjord på terreng ──
    {
      kapittelKode: "KB",
      navn: "KB2 – Vekstjord på terreng",
      referanse: "KB2",
      beskrivelse: "Utlegging av vekstjord (KB2.2) — lagtykkelse, jordkvalitet, planhet iht. Tabell K2/K3/K4",
      felter: [
        // FØR
        valg("Formål / planteformål", "FØR",
          [
            "Blomstereng (10 cm vekstjord)",
            "Grasbakke (20 cm)",
            "Grasplen (20 cm)",
            "Grasbane (20 cm)",
            "Utplantingsplanter (20 cm)",
            "Stauder og prydgras (40 cm)",
            "Busker (40 cm)",
            "Kombinasjonsplantinger (40 cm)",
            "Trær (60 cm)",
          ],
          "Tabell K4: anbefalt vekstjordtykkelse over egnet undergrunnsjord. Over steinfylling/berg/tett leire kommer mineraljord i tillegg (sum 40/70/100 cm). Vekstjordlag over 50 cm deles i to lag — nederste moldfattig. Prosjektbeskrivelsen kan angi andre tykkelser."),
        valg("Underlag", "FØR",
          [
            "Stedlig jord – godkjent og drenert",
            "Stedlig jord – krever løsgjøring/utbedring",
            "Steinfylling/berg – mineraljordlag påført",
            "Steinfylling/berg – krever mineraljordlag",
          ],
          "KB2.2 c2: Hardpakket undergrunnsjord skal løses. Undergrunnen skal ikke komprimeres under utlegging."),
        trafikklys("Varedeklarasjon kontrollert", "FØR",
          "KB2 b5: Jord leveres med varedeklarasjon iht. NS 2890 og skal tilfredsstille Tabell K2 (pH 5,5–7,0, uten rotugras). Ta bilde av varedeklarasjonen."),

        // UNDER
        heltall("Lagtykkelse vekstjord – minste måling (cm)", "UNDER", { enhet: "cm" },
          "Tabell K4: blomstereng 10, gras/utplanting 20, stauder/busker 40, trær 60 cm. Tykkelsen gjelder etter at jorda har satt seg — legg ut med overhøyde. Mål på minst 3 punkter og før inn laveste måling (hele cm)."),
        valg("Maks steinstørrelse", "UNDER",
          [
            "OK – under 20 mm (gras/blomstereng)",
            "OK – under 60 mm (busker/stauder/utplanting)",
            "OK – under 100 mm (trær)",
            "Avvik – for store steiner funnet",
          ],
          "KB2.2 b1: Maks 20 mm for grasarealer/blomstereng, 60 mm for utplanting/busker/stauder, 100 mm for trær."),
        trafikklys("Jord ikke komprimert", "UNDER",
          "KB2.2 c2 og a1: Jorda skal kun pakkes lett — ingen komprimering av undergrunn eller jordlag under utlegging."),

        // ETTER
        valg("Planhet – svanker/bulninger over 3 m", "ETTER",
          [
            "OK – innenfor 15 mm (green/fairway/tee)",
            "OK – innenfor 20 mm (grasbane)",
            "OK – innenfor 30 mm (grasplen)",
            "OK – innenfor 50 mm (grasbakke/eng)",
            "Avvik – utenfor toleranse for dekketypen",
          ],
          "Tabell K3: toleransen avhenger av dekketypen. Kontroller flere punkter med 3 m rettholt uten knaster; velg raden for dekketypen. Ved avvik: noter største målte verdi og sted i kommentaren. For grasdekker: kontrolleres på ferdig grasdekke."),
        trafikklys("Fall minst 2 % mot avrenning", "ETTER",
          "KB2.2 c1: Ferdig overflate skal ha fall på minst 2 % (1:50) hvis ikke annet er spesifisert i beskrivelsen. Kontroller flere punkter på objektet. Ved avvik: noter målt fall og hvor det er målt i kommentaren."),
        trafikklys("Overflate jevn, fri for stein og ugras", "ETTER",
          "KB c1/c2 og KB2 c3: Jevne flater og overganger, uten stein til ulempe for skjøtsel, fritt for rotugras. Ta bilde av ferdig flate."),
      ],
    },

    // ── KB4 – Grasdekker ──
    {
      kapittelKode: "KB",
      navn: "KB4 – Grasdekker",
      referanse: "KB4",
      beskrivelse: "Etablering av grasdekke ved såing eller ferdigplen — materialkontroll, utførelse og overtakelseskrav (post KB4)",
      felter: [
        // FØR
        valg("Formål", "FØR",
          ["Grasplen", "Grasbane", "Grasbakke og eng", "Annet – angi i kommentar"],
          "Matrise KB4:1. Formålet avgjør overtakelseskravet: grasplen/grasbane følger KB4 c4, grasbakke KB4 c5 (samme krav + minst 100 mm høyt)."),
        valg("Metode", "FØR",
          ["Sådd (ikke sprøytesådd)", "Sprøytesådd", "Ferdigplen", "Annen metode – angi i kommentar"],
          "Matrise KB4:2. Metoden skal samsvare med posten i beskrivelsen."),
        trafikklys("Frø/ferdigplen kontrollert og dokumentert", "FØR",
          "KB4 b1: Opphavsmaterialet for frøslag skal dokumenteres og emballasjen være merket. KB4 b2: Ferdigplen skal ha høy skuddtetthet og godt utviklet rot- og utløpersystem. Frøblanding og frømengde per m² står i beskrivelsen. Ta bilde av emballasje/etikett eller følgeseddel."),
        trafikklys("Jordlag løsgjort og finplanert", "FØR",
          "Underlaget skal være klart for etablering — løsgjøring og finplanering, se KB2.5. Jordlagets kvalitet og fall dokumenteres i KB2-sjekklisten."),

        // UNDER
        trafikklys("God kontakt frø/plen mot jord", "UNDER",
          "KB4 c1: Ved såing god kontakt mellom frø og jord, f.eks. ved nedmolding eller tromling. KB4 c2: Ferdigplen legges tett sammen, i forband og i god kontakt med underlaget. Ta bilde."),
        trafikklys("Vannet etter legging/såing", "UNDER",
          "Vanning etter såing/legging sikrer etableringen. Prosjektspesifikke skjøtselskrav står i beskrivelsen."),
        trafikklys("Klippet jevnlig frem til overtakelse", "UNDER",
          "KB4 c3: Grasplen og grasbane skal klippes jevnlig fram til overtakelse. Gjelder ikke grasbakke/eng — sett «Ikke relevant»."),

        // ETTER
        desimal("Markdekningsgrad (%)", "ETTER", { enhet: "%" },
          "KB4 c4/c5: Minst 95 % markdekningsgrad ved overtakelse, med mindre annet står i beskrivelsen (KB4 y5.5). Bedøm visuelt eller ved prøverute — før målt/bedømt verdi."),
        trafikklys("Ferdig gressflate godkjent for overtakelse", "ETTER",
          "KB4 c4/c5: Graset skal være homogent og i god vekst, uten åpne flekker større enn 1,0 dm². Grasbakke skal i tillegg være minst 100 mm høyt. Ta bilde av ferdig flate."),
      ],
    },

    // ── KB6 – Planting ──
    {
      kapittelKode: "KB",
      navn: "KB6 – Planting",
      referanse: "KB6",
      beskrivelse: "Planting av trær, busker, stauder, utplantingsplanter, løk og knoller — mottakskontroll, utførelse og overtakelse (KB6)",
      felter: [
        // FØR
        valg("Plantegruppe", "FØR",
          ["Trær", "Busker", "Stauder", "Utplantingsplanter", "Løk og knoller", "Blandet – angi i kommentar"],
          "Avgjør hvilke utførelseskrav som gjelder (KB6.1–KB6.5). Art, sort, størrelse, leveringsform og planteavstand står i beskrivelsen."),
        valg("Plantekvalitet", "FØR",
          ["Godkjent – iht. NS 4400 og plantelista", "Avvik – dokumentert i kommentar", "Underkjent – returneres"],
          "KB6 b1: Trær, busker og stauder skal tilfredsstille NS 4400. Kontroller art, størrelse og leveringsform mot beskrivelsen. Ta bilde av leveransen og eventuelt mottaksskjema."),
        valg("Tilstand ved ankomst", "FØR",
          ["Saftspente og fuktige", "Noe tørre – vannes straks", "Uttørket – returneres"],
          "KB6 c1: Planter skal være saftspente og godt gjennomfuktet før planting."),

        // UNDER
        valg("Plantedybde og rothals", "UNDER",
          [
            "Trær/busker: rothals over jorda, klump tildekket",
            "Stauder/utplanting: klumpen akkurat dekket",
            "Podede roser: podested dekket av jord",
            "Avvik – må justeres",
          ],
          "KB6.1 c1 / KB6.2 c1: Rothalsen skal være over jorda og rotklumpen tildekket av jord. KB6.3 c1 / KB6.4 c1: Kontainer-, klump- og pluggplanter plantes slik at klumpen akkurat er dekket — hindrer uttørking. KB6.2 c2: Podede roser med podestedet dekket av jorda."),
        trafikklys("Pakking og kontakt rot/jord", "UNDER",
          "KB6 c3: God kontakt mellom rot og jord. For trær (KB6.1 c2): pakk jorda under rotklumpen og plant med noe overhøyde så treet ikke synker under terrenget — pakkingen skal ikke gå ut over dreneringen i plantehullet. Barrotsplanter (KB6 c2): plantes i hvile; røttene skal ikke bøyes, men kan stusses."),
        trafikklys("Rotbløyte utført", "UNDER",
          "KB6 c4: Ved planting skal det vannes grundig (rotbløyte)."),
        trafikklys("Beskjæring ved planting", "UNDER",
          "KB6.1 c3 / KB6.2 c3: Kun skadde grener beskjæres ved planting. Unntak: ungplanter til hekk uten gjennomgående stamme toppes for å sikre god forgreining."),

        // ETTER
        valg("Oppbinding/støtte", "ETTER",
          ["Montert – kontrolleres etter KC3.1", "Ikke nødvendig", "Mangler"],
          "KB6 y2.1: Midlertidig oppstøtting og oppbinding inngår ikke i plantingen — egen post, se KC3.1-sjekklisten for kravene."),
        trafikklys("Plantefelt fritt for ugras", "ETTER",
          "KB6 c5: Ved overtakelse skal plantefeltet være fritt for ugras. Ta bilde av ferdig plantefelt."),
        trafikklys("Krav oppfylt og dokumentasjon levert", "ETTER",
          "Kontroller mot beskrivelsen: riktig antall og planteavstand, alle krav oppfylt. Bilder og eventuelt mottaksskjema er lagt ved dette dokumentet."),
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

  // ── NS 3420-F:2024 Grunnarbeider ──────────────────────────────────

  const standardF = await prisma.bibliotekStandard.upsert({
    where: { kode: "NS3420-F" },
    update: {},
    create: { kode: "NS3420-F", navn: "NS 3420-F:2024 Grunnarbeider", sortering: 2 },
  });

  const kapittelDataF = [
    { kode: "FB", navn: "Graving, spunting, avstiving", sortering: 1 },
    { kode: "FC", navn: "Sprengning", sortering: 2 },
    { kode: "FD", navn: "Fylling og komprimering", sortering: 3 },
    { kode: "FE", navn: "Grøfter for kabler og ledninger", sortering: 4 },
  ];

  const kapF: Record<string, string> = {};
  for (const k of kapittelDataF) {
    kapF[k.kode] = await finnEllerOpprettKapittel(prisma, standardF.id, k);
  }

  const malerF: MalDef[] = [
    // ── FB2 – Graving ──
    {
      kapittelKode: "FB",
      navn: "FB2 – Graving",
      referanse: "FB2",
      beskrivelse: "Graving av byggegrop og grøft — sikring, profil, bunn",
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
      beskrivelse: "Bergsprengning — salveplan, rystelser, profil",
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
      beskrivelse: "Masseutlegging, lagvis komprimering, bæreevne",
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
      beskrivelse: "Grøfter for VA og kabel — profil, fundament, tetthet",
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
      beskrivelse: "Spuntvegg, avstiving, setningskontroll",
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
      beskrivelse: "KC-peler, jetinjeksjon, masseutskifting — kontroll",
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

  // Alle 12 malene er AI-utkast → verifisert: false (settes eksplisitt, ikke bare schema-default).
  // Prod-gate: uverifiserte maler seedes ikke i prod — prod holdes på 0 maler til fagkontroll er
  // registrert (via en fremtidig «Merk verifisert»-handling). Test/lokal får alle 12.
  const erProd = erProdDatabase();
  let opprettet = 0;
  let hoppetProdGate = 0;
  const hoppetFinnes: string[] = [];
  for (const mal of [...maler, ...malerF]) {
    const verifisert = false;
    if (erProd && !verifisert) {
      hoppetProdGate++;
      continue;
    }
    const kapittelId = (mal.kapittelKode.startsWith("K") ? kap : kapF)[mal.kapittelKode]!;
    const malInnhold = mal.felter.map((f, i) => ({ ...f, sortOrder: i + 1 }));
    const status = await opprettMalHvisMangler(prisma, kapittelId, {
      navn: mal.navn,
      referanse: mal.referanse,
      beskrivelse: mal.beskrivelse ?? null,
      prioritet: mal.prioritet ?? 1,
      verifisert,
      malInnhold,
    });
    if (status === "opprettet") {
      opprettet++;
      console.log(`  + opprettet: ${mal.referanse} — ${mal.navn}`);
    } else {
      hoppetFinnes.push(mal.referanse);
    }
  }

  // Krav 2: skill opprettet fra hoppet-over-fordi-finnes, og navngi de hoppede med
  // referanse. Uten dette blir «N maler seedet» en løgn — neste person tror en revisjon
  // i fila nådde databasen. «Stille tomhet i meldingsform.»
  console.log(`Ferdig! ${opprettet} nye maler opprettet.`);
  if (hoppetFinnes.length > 0) {
    console.log(
      `  ↷ ${hoppetFinnes.length} fantes fra før og ble IKKE rørt: ${hoppetFinnes.join(", ")}`,
    );
  }
  if (hoppetProdGate > 0) {
    console.log(`  ↷ ${hoppetProdGate} uverifiserte hoppet over (prod-gate).`);
  }
}

// Kjør seeden KUN når fila startes direkte (`tsx prisma/seed-bibliotek.ts`), ikke når den
// importeres (testen importerer `opprettMalHvisMangler`). Uten guarden ville import kjøre
// seeden. realpathSync normaliserer symlinks (macOS /tmp → /private/tmp) før sammenligning.
const kjørtDirekte =
  process.argv[1] !== undefined &&
  realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);

if (kjørtDirekte) {
  main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
}

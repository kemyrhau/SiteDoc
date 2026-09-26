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
import { byggBibliotekRader, BETINGELSE_EGEN_NOKKEL } from "@sitedoc/shared";
import type { BibliotekFeltData } from "@sitedoc/shared";
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
 * Vei C del 1 (ordre bibliotekmal-objekttabell, Krav 6): innholdet skrives nå som
 * `BibliotekMalObjekt`-RADER (inkl. materialiserte heading-rader), etter NØYAKTIG samme
 * regel som migreringen — `byggBibliotekRader` (@sitedoc/shared) er den delte fasiten.
 * `malInnhold` skrives som TOM array: kolonnen er frossen (leses ikke), og vi skriver
 * ALDRI innholdet til begge former (Krav 4 — sannheten skal bo ett sted).
 *
 * `db` injiseres slik at seeden kjører mot ekte PrismaClient og testen mot en fake —
 * testen verifiserer at en eksisterende rad aldri får create/update (vakten mot at
 * seeden igjen begynner å overskrive).
 */
export async function opprettMalHvisMangler(
  db: Pick<PrismaClient, "bibliotekMal" | "bibliotekMalObjekt">,
  kapittelId: string,
  mal: BibliotekMalSeed,
): Promise<"opprettet" | "finnes"> {
  const eksisterende = await db.bibliotekMal.findFirst({
    where: { kapittelId, referanse: mal.referanse },
  });
  if (eksisterende) return "finnes";
  const opprettetMal = await db.bibliotekMal.create({
    data: {
      kapittelId,
      referanse: mal.referanse,
      navn: mal.navn,
      beskrivelse: mal.beskrivelse,
      prioritet: mal.prioritet,
      verifisert: mal.verifisert,
      malInnhold: [], // frossen kolonne — innholdet bor i radene under
    },
    select: { id: true },
  });
  const rader = byggBibliotekRader((mal.malInnhold ?? []) as BibliotekFeltData[]);
  for (const rad of rader) {
    await db.bibliotekMalObjekt.create({
      data: {
        templateId: opprettetMal.id,
        type: rad.type,
        label: rad.label,
        config: rad.config,
        translations: rad.translations,
        sortOrder: rad.sortOrder,
        required: rad.required,
      },
    });
  }
  return "opprettet";
}

export interface FeltDef {
  label: string;
  type: "traffic_light" | "decimal" | "integer" | "list_single" | "heading";
  zone: "topptekst" | "datafelter";
  fase?: string;
  config?: Record<string, unknown>;
  // Betingede felt (del A, ordre 2026-09-21): `ref` på en forelder, `parentRef` på et barn.
  // Settes av `forgrening` — aldri for hånd. `byggBibliotekRader` løser dem til id/parentId.
  ref?: string;
  parentRef?: string;
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

/**
 * Betingede felt (del A, ordre 2026-09-21) — en FORELDER (`list_single`) med barn som bare vises
 * for bestemte svar. Returnerer `[forelder, ...barn]` i rekkefølge (barn rett etter forelder, samme
 * fase). Forelderen får `conditionActive: true` og en stabil `ref`; hvert barn får `parentRef = ref`
 * og sitt EGET utløsersett i `config[BETINGELSE_EGEN_NOKKEL]` (= `conditionOwnValues`).
 *
 * 🔴 Utløseren ligger på barnets EGNE nøkkel, IKKE `conditionValues` (app-endringen 2026-09-21,
 * `@sitedoc/shared/betingelse.ts`): `conditionValues` på et barn er barnets FORELDER-rolle (hva
 * DETS barn utløses av) og ville kollidere i nøstede kontainere. Nøkkelen importeres — aldri skrevet
 * som streng — så seed og app ikke kan drifte. Et barn kan selv være en forelder: send da et helt
 * undertre (utdata fra en nestet `forgrening`) som `felt`, så beholder hodet sin `ref` + conditionActive.
 *
 * `ref` må være unik innenfor malen. Aldri sett `ref`/`parentRef` for hånd — bruk denne.
 */
export function forgrening(
  ref: string,
  forelder: FeltDef,
  barn: { naar: string[]; felt: FeltDef | FeltDef[] }[],
): FeltDef[] {
  const ut: FeltDef[] = [
    { ...forelder, ref, config: { ...(forelder.config ?? {}), conditionActive: true } },
  ];
  for (const { naar, felt: b } of barn) {
    const [hode, ...resten] = Array.isArray(b) ? b : [b];
    if (!hode) continue;
    ut.push({
      ...hode,
      parentRef: ref,
      config: { ...(hode.config ?? {}), [BETINGELSE_EGEN_NOKKEL]: naar },
    });
    ut.push(...resten);
  }
  return ut;
}

/**
 * Merk et felt som en forgrenings-FORELDER uten å binde barna inline (KD1 v3, ordre §3). Brukes når
 * barna er SPREDT — i ulike faser og ikke rett etter forelderen — slik at `forgrening` (som legger
 * barna sammenhengende rett etter forelderen) ikke passer. Forelderen får `ref` + `conditionActive`;
 * barna festes hver for seg med `barnAv(ref, …)` der de faktisk hører hjemme i lista. `byggBibliotekRader`
 * kobler `parentId` fra `ref`/`parentRef` uavhengig av rekkefølge, så avstand mellom forelder og barn
 * er trygt (verifisert §4-fasemåling 2026-09-23: barn i en senere fase enn forelderen vises/skjules riktig).
 */
export function forelderFelt(ref: string, felt: FeltDef): FeltDef {
  return { ...felt, ref, config: { ...(felt.config ?? {}), conditionActive: true } };
}

/**
 * Et betinget BARN som peker til en forelder-`ref` lenger opp i lista (KD1 v3, ordre §3). I motsetning
 * til `forgrening` beholder barnet sin EGEN plass i array-rekkefølgen (og dermed sin egen fase). Barnet
 * får `parentRef = ref` og sitt eget utløsersett i `config[BETINGELSE_EGEN_NOKKEL]` (= `conditionOwnValues`,
 * aldri `conditionValues` — jf. `forgrening`). Forelderen må være merket med `forelderFelt(ref, …)`.
 */
export function barnAv(ref: string, naar: string[], felt: FeltDef): FeltDef {
  return { ...felt, parentRef: ref, config: { ...(felt.config ?? {}), [BETINGELSE_EGEN_NOKKEL]: naar } };
}

// Stabil sortering på fase (FØR<UNDER<ETTER). `byggBibliotekRader` lager fase-overskriftene i
// FØRSTE-OPPTREDEN-rekkefølge; står typeforelderen i UNDER (UP2/UO2.1), ville FØR-seksjonen ellers
// havne nederst. Sorteringen sikrer riktig overskrift-rekkefølge. Trekoblingen (ref/parentRef) er
// posisjonsuavhengig, og en forelder ligger i tidligere-eller-lik fase enn barnet, så forelder-før-barn
// bevares. Innen samme fase beholdes rekkefølgen (stabil sort + indeks-tiebreaker). Definert her (før
// første mal) så maler tidlig i fila (UM1/UM1.1) kan bruke den uten temporal-dead-zone på FASE_RANG.
const FASE_RANG: Record<string, number> = { FØR: 0, UNDER: 1, ETTER: 2 };
function faseSortert(felter: FeltDef[]): FeltDef[] {
  return felter
    .map((f, i) => ({ f, i }))
    .sort((a, b) => (FASE_RANG[a.f.fase ?? "ETTER"]! - FASE_RANG[b.f.fase ?? "ETTER"]!) || a.i - b.i)
    .map((x) => x.f);
}

// KC3.1 – Oppstøtting av trær. Eksportert som egen definisjon slik at seed-testen kan låse
// feltene (krav (c) «stille tomhet forbudt»). Bygget med eksisterende helpers; skriveveien
// (opprettMalHvisMangler + felter→malInnhold-mapping) er urørt.
export const KC31_MAL = {
  kapittelKode: "KC",
  navn: "KC3.1 – Oppstøtting av trær",
  referanse: "KC3.1",
  beskrivelse: "Oppstøtting og oppbinding av nyplantede trær. Faglig grunnlag: NS 3420-K:2024, post KC3.1.",
  felter: [
    valg("Metode", "FØR",
      ["Oppstøtting med stokker", "Bardunering", "Forankring i grunnen", "Annet – angi i kommentar"],
      "Metoden står i beskrivelsen. Bardunering og forankring har egne krav i beskrivelsen — denne sjekklisten dekker kontrollpunktene som gjelder for alle metodene."),
    valg("Materiell kontrollert mot beskrivelsen", "FØR",
      ["Iht. posten – type, antall stokker og bindemateriale stemmer", "Avvik – dokumentert i kommentar", "Mangler – må skaffes før montering"],
      "Type, antall stokker per tre og bindemateriale står i beskrivelsen. Bruk mykt bindemateriale — aldri ståltråd rett mot barken. Ta bilde av materiellet."),
    trafikklys("Solid og fast forankret – røtter uskadet", "UNDER",
      "Støtten står stødig og er godt festet i bakken, uten at røttene er skadet. Ta bilde av forankringen."),
    trafikklys("Bundet uten fare for gnag eller barkskade", "UNDER",
      "Bindingen skal ikke skade treet. Bruk myk stropp eller gummibeskyttelse — aldri ståltråd rett mot barken. Ta bilde av bindepunktet."),
    trafikklys("Kronen kan bevege seg fritt", "UNDER",
      "Kronen skal kunne bevege seg fritt. Er treet spent fast, blir stammen svak."),
    trafikklys("Høyde: så lav som mulig – maks 1/3 av treets høyde", "UNDER",
      "Sett støtten så lavt som mulig, gjerne ned mot 80 cm, og aldri høyere enn 1/3 av treets høyde. Ved avvik: noter målt høyde i kommentaren."),
    heltall("Antall trær støttet (stk)", "ETTER", { enhet: "stk" },
      "Før inn antall trær som er støttet eller bundet opp. Det dokumenterer levert mengde mot beskrivelsen."),
    trafikklys("Krav oppfylt og dokumentasjon levert", "ETTER",
      "Konklusjon før overlevering: metode, materiell og antall iht. posten, alle kontrollpunkter besvart, bilder lagt ved dette dokumentet. Etterfølgende sesongskontroll og fjerning av oppstøttingen er vedlikehold (egen oppgave) — ikke del av denne sjekklisten. FDV/sluttdokumentasjon leveres via egen dokumentasjonssjekkliste."),
  ] as FeltDef[],
};

// KD1 – Belegg av stein og heller. Eksportert som egen definisjon slik at seed-testen kan låse
// feltene (krav (c) «stille tomhet forbudt»). Bygget med hjelpefunksjonene; skriveveien
// (opprettMalHvisMangler + felter→malInnhold-mapping) er urørt.
//
// Revisjon 2026-09-18 (§7b): SiteDocs egne krav, ingen tabell-/punktkoder; standarden nevnes én gang.
//
// Revisjon v3 2026-09-22 (ordre KD1 v3, gatet av Kenneth «alternativ 1»): BETINGEDE KRAVFELT.
// `Belegningstype` (f01) blir FORELDER; de fire kravfeltene (tykkelse, fugebredde, planhet, sprang)
// splittes i én GREN per kravsett, hver utløst av typene som deler kravet — 18 grener totalt, men
// arbeideren ser fire (ett per kravfelt, skreddersydd for typen). Alternativene forenkles til
// «Innenfor kravet»/«Avvik – måles og noteres» og tallet flyttes til hjelpeteksten (§1e); sprang
// forblir heltall (§1, én veldefinert måling). Barna er SPREDT (tykkelse i FØR etter f03; fugebredde,
// planhet og sprang i ETTER) mens forelderen står i FØR → bygget med `forelderFelt` + `barnAv`, ikke
// `forgrening` (som legger barna sammenhengende). Kryss-fase-barn er verifisert trygt (§4-fasemåling
// 2026-09-23). Gang/kjøreareal skilles fortsatt i hjelpeteksten (en gren kan bare henge på ett svar).
// `KD1_TYPER` er ÉN kilde for de 11 belegningstypene: f01-alternativene OG grenenes utløsersett bygges
// fra den, så en utløser ikke kan drifte fra et alternativ (en feil utløser sender til feil krav).
const KD1_TYPER = {
  storgatestein: "Storgatestein",
  smaagatestein: "Smågatestein",
  mosaikk: "Mosaikkstein",
  plateSagd: "Natursteinsplater – sagde sider",
  plateRaahogd: "Natursteinsplater – råhogde kanter / bruddheller",
  belegningNatur: "Belegningsstein av naturstein",
  betongheller: "Betongheller",
  belegningBetong: "Belegningsstein av betong",
  belegningTegl: "Belegningsstein av tegl",
  permeabelt: "Permeabelt belegg",
  annet: "Annet – se beskrivelsen",
} as const;
const T = KD1_TYPER;

// Felles alternativer for de tre samsvars-kravfeltene (tykkelse/fugebredde/planhet).
const KD1_KRAV_SVAR = ["Innenfor kravet", "Avvik – måles og noteres"];

export const KD1_MAL = {
  kapittelKode: "KD",
  navn: "KD1 – Belegg av stein og heller",
  referanse: "KD1",
  beskrivelse:
    "Legging av belegg av naturstein, betong og tegl, også permeabelt belegg — settelag, fuger, fall og planhet. Faglig grunnlag: NS 3420-K:2024, post KD1.",
  felter: [
    // ── FØR ──
    forelderFelt("belegningstype",
      valg("Belegningstype", "FØR",
        Object.values(KD1_TYPER),
        "Velg typen som er lagt — den avgjør kravene til settelag, fuger, fall og planhet i feltene under. Kontroller frostklassen i merkingen på pallen: naturstein og gatestein F1, betongheller og betongstein klasse 3 (merket D), tegl FP100. Ta bilde av pallelapp eller leveringsseddel.")),
    valg("Areal", "FØR",
      ["Gangareal", "Kjøreareal"],
      "Kjøreareal har strengere krav til fall og romsligere toleranse for planhet enn gangareal."),
    valg("Settelag", "FØR",
      [
        "Natursand",
        "Betong",
        "Knust 0/8",
        "Knust 0/11",
        "Knust 2/8",
        "Knust 2/11",
        "Knust 2/5 (permeabelt)",
        "Annet – se beskrivelsen",
      ],
      "Anbefalt: 0/8 eller 0/11 under belegningsstein og gatestein, 2/8 under natursteinsplater og betongheller, 2/11 ved maskinlegging. Permeabelt belegg: 2/5, 2/8 eller 2/11. Beskytt betong i settelag og fuger mot uttørking og frost."),
    // Tykkelse settelag — fire grener (FØR, barn av belegningstype)
    barnAv("belegningstype", [T.betongheller, T.belegningBetong, T.belegningTegl],
      valg("Tykkelse settelag", "FØR", KD1_KRAV_SVAR,
        "Settelaget skal være 20–40 mm. Legg med overhøyde på 3–5 mm, så belegget ender i riktig høyde etter komprimering. Ved avvik: noter målt tykkelse og sted i kommentaren.")),
    barnAv("belegningstype", [T.mosaikk, T.plateSagd, T.plateRaahogd, T.belegningNatur],
      valg("Tykkelse settelag", "FØR", KD1_KRAV_SVAR,
        "Settelaget skal være 30–50 mm. Legg med overhøyde på 3–5 mm. Ved avvik: noter målt tykkelse og sted i kommentaren.")),
    barnAv("belegningstype", [T.storgatestein, T.smaagatestein],
      valg("Tykkelse settelag", "FØR", KD1_KRAV_SVAR,
        "Settelaget skal være 50–70 mm. Gatestein legges med overhøyde på 8–12 mm. Ved avvik: noter målt tykkelse og sted i kommentaren.")),
    barnAv("belegningstype", [T.permeabelt, T.annet],
      valg("Tykkelse settelag", "FØR", KD1_KRAV_SVAR,
        "Tykkelsen står i beskrivelsen. Med snøsmelteanlegg gjelder leverandørens tykkelse. Ved avvik: noter målt tykkelse og sted i kommentaren.")),
    // ── UNDER ──
    trafikklys("Fall mot avrenning", "UNDER",
      "Minst 2 % på gangareal. Kjøreareal: minst 2,5 %, for gatestein minst 3 %. Permeabelt belegg: fallet står i beskrivelsen. Angir beskrivelsen noe annet, gjelder den. Kontroller flere punkter. Ved avvik: noter målt fall og sted i kommentaren."),
    trafikklys("Fuger og striper i rette linjer eller jevne buer", "UNDER",
      "Gatestein legges i forband, forskjøvet minst 1/3 stein, i buer minst 1/5. Ingen tilpassede biter mindre enn 30 % av en hel stein."),
    // ── ETTER ──
    // Fugebredde — fem grener (ETTER, barn av belegningstype)
    barnAv("belegningstype", [T.storgatestein, T.smaagatestein, T.mosaikk, T.plateRaahogd],
      valg("Fugebredde", "ETTER", KD1_KRAV_SVAR,
        "Fugene legges i knas — steinene ligger tett mot hverandre. Ved avvik: noter sted i kommentaren.")),
    barnAv("belegningstype", [T.betongheller, T.belegningBetong],
      valg("Fugebredde", "ETTER", KD1_KRAV_SVAR,
        "Fugebredden skal være 2–5 mm. Ved avvik: noter målt bredde og sted i kommentaren.")),
    barnAv("belegningstype", [T.belegningNatur],
      valg("Fugebredde", "ETTER", KD1_KRAV_SVAR,
        "Fugebredden skal være 5–7 mm. Enkeltsteiner kan avvike ±3 mm. Ved avvik: noter målt bredde og sted.")),
    barnAv("belegningstype", [T.plateSagd],
      valg("Fugebredde", "ETTER", KD1_KRAV_SVAR,
        "Fugebredden avhenger av platetykkelsen: 5–8 mm for plater under 80 mm, og 9–12 mm for plater fra 80 til 150 mm. Over 150 mm står bredden i beskrivelsen. Enkeltplater kan avvike ±2 mm.")),
    barnAv("belegningstype", [T.belegningTegl, T.permeabelt, T.annet],
      valg("Fugebredde", "ETTER", KD1_KRAV_SVAR,
        "Fugebredden står i beskrivelsen. Ved avvik: noter målt bredde og sted i kommentaren.")),
    // Planhet – svanker/bulninger over 3 m — fire grener (ETTER, barn av belegningstype)
    barnAv("belegningstype", [T.betongheller, T.belegningBetong, T.belegningTegl, T.belegningNatur, T.smaagatestein, T.mosaikk],
      valg("Planhet – svanker/bulninger over 3 m", "ETTER", KD1_KRAV_SVAR,
        "Målt med 3 m rettholt: svanker og bulninger skal være innenfor ±3 mm på gangareal og ±5 mm på kjøreareal. Mål flere steder. Ved avvik: noter største måling og sted.")),
    barnAv("belegningstype", [T.storgatestein, T.plateSagd],
      valg("Planhet – svanker/bulninger over 3 m", "ETTER", KD1_KRAV_SVAR,
        "Målt med 3 m rettholt: innenfor ±5 mm på gangareal og ±8 mm på kjøreareal. Mål flere steder. Ved avvik: noter største måling og sted.")),
    barnAv("belegningstype", [T.plateRaahogd],
      valg("Planhet – svanker/bulninger over 3 m", "ETTER", KD1_KRAV_SVAR,
        "Målt med 3 m rettholt: innenfor ±8 mm på gangareal og ±10 mm på kjøreareal. Mål flere steder. Ved avvik: noter største måling og sted.")),
    barnAv("belegningstype", [T.permeabelt, T.annet],
      valg("Planhet – svanker/bulninger over 3 m", "ETTER", KD1_KRAV_SVAR,
        "Målt med 3 m rettholt: for maskinlagt permeabelt belegg gjelder ±3 mm på gangareal og ±6 mm på kjøreareal. Ellers står kravet i beskrivelsen.")),
    // Største vertikale sprang ved fuger (mm) — fem grener (ETTER, heltall, barn av belegningstype)
    barnAv("belegningstype", [T.betongheller, T.belegningBetong, T.belegningTegl, T.belegningNatur],
      heltall("Største vertikale sprang ved fuger (mm)", "ETTER", { enhet: "mm" },
        "Største tillatte sprang er 2 mm på gangareal og 3 mm på kjøreareal. Før inn den største målingen i hele mm.")),
    barnAv("belegningstype", [T.smaagatestein, T.mosaikk],
      heltall("Største vertikale sprang ved fuger (mm)", "ETTER", { enhet: "mm" },
        "Største tillatte sprang er 3 mm på gangareal og 5 mm på kjøreareal. Før inn den største målingen i hele mm.")),
    barnAv("belegningstype", [T.storgatestein],
      heltall("Største vertikale sprang ved fuger (mm)", "ETTER", { enhet: "mm" },
        "Største tillatte sprang er 5 mm på gangareal og 8 mm på kjøreareal. Før inn den største målingen i hele mm.")),
    barnAv("belegningstype", [T.plateSagd],
      heltall("Største vertikale sprang ved fuger (mm)", "ETTER", { enhet: "mm" },
        "Største tillatte sprang er 4 mm på gangareal og 6 mm på kjøreareal. Før inn den største målingen i hele mm.")),
    barnAv("belegningstype", [T.plateRaahogd, T.permeabelt, T.annet],
      heltall("Største vertikale sprang ved fuger (mm)", "ETTER", { enhet: "mm" },
        "Største tillatte sprang er 6 mm på gangareal og 8 mm på kjøreareal for råhogde plater. For permeabelt og annet står kravet i beskrivelsen. Før inn den største målingen i hele mm.")),
    // Konklusjon (ETTER)
    trafikklys("Krav oppfylt og dokumentasjon levert", "ETTER",
      "Belegget oppfyller kravene over, overflaten er feid ren for fugemasse, og flaten er klar for overlevering. Ta bilde av ferdig belegg."),
  ] as FeltDef[],
};

// KD2 – Setting av kantstein. Første NYE mal (ikke revisjon) etter den nye design↔mal-Opus-
// løypen. Eksportert som egen definisjon slik at seed-testen kan låse feltene (krav (c) «stille
// tomhet forbudt»). Bygget med eksisterende helpers; skriveveien (opprettMalHvisMangler +
// felter→malInnhold-mapping) er urørt.
//
// Ordre KD2 2026-09-18 (design-rollen, gatet av Kenneth): 10 felt for setting av kantstein av
// naturstein (KD2.2) og betong (KD2.3). Avgrenset: plasstøpte kanter (KD2.4), stål (KD2.5) og
// andre materialer (KD2.7) er ute; vishøyde over 300 mm er mur (KM2). Krav mot en flate som
// varierer (linjeføring, planhet) besvares med samsvar per kravnivå — ikke tallfelt (MAL-METODE
// §1). Én veldefinert måling (største sprang ved fuger) er heltall uten maks-grense (blokkerer
// aldri avviksregistrering). §7b: SiteDocs egne krav, ingen normkoder i hjelpetekster; standarden
// nevnes én gang, i beskrivelsen.
export const KD2_MAL = {
  kapittelKode: "KD",
  navn: "KD2 – Setting av kantstein",
  referanse: "KD2",
  beskrivelse:
    "Setting av kantstein av naturstein og betong — fundament, linjeføring, planhet og fuger. Faglig grunnlag: NS 3420-K:2024, post KD2.",
  felter: [
    valg("Kantsteinstype", "FØR",
      [
        "Naturstein – råkilt",
        "Naturstein – gradet eller flammet",
        "Betongkantstein",
        "Annet – se beskrivelsen",
      ],
      "Styrer kravene til linjeføring, planhet og sprang i feltene under. Kontroller frostmerkingen på pallen: naturstein F1, betong klasse 3 merket D. Ta bilde av pallelapp eller leveringsseddel. I kurver med radius under 20 m bør steinen være radiushogd."),
    valg("Montering", "FØR",
      [
        "I betong (for- og bakstøp)",
        "Limt",
        "Spikret",
        "Annet – se beskrivelsen",
      ],
      "Settes kantsteinen i betong, må betongen beskyttes mot uttørking og frost."),
    trafikklys("Vishøyde iht. beskrivelsen", "FØR",
      "Vishøyden er det som står over ferdig terreng eller belegg. Er den over 300 mm, er det en mur og ikke en kant — bruk malen for mur."),
    trafikklys("Minst 100 mm betong under hele steinen", "UNDER",
      "Gjelder kantstein satt i betong. Forkant tilpasset vishøyden og belegget, bakkant så høy som mulig. Ta bilde før gjenfylling."),
    trafikklys("For- og bakstøp pakket, glattet og lagt samtidig med settingen", "UNDER",
      "Gir god støtte for steinen og jevn herding. Legg for- og bakstøp i samme arbeidsgang som settelaget og steinen."),
    valg("Linjeføring i høyde og side", "ETTER",
      [
        "OK – innenfor 5 mm",
        "OK – innenfor 6 mm",
        "OK – innenfor 8 mm",
        "Avvik – utenfor toleransen for steintypen",
      ],
      "Målt langs toppen av visflaten over 3 m: betong 5 mm, gradet eller flammet naturstein 6 mm, råkilt naturstein 8 mm. Kantene skal følge rette linjer eller jevne buer. Ved avvik: noter største måling og sted i kommentaren."),
    valg("Planhet på overside og visflate", "ETTER",
      [
        "OK – innenfor 4 mm",
        "OK – innenfor 5 mm",
        "OK – innenfor 7 mm",
        "Avvik – utenfor toleransen for steintypen",
      ],
      "Svanker og bulninger over 3 m: betong 4 mm, gradet eller flammet naturstein 5 mm, råkilt naturstein 7 mm. Ved avvik: noter største måling og sted i kommentaren."),
    heltall("Største sprang ved fuger (mm)", "ETTER", { enhet: "mm" },
      "Største tillatte sprang: betong og gradet eller flammet naturstein 3 mm, råkilt naturstein 4 mm. Før inn den største målingen (hele mm)."),
    trafikklys("Fuger og synlige flater", "ETTER",
      "Fugene er godt pakket og svakt inntrukket, og synlige flater er rengjort for fugemasse. Naturstein med presise fugesider er satt med fugeavstand. Alle synlige flater, også endene, har samme struktur."),
    trafikklys("Krav oppfylt og dokumentasjon levert", "ETTER",
      "Kanten oppfyller kravene over og er klar for overlevering. Ta bilde av ferdig kant."),
  ] as FeltDef[],
};

// KM2 – Mur av stein i terreng. Ny mal, nytt kapittel KM (finnes ikke i biblioteket i dag).
// Normen har INGEN utførelseskrav eller toleranser for murer i terreng — malen er en kontroll
// mot prosjektets beskrivelse (MAL-METODE §1: prosjektspesifikke krav peker til beskrivelsen).
// Ingen tallfelt og ingen normtall i hjelpetekstene. Ett unntak: felt 1 bærer definisjonen
// «vishøyde over 300 mm» — grensen mur/kant (jf. KD2), ikke et utførelseskrav; arbeideren
// trenger den for å velge riktig mal. §7b: SiteDocs egne krav, standarden nevnes kun i beskrivelsen.
export const KM2_MAL = {
  kapittelKode: "KM",
  navn: "KM2 – Mur av stein i terreng",
  referanse: "KM2",
  beskrivelse:
    "Ensidig og tosidig mur, tørrmur og murt mur — fundament, oppbygging og fuger kontrollert mot beskrivelsen. Faglig grunnlag: NS 3420-K:2024, post KM2.",
  felter: [
    // FØR
    valg("Murtype", "FØR",
      [
        "Ensidig tørrmur",
        "Ensidig murt mur",
        "Tosidig tørrmur",
        "Tosidig murt mur",
        "Ett-skifts mur",
        "Annet – se beskrivelsen",
      ],
      "Ensidig mur har visflate på én side, tosidig på begge sider med kjerne mellom. Ett-skifts mur har ett element i høyden og vishøyde over 300 mm — lavere enn det er en kant, ikke en mur."),
    valg("Materiale", "FØR",
      [
        "Naturstein",
        "Betongstein",
        "Imitert stein",
        "Annet – se beskrivelsen",
      ],
      "Kontroller steinen mot materialspesifikasjonen i beskrivelsen: bergart eller type, utseende, dimensjon og bearbeiding av visflaten. Ta bilde av leveransen."),
    trafikklys("Fundament, filterlag og drenering på plass", "FØR",
      "Fundament, filterlag og drensledning er egne poster, men muren skal ikke settes før de er ferdige og slik beskrivelsen angir. Ta bilde før muringen starter — etterpå er det ikke synlig."),

    // UNDER
    trafikklys("Helning og tverrsnitt iht. beskrivelsen", "UNDER",
      "Kontroller helningen og tverrsnittet mot beskrivelsen eller tegningen. Ved avvik: noter hva som er målt og hvor i kommentaren."),
    valg("Bindere, forankring eller armering", "UNDER",
      [
        "OK – iht. beskrivelsen",
        "Ikke krevd i beskrivelsen",
        "Avvik",
      ],
      "Kontroller type, plassering og antall mot beskrivelsen. Ta bilde før de dekkes."),
    valg("Kjernefyll", "UNDER",
      [
        "OK – iht. beskrivelsen",
        "Ikke aktuelt – ensidig mur",
        "Avvik",
      ],
      "Gjelder tosidig mur. Kontroller at kjernen er fylt med materialet beskrivelsen angir."),
    valg("Drenshull", "UNDER",
      [
        "OK – iht. beskrivelsen",
        "Ikke krevd i beskrivelsen",
        "Avvik",
      ],
      "Kontroller plassering og antall mot beskrivelsen, og at hullene er åpne."),

    // ETTER
    trafikklys("Ligge- og stussfuger iht. beskrivelsen", "ETTER",
      "Kontroller tetting, bredde og materiale i fugene mot beskrivelsen. Ved avvik: noter sted og hva som avviker."),
    trafikklys("Linjeføring, mønster og toleranser iht. beskrivelsen", "ETTER",
      "Toleransene for mur står i beskrivelsen, ikke som faste tall. Kontroller synlig flate, linjeføring og mønster mot dem. Ved avvik: noter største måling og sted."),
    trafikklys("Krav oppfylt og dokumentasjon levert", "ETTER",
      "Muren er utført slik beskrivelsen angir og er klar for overlevering. Ta bilde av ferdig mur."),
  ] as FeltDef[],
};

// FB1 – Markrydding og avtaking av vekstjord. NY mal som fyller det tomme kapittelet FB
// «Markrydding» (ordre FB1 2026-09-20, gatet av Kenneth, Runde C). FB ble tomt etter at FB2 ble
// omkodet til FD1 (Del F-omkodingen). Dekker det som skjer først på jobben: vegetasjonsrydding,
// felling, stubbebehandling og avtaking av vekstjord til ranke/depot; rydding under vann, transport
// bort, depotdrift og ugressbehandling er avgrenset ut. 10 felt, INGEN tallfelt: ryddegrense,
// masseskille og opplegging besvares med samsvar (MAL-METODE §1). §7b: SiteDocs egne krav —
// standarden kun i beskrivelsen. Legges FØRST i F-arrayet (foran FD1).
export const FB1_MAL = {
  kapittelKode: "FB",
  navn: "FB1 – Markrydding og avtaking av vekstjord",
  referanse: "FB1",
  beskrivelse:
    "Rydding av vegetasjon og avtaking av vekstjord — ryddegrense, fremmede arter, masseskille og opplegging. Faglig grunnlag: NS 3420-F:2024, post FB1 og FB2.",
  felter: [
    // FØR
    valg("Hva ryddes", "FØR",
      [
        "Vegetasjonsdekke og busker",
        "Trær",
        "Begge deler",
        "Bare vekstjord",
      ],
      "Sier hva jobben omfatter, og styrer hvilke felt under som er aktuelle."),
    valg("Fremmede arter", "FØR",
      [
        "Ingen registrert",
        "Registrert – tiltaksplan følges",
        "Ikke undersøkt – avklar",
      ],
      "Er det fare for fremmede arter, skal det finnes en rapport med tiltaksplan, og massene skal håndteres etter den. Masser med og uten fremmede arter holdes fra hverandre."),
    trafikklys("Ryddegrensen er merket", "FØR",
      "Grensen går 2,0 m utenfor prosjektert skjæringstopp eller fyllingsfot når beskrivelsen ikke sier noe annet. Trær og vegetasjon som skal stå, er merket og beskyttet."),

    // UNDER
    valg("Trær og stubber", "UNDER",
      [
        "Felt, stubber tatt opp",
        "Stubber frest",
        "Ikke aktuelt",
        "Avvik",
      ],
      "Felte trær, stubber og røtter kjøres til oppsamlingsplass eller behandles på stedet. Trær i kanten av området felles så de som blir stående, tåler å stå fritt."),
    trafikklys("Massene holdes adskilt", "UNDER",
      "Vegetasjonsdekke, vekstjord og øvrige masser legges hver for seg, og blandes ikke."),
    valg("Vekstjorda tatt av uten innblanding", "UNDER",
      [
        "Tatt av ren",
        "Blandet med massene under – avvik",
        "Ingen vekstjord på stedet",
      ],
      "Vekstjorda skal ikke blandes med massene under eller andre materialer, og skal ikke forringes. Skal den brukes til revegetering, tas den av skånsomt slik beskrivelsen sier."),
    valg("Opplegging", "UNDER",
      [
        "Løse hauger eller ranker, høyst 2 m",
        "Høyere enn 2 m – avvik",
        "Kjørt til depot",
      ],
      "Vekstjorda legges løst og høyst 2 m høyt når beskrivelsen ikke sier noe annet. Unngå komprimering — ikke kjør på jorda."),
    valg("Behandling av kvist og stubber", "UNDER",
      [
        "Fliskuttet",
        "Oppkuttet",
        "Sortert",
        "Kjørt bort",
        "Ikke aktuelt",
      ],
      "Velg det beskrivelsen angir. Masser som kjøres bort, håndteres etter tiltaksplanen når fremmede arter er registrert."),

    // ETTER
    trafikklys("Området er ryddet til avtalt grense", "ETTER",
      "Ryddingen følger den merkede grensen, og vegetasjon som skulle stå, er uskadd. Ta bilde."),
    valg("Vekstjorddepotet er merket", "ETTER",
      [
        "Merket etter plan",
        "Ikke aktuelt",
        "Mangler merking",
      ],
      "Der det er fare for fremmede arter, merkes hauger og ranker etter hvilket område jorda kommer fra, så massene ikke blandes senere."),
  ] as FeltDef[],
};

// FD1 – Graving av byggegrop. Omkoding av tidligere «FB2 – Graving» (ordre FD1 2026-09-19,
// gatet av Kenneth): graving hører til FD (uttak av løsmasser), ikke FB (markrydding). Samme
// bibliotekrad omkodes FB2→FD1 i arkivet (lånene beholder id-koblingen) — se generer-mal-sql.ts
// `--fra FB2`. Grøft er skilt ut til egen mal (FD2 grøft, senere ordre). 11 felt, INGEN tallfelt:
// bunn- og sideavvik besvares med samsvar mot toleransen (MAL-METODE §1), målt verdi i kommentaren.
// §7b: SiteDocs egne krav — ingen tabell-/punktkoder i hjelpetekstene; standarden nevnes kun i
// beskrivelsen («Faglig grunnlag»). Kodene i navn/referanse beholdes (datanøkler + gjenkjennelse).
export const FD1_MAL = {
  kapittelKode: "FD",
  navn: "FD1 – Graving av byggegrop",
  referanse: "FD1",
  beskrivelse:
    "Graving av byggegrop og groper — påvisning, sikring, bunn og toleranser. Faglig grunnlag: NS 3420-F:2024, post FD1 og FD3.",
  felter: [
    // FØR
    valg("Kabler og ledninger påvist", "FØR",
      [
        "Påvist og merket i terrenget",
        "Ingen i området – bekreftet",
        "Ikke påvist – stopp graving",
      ],
      "Kabler og ledninger skal være påvist og merket før gravingen starter. Ledninger som blir avdekket, skal sikres. Ta bilde av merkingen."),
    valg("Grunnforhold", "FØR",
      [
        "Som i geoteknisk rapport",
        "Avvik fra rapporten – meldt til prosjekterende",
        "Ingen rapport – vurdert på stedet",
      ],
      "Sjekk jordart, grunnvann og fare for kvikkleire mot rapporten. Leire og silt kan miste fastheten når de røres opp — grav forsiktig der beskrivelsen krever det."),
    trafikklys("Utstikking etter tegning", "FØR",
      "Gravegrense, skråning og bunnhøyde er stukket ut etter tegningen før gravingen starter."),

    // UNDER
    valg("Skråning og sikring", "UNDER",
      [
        "Skråning etter tegning – stabil",
        "Avstivet",
        "Ustabil – stopp og sikre",
      ],
      "Gravingen må ikke svekke stabiliteten i grunnen. Groper dypere enn 2 m sikres med avstiving eller forsvarlig skråning. Vurder stabiliteten uansett dybde, og på nytt etter nedbør."),
    valg("Vannhåndtering", "UNDER",
      [
        "Tørt – ingen tiltak",
        "Lensing/pumpe etablert – kontrollert",
        "Drenering/avskjæringsgrøft etablert",
        "Vanninntrengning – ustabil skråningsfot – stopp",
      ],
      "Vann i gropa graver ut skråningsfoten. Kontroller ved hver arbeidsstart og etter nedbør. Pump ut vannet før noen går ned."),
    trafikklys("Masser holdt adskilt", "UNDER",
      "Ulike typer masser er ikke blandet. Vekstjord er tatt av for seg før gravingen."),
    trafikklys("Eksisterende anlegg og trær som skal stå, er ikke skadet", "UNDER",
      "Ledninger, kabler, konstruksjoner og røtter til trær som skal bevares, er ikke skadet av gravingen."),

    // ETTER
    valg("Bunnhøyde", "ETTER",
      [
        "Innenfor ±100 mm",
        "Strengere krav i beskrivelsen – oppfylt",
        "Utenfor – krever avretting",
      ],
      "Kontroller bunnen mot prosjektert høyde flere steder. Tillatt avvik er ±100 mm når beskrivelsen ikke sier noe annet. Trengs strengere krav, avrettes bunnen etterpå. Noter største avvik i kommentaren."),
    valg("Sideavvik", "ETTER",
      [
        "Innenfor ±150 mm",
        "Utenfor – avvik",
      ],
      "Kontroller gravegrensen mot utstikkingen. Tillatt sideavvik er ±150 mm når beskrivelsen ikke sier noe annet."),
    valg("Avstand fra skråning til fundament", "ETTER",
      [
        "Oppfyller minsteavstanden",
        "Ikke aktuelt – ingen fundament",
        "For smalt – avvik",
      ],
      "Fundament inntil 1,0 m høyt: minst 1,0 m fra fundamentkanten til skråningen eller avstivingen. Høyere fundament: minst 1,5 m. Beskrivelsen kan kreve mer. Gjelder ikke rør og ledninger."),
    trafikklys("Bunnen er ren, ikke omrørt og klar for neste arbeid", "ETTER",
      "Bunnen er fri for løse masser, ikke forstyrret eller frossen, og godkjent før fundament, ledning eller fylling legges. Ta bilde."),
  ] as FeltDef[],
};

// FD2 – Graving av grøft. NY mal i eksisterende kapittel FD «Uttak av løsmasser» (ordre FD2
// 2026-09-19, gatet av Kenneth). Ingen omkoding — FD2-koden ble frigjort da FS2 omkodet den gamle
// «FD2 – Fylling». Dekker graving av grøft for rør, kabler og fundament + åpne grøfter + avstiving
// med grøftekasse; legging/gjenfylling (FS3), spunt, under vann og sprengning er avgrenset ut.
// 12 felt, INGEN tallfelt: bunn- og sideavvik besvares med samsvar mot toleransen (MAL-METODE §1),
// målt verdi/sted i kommentaren. §7b: SiteDocs egne krav — standarden kun i beskrivelsen.
export const FD2_MAL = {
  kapittelKode: "FD",
  navn: "FD2 – Graving av grøft",
  referanse: "FD2",
  beskrivelse:
    "Graving av grøft for rør, kabler og fundament — påvisning, avstiving, bunn og toleranser. Faglig grunnlag: NS 3420-F:2024, post FD2.",
  felter: [
    // FØR
    valg("Type grøft", "FØR",
      [
        "Rørgrøft",
        "Fundamentgrøft",
        "Åpen grøft",
        "Annen grøft",
      ],
      "Typen grøft avgjør hvilken bunntoleranse som gjelder."),
    valg("Kabler og ledninger påvist", "FØR",
      [
        "Påvist og merket i terrenget",
        "Ingen i området – bekreftet",
        "Ikke påvist – stopp graving",
      ],
      "Kabler og ledninger skal være påvist og merket før gravingen starter. Ta bilde av merkingen."),
    valg("Grøft i fylling", "FØR",
      [
        "Ikke i fylling",
        "Fylling komprimert minst 0,5 m over øverste ledning",
        "Ikke ferdig fylt – vent",
      ],
      "Skal grøften graves i en ny fylling, må fyllingen være lagt ut og komprimert til minst 0,5 m over øverste ledning før du graver."),
    trafikklys("Utstikking etter tegning", "FØR",
      "Trasé og bunnhøyde er stukket ut etter tegningen før gravingen starter."),

    // UNDER
    valg("Skråning og avstiving", "UNDER",
      [
        "Skråning etter tegning – stabil",
        "Grøftekasse",
        "Annen avstiving",
        "Ustabil – stopp",
      ],
      "Grøfter dypere enn 2 m sikres med avstiving eller forsvarlig skråning. Vurder stabiliteten uansett dybde, og på nytt etter nedbør. Grøftekasser trekkes eller løftes seksjonsvis, så massene rundt ledningen ikke forstyrres."),
    valg("Vannhåndtering", "UNDER",
      [
        "Tørt – ingen tiltak",
        "Lensing/pumpe etablert – kontrollert",
        "Drenering/avskjæringsgrøft etablert",
        "Vanninntrengning – ustabil skråningsfot – stopp",
      ],
      "Vann i grøfta graver ut skråningsfoten. Kontroller ved hver arbeidsstart og etter nedbør. Pump ut vannet før noen går ned."),
    valg("Avdekkede ledninger og kabler", "UNDER",
      [
        "Ingen avdekket",
        "Avdekket og sikret",
        "Skadet – meldt",
      ],
      "Ledninger og kabler som blir avdekket under gravingen, skal sikres. Skader meldes straks til eieren."),
    trafikklys("Grøftebredden er ikke større enn nødvendig", "UNDER",
      "En smal grøft gir røret støtte fra sidene. Grav ikke bredere enn tegningen og arbeidet krever."),

    // ETTER
    valg("Bunnhøyde", "ETTER",
      [
        "Innenfor toleransen for grøftetypen",
        "Krav i beskrivelsen – oppfylt",
        "Utenfor – krever avretting",
      ],
      "Tillatt avvik i bunnen: rørgrøft i jord ±50 mm, rørgrøft i sprengstein +50 til +100 mm, fundamentgrøft i jord ±50 mm, fundamentgrøft i sprengstein ±100 mm, åpen grøft +50 til +200 mm, andre grøfter ±100 mm. Står det strengere krav i beskrivelsen, gjelder de. Noter største avvik i kommentaren."),
    valg("Sideavvik", "ETTER",
      [
        "Innenfor ±150 mm",
        "Utenfor – avvik",
      ],
      "Kontroller grøftekanten mot utstikkingen. Tillatt sideavvik er ±150 mm når beskrivelsen ikke sier noe annet."),
    trafikklys("Bunnen er ren og klar for ledning eller fundament", "ETTER",
      "Bunnen er fri for løse masser, ikke forstyrret eller frossen, og godkjent før ledning eller fundament legges. Ta bilde."),
    trafikklys("Grøften er sikret", "ETTER",
      "Åpen grøft er sperret og skiltet, og sikret mot overvann og ras ved nedbør."),
  ] as FeltDef[],
};

// FS2 – Utlegging av masser i lag. Omkoding av tidligere «FD2 – Fylling og komprimering» (ordre FS2
// 2026-09-19, gatet av Kenneth): utlegging hører til FS «Utlegging av løsmasser», ikke FD (uttak).
// Omkodingen frigjør samtidig FD2-koden til den nye grøftemalen (senere ordre). Nytt kapittel FS
// legges til KAPITTEL_DATA_F. Fylling (FS1.1) og lag (FS2) i én mal; grøft/tilbakefylling/under vann
// er avgrenset ut. 11 felt, INGEN tallfelt: lagtykkelse, komprimering, høyde og jevnhet besvares med
// samsvar per kravnivå (MAL-METODE §1), målt verdi/sted i kommentaren. De gamle desimalfeltene
// (lagtykkelse cm, komprimeringsgrad %, planhet mm) og «Overflate og drenering» (fall gjelder ikke FS)
// utgår. §7b: SiteDocs egne krav — ingen tabell-/punktkoder i hjelpetekstene; standarden kun i
// beskrivelsen. Kodene i navn/referanse beholdes (datanøkler + gjenkjennelse).
export const FS2_MAL = {
  kapittelKode: "FS",
  navn: "FS2 – Utlegging av masser i lag",
  referanse: "FS2",
  beskrivelse:
    "Utlegging av fylling og lag — masser, lagtykkelse, komprimering og toleranser. Faglig grunnlag: NS 3420-F:2024, post FS1 og FS2.",
  felter: [
    // FØR
    valg("Type lag", "FØR",
      [
        "Fylling",
        "Forsterkningslag",
        "Bærelag",
        "Underlag for konstruksjon",
        "Annet – se beskrivelsen",
      ],
      "Typen lag avgjør hvilken høydetoleranse som gjelder. For vei og plass gjelder vegvesenets krav i beskrivelsen."),
    valg("Masser", "FØR",
      [
        "Riktig masse – vareseddel kontrollert",
        "Stedlige masser – godkjent",
        "Avvik – feil masse",
      ],
      "Sjekk vareseddelen mot beskrivelsen. Massene skal ikke være frosne eller på annen måte skade laget. Største stein er maks 2/3 av lagtykkelsen."),
    trafikklys("Underlaget er klart", "FØR",
      "Underlaget er uten snø, is, organisk materiale og stående vann, og er godkjent før laget legges."),

    // UNDER
    valg("Lagtykkelse", "UNDER",
      [
        "Innenfor angitt tykkelse",
        "For tykt – rettes",
      ],
      "Tykkelsen etter komprimering skal i snitt ikke være større enn kravet i beskrivelsen. Enkeltmålinger kan avvike ±20 %. Husk at laget synker når det komprimeres."),
    valg("Komprimering", "UNDER",
      [
        "Normal – utført",
        "Lett – utført",
        "Ingen komprimering angitt",
        "Ikke som angitt – avvik",
      ],
      "Komprimer lag for lag slik beskrivelsen angir (normal, lett eller ingen), med utstyr og antall overfarter etter komprimeringsplanen."),
    valg("Kontroll av komprimering", "UNDER",
      [
        "Utført – resultat godkjent",
        "Ikke angitt i beskrivelsen",
        "Under krav – avvik",
      ],
      "Beskrivelsen sier hvor mye som skal kontrolleres (begrenset, normal eller utvidet). Legg ved måleresultatet."),
    trafikklys("Massene er ikke blandet", "UNDER",
      "Ulike masser og lag er holdt adskilt."),

    // ETTER
    valg("Høyde på topp", "ETTER",
      [
        "Fylling – innenfor ±100 mm",
        "Underlag for konstruksjon – innenfor ±20 mm",
        "Bærelag på idrettsplass – innenfor ±15 mm",
        "Krav i beskrivelsen – oppfylt",
        "Utenfor – avvik",
      ],
      "Kontroller toppen mot prosjektert høyde flere steder. Velg linjen for typen lag. Står det strengere krav i beskrivelsen, gjelder de. Noter største avvik i kommentaren."),
    valg("Jevnhet på 3 m rettholt", "ETTER",
      [
        "Innenfor ±10 mm",
        "Ikke aktuelt",
        "Utenfor – avvik",
      ],
      "Gjelder underlag og bærelag for konstruksjoner. Et lag som skal forkiles, må være jevnt før forkilingen."),
    valg("Kant på topp og fot", "ETTER",
      [
        "Innenfor +150/−0 mm",
        "Ikke aktuelt",
        "Utenfor – avvik",
      ],
      "Gjelder fylling. Kanten kan ligge inntil 150 mm utenfor prosjektert linje, men ikke innenfor."),
    trafikklys("Laget er godkjent før neste lag legges", "ETTER",
      "Laget oppfyller kravene over og er klart for neste lag eller neste arbeid. Ta bilde."),
  ] as FeltDef[],
};

// FH1 – Sprengning i dagen. Omkoding av tidligere «FC1 – Sprengning» (ordre FH1 2026-09-19, gatet av
// Kenneth): sprengning hører til FH «Uttak av berg», ikke FC (finnes ikke i normen). Nytt kapittel FH;
// tomt kildekapittel FC slettes av omkodings-SQL-en. Dekker sikkerhetstiltak + sprengning i dagen;
// under jord/vann, kontursprengning, rensk, pigging og grøft/grop er avgrenset ut. 12 felt, INGEN
// tallfelt: endelig flate og profil besvares med toleranseklassen fra beskrivelsen (samsvar), ikke
// tallfelt. §7b: SiteDocs egne krav — standarden kun i beskrivelsen. Grenseverdier står i beskrivelsen.
export const FH1_MAL = {
  kapittelKode: "FH",
  navn: "FH1 – Sprengning i dagen",
  referanse: "FH1",
  beskrivelse:
    "Sprengning i dagen — planer, varsling, boring og lading, vibrasjoner, endelig flate og salverapport. Faglig grunnlag: NS 3420-F:2024, post FH1.",
  felter: [
    // FØR
    trafikklys("Sprengningsplan og risikovurdering er skriftlige", "FØR",
      "Sprengningsplanen og risikovurderingen skal være skriftlige før sprengningsarbeidet starter, og tas vare på i minst 3 år etter at arbeidet er ferdig."),
    valg("Salveplan", "FØR",
      [
        "Skriftlig salveplan foreligger",
        "Mangler – ikke lad",
      ],
      "Hver salve skal ha skriftlig salveplan i god tid før den skytes, i tråd med sprengningsplanen."),
    valg("Varsling, sperring og dekking", "FØR",
      [
        "Berørte varslet, område sperret, salven dekket",
        "Mangler – ikke skyt",
      ],
      "Naboer og berørte er varslet, området er sperret og skiltet med vakter på plass, og salven er dekket etter planen."),
    valg("Vibrasjonsmåling", "FØR",
      [
        "Målere satt ut etter plan",
        "Ikke krav i beskrivelsen",
        "Mangler – ikke skyt",
      ],
      "Grenseverdiene for vibrasjon, støy og støv står i beskrivelsen. Plasser målerne slik planen sier før salven skytes."),

    // UNDER
    valg("Boring i endelig flate", "UNDER",
      [
        "Ansett innenfor 100 mm og retning innenfor 2 %",
        "Ikke endelig flate i denne salven",
        "Avvik",
      ],
      "Ingen hull skal settes an innenfor den endelige flaten. Ansettet skal ligge innenfor 100 mm fra planlagt punkt, og retningen kan avvike høyst 2 % per pall."),
    trafikklys("Redusert ladning i endelig flate", "UNDER",
      "Hullene i endelig flate, og ved behov raden innenfor, lades med redusert ladning tilpasset hullavstand og berg, så flaten ikke svekkes unødig."),

    // ETTER
    valg("Vibrasjon, støy og støv", "ETTER",
      [
        "Innenfor grenseverdiene",
        "Ikke krav – ikke målt",
        "Over grenseverdi – stopp og meld",
      ],
      "Les av målerne etter hver salve. Over grenseverdien: stopp, meld fra og vurder salveplanen før neste salve."),
    valg("Skutt ut nok i bunnen", "ETTER",
      [
        "OK – ikke berg over såle",
        "Gjenstående berg – pigges eller skytes",
      ],
      "Kontroller etter hver salve. Det skal ikke stå igjen berg over prosjektert nivå i sålen."),
    valg("Endelig flate", "ETTER",
      [
        "Innenfor toleranseklassen i beskrivelsen",
        "Knøler utenfor klassen – fjernes",
        "Avvik",
      ],
      "Toleranseklassen står i beskrivelsen: klasse 0 tillater ingen knøler innenfor endelig flate, klasse 1 enkeltknøler på høyst 0,15 m, klasse 2 høyst 0,5 m, klasse 3 har ingen krav."),
    valg("Avstand fra skjæring til konstruksjon", "ETTER",
      [
        "Oppfyller minsteavstanden",
        "Ikke aktuelt",
        "For smalt – avvik",
      ],
      "Betongvegg: minst 1,5 m fra skjæringen når den er inntil 8 m høy, ellers 2,0 m. Fundament: minst 1,0 m når fundamentet er inntil 1,0 m høyt, ellers 1,5 m. Beskrivelsen kan kreve mer."),
    valg("Udetonert sprengstoff", "ETTER",
      [
        "Kontrollert – ingen funnet",
        "Funnet – håndtert etter rutine",
      ],
      "Der det er sprengt før, kan det ligge igjen sprengstoff som ikke har gått av. Kontroller før pigging, rensk og opplasting."),
    trafikklys("Salverapport er skriftlig", "ETTER",
      "Rapporten viser boring, lading, tenning, dekking og målinger for salven, vurderer hvordan den gikk, og beskriver avvik og hvordan de ble håndtert."),
  ] as FeltDef[],
};

// FS3 – Legging og gjenfylling i grøft. Omkoding av tidligere «FE1 – Ledningsgrøfter» (ordre FS3
// 2026-09-19, gatet av Kenneth): legging og gjenfylling i grøft hører til FS3, ikke FE (finnes ikke i
// normen). Kapittel FS finnes (fra FS2); tomt kildekapittel FE slettes av omkodings-SQL-en. Grøfteløpet
// er FD2 (graving) → FS3 (legging). Ledningsfall og tetthets-/trykkprøving flyttet ut (Del U). 11 felt,
// INGEN tallfelt: fundament, sidefylling og gjenfylling besvares med samsvar (kravene i alternativ +
// hjelpetekst), målt verdi i kommentaren. §7b: SiteDocs egne krav — standarden kun i beskrivelsen.
export const FS3_MAL = {
  kapittelKode: "FS",
  navn: "FS3 – Legging og gjenfylling i grøft",
  referanse: "FS3",
  beskrivelse:
    "Fundament, sidefylling, beskyttelse, markering og gjenfylling i grøft for rør og kabler. Faglig grunnlag: NS 3420-F:2024, post FS3.",
  felter: [
    // FØR
    valg("Innhold i grøfta", "FØR",
      [
        "Rørledning",
        "Kabel eller kabelrør",
        "Kulvert eller kanal",
        "Flere typer",
      ],
      "Hva som ligger i grøfta, avgjør kravene til fundament, beskyttelseslag og masser."),
    trafikklys("Grøftebunnen er godkjent", "FØR",
      "Bunnen er kontrollert og godkjent i sjekklisten for graving av grøft før fundamentet legges."),
    valg("Masser", "FØR",
      [
        "Riktig masse – vareseddel kontrollert",
        "Stedlige masser – godkjent av byggherre",
        "Avvik",
      ],
      "Sjekk vareseddelen mot beskrivelsen. Stedlige masser skal være godkjent av byggherren. Stein over 500 mm sorteres ut der fyllingen skal komprimeres."),

    // UNDER
    valg("Fundament", "UNDER",
      [
        "Riktig tykkelse, overkant innenfor ±30 mm",
        "Avvik",
      ],
      "Rør: overkant fundament innenfor ±30 mm. Vanlig minste tykkelse er 150 mm for rør under DN 400, tykkere for større rør — se beskrivelsen. Kabel og kabelrør: minst 50 mm, med masser inntil 8 mm for kabel og 16 mm for kabelrør. Røret skal ikke heve seg når fundamentet komprimeres."),
    valg("Sidefylling og beskyttelseslag", "UNDER",
      [
        "Lagvis på begge sider, godt pakket",
        "Avvik",
      ],
      "Legg massene forsiktig og lagvis på begge sider, og pakk godt rundt ledningen. Ikke tipp rett fra lasteplanet. Fyll i hele grøftebredden til 0,3 m over øverste ledning. Kabel: beskyttelseslag minst 100 mm med masser inntil 8 mm."),
    valg("Komprimering ved ledningen", "UNDER",
      [
        "Utstyr innenfor vektgrensen for rørtypen",
        "Avvik – for tungt utstyr",
      ],
      "Største vekt på komprimeringsutstyr ved siden av ledningen: plastrør og korrugerte stålrør 60 kg, betong-, stål- og støpejernsrør 100 kg (over DN 1000: 200 kg). Røret skal ikke skades eller forskyves."),
    trafikklys("Innmåling før gjenfylling", "UNDER",
      "Ledninger og kabler er målt inn før de dekkes til."),
    valg("Beskyttelse og skille", "UNDER",
      [
        "Lagt etter beskrivelsen",
        "Ikke krav",
        "Mangler",
      ],
      "Varerør, lastfordelingsplater, dekkplater og skillestein legges slik beskrivelsen sier. Ligger to eller flere kabler i samme grøft, skal det være en tett rekke skillestein eller skilleplater mellom dem."),
    valg("Markeringsbånd", "UNDER",
      [
        "Lagt midt over øverste ledning",
        "Ikke krav",
        "Mangler",
      ],
      "Båndet legges oppå beskyttelseslaget, midt over øverste ledning. Det skal være minst 40 mm bredt og ha en holdbar, lys kontrastfarge."),

    // ETTER
    valg("Gjenfylling", "ETTER",
      [
        "Lagvis og komprimert etter beskrivelsen",
        "Avvik",
      ],
      "Fyll lagvis og komprimer slik beskrivelsen angir. Ikke tipp rett fra lasteplanet, og ikke kjør tunge maskiner over ledningen før overdekningen er stor nok. Over ubeskyttet kabel skal de første 0,20 m være masser inntil 45 mm."),
    trafikklys("Grøfta er ferdig gjenfylt og klar for overlevering", "ETTER",
      "Grøfta er fylt opp til prosjektert høyde, og ledningene er uskadet. Ta bilde."),
  ] as FeltDef[],
};

// KA7/KB2/KB4/KB6 – eksportert som egne definisjoner (§7b-retting 2026-09-19) slik at
// generer-mal-sql.ts finner dem (samme mønster som KC31_MAL/KD1_MAL) og §7b-testen kan iterere
// alle K-malene. Bygget med eksisterende helpers; skriveveien er urørt.
//
// §7b (design-rollen, gatet av Kenneth 2026-09-19): malene fremstår med SiteDocs egne krav — ingen
// tabell-/punktkoder eller eksterne NS-standarder i navn, hjelpetekster eller svaralternativer.
// Standarden nevnes én gang, i beskrivelsen («Faglig grunnlag»). Kodene i navn/referanse beholdes
// (datanøkler + gjenkjennelse i beskrivelse/fremdriftsplan). Felt, typer og faser er uendret.
export const KA7_MAL = {
  kapittelKode: "KA",
  navn: "KA7 – Rengjøring og sortering av gjenbruksmaterialer",
  referanse: "KA7",
  beskrivelse:
    "Rengjøring og sortering av stein, betong og treverk som skal brukes om igjen. Gjenbruk av jord dekkes ikke her. Faglig grunnlag: NS 3420-K:2024, post KA7.",
  felter: [
    valg("Type materiale", "FØR",
      ["Belegningsstein/heller", "Naturstein", "Kantstein", "Murblokk", "Treverk", "Annet – angi i kommentar"],
      "Angi hvilket materiale som gjenbrukes. Mengde og bruksområde står i beskrivelsen."),
    valg("Materialstatus", "FØR",
      ["Sortert og godkjent", "Delvis sortert", "Ikke sortert", "Uegnet"],
      "Vurder tilstanden ved mottak/oppstart. Kravene til godkjenning står i prosjektbeskrivelsen. Ta bilde av materialene slik de står."),
    trafikklys("Dokumentasjon på opprinnelse", "FØR",
      "Hvor kommer materialene fra? Legg ved følgeseddel/foto hvis tilgjengelig."),
    trafikklys("Lagringsplass godkjent", "FØR",
      "Tørt, stabilt underlag uten fare for tilsøling eller skade frem til bruk."),
    trafikklys("Materialer rengjort", "UNDER",
      "Rengjort slik beskrivelsen krever. Ta bilde etter rengjøring."),
    trafikklys("Materialer sortert", "UNDER",
      "Sortert etter type og kvalitet slik beskrivelsen krever. Uegnede materialer er skilt ut. Ta bilde av de sorterte fraksjonene."),
    trafikklys("Godkjenningskriterier i beskrivelsen oppfylt", "ETTER",
      "Kontroller mot godkjenningskriteriene i prosjektbeskrivelsen for posten."),
    trafikklys("Dokumentasjonskrav levert", "ETTER",
      "Bilder og øvrig dokumentasjon som beskrivelsen krever er lagt ved dette dokumentet."),
  ] as FeltDef[],
};

export const FB4_MAL = {
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
  ] as FeltDef[],
};

export const FD3_MAL = {
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
  ] as FeltDef[],
};

export const KB2_MAL = {
  kapittelKode: "KB",
  navn: "KB2 – Utlegging av vekstjord",
  referanse: "KB2",
  beskrivelse:
    "Utlegging av vekstjord på terreng — lagtykkelse, jordkvalitet, planhet og fall. Faglig grunnlag: NS 3420-K:2024, post KB2.2.",
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
      "Formålet avgjør anbefalt tykkelse på vekstjorda over egnet undergrunn (tallet i parentes). Over steinfylling, berg eller tett leire kommer et lag mineraljord i tillegg, til sammen 40, 70 eller 100 cm. Vekstjord tykkere enn 50 cm legges i to lag, det nederste med lite mold. Beskrivelsen kan angi andre tykkelser."),
    valg("Underlag", "FØR",
      [
        "Stedlig jord – godkjent og drenert",
        "Stedlig jord – krever løsgjøring/utbedring",
        "Steinfylling/berg – mineraljordlag påført",
        "Steinfylling/berg – krever mineraljordlag",
      ],
      "Løs opp hardpakket undergrunn før utlegging, og unngå å kjøre den sammen igjen."),
    trafikklys("Varedeklarasjon kontrollert", "FØR",
      "Jorda skal leveres med varedeklarasjon. Kontroller at pH ligger mellom 5,5 og 7,0 og at jorda er fri for rotugras. Ta bilde av varedeklarasjonen."),

    // UNDER
    heltall("Lagtykkelse vekstjord – minste måling (cm)", "UNDER", { enhet: "cm" },
      "Anbefalt tykkelse: blomstereng 10, gras og utplanting 20, stauder og busker 40, trær 60 cm. Tykkelsen gjelder etter at jorda har satt seg — legg ut med overhøyde. Mål på minst 3 punkter og før inn den laveste målingen (hele cm)."),
    valg("Maks steinstørrelse", "UNDER",
      [
        "OK – under 20 mm (gras/blomstereng)",
        "OK – under 60 mm (busker/stauder/utplanting)",
        "OK – under 100 mm (trær)",
        "Avvik – for store steiner funnet",
      ],
      "Største tillatte stein: 20 mm under gras og blomstereng, 60 mm under utplanting, busker og stauder, 100 mm under trær."),
    trafikklys("Jord ikke komprimert", "UNDER",
      "Jorda pakkes bare lett. Verken undergrunn eller jordlag skal komprimeres under utleggingen."),

    // ETTER
    valg("Planhet – svanker/bulninger over 3 m", "ETTER",
      [
        "OK – innenfor 15 mm (green/fairway/tee)",
        "OK – innenfor 20 mm (grasbane)",
        "OK – innenfor 30 mm (grasplen)",
        "OK – innenfor 50 mm (grasbakke/eng)",
        "Avvik – utenfor toleranse for dekketypen",
      ],
      "Toleransen avhenger av dekketypen. Kontroller flere steder med 3 m rettholt og velg raden for dekketypen. Ved avvik: noter største måling og sted i kommentaren. For gras kontrolleres planheten på ferdig grasdekke."),
    trafikklys("Fall minst 2 % mot avrenning", "ETTER",
      "Ferdig overflate skal ha minst 2 % fall (1:50), med mindre beskrivelsen sier noe annet. Kontroller flere steder. Ved avvik: noter målt fall og sted i kommentaren."),
    trafikklys("Overflate jevn, fri for stein og ugras", "ETTER",
      "Flater og overganger er jevne, uten stein som hindrer skjøtsel, og fri for rotugras. Ta bilde av ferdig flate."),
  ] as FeltDef[],
};

export const KB4_MAL = {
  kapittelKode: "KB",
  navn: "KB4 – Etablering av gras",
  referanse: "KB4",
  beskrivelse:
    "Etablering av gras ved såing eller ferdigplen — materialkontroll, utførelse og krav ved overlevering. Faglig grunnlag: NS 3420-K:2024, post KB4.",
  felter: [
    // FØR
    valg("Formål", "FØR",
      ["Grasplen", "Grasbane", "Grasbakke og eng", "Annet – angi i kommentar"],
      "Formålet avgjør kravet ved overlevering: grasbakke og eng skal i tillegg være minst 100 mm høy."),
    valg("Metode", "FØR",
      ["Sådd (ikke sprøytesådd)", "Sprøytesådd", "Ferdigplen", "Annen metode – angi i kommentar"],
      "Metoden skal være den beskrivelsen angir."),
    trafikklys("Frø/ferdigplen kontrollert og dokumentert", "FØR",
      "Frø: emballasjen skal være merket og opphavet dokumentert. Ferdigplen: tett gras med godt utviklede røtter og utløpere. Frøblanding og mengde per m² står i beskrivelsen. Ta bilde av etiketten eller følgeseddelen."),
    trafikklys("Jordlag løsgjort og finplanert", "FØR",
      "Jordlaget er løst opp og finplanert, klart for såing eller legging. Jordas kvalitet og fall dokumenteres i sjekklisten KB2."),

    // UNDER
    trafikklys("God kontakt frø/plen mot jord", "UNDER",
      "Frø: god kontakt med jorda, for eksempel ved nedmolding eller tromling. Ferdigplen: lagt tett, i forband og med god kontakt mot underlaget. Ta bilde."),
    trafikklys("Vannet etter legging/såing", "UNDER",
      "Vanning etter såing/legging sikrer etableringen. Prosjektspesifikke skjøtselskrav står i beskrivelsen."),
    trafikklys("Klippet jevnlig frem til overtakelse", "UNDER",
      "Grasplen og grasbane klippes jevnlig fram til overlevering. Gjelder ikke grasbakke og eng — sett «Ikke relevant»."),

    // ETTER
    desimal("Markdekningsgrad (%)", "ETTER", { enhet: "%" },
      "Minst 95 % av marka skal være dekket ved overlevering, med mindre beskrivelsen sier noe annet. Bedøm visuelt eller med prøverute, og før inn verdien."),
    trafikklys("Ferdig gressflate godkjent for overtakelse", "ETTER",
      "Graset er jevnt og i god vekst, uten bare flekker større enn 1 dm². Grasbakke er i tillegg minst 100 mm høyt. Ta bilde av ferdig flate."),
  ] as FeltDef[],
};

export const KB6_MAL = {
  kapittelKode: "KB",
  navn: "KB6 – Planting",
  referanse: "KB6",
  beskrivelse:
    "Planting av trær, busker, stauder, utplantingsplanter, løk og knoller — mottakskontroll, utførelse og krav ved overlevering. Faglig grunnlag: NS 3420-K:2024, post KB6.",
  felter: [
    // FØR
    valg("Plantegruppe", "FØR",
      ["Trær", "Busker", "Stauder", "Utplantingsplanter", "Løk og knoller", "Blandet – angi i kommentar"],
      "Avgjør hvilke krav som gjelder i feltene under. Art, sort, størrelse, leveringsform og planteavstand står i beskrivelsen."),
    valg("Plantekvalitet", "FØR",
      ["Godkjent – iht. plantelista", "Avvik – dokumentert i kommentar", "Underkjent – returneres"],
      "Kontroller art, størrelse, leveringsform og kvalitet mot plantelista i beskrivelsen. Ta bilde av leveransen og eventuelt mottaksskjemaet."),
    valg("Tilstand ved ankomst", "FØR",
      ["Saftspente og fuktige", "Noe tørre – vannes straks", "Uttørket – returneres"],
      "Plantene skal være saftspente og ha fuktig rotklump når de plantes."),

    // UNDER
    valg("Plantedybde og rothals", "UNDER",
      [
        "Trær/busker: rothals over jorda, klump tildekket",
        "Stauder/utplanting: klumpen akkurat dekket",
        "Podede roser: podested dekket av jord",
        "Avvik – må justeres",
      ],
      "Trær og busker: rothalsen over jorda og rotklumpen dekket. Stauder og utplantingsplanter: klumpen akkurat dekket, så den ikke tørker ut. Podede roser: podestedet dekket av jord."),
    trafikklys("Pakking og kontakt rot/jord", "UNDER",
      "God kontakt mellom rot og jord. Trær: pakk jorda under rotklumpen og plant litt høyt, så treet ikke synker under terrenget — men ikke så hardt at dreneringen i plantehullet blir dårlig. Barrotsplanter plantes mens de er i hvile; røttene skal ikke bøyes, men kan stusses."),
    trafikklys("Rotbløyte utført", "UNDER",
      "Vann grundig ved planting."),
    trafikklys("Beskjæring ved planting", "UNDER",
      "Beskjær bare skadde greiner ved planting. Unntak: hekkplanter uten gjennomgående stamme toppes, så de forgreiner seg godt."),

    // ETTER
    valg("Oppbinding/støtte", "ETTER",
      ["Montert – kontrolleres i sjekklisten KC3.1", "Ikke nødvendig", "Mangler"],
      "Oppstøtting og oppbinding er ikke en del av plantingen. Kravene står i sjekklisten KC3.1."),
    trafikklys("Plantefelt fritt for ugras", "ETTER",
      "Plantefeltet er fritt for ugras ved overlevering. Ta bilde av ferdig plantefelt."),
    trafikklys("Krav oppfylt og dokumentasjon levert", "ETTER",
      "Kontroller mot beskrivelsen: riktig antall og planteavstand, alle krav oppfylt. Bilder og eventuelt mottaksskjema er lagt ved dette dokumentet."),
  ] as FeltDef[],
};

// UM1 – Legging av VA-ledninger. REVIDERT til v2 med betingede felt (ordre UM1 v2 2026-09-22,
// gatet av Kenneth). Standard NS3420-U:2019, kapittel UM. Grøfteløpet: FD2 (graving) → UM1
// (legging) → FS3 (omfylling) → UU1 (prøving). 14 felt, INGEN tallfelt (§1): plassering, fall,
// forankring og avstand besvares med samsvar, målt verdi/sted i kommentaren.
//
// TO UAVHENGIGE TRÆR (ordre §2):
//  · «ledningstype» (felt 1, FØR) — forelder for fall (ETTER), filterlag/duk (UNDER),
//    perforering (UNDER) og forankring (UNDER). Barna ligger i ANNEN fase enn forelderen →
//    `barnAv` (kryss-fase, §1f). §4-fasemålingen er positiv (JH2/UP), bekreftet i relay 2026-09-22.
//  · «skjoting» (felt 8, UNDER) — forelder for sveiseskjøt-dokumentasjon (UNDER). SAMME fase →
//    `forgrening` (§1f). Sveiseloggen henger på SKJØTEMETODEN, ikke ledningstypen (ordre §2).
//
// Ni felt vises alltid (Type ledning, Rør og deler, Grøftebunn, Skjøting, Røret hviler, Ren
// innvendig, Avstand, Plassering, Klar for omfylling); fem er betingede. §1c: «sveist» er et SVAR
// på forankring (dokumenterer HVORFOR forankring ikke kreves), ikke en skjult sti. `faseSortert`
// sikrer FØR→UNDER→ETTER-overskrifter når betingede barn er spredt over faser.
// §7b: SiteDocs egne krav — standarden kun i beskrivelsen. Prøving er egen mal (UU1). Felt 9 peker
// på UM1.1 (skjøt-pr-skjøt) — de to malene bygges og merges SAMMEN.
export const UM1_MAL = {
  kapittelKode: "UM",
  navn: "UM1 – Legging av VA-ledninger",
  referanse: "UM1",
  beskrivelse:
    "Legging og skjøting av vann-, avløps- og drensledninger i grøft — rørmateriell, fundament, skjøter, forankring, fall og plassering. Faglig grunnlag: NS 3420-U:2019, post UM1.",
  felter: faseSortert([
    // Tre 1 — «ledningstype» (FØR), barn i UNDER/ETTER → barnAv (kryss-fase)
    forelderFelt("ledningstype",
      valg("Type ledning", "FØR",
        [
          "Vannledning",
          "Avløp, selvfall",
          "Avløp, trykk",
          "Drensledning",
          "Annen ledning",
        ],
        "Typen ledning avgjør skjøtemetode, hvilke krav som gjelder for fall og forankring, og hvilken prøving som skal gjøres etterpå. Skriv strekningen i emnefeltet med kumnavnene fra tegningen: SP-04 til SP-05, V-01 til V-02, OV-02 til OV-03. Går ikke strekningen mellom to kummer, skriver du ledningstypen og pelene i stedet: VL P120 til P180. Det er slik strekningen finnes igjen senere.")),
    barnAv("ledningstype", ["Avløp, selvfall", "Drensledning"],
      valg("Fall", "ETTER",
        [
          "Innenfor toleransen for prosjektert fall",
          "Avvik",
        ],
        "Tillatt avvik: ±2 ‰ når fallet er under 10 ‰, ±3 ‰ ved 10–20 ‰, og ±5 ‰ når fallet er over 20 ‰. Gjelder hvert rør og hele strekningen. Mål før omfylling — etterpå er det for sent å rette.")),
    barnAv("ledningstype", ["Drensledning"],
      valg("Filterlag og duk rundt ledningen", "UNDER",
        [
          "Filtermasse og duk som beskrevet",
          "Avvik – rettes før omfylling",
        ],
        "Drensledningen skal omgis av den filtermassen beskrivelsen angir, og duken skal ligge slik at finstoff ikke vaskes inn i røret. Et drensrør som gror igjen, kan ikke utbedres senere uten å grave opp.")),
    barnAv("ledningstype", ["Drensledning"],
      valg("Perforeringen vendt opp", "UNDER",
        [
          "Slissene ligger opp",
          "Avvik – rettes før omfylling",
        ],
        "Slissene skal ligge opp. Silt og finstoff bygger seg opp fra bunnen av røret, så perforering vendt ned tetter seg igjen — og da kan ledningen ikke utbedres uten å grave opp. Kontroller også at spylepunkter og utløp er der tegningen viser.")),
    barnAv("ledningstype", ["Vannledning", "Avløp, trykk"],
      valg("Forankring av bend", "UNDER",
        [
          "Forankret som beskrevet – bend over 15° med muffeskjøter",
          "Ikke krav – ledningen er sveist, skjøtene er strekkfaste",
          "Ikke krav – ingen bend over 15° på denne strekningen",
          "Avvik",
        ],
        "Forankring gjelder bend over 15° og trykkledninger med muffer. En sveist PE-ledning får ikke forankring — sveiseskjøtene er strekkfaste og tar kraften selv. En trykkledning skyver seg utover i bend, T-rør, reduksjoner og endelokk, og forankringen skal være på plass før ledningen settes under trykk.")),

    // FØR — alltid synlige (uendret fra v1)
    valg("Rør og deler kontrollert", "FØR",
      [
        "Rene og uskadde",
        "Skadet – kassert eller reparert",
      ],
      "Rør og deler skal være rene inn- og utvendig før montering. Plastrør lagres skjermet mot sol og varme. PE-rør: utvendige riper høyst 10 % av veggtykkelsen, ingen innvendige riper. Dypere skader kappes ut eller repareres."),
    trafikklys("Grøftebunn og fundament klare", "FØR",
      "Bunnen er fri for tele, snø og is. Øverste tredjedel av fundamentet er løsnet langs senterlinjen, minst en halv rørdiameter bredt. Grav ut for muffene så røret hviler på fundamentet."),

    // Tre 2 — «skjoting» (UNDER), barn i SAMME fase → forgrening
    ...forgrening("skjoting",
      valg("Skjøting", "UNDER",
        [
          "Muffe",
          "PE-sveis",
          "Flens eller kobling",
          "Avvik",
        ],
        "Rørene sentreres, og skjøtekraften skal virke langs røret. Rør som brukes som mothold, støttes så de ikke forskyves. Flensskjøter ettertrekkes. Klemringskobling på PE-rør skal ha støttehylse innvendig."),
      [
        {
          naar: ["PE-sveis"],
          felt: valg("Sveiseskjøter dokumentert", "UNDER",
            [
              "Alle skjøter har egen sjekkliste",
              "Mangler",
            ],
            "Hver sveiseskjøt dokumenteres i sin egen sjekkliste, med sveiseparametre, sveiserens ID og signatur. Dette feltet bekrefter bare at ingen skjøt på strekningen mangler — selve loggen hører ikke hjemme her."),
        },
      ]),

    // UNDER — alltid synlige (uendret fra v1)
    trafikklys("Røret hviler på fundamentet, ingen skolinger", "UNDER",
      "Røret skal ligge jevnt på fundamentet hele veien og ikke på klosser eller steiner."),
    trafikklys("Ledningen holdt ren innvendig", "UNDER",
      "Slam, jord og fremmedlegemer skal ikke komme inn i ledningen. Tett åpne ender når arbeidet stopper."),
    valg("Avstand til kum og andre ledninger", "UNDER",
      [
        "Minst 100 mm",
        "Tiltak mot kontakt utført",
        "Avvik",
      ],
      "Minst 100 mm fra kumvegg og fra ledninger og kabler som krysser eller går forbi. Ligger ledningene i flere lag, omfylles og komprimeres den nederste opp til neste før den legges."),

    // ETTER — alltid synlige
    valg("Plassering i høyde og side", "ETTER",
      [
        "Innenfor ±30 mm høyde og ±100 mm side",
        "Avvik",
      ],
      "Kontroller mot prosjektert plassering, både for hvert rør og for hele strekningen. Noter største avvik i kommentaren."),
    trafikklys("Ledningen er klar for omfylling", "ETTER",
      "Ledningen er lagt, skjøtt, innmålt og kontrollert og kan omfylles. Innmålingen tas før ledningen dekkes til — etterpå må det graves opp. Ta bilde."),
  ]) as FeltDef[],
};

// UM1.1 – Skjøt på PE-ledning. NY mal (ordre UM1.1 2026-09-22, gatet av Kenneth), bygget SAMMEN med
// UM1 v2 (felt 9 der peker på denne). Standard NS3420-U:2019, kapittel UM (finnes fra UM1 — ingen
// nytt kapittel). Dokumentets enhet er SKJØTEN: én sjekkliste pr. skjøt (normkrav c3.2.8/c3.2.9,
// omskrevet til egne ord, §7b). 18 felt, INGEN tallfelt (§1) — parametrene hører i sveiseskjemaet.
//
// TO UAVHENGIGE TRÆR (ordre §5):
//  · «hvaskjotes» (felt 1, FØR) — forelder for bendets retning (FØR) og anboring/uttak (FØR).
//    SAMME fase → `forgrening` (§1f).
//  · «skjotetype» (felt 5, FØR) — forelder for hele resten: sveisegruppen (fem barn under samme
//    utløserpar Elektromuffesveis+Speilsveis), elektromuffe-paret, speilsveis-paret, klemring og
//    flens. Barna ligger i UNDER → `barnAv` (kryss-fase, §1f). Fem barn under samme utløserpar er
//    bygget som FEM egne `barnAv`-kall (ikke `felt:[a..e]`), så hvert barn får sin egen parentRef.
//
// Fem felt vises alltid (Hva skjøtes, Rør og deler, Skjøtetype, Skjøten merket, Skjøten klar); de
// tretten øvrige er betingede. §7b/§7c: PE/SDR/elektromuffe/speilsveis/buttsveis er produkt- og
// metodebetegnelser (tillatt); «pel» (posisjon), ALDRI «pæl» (fundamenteringspæl). Emnet bærer
// ledning + pelnummer + sveisenummer (VL P120 S14) — sveisenummeret skiller to skjøter på samme bend.
export const UM11_MAL = {
  kapittelKode: "UM",
  navn: "UM1.1 – Skjøt på PE-ledning",
  referanse: "UM1.1",
  beskrivelse:
    "Skjøt på PE-ledning for vann, avløp og drens — skjøtetype, rørkontroll, sveiseprosedyre, parametre, avkjøling og merking. Én sjekkliste pr. skjøt. Gjelder sveiste og mekaniske skjøter, bend, muffer og stikkledningsuttak. Faglig grunnlag: NS 3420-U:2019, post UM1.1.",
  felter: faseSortert([
    // Tre A — «hvaskjotes» (FØR), barn i SAMME fase → forgrening
    ...forgrening("hvaskjotes",
      valg("Hva skjøtes", "FØR",
        [
          "Skjøt på rett rør",
          "Bend",
          "Muffe eller overgang",
          "Uttak av stikkledning",
          "Annen del – se beskrivelsen",
        ],
        "Skriv ledningen, pelnummeret og sveisenummeret i emnefeltet: VL P120 S14 for vannledning, SP P340 S22 for spillvann, OV P95 S07 for overvann. Sveisenummeret er det samme som i sveiseskjemaet og på merkingen av skjøten, og det er det som skiller to skjøter på samme bend. Én sjekkliste pr. skjøt — et bend har to ender og gir to lister. Kontrollen gjelder uansett om bendet eller muffen er priset som egen post eller inngår i løpemeterprisen — en skjøt som svikter, svikter like fullt."),
      [
        {
          naar: ["Bend"],
          felt: valg("Bendets retning og vinkel", "FØR",
            [
              "Riktig vinkel og retning, forankret som beskrevet",
              "Forankring ikke krevd her",
              "Avvik",
            ],
            "Kontroller vinkelen og retningen mot tegningen før skjøten lages — et bend som peker feil, rives opp igjen. Står ledningen under trykk, skyver bendet seg utover, og kraften skal tas opp av mothold eller strekkfaste skjøter slik beskrivelsen angir."),
        },
        {
          naar: ["Uttak av stikkledning"],
          felt: valg("Anboring og uttak", "FØR",
            [
              "Klammer og deler tilpasset rørmaterialene, ledningen rengjort, uttaket tett",
              "Avvik",
            ],
            "Anboringsklammer og T-rør skal passe til rørmaterialet i både hovedledning og stikkledning. Rengjør ledningen utvendig der klammeret settes på. Kontroller at uttaket er tett, og at hovedledningen ikke er svekket av boringen."),
        },
      ]),

    // FØR — alltid synlig
    valg("Rør og deler kontrollert", "FØR",
      [
        "Riktig dimensjon og trykklasse, riper innenfor grensen",
        "Skade kappet bort eller reparert",
        "Avvik",
      ],
      "Utvendig ripe kan være høyst 10 % av godstykkelsen. Rensk området jevnt med rørflaten med skarp kniv før du måler dybden — ellers måler du feil. Skarpe riper avrundes og fylles med ekstrudersveis. Er skaden dypere, kappes delen bort, eller den dekkes med en elektrisk reparasjonssadel. Innvendige riper aksepteres ikke. Rør levert på kveil rettes ut, og eventuell kappe fjernes der skjøten skal lages."),

    // Tre B — «skjotetype» (FØR), barn i UNDER → barnAv (kryss-fase)
    forelderFelt("skjotetype",
      valg("Skjøtetype", "FØR",
        [
          "Elektromuffesveis",
          "Speilsveis (buttsveis)",
          "Klemringsskjøt",
          "Flenseskjøt eller løsflens",
          "Annen skjøt – se beskrivelsen",
        ],
        "Skjøtetypen avgjør hva som kontrolleres. Mindre dimensjoner leveres på kveil og skjøtes ofte med klemring i stedet for sveis — da gjelder helt andre krav enn ved sveising.")),

    // Sveisegruppe — fem barn under samme utløserpar (Elektromuffesveis + Speilsveis)
    barnAv("skjotetype", ["Elektromuffesveis", "Speilsveis (buttsveis)"],
      valg("Prosedyre, kalibrering og sertifikat", "UNDER",
        [
          "Prosedyre foreligger, maskinen kalibrert, sveiseren sertifisert",
          "Avvik",
        ],
        "Sveiseprosedyren for denne maskinen og dette rørmaterialet skal være utarbeidet før arbeidet starter, på grunnlag fra rørprodusenten. Er noe uklart, er det produsentens anvisning som gjelder. Maskinen skal være kalibrert, og sveiseren skal ha gyldig sertifikat for metoden.")),
    barnAv("skjotetype", ["Elektromuffesveis", "Speilsveis (buttsveis)"],
      valg("Forholdene på stedet", "UNDER",
        [
          "Tørt og skjermet, rørendene tildekket",
          "Telt eller oppvarming brukt",
          "Avvik – sveiset likevel",
        ],
        "Sveising skal være beskyttet mot støv og nedbør, og skal ikke utføres under 0 °C uten oppvarmet telt. Dekk rørendene med plast for å hindre trekk og avkjøling gjennom røret.")),
    barnAv("skjotetype", ["Elektromuffesveis", "Speilsveis (buttsveis)"],
      valg("Ovalitet og oppspenning", "UNDER",
        [
          "Ovalitet kontrollert og rettet, sveiseområdet oppspent",
          "Avvik",
        ],
        "Ovalitet og toleranser kontrolleres og rettes før sveising, med rundingsverktøy. Kveilrør er alltid ovalt og skal rundes. Sveiseområdet spennes opp så muffen står stabil gjennom hele sveisen. Bruk verktøy levert eller godkjent av muffeleverandøren.")),
    barnAv("skjotetype", ["Elektromuffesveis", "Speilsveis (buttsveis)"],
      valg("Sveiseparametre ført i skjema", "UNDER",
        [
          "Ført og signert av utførende sveiser",
          "Avvik",
        ],
        "Skjemaet skal vise sveisenummer, muffeidentitet, sveisetrykk, sveisetemperatur, sveisetid, værforhold, lufttemperatur og tildekking, og være signert av den som sveiset. Legg skjemaet ved.")),
    barnAv("skjotetype", ["Elektromuffesveis", "Speilsveis (buttsveis)"],
      valg("Avkjøling", "UNDER",
        [
          "Full avkjølingstid, uten belastning",
          "Avvik",
        ],
        "Skjøten skal stå hele den foreskrevne avkjølingstiden, og skal ikke belastes, beveges eller trykkprøves før tiden er ute. Dette er punktet som oftest ryker under tidspress.")),

    // Elektromuffe — utløses av Elektromuffesveis
    barnAv("skjotetype", ["Elektromuffesveis"],
      valg("Skraping av røroverflaten", "UNDER",
        [
          "Skrapt med leverandørens verktøy over hele muffelengden",
          "Avvik",
        ],
        "Skrap med verktøy levert eller godkjent av muffeleverandøren, etter leverandørens instruks. Håndskraping er ikke tillatt — oksidsjiktet skal bort, ikke bare pusses. Ta ikke på skjøteflaten etterpå.")),
    barnAv("skjotetype", ["Elektromuffesveis"],
      valg("Smelteindikatorer", "UNDER",
        [
          "Indikatorer ute på begge sider, muffen sitter i posisjon",
          "Avvik",
        ],
        "Begge indikatorene skal ha kommet ut. Har bare én kommet ut, er skjøten ikke godkjent — den kappes ut. Kontroller også at muffen ikke har forskjøvet seg.")),

    // Speilsveis — utløses av Speilsveis (buttsveis)
    barnAv("skjotetype", ["Speilsveis (buttsveis)"],
      valg("Høvling og oppstilling", "UNDER",
        [
          "Endene høvlet, rørene i samme akse, kantavvik innenfor kravet",
          "Avvik",
        ],
        "Høvle begge ender umiddelbart før sveising, og kontroller at flatene ligger an mot hverandre hele veien rundt. Rørene skal ligge i samme akse — kantavvik gir en svak sveis selv med riktige parametre.")),
    barnAv("skjotetype", ["Speilsveis (buttsveis)"],
      valg("Vulsten", "UNDER",
        [
          "Jevn og symmetrisk hele veien rundt",
          "Avvik",
        ],
        "Vulsten skal være jevn og like stor på begge sider hele veien rundt røret. Skjev eller ujevn vulst betyr skjev oppstilling eller feil parametre — skjøten kappes ut og sveises på nytt.")),

    // Mekaniske skjøter
    barnAv("skjotetype", ["Klemringsskjøt"],
      valg("Støttehylse og tiltrekking", "UNDER",
        [
          "Støttehylse montert innvendig, koblingen trukket til",
          "Avvik",
        ],
        "Klemringskobling på PE-rør skal ha støttehylse innvendig. Uten den trekker røret seg sammen under klemringen, og skjøten begynner å lekke. Trekk til etter leverandørens anvisning.")),
    barnAv("skjotetype", ["Flenseskjøt eller løsflens"],
      valg("Ettertrekking av flens", "UNDER",
        [
          "Ettertrukket etter montering",
          "Avvik",
        ],
        "Flenseskjøter skal ettertrekkes. PE gir seg over tid, og en flens som bare er trukket én gang, lekker senere.")),

    // ETTER — alltid synlige
    valg("Skjøten merket", "ETTER",
      [
        "Merket med pelnummer, og med sveiserens ID der det er sveiset",
        "Avvik",
      ],
      "Hver sveiset skjøt skal merkes med sveiserens identifikasjon. Ta med pelnummeret på alle skjøter, også de mekaniske, så kan skjøten knyttes til denne sjekklisten når grøfta er fylt igjen."),
    trafikklys("Skjøten er dokumentert og klar", "ETTER",
      "Skjema og følgesedler er tatt vare på, skjøten er merket og innmålt, og den kan omfylles. Ta bilde av skjøten og av merkingen før den dekkes til."),
  ]) as FeltDef[],
};

// UU1 – Prøving av VA-ledninger. Andre mal i NS 3420-U (ordre UU1 2026-09-19, gatet av Kenneth).
// Nytt kapittel UU «Felles arbeider for utendørs rørledningsanlegg» i samme standard NS3420-U
// (opprettet av UM1). Prøving gjøres ofte av andre enn dem som legger — malen står på egne ben og
// bekrefter selv at ledningen er ferdig før prøving. 11 felt, INGEN tallfelt: tetthet, trykk og
// deformasjon besvares med samsvar (bestått/avvik), tall/verdier i rapporten. §7b: SiteDocs egne
// krav — standarden nevnes kun i beskrivelsen.
export const UU1_MAL = {
  kapittelKode: "UU",
  navn: "UU1 – Prøving av VA-ledninger",
  referanse: "UU1",
  beskrivelse:
    "Prøving og klargjøring av vann-, avløps- og drensledninger og kummer — tetthet, trykk, deformasjon, inspeksjon, spyling, desinfisering og rapport. Faglig grunnlag: NS 3420-U:2019, post UU1.",
  felter: [
    // FØR
    valg("Hva prøves", "FØR",
      [
        "Avløp, selvfall",
        "Trykkledning",
        "Kum",
        "Drensledning",
        "Annet",
      ],
      "Hva som prøves, avgjør metode og krav. Metode og prøvetrykk står i beskrivelsen."),
    trafikklys("Ledningen er gjenfylt og ferdig", "FØR",
      "Prøving gjøres etter at ledningen er gjenfylt og ferdigstilt. Sjekk at legging og gjenfylling er godkjent før du starter."),
    trafikklys("Prøvestrekningen er klargjort", "FØR",
      "Tettingspropper i hver ende og ved alle avgreininger. Ledning og kum er sikret så de ikke forskyver seg. Før prøving med luft tømmes de for vann. Prøves en kum med trykk, forankres kjeglen eller topplaten."),

    // UNDER
    valg("Prøvemedium", "UNDER",
      [
        "Luft",
        "Vann",
        "Undertrykk",
      ],
      "Vann til prøving av drikkevannsledning skal ha drikkevannskvalitet."),
    valg("Tetthetsprøving", "UNDER",
      [
        "Bestått",
        "Ikke bestått – utbedres og prøves på nytt",
        "Ikke aktuelt",
      ],
      "Prøv etter metoden i beskrivelsen. Kum med vann: betongkum står minst 4 timer før prøving, synket måles i 30 minutter, og påfylt vann skal være under 0,2 liter per m² innvendig flate. Før resultatet i rapporten."),
    valg("Trykkprøving", "UNDER",
      [
        "Bestått",
        "Ikke bestått – utbedres og prøves på nytt",
        "Ikke aktuelt",
      ],
      "Gjelder ledninger som skal stå under trykk. Prøvetrykk og metode står i beskrivelsen. Før prøvetrykk, prøvetid og trykkfall i rapporten."),
    valg("Deformasjon", "UNDER",
      [
        "Innenfor kravet",
        "Over kravet – avvik",
        "Ikke aktuelt",
      ],
      "Gjelder plast- og GRP-rør. Ved overtakelse: plastrør høyst 5 % (8 % ved reduserte krav), GRP høyst 3 %. Punktvis deformasjon høyst en tredjedel av dette."),
    valg("Kamerainspeksjon", "UNDER",
      [
        "Utført – ingen feil",
        "Utført – feil registrert",
        "Ikke krav",
      ],
      "Inspeksjon gjøres med kamera. Feil og mangler registreres og legges ved rapporten."),

    // ETTER
    valg("Spyling", "ETTER",
      [
        "Utført – ledningen ren",
        "Ikke krav",
      ],
      "Spyl med vann fra nettet. Etterpå skal ledningen være fri for sand, grus, avleiringer og fremmedlegemer."),
    valg("Desinfisering", "ETTER",
      [
        "Utført – prøver godkjent",
        "Venter på prøvesvar",
        "Ikke vannledning",
      ],
      "Mål restene av desinfeksjonsmiddel etter 24 timer. Bakterieprøver analyseres av sertifisert laboratorium. Vannet skal ikke inn i nett som er i drift, og slippes ut miljøforsvarlig. Venter du på prøvesvar, lagre sjekklisten og fullfør når svaret kommer."),
    trafikklys("Prøverapporten er skrevet og signert", "ETTER",
      "Rapporten viser bestiller, kontrollør, sted, ledning eller kum med type og dimensjon, lengde, krav, prøvetrykk og tid, resultat og signatur. Legg den ved."),
  ] as FeltDef[],
};

// UP1 – Setting av kum i grunnen. Tredje mal i NS 3420-U (ordre UP1 2026-09-20, gatet av Kenneth,
// Runde C). Nytt kapittel UP «Kummer i grunnen» i standard NS3420-U (fra runde B), plassert FØR UU
// i normens rekkefølge (UM, UP, UU). Fullfører VA-kjeden: FD2 → UM1 → UP1 → FS3 → UU1. 12 felt,
// INGEN tallfelt: plassering, sandvolum, lokkhøyde og ramme-høyde besvares med samsvar mot kravet,
// målt verdi/sted i kommentaren. §7b: SiteDocs egne krav — standarden kun i beskrivelsen.
// Styrkeklasser (A 15 … F 900) og «T-merket» er produktmerking brukeren ser, og er tillatt.
// ── UP-delingen (ordre UP1-deling-fire-maler 2026-09-22, gatet av Kenneth) ─────────────────────────
// UP1 (revisjon) + UP2/UP3/UO2.1 (nye). To DELTE blokker: basisfeltene B1–B10 (`upBasisfelter`) og
// materialeblokken M1–M4 (`materialeblokk`), ord for ord identiske på tvers av malene og låst av
// delt-tekst-testen. Typeforeldre står i FØR med barn i UNDER/ETTER → `barnAv` (kryss-fase, §1f);
// samme-fase-barn (UP2 gjennomløp→plastliner) → `forgrening`. Fase for materialeblokk (M1=FØR,
// M2–M4=UNDER) og de type-spesifikke feltene er UTLEDET av §4-mønsteret (ordren oppgir dem ikke
// eksplisitt) — meldt til design i pre-bygg-avklaring 2026-09-23.

// Delt basisblokk B1–B10 (ordre §5). Ord for ord identisk; UO2.1 (`erVentil`) bytter «kummen»→«enheten»
// i B1 og B6, og utvider B7 (teleskop/deksel). B5 «Oppdrift» er NYTT, plassert i UNDER FØR B6. Faser:
// B1,B2=FØR · B3,B4,B5=UNDER · B6–B10=ETTER.
function upBasisfelter(erVentil: boolean): FeltDef[] {
  const b6Label = erVentil ? "Omfylling rundt enheten" : "Omfylling rundt kummen";
  const b7Hjelp = erVentil
    ? "En nedgravd ventil har teleskop og deksel, ikke justeringsringer og topplate. Kontroller at teleskopet står i riktig høyde og i lodd, så dekselet ligger jevnt mot gatelokket."
    : "Overdekningen over topplata skal være minst 0,3 m. Samlet høyde av justeringsringer og ramme bør ikke være over 0,40 m.";
  return [
    valg("Kum og deler kontrollert", "FØR",
      ["Riktig type og dimensjon, uskadd", "Avvik – feil type eller skadet"],
      erVentil
        ? "Sjekk dimensjon, bunnseksjon og pakninger mot beskrivelsen. Der enheten skal være tett, skal den være T-merket. Skadde elementer settes ikke ned."
        : "Sjekk dimensjon, bunnseksjon og pakninger mot beskrivelsen. Der kummen skal være tett, skal den være T-merket. Skadde elementer settes ikke ned."),
    trafikklys("Grøftebunn og fundament klare", "FØR",
      "Bunnen er fri for tele, snø og is, og fundamentet er avrettet så kummen får jevnt anlegg."),
    valg("Plassering", "UNDER",
      ["Innenfor ±30 mm høyde og ±100 mm side", "Avvik"],
      "Kontroller kote og plassering mot tegningen før omfylling. Noter største avvik i kommentaren."),
    valg("Skjøter og gjennomføringer", "UNDER",
      ["Pakninger på plass, tette skjøter", "Avvik"],
      "Skjøter mellom elementene og gjennomføringer for ledninger skal ha pakning og sitte riktig. Hold minst 100 mm mellom kumveggen og ledninger som går forbi utenfor."),
    valg("Oppdrift og vann i grøfta", "UNDER",
      ["Tørt i grøfta – ingen fare for oppdrift", "Vann i grøfta – sikret mot oppdrift før omfylling", "Avvik – ikke sikret"],
      "Står det vann i grøfta, kan kummen løfte seg. Det gjelder alle kummer, og særlig kummer av plast, som er lette. Sikringen — ballast, forankring eller lensing — skal være på plass FØR omfyllingen begynner. En kum som har løftet seg, ser riktig ut helt til dekket sprekker eller fallet snur."),
    valg(b6Label, "ETTER",
      [erVentil ? "Lagvis og komprimert, enheten står stødig" : "Lagvis og komprimert, kummen står stødig", "Avvik"],
      erVentil
        ? "Fyll og komprimer lagvis hele veien rundt, så enheten ikke forskyves eller kommer ut av lodd. Ikke tipp massene rett fra lasteplanet."
        : "Fyll og komprimer lagvis hele veien rundt, så kummen ikke forskyves eller kommer ut av lodd. Ikke tipp massene rett fra lasteplanet."),
    valg("Justeringsringer og ramme", "ETTER",
      ["Samlet høyde høyst 0,40 m", "Avvik"],
      b7Hjelp),
    valg("Lokk eller rist", "ETTER",
      ["Riktig styrkeklasse for stedet", "Avvik"],
      "Styrkeklassen står i beskrivelsen: A 15, B 125, C 250, D 400 eller F 900. Lokk med lås eller pakning monteres der beskrivelsen krever det."),
    valg("Lokkhøyde mot dekket", "ETTER",
      ["Vei eller plass: +0/−10 mm", "Grønt eller grøft: +10/−100 mm", "Avvik"],
      "Mål mot ferdig dekke eller terreng. I vei og på plass skal lokket ikke stikke opp. I grøntanlegg og grøfter er kravet romsligere."),
    trafikklys("Ren, innmålt og klar", "ETTER",
      "Sand og slam er spylt ut, kummen er målt inn, og den er klar for prøving og overlevering. Ta bilde."),
  ];
}

// Delt materialeblokk M1–M4 (ordre §5b). M1 «Materiale» forelder (FØR); M2/M3/M4 barn (UNDER, `barnAv`
// kryss-fase). M2/M3 ord for ord identiske i UP1/UP2/UP3 (låst av delt-tekst-test); M4 kun UP1.
// `betongTrigger` = M1-alternativet som utløser M2 (UP1: «Betongelementer», UP2/UP3: «Betong»).
function materialeblokk(m1options: string[], betongTrigger: string, medM4: boolean): FeltDef[] {
  const felter: FeltDef[] = [
    forelderFelt("materiale", valg("Materiale", "FØR", m1options,
      "Materialet avgjør hvilke kontrollpunkter som vises under.")),
    barnAv("materiale", [betongTrigger],
      valg("Kumskjøt og pakninger", "UNDER", ["Elementer med falsskjøt og glidering som beskrevet", "Avvik"],
        "Elementene skjøtes med falsskjøt og glidering, eller med not og fjær, etter beskrivelsen. Krav om T-merking der kummen skal være tett, dekkes av kontrollen av kum og deler.")),
    barnAv("materiale", ["Plast"],
      valg("Oppføringsrør og form", "UNDER", ["Kappet i riktig høyde, røret er rundt og uskadd", "Avvik"],
        "Oppføringsrøret kappes så rammen får jevnt anlegg og lokket kommer i riktig høyde. Kontroller at røret ikke er blitt ovalt av gravemaskin eller ensidig omfylling — en deformert kum kan ikke spyles eller filmes. Oppdrift dekkes av eget kontrollpunkt, som gjelder alle materialer.")),
  ];
  if (medM4) {
    felter.push(barnAv("materiale", ["Kumbunn av plasstøpt betong"],
      valg("Plasstøpt kumbunn", "UNDER", ["Forskaling, gjennomføringer og renneløp støpt som beskrevet", "Avvik"],
        "Rørgjennomføringene skal støpes inn tette, og renneløpet skal få det fallet og løpet beskrivelsen angir. Betongen skal ha herdet før kummen belastes. Dette er den ene kumtypen der bunnen ikke kan byttes hvis den blir feil.")));
  }
  return felter;
}

// Kumtyper UP1 (ordre §2, Kenneths forkortelser). Én kilde → typeliste + utløsersett kan ikke drifte.
const UP1_KUMTYPER = {
  sp: "Spillvannskum (SP)",
  ov: "Overvannskum (OV)",
  af: "Felleskum (AF)",
  v: "Vannkum (V)",
  annen: "Annen kum – se beskrivelsen",
} as const;
const UPBRANN = "Ja – kummen er brannkum";

// Mal 1 — UP1 «Nedstigningskum i grunnen» (REVISJON). To uavhengige trær: kumtype (FØR) og materiale
// (FØR). Kumtype-grener renneløp/ventil/uttak/stikkledning i UNDER, brannkumskilt (barn av uttak) i
// ETTER → alle `barnAv` (kryss-fase). 20 felt, 12 alltid synlige (Type kum, M1, B1–B10).
export const UP1_MAL = {
  kapittelKode: "UP",
  navn: "UP1 – Nedstigningskum i grunnen",
  referanse: "UP1",
  beskrivelse:
    "Setting av nedstigningskum i grunnen — type og plassering, fundament, skjøter, kumbunn, omfylling, ramme og lokk. Én kum per sjekkliste. Faglig grunnlag: NS 3420-U:2019, post UP1.",
  felter: faseSortert([
    forelderFelt("kumtype",
      valg("Type kum", "FØR", Object.values(UP1_KUMTYPER),
        "Skriv kummens prosjektnavn i emnefeltet, slik det står på tegningen — for eksempel V-01 eller V01. Bruk samme skrivemåte gjennom hele prosjektet, ellers havner kummene i ulike bunker når de sorteres. Det er slik kummen finnes igjen senere. Én kum per sjekkliste — settes flere kummer i samme kumgruppe, fylles én liste for hver. Typen avgjør hvilke kontrollpunkter som vises under.")),
    barnAv("kumtype", [UP1_KUMTYPER.sp, UP1_KUMTYPER.ov, UP1_KUMTYPER.af],
      valg("Renneløp gjennom kummen", "UNDER", ["Riktig løp og fall", "Avvik"],
        "Bunnseksjonen skal ha det løpet beskrivelsen angir, med jevnt fall gjennom kummen, uten kanter eller sprang som samler slam. Kum med mellomdekke skal ha nedstigningsåpningene forskjøvet i forhold til hverandre.")),
    barnAv("kumtype", [UP1_KUMTYPER.v],
      valg("Hovedventil", "UNDER", ["Riktig type og stilling, spindel kan betjenes", "Avvik"],
        "Ventiltype og dimensjon står i beskrivelsen. Spindelen skal kunne betjenes, og stillingen skal være som prosjektert ved overlevering. Kontroller at ventilen ikke er skadet under nedsetting.")),
    barnAv("kumtype", [UP1_KUMTYPER.v],
      forelderFelt("uttak",
        valg("Brannvannsuttak på ventilen", "UNDER", [UPBRANN, "Nei – ordinær vannkum"],
          "Har ventilen uttak for brannvann, er kummen en brannkum. Den heter fortsatt V i emnefeltet — det er dette svaret som skiller den ut. Kontroller at uttaket har den kuplingen beskrivelsen angir, at det er fri adkomst, og at det er frostsikret slik beskrivelsen krever."))),
    barnAv("uttak", [UPBRANN],
      valg("Brannkumskilt", "ETTER", ["Skilt montert med avstand og retning", "Skilt ikke montert – utestår", "Avvik"],
        "Brannkummen markeres med skilt som viser avstand og retning fram til kummen, slik at brannvesenet finner den. Skiltet skal stå før overlevering. Ta bilde av skiltet.")),
    barnAv("kumtype", [UP1_KUMTYPER.v],
      valg("Stikkledningsuttak fra kummen", "UNDER", ["Ingen stikkledninger fra denne kummen", "Uttak montert som beskrevet, avstenging kan betjenes", "Avvik"],
        "Kommunen ønsker i noen tilfeller at stikkledninger kobles fra vannkummen i stedet for med anboring på hovedledningen. Er det beskrevet, skal uttakene ha den dimensjonen og avstengingen beskrivelsen angir, og avstengingen skal kunne betjenes etter at kummen er satt. «Ingen stikkledninger» er et gyldig svar — de fleste vannkummer har ingen.")),
    ...materialeblokk(["Betongelementer", "Kumbunn av plasstøpt betong", "Plast"], "Betongelementer", true),
    ...upBasisfelter(false),
  ]) as FeltDef[],
};

// Mal 2 — UP2 «Inspeksjonskum i grunnen» (NY). To trær: gjennomløp (UNDER, forelder for plastliner i
// SAMME fase → `forgrening`) og materiale (FØR). Felt 3 «kan spyles» (trafikklys) i ETTER, alltid
// synlig. Ingen nedstigningsfelt (negativ test). Materialeblokk uten M4.
export const UP2_MAL = {
  kapittelKode: "UP",
  navn: "UP2 – Inspeksjonskum i grunnen",
  referanse: "UP2",
  beskrivelse:
    "Setting av inspeksjonskum i grunnen — materiale, gjennomløp, skjøt, fundament, omfylling, ramme og lokk. Én kum per sjekkliste. Faglig grunnlag: NS 3420-U:2019, post UP2.",
  felter: faseSortert([
    ...forgrening("gjennomlop",
      valg("Gjennomløp og fall", "UNDER", ["Riktig gjennomløp og jevnt fall", "Avvik"],
        "Skriv kummens prosjektnavn i emnefeltet, slik det står på tegningen — for eksempel SP-07. Bruk samme skrivemåte gjennom hele prosjektet. Gjennomløpet skal være det beskrivelsen angir — rett, med avgreining, eller Y — med jevnt fall gjennom kummen. Kontroller mot tegningen at avgreiningene peker rett vei før omfylling."),
      [{ naar: ["Riktig gjennomløp og jevnt fall"],
        felt: valg("Plastliner i gjennomløpet", "UNDER", ["Liner hel, overgang mot røret tett", "Ikke krevd i beskrivelsen", "Avvik"],
          "Normen har gjennomløp både med og uten plastliner. Er liner beskrevet, skal den være hel og overgangen mot røret tett — en revnet liner gir slitasje og innlekking, og den kan ikke byttes uten å grave opp.") }]),
    trafikklys("Kummen kan spyles og inspiseres fra overflaten", "ETTER",
      "En inspeksjonskum er for liten å gå ned i — hele hensikten er at ledningen kan spyles og filmes herfra. Kontroller at det er fri passasje ned og at gjennomløpet er rent før lokket legges på."),
    ...materialeblokk(["Betong", "Plast"], "Betong", false),
    ...upBasisfelter(false),
  ]) as FeltDef[],
};

// Mal 3 — UP3 «Sandfangkum og hjelpesluk» (NY). To trær: type (FØR, forelder for sandvolum+dykker i
// UNDER → `barnAv` kryss-fase) og materiale (FØR). Materialeblokk uten M4.
export const UP3_MAL = {
  kapittelKode: "UP",
  navn: "UP3 – Sandfangkum og hjelpesluk",
  referanse: "UP3",
  beskrivelse:
    "Setting av sandfangkum og hjelpesluk i grunnen — sandvolum, dykker, tilgang for tømming, fundament, omfylling, ramme og rist. Én kum per sjekkliste. Faglig grunnlag: NS 3420-U:2019, post UP3.",
  felter: faseSortert([
    forelderFelt("type",
      valg("Type", "FØR", ["Sandfangkum", "Hjelpesluk"],
        "Skriv kummens prosjektnavn i emnefeltet, slik det står på tegningen — for eksempel SF-03. Bruk samme skrivemåte gjennom hele prosjektet. Et hjelpesluk har ikke sandfangvolum, så de to kontrolleres ulikt.")),
    barnAv("type", ["Sandfangkum"],
      valg("Sandvolum og høyde til utløp", "UNDER", ["Minst 0,8 m³ og 1 m", "Under kravet"],
        "Sandvolumet bør ikke være mindre enn 0,8 m³, og høyden fra bunn til utløp bør være minst 1 m. Noter målt verdi i kommentaren.")),
    barnAv("type", ["Sandfangkum"],
      valg("Dykker og tilgang for tømming", "UNDER", ["Dykker montert, kummen kan tømmes", "Dykker ikke krevd i beskrivelsen", "Avvik"],
        "Normen har sandfang både med og uten dykker, så «ikke krevd» er et gyldig svar og ikke en unnvikelse. Dykkeren holder flytende materiale tilbake og skal sitte som beskrevet. Kummen må stå slik at slamsugebil kommer til — er adkomsten sperret etter at anlegget er ferdig, kan kummen ikke driftes.")),
    ...materialeblokk(["Betong", "Plast"], "Betong", false),
    ...upBasisfelter(false),
  ]) as FeltDef[],
};

// Mal 4 — UO2.1 «Nedgravd stengeventil» (NY, NYTT KAPITTEL UO). Ett tre: uttak (forelder for skiltet).
// Ventil/uttak/spindelforlenger i UNDER, skilt i ETTER → `barnAv` (kryss-fase). INGEN materialeblokk.
// Basisfelt med «enheten»-bytte (B1/B6) + utvidet B7. «Baio»/«Bajo»/«bajonett» forekommer ikke.
export const UO21_MAL = {
  kapittelKode: "UO",
  navn: "UO2.1 – Nedgravd stengeventil",
  referanse: "UO2.1",
  beskrivelse:
    "Setting av nedgravd stengeventil med gatelokk — ventil, brannvannsuttak, teleskop og deksel, omfylling og lokkhøyde. Én ventil per sjekkliste. Faglig grunnlag: NS 3420-U:2019, post UO2.1.",
  felter: faseSortert([
    valg("Hovedventil", "UNDER", ["Riktig type og stilling, spindel kan betjenes", "Avvik"],
      "Skriv ventilens prosjektnavn i emnefeltet, slik det står på tegningen — for eksempel V-04. Bruk samme skrivemåte gjennom hele prosjektet. Ventiltype og dimensjon står i beskrivelsen. Spindelen betjenes gjennom dekselet — prøv avstengingen før gatelokket legges på plass."),
    forelderFelt("uttak",
      valg("Brannvannsuttak på ventilen", "UNDER", ["Ja – ventilen har brannvannsuttak", "Nei – ordinær stengeventil"],
        "Har ventilen uttak for brannvann, skal uttaket ha den kuplingen beskrivelsen angir, det skal være fri adkomst, og det skal være frostsikret slik beskrivelsen krever.")),
    barnAv("uttak", ["Ja – ventilen har brannvannsuttak"],
      valg("Brannkumskilt", "ETTER", ["Skilt montert med avstand og retning", "Skilt ikke montert – utestår", "Avvik"],
        "Uttaket markeres med skilt som viser avstand og retning fram til det, slik at brannvesenet finner det. Skiltet skal stå før overlevering. Ta bilde av skiltet.")),
    valg("Spindelforlenger og forankring", "UNDER", ["Montert som beskrevet, ventilen står stabilt", "Avvik"],
      "Spindelforlengeren monteres på ventiltoppen og fungerer samtidig som forankring i grunnen. Kontroller at den står i lodd og i riktig høyde før gjenfylling — etterpå kommer ingen til."),
    ...upBasisfelter(true),
  ]) as FeltDef[],
};

// FF1 – Avretting. Ny mal (ordre FF1 2026-09-20, gatet av Kenneth, Runde D). Nytt kapittel FF
// «Avretting og rensk» i NS3420-F, plassert MELLOM FD (3) og FH (5) på sortering 4 — ledig tall,
// ingen søster må flyttes (ingen --sorter). Dekker avretting med/uten tilføring og ved fjerning
// (FF1.2–FF1.4) + kontroll av underlaget (FF1.1); under vann, arrondering og rensk av berg er ute.
// 10 felt, INGEN tallfelt (§1): høyde, planhet og fall besvares med samsvar mot kravet i
// beskrivelsen, målt verdi/sted i kommentaren. §7b: SiteDocs egne krav, standarden kun i beskrivelsen.
export const FF1_MAL = {
  kapittelKode: "FF",
  navn: "FF1 – Avretting",
  referanse: "FF1",
  beskrivelse:
    "Avretting av planum, lag og grøftebunn — metode, masser, høyde, planhet og fall. Faglig grunnlag: NS 3420-F:2024, post FF1.",
  felter: [
    // FØR
    valg("Hva avrettes", "FØR",
      [
        "Planum eller traubunn",
        "Forsterkningslag",
        "Bærelag",
        "Grusdekke",
        "Bunn eller fundament i grøft",
        "Annen flate",
      ],
      "Hvilken flate som avrettes, avgjør hvilke krav beskrivelsen setter til høyde og planhet."),
    valg("Underlaget kontrollert", "FØR",
      [
        "Nivå, jevnhet og fall kontrollert",
        "Avvik funnet – meldt",
        "Ikke bestilt som egen kontroll",
      ],
      "Er kontroll av underlaget bestilt, skal den dokumenteres. Rekomprimeres flaten, kontrolleres den på nytt etterpå."),
    valg("Metode", "FØR",
      [
        "Uten tilføring av masser",
        "Med tilføring av masser",
        "Ved fjerning av masser",
      ],
      "Uten tilføring brukes massene som ligger der. Vurder om kravet er mulig å nå med den største steinen i underlaget — hvis ikke, skal det tilføres masser."),

    // UNDER
    valg("Masser til avretting", "UNDER",
      [
        "Fraksjon tilpasset underlaget",
        "Ikke aktuelt – avrettes uten tilføring",
        "Avvik",
      ],
      "Ved tilføring skal fraksjonen passe til underlaget og til kravet som skal nås. Husk at massene endrer seg ved komprimering."),
    trafikklys("Overskuddsmasser fjernet", "UNDER",
      "Masser som blir til overs ved avrettingen, er fjernet fra flaten."),
    valg("Etterkomprimering", "UNDER",
      [
        "Utført",
        "Ikke krav",
        "Avvik",
      ],
      "Avrettingen avsluttes med komprimering slik beskrivelsen angir."),

    // ETTER
    valg("Høyde", "ETTER",
      [
        "Innenfor kravet i beskrivelsen",
        "Utenfor – rettes",
      ],
      "Beskrivelsen velger kravet: ±10 mm, ±20 mm, ±50 mm, +0 til 20 mm, +0 til 50 mm eller +20 til 0 mm. Noter største avvik i kommentaren."),
    valg("Planhet", "ETTER",
      [
        "Innenfor kravet i beskrivelsen",
        "Utenfor – rettes",
      ],
      "Mål langs en rett linje mellom to punkter som ligger 3 m fra hverandre. Beskrivelsen velger kravet, fra ±10 mm til ±50 mm."),
    valg("Fall og avrenning", "ETTER",
      [
        "Fall som prosjektert",
        "Ikke krav til fall",
        "Vannlommer – rettes",
      ],
      "Kontroller at vannet renner dit det skal, og at det ikke blir stående igjen på flaten."),
    trafikklys("Flaten er godkjent for neste lag", "ETTER",
      "Flaten oppfyller kravene over og kan bygges videre på. Ta bilde."),
  ] as FeltDef[],
};

// JH2 – Asfaltdekke. Revidert til v2 (ordre JH2 v2 2026-09-21, gatet av Kenneth). PILOTEN på
// betingede felt (forelder/barn) i bibliotekmaler — første mal som bruker `forgrening` (del A).
// FJERDE standard NS3420-J:2008 «Dekke- og banearbeider» (merk årstallet — K/F er 2024, U er 2019);
// kapittel JH «Asfaltdekker», sortering 1. Dekker varmprodusert asfaltdekke (JH2.1) med behandling
// av underlaget (JH1) og avstrøing (JH2.81); kaldasfalt, bitumen-/sementbærelag, oppmerking, humper,
// kanter, kunstgress/kunststoff og flyplass er ute. 12 felt, INGEN tallfelt (§1).
//
// TRE (§3): felt 3 «Underlaget består av» er forelder for felt 4 (ubundet → planhet/komprimering)
// og felt 5 (bundet/gammelt → rengjøring/klebing); felt 5 er igjen forelder for felt 6 (trafikk på
// klebet flate, bare når det er klebet). Ni felt vises alltid (1, 2, 3, 7, 8, 9, 10, 11, 12); 4/5
// vises etter svaret i felt 3, og 6 bare når det er klebet (MAL-METODE §1c: «Ikke aktuelt» som SVAR
// = svaralternativ som blir stående; det som SKJULES er felt som aldri gjaldt). Bygget med
// `forgrening` — utløseren ligger på barnets EGET sett (conditionOwnValues), aldri conditionValues.
//
// §7b: SiteDocs egne krav — de betalte NS-standardene navngis ikke. §7c (Kenneth 2026-09-20):
// vegvesenets håndbok N200 er gratis og fritt nedlastbar, og KAN navngis i hjelpetekst (felt 4, 11).
// Asfalttyper (Ab, Ska, Ma, Agb, Ag …) er produktbetegnelser og er tillatt; fullt navn første gang,
// forkortelse i parentes. Utgår fra v1: «Underlaget rengjort» + «Klebing» (slått sammen til felt 5),
// «Overflaten» (slått sammen med skjøter/kanter i felt 10).
export const JH2_MAL = {
  kapittelKode: "JH",
  navn: "JH2 – Asfaltdekke",
  referanse: "JH2",
  beskrivelse:
    "Varmprodusert asfaltdekke — underlag, klebing, utlegging, komprimering, skjøter og ferdig overflate. Faglig grunnlag: NS 3420-J:2008, post JH2.",
  felter: [
    // FØR — felt 1, 2 alltid synlige
    valg("Type lag", "FØR",
      [
        "Slitelag",
        "Bindlag",
        "Opprettingslag",
      ],
      "Beskrivelsen sier hvilket lag som legges, med tykkelse og masse. Bærelag av asfalt hører til et eget kapittel i normen og får egen mal — bruk ikke denne for det."),
    valg("Asfalttype", "FØR",
      [
        "Asfaltbetong (Ab)",
        "Skjelettasfalt (Ska)",
        "Mykasfalt (Ma)",
        "Asfaltgrusbetong (Agb)",
        "Annen type – se beskrivelsen",
      ],
      "Type masse, nominell steinstørrelse og bindemiddel står i beskrivelsen. Kontroller følgeseddelen mot den. Alle typene over er varmproduserte. Kalde masser som emulsjonsgrus (Eg) og enkelte gjenbrukstyper (Gja), og halvvarme masser som Mjøg, dekkes ikke av denne malen."),

    // FØR — tre: felt 3 (forelder) → felt 4 | felt 5 (forelder) → felt 6
    ...forgrening(
      "underlag",
      valg("Underlaget består av", "FØR",
        [
          "Ubundet lag: grus, forkilt pukk eller knust fjell",
          "Bundet lag: asfaltert grus (Ag), asfaltgrusbetong (Agb) eller annet bitumenstabilisert lag",
          "Gammelt asfaltdekke",
        ],
        "Hva du legger på, avgjør hva som må kontrolleres: et ubundet lag skal være komprimert og jevnt, mens et bundet lag skal rengjøres og klebes."),
      [
        {
          naar: ["Ubundet lag: grus, forkilt pukk eller knust fjell"],
          felt: valg("Planhet og komprimering på underlaget", "FØR",
            [
              "Kontrollert – innenfor kravene",
              "Oppretting utført før legging",
              "Avvik – rettes før legging",
            ],
            "Mål planheten med 3 m rettholt mot kravet i beskrivelsen. For veg gjelder toleransene i vegvesenets håndbok N200. Laget skal være komprimert og kontrollert før dekket legges — be om måleresultatet i stedet for å anta. Ujevnheter rettes med opprettingslag, ikke ved å variere tykkelsen på slitelaget."),
        },
        {
          naar: [
            "Bundet lag: asfaltert grus (Ag), asfaltgrusbetong (Agb) eller annet bitumenstabilisert lag",
            "Gammelt asfaltdekke",
          ],
          felt: forgrening(
            "klebing",
            valg("Rengjøring og klebing", "FØR",
              [
                "Rengjort og klebet – virksom over hele flaten",
                "Rengjort – klebing ikke krevd",
                "Avvik",
              ],
              "Rengjør ved feiing eller spyling før klebing. Klebemiddelet skal virke over hele arealet. Også et bundet bærelag, for eksempel asfaltert grus (Ag), skal klebes før neste lag legges. Fås ikke vedheft mellom lagene, freses laget bort, det klebes på nytt, og ny asfalt legges."),
            [
              {
                naar: ["Rengjort og klebet – virksom over hele flaten"],
                felt: valg("Trafikk på klebet flate", "FØR",
                  [
                    "Ikke trafikkert før legging",
                    "Trafikkert – strødd med sand først",
                    "Avvik",
                  ],
                  "Klebet flate bør ikke kjøres på før laget legges. Må den kjøres på, strøs den med sand først."),
              },
            ],
          ),
        },
      ],
    ),

    // FØR — felt 7 alltid synlig
    valg("Vær og underlag", "FØR",
      [
        "Tørt underlag – klart for legging",
        "Fritt vann på underlaget – vent",
        "Frossent eller for kaldt underlag – vent",
      ],
      "Det skal ikke asfalteres når det står fritt vann på underlaget. Frossent underlag gir dårlig vedheft og skal ikke asfalteres."),

    // UNDER
    valg("Masse og temperatur", "UNDER",
      [
        "Type og temperatur som beskrevet",
        "Avvik – meldt",
      ],
      "Massen skal være homogen, og filler, finstoff og fiber tørre ved innmatning. Laveste utleggingstemperatur følger massetypen og står i beskrivelsen. Kontroller temperaturen ved innmatning, ikke bare på følgeseddelen."),
    valg("Komprimering fullført i tide", "UNDER",
      [
        "Ja – før temperaturen falt 50 °C under laveste utleggingstemperatur",
        "Avvik",
      ],
      "Valsingen skal være ferdig mens massen fortsatt er varm nok. Kommer den for sent, blir dekket ikke tett."),

    // ETTER
    valg("Skjøter, kanter og overflate", "ETTER",
      [
        "Følger vegens geometri, overflaten er homogen",
        "Sprekker, hull eller fete partier – utbedres",
        "Skjøt eller kant avviker – utbedres",
      ],
      "Langsgående skjøter legges der det kjøres minst, og skjøter og kanter følger vegens linjer. Dekket skal være jevnt i utseende og friksjon."),
    valg("Jevnhet og høyde", "ETTER",
      [
        "Innenfor kravene i beskrivelsen",
        "Avvik",
      ],
      "Jevnheten måles med rettholt. Tillatt sideavvik er +100 / −0 mm. For bind- og slitelag i veg gjelder toleransene i vegvesenets håndbok N200 — beskrivelsen sier hvilke som er avtalt for jobben."),
    trafikklys("Ferdig dekke godkjent og dokumentert", "ETTER",
      "Avstrøing er utført der det kreves, følgesedler er samlet, og dekket er klart for overlevering. Ta bilde."),
  ] as FeltDef[],
};

// FJ1 – Vannhåndtering. Ny mal (ordre FJ1 2026-09-21, gatet av Kenneth, Runde E). Nytt kapittel FJ
// «Vannhåndtering» i NS 3420-F:2024, plassert MELLOM FH (5) og FS (6): FJ=6, FP=7, og FS flyttet
// 6→8 (se KAPITTEL_DATA_F). Dekker lensing (FJ1), drenering av bergoverflate (FJ2), sedimentering og
// rensing (FJ6), kontroll av utslipp (FJ7) og siltskjørt (FJ8.2); infiltrasjon, tunnellekkasje,
// plastavfall, grunnvannsbrønner/wellpoint og injeksjon er ute. 10 felt, INGEN tallfelt (§1). §7b:
// SiteDocs egne krav — NS-standardene navngis ikke; standarden nevnes kun i beskrivelsen.
export const FJ1_MAL = {
  kapittelKode: "FJ",
  navn: "FJ1 – Vannhåndtering",
  referanse: "FJ1",
  beskrivelse:
    "Lensing, drenering, sedimentering og kontroll av utslipp — utstyr, beredskap, måling og slamhåndtering. Faglig grunnlag: NS 3420-F:2024, post FJ1.",
  felter: [
    // FØR
    valg("Hva håndteres", "FØR",
      [
        "Lensing av byggegrop eller grøft",
        "Drenering av bergoverflate",
        "Sedimentering og rensing før utslipp",
        "Flere av delene",
      ],
      "Sier hva jobben omfatter, og styrer hvilke felt under som er aktuelle."),
    valg("Krav til utslipp", "FØR",
      [
        "Krav og tillatelse er kjent",
        "Ikke krav til utslippet",
        "Ikke avklart – stopp før utslipp",
      ],
      "Krav til utslippsvann og krav fra myndighetene står i beskrivelsen eller i tillatelsen. Slipp ikke vann ut før dette er avklart."),
    trafikklys("Utstyret er rigget", "FØR",
      "Pumper, slanger, lenseledning og strøm er på plass og virker, og det er avklart hvem som følger opp utstyret utenom arbeidstid."),

    // UNDER
    valg("Vannmengden dokumenteres", "UNDER",
      [
        "Vannmåler",
        "Dokumentert på annen måte",
        "Ikke dokumentert – avvik",
      ],
      "Vannmengden som håndteres, skal dokumenteres. Vannmåler er det enkleste, men pumpekapasitet ganget med driftstid kan også brukes når det er avtalt."),
    valg("Beredskap utenom arbeidstid", "UNDER",
      [
        "Avklart og på plass",
        "Ikke behov",
        "Uavklart – avvik",
      ],
      "Lensingen må også virke i helger, på helligdager og i ferier så lenge arbeidet pågår. Avklar hvem som sjekker, og hva som skjer ved lange pauser."),
    valg("Sedimentering og rensing", "UNDER",
      [
        "I drift",
        "Ikke krav",
        "Ute av drift – stopp utslippet",
      ],
      "Anlegget skal resirkulere vannet så mye som mulig. Ved tømming av slam pumpes vannet over slamnivået ut først."),
    valg("Kontroll av utslipp", "UNDER",
      [
        "Målt etter avtalt frekvens",
        "Ikke krav",
        "Ikke målt – avvik",
      ],
      "Typiske målinger er pH og partikkelinnhold. Frekvens og prosedyre står i beskrivelsen. Før resultatene i loggen."),
    valg("Siltskjørt", "UNDER",
      [
        "Montert riktig, grenseverdiene overholdes",
        "Ikke aktuelt",
        "Grenseverdi overskredet – tiltak",
      ],
      "Gjelder arbeid ved eller i vann. Skjørtet skal være riktig montert og virke etter hensikten, og partikkelspredningen skal holdes innenfor grensen."),

    // ETTER
    valg("Slam levert til godkjent mottak", "ETTER",
      [
        "Levert – kvittering foreligger",
        "Ikke aktuelt",
        "Mangler kvittering",
      ],
      "Slam leveres til godkjent mottak om ikke annet er avtalt. Ta vare på kvitteringen."),
    trafikklys("Nedrigging og dokumentasjon", "ETTER",
      "Utstyret er tatt ned, målinger og kvitteringer er samlet, og området er ryddet. Ta bilde."),
  ] as FeltDef[],
};

// FP1 – Sikring av berg. Ny mal (ordre FP1 2026-09-21, gatet av Kenneth, Runde E). Nytt kapittel FP
// «Sikring av berg og løsmasser» i NS 3420-F:2024, plassert ETTER FJ (6) og før FS: FP=7 (se
// KAPITTEL_DATA_F). Hører sammen med sprengningsmalen FH1 — det som er sprengt ut, skal sikres.
// Dekker rensk (FP1.1), sikringsbolter (FP1.3) og bånd/nett (FP1.5); klatrelag, løsmassesikring,
// fanggjerder, sprøytebetong og injeksjon er ute. 11 felt, INGEN tallfelt (§1). §7b: SiteDocs egne
// krav — NS-standardene navngis ikke. «B20» er en materialbetegnelse og er tillatt (ordre §4).
export const FP1_MAL = {
  kapittelKode: "FP",
  navn: "FP1 – Sikring av berg",
  referanse: "FP1",
  beskrivelse:
    "Rensk, sikringsbolter og nett i bergskjæring — borhull, innstøping, prøvetrekking og kontroll. Faglig grunnlag: NS 3420-F:2024, post FP1.",
  felter: [
    // FØR
    valg("Type sikring", "FØR",
      [
        "Rensk",
        "Bolter",
        "Bånd og nett",
        "Flere av delene",
      ],
      "Sier hva jobben omfatter, og styrer hvilke felt under som er aktuelle."),
    trafikklys("Sikringsplanen foreligger", "FØR",
      "Det skal være prosjektert hva som skal sikres, hvor, og med hvilken bolttype, lengde og eventuelt nett. Midlertidig sikring skal også være planlagt."),
    valg("Materiell kontrollert", "FØR",
      [
        "Som spesifisert – uskadd",
        "Avvik – feil type eller skadet",
      ],
      "Sjekk bolttype, lengde og korrosjonsbeskyttelse mot beskrivelsen. Boltene skal leveres med sfærisk skive, mutter og halvkule. Nett: steinsprangnett eller flettverksnett etter beskrivelsen."),

    // UNDER
    valg("Rensk før sikring", "UNDER",
      [
        "Manuell rensk",
        "Maskinell rensk",
        "Ikke aktuelt",
        "Avvik",
      ],
      "Løs stein tas ned før bolting og nett monteres. Et manuelt renskelag er minst to personer, i tillegg til hjelpemannskap."),
    valg("Borhull", "UNDER",
      [
        "Diameter og lengde tilpasset boltetypen",
        "Avvik",
      ],
      "Hullet skal passe til bolten: minst 10 mm større enn bolten for fullt innstøpte, og 5–15 mm større når bolten forankres med syntetisk lim."),
    valg("Innstøping og forankring", "UNDER",
      [
        "Fullt innstøpt – helt omhyllet",
        "Endeforankret – tiltrukket 50 kN",
        "Ikke aktuelt",
        "Avvik",
      ],
      "Fullt innstøpte bolter skal være helt omhyllet av massen. Mørtelen skal være minst fasthetsklasse B20 med ekspanderende tilsetning. Endeforankrede bolter tiltrekkes med 50 kN."),
    valg("Bånd og nett", "UNDER",
      [
        "Montert etter planen, god kontakt med berget",
        "Ikke aktuelt",
        "Avvik",
      ],
      "Nettet skal ligge inntil berget og følge ujevnhetene, og festeboltene settes slik planen viser."),

    // ETTER
    valg("Prøvetrekking av endeforankrede bolter", "ETTER",
      [
        "Utført etter planen – godkjent",
        "Mer enn 5 % underkjent – utvidet prøving",
        "Ikke aktuelt",
      ],
      "Prøvetrekk minst halvparten av de første 100 boltene, til 10 % over dimensjonerende last. Blir mer enn 5 % underkjent, prøves halvparten av de neste 100 til underkjenningen er under 5 %. Deretter 50 bolter pr. 1000 satte."),
    valg("Visuell kontroll av fullt innstøpte bolter", "ETTER",
      [
        "Kontrollert – vinkel, halvkule og mørtel i orden",
        "Ikke aktuelt",
        "Avvik",
      ],
      "Se etter at bolten står med riktig vinkel, at halvkula ligger riktig an, at det er mørtelrester under platen eller i returslangen, og at sekkene viser riktig mørteltype."),
    trafikklys("Dokumentasjon", "ETTER",
      "Plassering og antall bolter, prøveresultater og hvilken mørtel som er brukt, er ført. Legg ved måleresultatene."),
    trafikklys("Sikringen er godkjent og området frigitt", "ETTER",
      "Sikringen er kontrollert og området kan slippes til videre arbeid. Ta bilde."),
  ] as FeltDef[],
};

// Standarder i biblioteket (kode, navn, sortering). Eksportert (ordre UM1 §3) slik at
// generer-mal-sql.ts kan opprette en manglende standard (NS3420-U) i samme transaksjon som
// kapittel + mal (WHERE NOT EXISTS), og seeden bygger sine upserts fra samme kilde — ingen drift
// mellom seed og generator. KUN OPPRETT (upsert med update:{}); eksisterende standard-rad røres ikke.
export const STANDARD_DATA = [
  { kode: "NS3420-K", navn: "NS 3420-K:2024 Anleggsgartnerarbeider", sortering: 1 },
  { kode: "NS3420-F", navn: "NS 3420-F:2024 Grunnarbeider", sortering: 2 },
  { kode: "NS3420-U", navn: "NS 3420-U:2019 Rørinstallasjoner", sortering: 3 },
  // NS3420-J lagt til (ordre JH2, Runde D): fjerde standard, dekke- og banearbeider. MERK årstallet
  // 2008 — K/F er 2024, U er 2019. Hullet vi selv laget da asfalt ble tatt ut av KD1.
  { kode: "NS3420-J", navn: "NS 3420-J:2008 Dekke- og banearbeider", sortering: 4 },
];

// Kapitler i NS 3420-K-arkivet (kode, navn, sortering). Eksportert (design-godkjent 2026-09-18)
// slik at generer-mal-sql.ts kan opprette et manglende kapittel i samme transaksjon (ordre KM2 §4).
// Seeden bruker den via finnEllerOpprettKapittel (KUN OPPRETT — eksisterende rader røres ikke).
export const KAPITTEL_DATA_K = [
  { kode: "KA", navn: "Innledende arbeider", sortering: 1 },
  { kode: "KB", navn: "Jord og vegetasjon", sortering: 2 },
  { kode: "KC", navn: "Vanningsanlegg, sikring og beskyttelse", sortering: 3 },
  { kode: "KD", navn: "Utendørsbelegg, kanter, renner", sortering: 4 },
  { kode: "KM", navn: "Murer i terreng", sortering: 5 },
];

// Kapitler i NS 3420-F-arkivet. Eksportert (ordre FD1 §5) slik at generer-mal-sql.ts kan slå opp
// standarden en F-mal hører til (i stedet for hardkodet NS3420-K) og hente kapittelnavn ved omkoding.
// Navnene rettet til normen 2026-09-19 (ordre FD1 §3): graving hører til FD «Uttak av løsmasser»,
// ikke FB «Markrydding». Seeden bruker den via finnEllerOpprettKapittel (KUN OPPRETT — eksisterende
// kapittel-rader røres ikke; navne-rettingen i test-arkivet skjer via omkodings-SQL, ikke seeden).
export const KAPITTEL_DATA_F = [
  { kode: "FB", navn: "Markrydding", sortering: 1 },
  { kode: "FD", navn: "Uttak av løsmasser", sortering: 3 },
  // FF lagt til (ordre FF1, Runde D): avretting og rensk, MELLOM FD (3) og FH (5). Sortering 4 er
  // ledig — ingen søster må flyttes (ingen --sorter i SQL-en, i motsetning til UP/UU i runde C).
  { kode: "FF", navn: "Avretting og rensk", sortering: 4 },
  // FH lagt til ved FH1-omkodingen (ordre FH1 §3): sprengning hører til FH «Uttak av berg», ikke
  // FC. Sortering 5 følger normens rekkefølge (FB, FD, FH, FS). FC er fjernet — det blir tomt etter
  // FC1→FH1 og slettes av omkodings-SQL-en (NOT EXISTS-vakt). Tilsvarende FE (fjernet ved FS3).
  { kode: "FH", navn: "Uttak av berg", sortering: 5 },
  // FJ + FP lagt til (ordre FJ1/FP1, Runde E): vannhåndtering og bergsikring, MELLOM FH (5) og FS.
  // Normens rekkefølge er FB, FD, FF, FH, FJ, FP, FS. FS var på 6 — flyttet til 8 for å gi FJ (6) og
  // FP (7) plass. MERK (KUN OPPRETT-drift): et arkiv seedet før runde E har FS på 6 fra før — seeden
  // rører den ikke; --sorter FS=8 i runde-E-SQL-en flytter den i test-arkivet. En fersk seed får
  // FB/FD/FF/FH/FJ/FP/FS = 1/3/4/5/6/7/8 direkte.
  { kode: "FJ", navn: "Vannhåndtering", sortering: 6 },
  { kode: "FP", navn: "Sikring av berg og løsmasser", sortering: 7 },
  { kode: "FS", navn: "Utlegging av løsmasser", sortering: 8 },
];

// Kapitler i NS 3420-U-arkivet (ny standard, ordre UM1/UU1 §3). UM «Utendørs rørledninger» (UM1),
// UU «Felles arbeider for utendørs rørledningsanlegg» (UU1). Eksportert slik at generer-mal-sql.ts
// kan slå opp standarden en U-mal hører til og opprette manglende kapittel. Seeden bruker den via
// finnEllerOpprettKapittel (KUN OPPRETT — eksisterende kapittel-rader røres ikke).
export const KAPITTEL_DATA_U = [
  { kode: "UM", navn: "Utendørs rørledninger", sortering: 1 },
  // UO lagt til (ordre UP-deling, 2026-09-22): utendørs ventiler, på sortering 2 i normens rekkefølge
  // (UM 249, UO 308, UP 339, UU 374). UP flyttet 2→3, UU 3→4 for å gi plass. MERK (KUN OPPRETT-drift):
  // et EKSISTERENDE arkiv har UP=2/UU=3 fra før — seeden rører dem ikke. Arkiv-rettingen skjer via
  // generatorens `--sorter UP=3 --sorter UU=4` i UO2.1-SQL-en. En fersk seed får UM/UO/UP/UU = 1/2/3/4.
  { kode: "UO", navn: "Utendørs ventiler og utstyr", sortering: 2 },
  { kode: "UP", navn: "Kummer i grunnen", sortering: 3 },
  { kode: "UU", navn: "Felles arbeider for utendørs rørledningsanlegg", sortering: 4 },
];

// Kapitler i NS 3420-J-arkivet (ny standard, ordre JH2 §3, Runde D). JH «Asfaltdekker» (JH2).
// Eksportert slik at generer-mal-sql.ts kan slå opp standarden en J-mal hører til og opprette
// manglende kapittel. Seeden bruker den via finnEllerOpprettKapittel (KUN OPPRETT).
export const KAPITTEL_DATA_J = [
  { kode: "JH", navn: "Asfaltdekker", sortering: 1 },
];

/** Standard: KUN OPPRETT fra STANDARD_DATA. `update: {}` → finnes koden, blir raden urørt. */
async function opprettStandard(kode: string) {
  const d = STANDARD_DATA.find((s) => s.kode === kode);
  if (!d) throw new Error(`Ukjent standard «${kode}» — mangler i STANDARD_DATA.`);
  return prisma.bibliotekStandard.upsert({
    where: { kode: d.kode },
    update: {},
    create: { kode: d.kode, navn: d.navn, sortering: d.sortering },
  });
}

async function main() {
  console.log("Seeder sjekklistebibliotek (kun opprett — rører aldri eksisterende rader)...");

  avbrytHvisProdUtenBekreftelse();

  // Standard: KUN OPPRETT (fra STANDARD_DATA). `update: {}` → finnes koden, blir raden urørt.
  const standard = await opprettStandard("NS3420-K");

  const kapittelData = KAPITTEL_DATA_K;

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
    // ── KA7 ── (definisjon eksportert over: KA7_MAL)
    KA7_MAL,

    // ── KB2 ── (definisjon eksportert over: KB2_MAL)
    KB2_MAL,

    // ── KB4 ── (definisjon eksportert over: KB4_MAL)
    KB4_MAL,

    // ── KB6 ── (definisjon eksportert over: KB6_MAL)
    KB6_MAL,

    // ── KC3.1 ── (definisjon eksportert over: KC31_MAL)
    KC31_MAL,

    // ── KD1 ── (definisjon eksportert over: KD1_MAL)
    KD1_MAL,

    // ── KD2 ── (definisjon eksportert over: KD2_MAL)
    KD2_MAL,

    // ── KM2 ── (definisjon eksportert over: KM2_MAL) — ny mal, nytt kapittel KM
    KM2_MAL,
  ];

  // ── NS 3420-F:2024 Grunnarbeider ──────────────────────────────────

  const standardF = await opprettStandard("NS3420-F");

  const kapittelDataF = KAPITTEL_DATA_F;

  const kapF: Record<string, string> = {};
  for (const k of kapittelDataF) {
    kapF[k.kode] = await finnEllerOpprettKapittel(prisma, standardF.id, k);
  }

  const malerF: MalDef[] = [
    // ── FB1 – Markrydding og avtaking av vekstjord ── (FB1_MAL — ny mal, fyller tomt kapittel FB)
    FB1_MAL,

    // ── FD1 – Graving av byggegrop ── (definisjon eksportert over: FD1_MAL — omkoding av FB2)
    FD1_MAL,

    // ── FD2 – Graving av grøft ── (definisjon eksportert over: FD2_MAL — ny mal i kapittel FD)
    FD2_MAL,

    // ── FH1 – Sprengning i dagen ── (definisjon eksportert over: FH1_MAL — omkoding av FC1)
    FH1_MAL,

    // ── FS2 – Utlegging av masser i lag ── (definisjon eksportert over: FS2_MAL — omkoding av FD2)
    FS2_MAL,

    // ── FS3 – Legging og gjenfylling i grøft ── (definisjon eksportert over: FS3_MAL — omkoding av FE1)
    FS3_MAL,

    // ── FF1 – Avretting ── (definisjon eksportert over: FF1_MAL — ny mal, nytt kapittel FF)
    FF1_MAL,

    // ── FJ1 – Vannhåndtering ── (definisjon eksportert over: FJ1_MAL — ny mal, nytt kapittel FJ)
    FJ1_MAL,

    // ── FP1 – Sikring av berg ── (definisjon eksportert over: FP1_MAL — ny mal, nytt kapittel FP)
    FP1_MAL,

    // ── FB4 – Spunting og avstiving ── (definisjon eksportert over: FB4_MAL)
    FB4_MAL,

    // ── FD3 – Grunnforsterkning ── (definisjon eksportert over: FD3_MAL)
    FD3_MAL,
  ];

  // ── NS 3420-U:2019 Rørinstallasjoner ──────────────────────────────
  // Ny standard (ordre UM1/UU1 §3). UM1 (legging) i kapittel UM, UU1 (prøving) i kapittel UU.

  const standardU = await opprettStandard("NS3420-U");

  const kapittelDataU = KAPITTEL_DATA_U;

  const kapU: Record<string, string> = {};
  for (const k of kapittelDataU) {
    kapU[k.kode] = await finnEllerOpprettKapittel(prisma, standardU.id, k);
  }

  const malerU: MalDef[] = [
    // ── UM1 – Legging av VA-ledninger ── (definisjon eksportert over: UM1_MAL — revidert v2, betinget)
    UM1_MAL,

    // ── UM1.1 – Skjøt på PE-ledning ── (definisjon eksportert over: UM11_MAL — ny mal, kap. UM fra UM1)
    UM11_MAL,

    // ── UP-delingen (ordre UP-deling-fire-maler): UP1 revidert + UP2/UP3 nye i kap. UP, UO2.1 i nytt kap. UO
    UP1_MAL,
    UP2_MAL,
    UP3_MAL,
    UO21_MAL,

    // ── UU1 – Prøving av VA-ledninger ── (definisjon eksportert over: UU1_MAL — ny mal, kapittel UU)
    UU1_MAL,
  ];

  // ── NS 3420-J:2008 Dekke- og banearbeider ─────────────────────────
  // Ny standard (ordre JH2 §3, Runde D). JH2 (asfaltdekke) i nytt kapittel JH.

  const standardJ = await opprettStandard("NS3420-J");

  const kapittelDataJ = KAPITTEL_DATA_J;

  const kapJ: Record<string, string> = {};
  for (const k of kapittelDataJ) {
    kapJ[k.kode] = await finnEllerOpprettKapittel(prisma, standardJ.id, k);
  }

  const malerJ: MalDef[] = [
    // ── JH2 – Asfaltdekke ── (definisjon eksportert over: JH2_MAL — ny mal, ny standard NS3420-J)
    JH2_MAL,
  ];

  // Kapittel-id per kode på tvers av alle fire standarder. Kapittelkoder er globalt unike
  // (KA…KM, FB…FS, UM/UU, JH), så en samlet oppslags-map er entydig — dispatch på malens kapittelKode.
  const alleKap: Record<string, string> = { ...kap, ...kapF, ...kapU, ...kapJ };

  // Alle malene er AI-utkast → verifisert: false (settes eksplisitt, ikke bare schema-default).
  // Prod-gate: uverifiserte maler seedes ikke i prod — prod holdes på 0 maler til fagkontroll er
  // registrert (via en fremtidig «Merk verifisert»-handling). Test/lokal får alle.
  const erProd = erProdDatabase();
  let opprettet = 0;
  let hoppetProdGate = 0;
  const hoppetFinnes: string[] = [];
  for (const mal of [...maler, ...malerF, ...malerU, ...malerJ]) {
    const verifisert = false;
    if (erProd && !verifisert) {
      hoppetProdGate++;
      continue;
    }
    const kapittelId = alleKap[mal.kapittelKode]!;
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

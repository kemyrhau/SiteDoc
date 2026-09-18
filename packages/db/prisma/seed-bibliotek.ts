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
import { byggBibliotekRader } from "@sitedoc/shared";
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

// KC3.1 – Oppstøtting av trær. Eksportert som egen definisjon slik at seed-testen kan låse
// feltene (krav (c) «stille tomhet forbudt»). Bygget med eksisterende helpers; skriveveien
// (opprettMalHvisMangler + felter→malInnhold-mapping) er urørt.
export const KC31_MAL = {
  kapittelKode: "KC",
  navn: "KC3.1 – Oppstøtting av trær",
  referanse: "KC3.1",
  beskrivelse: "Oppstøtting og oppbinding",
  felter: [
    valg("Metode", "FØR",
      ["Oppstøtting med stokker (KC3.11)", "Bardunering (KC3.12)", "Forankring i grunnen (KC3.13)", "Annet – angi i kommentar"],
      "Posten i beskrivelsen angir metoden. Bardunering og forankring er egne poster (KC3.12/KC3.13) med egne krav — denne sjekklisten dekker kontrollpunktene felles; postspesifikke krav står i beskrivelsen."),
    valg("Materiell kontrollert mot beskrivelsen", "FØR",
      ["Iht. posten – type, antall stokker og bindemateriale stemmer", "Avvik – dokumentert i kommentar", "Mangler – må skaffes før montering"],
      "KC3.11: type, antall stokker per oppstøtting og bindemateriale står i posten. Bruk mykt bindemateriale — aldri ståltråd direkte mot bark. Ta bilde av materiellet."),
    trafikklys("Solid og fast forankret – røtter uskadet", "UNDER",
      "KC3.1 c1: støtten skal stå solid og være fast forankret i bakken uten at røtter skades. Ta bilde av forankringen."),
    trafikklys("Bundet uten fare for gnag eller barkskade", "UNDER",
      "KC3.1 c2: bindingen skal ikke påføre treet mekanisk skade. Myk stropp eller gummibeskyttelse — aldri ståltråd direkte mot bark. Ta bilde av bindepunktet."),
    trafikklys("Kronen kan bevege seg fritt", "UNDER",
      "KC3.1 c3: støtten skal tillate fri bevegelse i kronen — stiv innspenning gir svak stamme."),
    trafikklys("Høyde: så lav som mulig – maks 1/3 av treets høyde", "UNDER",
      "KC3.1 c4, figur K7: støtten settes så lavt som mulig (ned mot 80 cm) og aldri over 1/3 av treets høyde. Ved avvik: noter målt høyde i kommentaren."),
    heltall("Antall trær støttet (stk)", "ETTER", { enhet: "stk" },
      "KC3.11 måles i stk trær. Før antallet som er støttet/bundet opp — dokumenterer levert mengde mot posten."),
    trafikklys("Krav oppfylt og dokumentasjon levert", "ETTER",
      "Konklusjon før overlevering: metode, materiell og antall iht. posten, alle kontrollpunkter besvart, bilder lagt ved dette dokumentet. Etterfølgende sesongskontroll og fjerning av oppstøttingen er vedlikehold (egen post, ZK2.7112) — ikke del av denne sjekklisten. FDV/sluttdokumentasjon leveres via egen dokumentasjonssjekkliste."),
  ] as FeltDef[],
};

// KD1 – Belegg av stein og heller. Eksportert som egen definisjon slik at seed-testen kan låse
// feltene (krav (c) «stille tomhet forbudt»). Bygget med eksisterende helpers; skriveveien
// (opprettMalHvisMangler + felter→malInnhold-mapping) er urørt.
//
// Revisjon 2026-09-18 (design-rollen, gatet av Kenneth): 7→10 felt for legging av stein-/hellebelegg.
// «Asfalt» fjernet (hører til IH). Krav mot varierende flate (fall, planhet, fugebredde, tykkelse)
// besvares med samsvar per kravnivå — ikke tallfelt (MAL-METODE §1). Én veldefinert måling (største
// sprang ved fuger) forblir heltall uten maks-grense (blokkerer aldri registrering av avvik).
// TILLEGG 2026-09-18 (§7b): malen fremstår med SiteDocs egne krav — ingen tabell-/punktkoder i
// hjelpetekster; standarden nevnes én gang, i beskrivelsen («Faglig grunnlag»). Kodene i navn/referanse
// beholdes (datanøkler + gjenkjennelse i beskrivelse/fremdriftsplan).
export const KD1_MAL = {
  kapittelKode: "KD",
  navn: "KD1 – Belegg av stein og heller",
  referanse: "KD1",
  beskrivelse:
    "Legging av belegg av naturstein, betong og tegl, også permeabelt belegg — settelag, fuger, fall og planhet. Faglig grunnlag: NS 3420-K:2024, post KD1.",
  felter: [
    valg("Belegningstype", "FØR",
      [
        "Storgatestein",
        "Smågatestein",
        "Mosaikkstein",
        "Natursteinsplater – sagde sider",
        "Natursteinsplater – råhogde kanter / bruddheller",
        "Belegningsstein av naturstein",
        "Betongheller",
        "Belegningsstein av betong",
        "Belegningsstein av tegl",
        "Permeabelt belegg",
        "Annet – se beskrivelsen",
      ],
      "Velg typen som er lagt — den avgjør kravene til settelag, fuger, fall og planhet i feltene under. Kontroller frostklassen i merkingen på pallen: naturstein og gatestein F1, betongheller og betongstein klasse 3 (merket D), tegl FP100. Ta bilde av pallelapp eller leveringsseddel."),
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
    valg("Tykkelse settelag", "UNDER",
      [
        "OK – 20–40 mm (betongstein, betongheller, tegl)",
        "OK – 30–50 mm (mosaikk, natursteinsplater, belegningsstein av naturstein)",
        "OK – 50–70 mm (stor- og smågatestein)",
        "OK – iht. leverandør (snøsmelteanlegg)",
        "Avvik – utenfor intervallet for belegningstypen",
      ],
      "Legg med overhøyde, slik at belegget ender i riktig høyde etter komprimering: 3–5 mm, for gatestein 8–12 mm. Med snøsmelteanlegg gjelder leverandørens tykkelse. Ved avvik: noter målt tykkelse og sted i kommentaren."),
    trafikklys("Fall mot avrenning", "UNDER",
      "Minst 2 % på gangareal. Kjøreareal: minst 2,5 %, for gatestein minst 3 %. Permeabelt belegg: fallet står i beskrivelsen. Angir beskrivelsen noe annet, gjelder den. Kontroller flere punkter. Ved avvik: noter målt fall og sted i kommentaren."),
    trafikklys("Fuger og striper i rette linjer eller jevne buer", "UNDER",
      "Gatestein legges i forband, forskjøvet minst 1/3 stein, i buer minst 1/5. Ingen tilpassede biter mindre enn 30 % av en hel stein."),
    valg("Fugebredde", "ETTER",
      [
        "OK – knas (gatestein, råhogd naturstein)",
        "OK – 2–5 mm (betongheller, betongstein)",
        "OK – 5–7 mm (belegningsstein av naturstein, sagde sider)",
        "OK – 5–8 mm (natursteinsplater, sagde, under 80 mm)",
        "OK – 9–12 mm (natursteinsplater, sagde, 80–150 mm)",
        "OK – iht. beskrivelsen (tegl, permeabelt, bruddheller, over 150 mm)",
        "Avvik – utenfor kravet for belegningstypen",
      ],
      "Enkeltsteiner kan avvike ±2 mm (sagde natursteinsplater) eller ±3 mm (belegningsstein av naturstein). Ved avvik: noter målt bredde og sted i kommentaren."),
    valg("Planhet – svanker/bulninger over 3 m", "ETTER",
      [
        "OK – innenfor ±3 mm",
        "OK – innenfor ±5 mm",
        "OK – innenfor ±6 mm",
        "OK – innenfor ±8 mm",
        "OK – innenfor ±10 mm",
        "Avvik – utenfor toleransen for type og areal",
      ],
      "Toleranse gang/kjøre, målt med 3 m rettholt: betongstein, betongheller, tegl og belegningsstein av naturstein ±3/±5 · smågatestein og mosaikk ±3/±5 · storgatestein ±5/±8 · sagde natursteinsplater ±5/±8 · råhogde natursteinsplater ±8/±10 · permeabelt maskinlagt ±3/±6. Mål flere steder og velg raden som gjelder. Ved avvik: noter største måling og sted i kommentaren."),
    heltall("Største vertikale sprang ved fuger (mm)", "ETTER", { enhet: "mm" },
      "Største tillatte sprang gang/kjøre: betongstein, betongheller, tegl og belegningsstein av naturstein 2/3 · smågatestein og mosaikk 3/5 · storgatestein 5/8 · sagde natursteinsplater 4/6 · råhogde natursteinsplater 6/8. Før inn den største målingen (hele mm)."),
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

async function main() {
  console.log("Seeder sjekklistebibliotek (kun opprett — rører aldri eksisterende rader)...");

  avbrytHvisProdUtenBekreftelse();

  // Standard: KUN OPPRETT. `update: {}` → finnes koden, blir raden urørt.
  const standard = await prisma.bibliotekStandard.upsert({
    where: { kode: "NS3420-K" },
    update: {},
    create: { kode: "NS3420-K", navn: "NS 3420-K:2024 Anleggsgartnerarbeider", sortering: 1 },
  });

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

  // Alle 14 malene er AI-utkast → verifisert: false (settes eksplisitt, ikke bare schema-default).
  // Prod-gate: uverifiserte maler seedes ikke i prod — prod holdes på 0 maler til fagkontroll er
  // registrert (via en fremtidig «Merk verifisert»-handling). Test/lokal får alle 14.
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

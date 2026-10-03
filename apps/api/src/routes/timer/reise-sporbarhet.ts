import { prisma } from "@sitedoc/db";
import { Prisma } from "@sitedoc/db-timer";
import {
  erReiseLonnsart,
  type ErReiseKontekst,
  type ReiseKilde,
  type ReiseRetning,
} from "@sitedoc/shared";

/**
 * LAG 2 (timer-GPS, sporbarhet — ordre L2-A, C2/C3) — serverens MOTTAK av
 * reise-sporet. K5 «mottak med sporbarhet»: serveren TAR IMOT klassifiseringen
 * med alt den bygde på, VALIDERER den (C2) og KONTROLLERER den mot matrisen (C3)
 * — men regner ALDRI om. Ingen lønnsart settes her; C3 flagger kun et varsel.
 *
 * Alle konstanter og regler bor i denne ene fila (rad-tak.ts-mønsteret), slik at
 * ingen terskel eller grense står som et tall spredt i handleren.
 */

// ── C3-konstanter (dobbel terskel) ────────────────────────────────────────
// En ren prosent roper på korte turer og tier på mellomlange (10 % av 2 km = 200 m
// støy), så avvik flagges FØRST når det overstiger BÅDE prosenten OG en nedre
// absolutt grense. Tallene er fabels forslag (gate 2026-10-03) — én kilde, aldri
// et tall i koden.
/** Minste relative avvik (%) før en dimensjon kan flagges. */
export const REISEAVVIK_MIN_PROSENT = 10;
/** Minste absolutte avstandsavvik (meter) før avstand kan flagges. */
export const REISEAVVIK_MIN_AVSTAND_M = 2000;
/** Minste absolutte kjøretidsavvik (minutter) før kjøretid kan flagges. */
export const REISEAVVIK_MIN_KJORETID_MIN = 10;

// ── C2-konstant ───────────────────────────────────────────────────────────
/**
 * Øvre fornuftssperre for en reise-avstand (meter). 1 000 000 m = 1000 km ligger
 * godt over enhver reell dagsreise i Norge; en tastefeil i størrelsesorden fanges.
 * Grov sperre, ikke en presis grense (jf. KM_MAKS_PER_DAG i rad-tak.ts).
 */
export const REISE_AVSTAND_MAKS_M = 1_000_000;

/**
 * Hent firmaets kontekst for erReise-utledning (reiseLonnsartId +
 * grensepunkt-arter). Leses fra KJERNEN (organization_settings +
 * organization_reise_grenser) — cross-package, ingen @relation. Kalles ÉN gang
 * per skrivesti og gjenbrukes for alle rader.
 */
export async function hentErReiseKontekst(
  organizationId: string,
): Promise<ErReiseKontekst> {
  const [setting, grenser] = await Promise.all([
    prisma.organizationSetting.findUnique({
      where: { organizationId },
      select: { reiseLonnsartId: true },
    }),
    prisma.organizationReiseGrense.findMany({
      where: { organizationId, lonnsartId: { not: null } },
      select: { lonnsartId: true },
    }),
  ]);
  return {
    reiseLonnsartId: setting?.reiseLonnsartId ?? null,
    grensepunktLonnsartIds: grenser
      .map((g) => g.lonnsartId)
      .filter((id): id is string => id != null),
  };
}

/**
 * Utled erReise for en rad når klienten IKKE sendte flagget eksplisitt
 * (overgangsperioden: gamle apper / web-skrivestier). SPEILER backfillen via den
 * delte `erReiseLonnsart` — samme regel, ett hjem. reiseKilde forblir null (vi
 * utledet, arbeideren klassifiserte ikke).
 */
export function utledErReise(
  lonnsartId: string,
  lonnsartNavn: string,
  ktx: ErReiseKontekst,
): boolean {
  return erReiseLonnsart(lonnsartId, lonnsartNavn, ktx);
}

/** Minimal klient-form helperen trenger (ekte klient ELLER tx-klient). */
type LonnsartLeser = {
  lonnsart: {
    findMany: (args: {
      where: { id: { in: string[] } };
      select: { id: true; navn: true };
    }) => Promise<{ id: string; navn: string }[]>;
  };
};

/**
 * Utled erReise for et sett lønnsart-IDer (presisering 2) — de interaktive
 * skrivestiene (web/firma-admin) sender ikke flagget, så det MÅ utledes her, med
 * SAMME regel som backfillen og synken. Henter kontekst + navn ÉN gang og
 * returnerer et kart lonnsartId → erReise. Brukes av tilfoy/oppdater/forson/
 * splitt/rediger — ingen rad slipper gjennom som stille `false`.
 */
export async function hentErReiseForLonnsarter(
  prismaTimer: LonnsartLeser,
  organizationId: string,
  lonnsartIds: string[],
): Promise<Map<string, boolean>> {
  const unike = Array.from(new Set(lonnsartIds));
  const res = new Map<string, boolean>();
  if (unike.length === 0) return res;
  const ktx = await hentErReiseKontekst(organizationId);
  const arter = await prismaTimer.lonnsart.findMany({
    where: { id: { in: unike } },
    select: { id: true, navn: true },
  });
  const navnMap = new Map(arter.map((a) => [a.id, a.navn]));
  for (const id of unike) {
    res.set(id, erReiseLonnsart(id, navnMap.get(id) ?? "", ktx));
  }
  return res;
}

/** Reise-sporet slik det ligger lest på en original-rad (for splitt-arv). */
export interface ReiseSporKilde {
  erReise: boolean;
  reiseRetning: string | null;
  reiseOppmotestedId: string | null;
  reiseKjoretidMin: number | null;
  reiseAvstandM: number | null;
  reiseKilde: string | null;
  reiseRegel: Prisma.JsonValue;
  tidKilde: string | null;
  reiseAvvik: boolean | null;
}

/**
 * Arv hele reise-sporet fra en original-rad til splitt-rader (presisering 2 +
 * sporbarhet): en splitt er SAMME arbeid, så klassifiseringen og sporet følger
 * med uendret. Json-feltet mappes til DbNull når det er tomt (Prisma-krav ved
 * create). Lønnsarten er uendret ved splitt → erReise forblir korrekt.
 */
export function arvReiseSpor(o: ReiseSporKilde): {
  erReise: boolean;
  reiseRetning: string | null;
  reiseOppmotestedId: string | null;
  reiseKjoretidMin: number | null;
  reiseAvstandM: number | null;
  reiseKilde: string | null;
  reiseRegel: Prisma.InputJsonValue | typeof Prisma.DbNull;
  tidKilde: string | null;
  reiseAvvik: boolean | null;
} {
  return {
    erReise: o.erReise,
    reiseRetning: o.reiseRetning,
    reiseOppmotestedId: o.reiseOppmotestedId,
    reiseKjoretidMin: o.reiseKjoretidMin,
    reiseAvstandM: o.reiseAvstandM,
    reiseKilde: o.reiseKilde,
    reiseRegel:
      o.reiseRegel == null
        ? Prisma.DbNull
        : (o.reiseRegel as Prisma.InputJsonValue),
    tidKilde: o.tidKilde,
    reiseAvvik: o.reiseAvvik,
  };
}

// ── C3: reiseAvvik (dobbel terskel) ───────────────────────────────────────

/** Tallene en matrise-rad bærer som snapshot, og cellens fasit å kontrollere mot. */
export interface ReiseKontrollVerdier {
  avstandM: number | null;
  kjoretidMin: number | null;
}

/** Overstiger avviket i én dimensjon BÅDE prosenten OG den absolutte grensen? */
function dimensjonAvvik(
  radVal: number | null,
  celleVal: number | null,
  minProsent: number,
  minAbsolutt: number,
): boolean {
  // Mangler et av tallene (eller uoppnåelig par, -1) → dimensjonen kan ikke
  // kontrolleres → bidrar ikke til et avvik.
  if (radVal == null || celleVal == null || radVal < 0 || celleVal < 0) {
    return false;
  }
  const diff = Math.abs(radVal - celleVal);
  const prosentOver = diff > (minProsent / 100) * celleVal;
  const absoluttOver = diff > minAbsolutt;
  return prosentOver && absoluttOver;
}

/**
 * C3 — sammenlign radens snapshot med matrisecellen. KONTROLL, ikke omregning:
 * returnerer kun et varsel-flagg, klassifiserer ingenting på nytt.
 *   true  = avvik (avstand ELLER kjøretid overstiger både % og nedre grense)
 *   false = innenfor terskel
 *   null  = cellen mangler → kan ikke kontrolleres (tre tilstander, «vet ikke»)
 */
export function beregnReiseAvvik(
  rad: ReiseKontrollVerdier,
  celle: ReiseKontrollVerdier | null,
): boolean | null {
  if (celle == null) return null;
  const avstand = dimensjonAvvik(
    rad.avstandM,
    celle.avstandM,
    REISEAVVIK_MIN_PROSENT,
    REISEAVVIK_MIN_AVSTAND_M,
  );
  const kjoretid = dimensjonAvvik(
    rad.kjoretidMin,
    celle.kjoretidMin,
    REISEAVVIK_MIN_PROSENT,
    REISEAVVIK_MIN_KJORETID_MIN,
  );
  return avstand || kjoretid;
}

// ── C2: invarianter ved mottak ────────────────────────────────────────────

/** En reise-rad slik den kom inn på synken, redusert til det C2 trenger. */
export interface ReiseRadInvariantInput {
  erReise: boolean;
  reiseRetning: ReiseRetning | null;
  reiseKilde: ReiseKilde | null;
  reiseOppmotestedId: string | null;
  reiseKjoretidMin: number | null;
  reiseAvstandM: number | null;
  reiseRegel: unknown;
}

/**
 * C2 — valider invariantene for en rad der klienten sendte erReise EKSPLISITT.
 * (Utledet erReise, overgangsperioden, er unntatt: den bærer med vilje null-spor.)
 * Returnerer en navngitt feilmelding ved brudd, ellers null. Validering, ikke
 * omregning — raden avvises, serveren retter aldri.
 *
 * `gyldigeOppmotesteder` = settet av oppmøtested-IDer som tilhører firmaet
 * (pre-lastet av kalleren, så validatoren er ren).
 */
export function validerReiseInvarianter(
  rad: ReiseRadInvariantInput,
  gyldigeOppmotesteder: Set<string>,
): string | null {
  if (!rad.erReise) {
    // Ikke-reise-rad skal ikke bære reise-spor (stille-tomhet-speil av DB-CHECK).
    if (
      rad.reiseRetning != null ||
      rad.reiseKjoretidMin != null ||
      rad.reiseAvstandM != null
    ) {
      return "En ikke-reise-rad bærer reise-felter (retning/kjøretid/avstand).";
    }
    return null;
  }

  // erReise = true (eksplisitt): KILDE er alltid påkrevd. Retningen er
  // informasjon, ikke lønn (B4 valg A, spec § 3/§ 4 C2) — lønnsarten arbeideren
  // velger avgjør. Derfor kreves retning + matrise-tallene KUN for matrise-kilde;
  // en manuell reise-rad (ingen retningsvelger i UI) er gyldig uten retning.
  if (rad.reiseKilde == null) {
    return "Reise-rad mangler kilde (matrise/manuell).";
  }
  if (rad.reiseKilde === "matrise") {
    if (rad.reiseRetning == null) {
      return "Matrise-reise mangler retning (ut/retur).";
    }
    if (rad.reiseKjoretidMin == null || rad.reiseKjoretidMin < 0) {
      return "Matrise-reise mangler gyldig kjøretid.";
    }
    if (rad.reiseAvstandM == null || rad.reiseAvstandM < 0) {
      return "Matrise-reise mangler gyldig avstand.";
    }
    if (rad.reiseRegel == null) {
      return "Matrise-reise mangler regel-snapshot.";
    }
  }
  if (
    rad.reiseAvstandM != null &&
    rad.reiseAvstandM > REISE_AVSTAND_MAKS_M
  ) {
    return `Reise-avstand ${rad.reiseAvstandM} m overstiger maksgrensen på ${REISE_AVSTAND_MAKS_M} m.`;
  }
  if (
    rad.reiseOppmotestedId != null &&
    !gyldigeOppmotesteder.has(rad.reiseOppmotestedId)
  ) {
    return "Reise-rad peker på et oppmøtested som ikke tilhører firmaet.";
  }
  return null;
}

import { eq, and, asc } from "drizzle-orm";
import {
  utledOrdning,
  erGyldigOrdning,
  løsReiseLonnsartId,
  REISE_LONNSART_REGEX,
  type UtleggOrdning,
} from "@sitedoc/shared";
import { hentDatabase } from "../db/database";
import {
  lonnsartLocal,
  aktivitetLocal,
  tilleggLocal,
  externalCostObjectLocal,
  expenseCategoryLocal,
  prosjektOrdningOverstyringLocal,
} from "../db/schema";
import { hentOrganizationSettingLokalt } from "./organizationSettingKatalog";
import { hentReiseGrensepunkterLokalt } from "./reiseGrensepunktKatalog";
import type { trpc } from "../lib/trpc";

// REISE_LONNSART_REGEX bor nå i @sitedoc/shared (én kilde delt med serverens
// tvetydighets-telling) — importert over, ikke definert lokalt.

/* ============================================================================
 *  Timer-katalog-cache (Runde 2)
 *
 *  Speiler firmaets aktive lønnsarter, aktiviteter og tillegg lokalt.
 *  Refresh ved login + ved manuell trigger. Ikke delta-sync i Runde 2 —
 *  full overskriving er enkelt og katalog er typisk < 100 rader per type.
 *
 *  Mobil-UI leser kun fra lokal cache når dagsseddel åpnes — sikrer at
 *  velgere fungerer offline. Ny katalog-rad fra firma-admin krever sync.
 * ============================================================================ */

type TrpcKlient = ReturnType<typeof trpc.useUtils>["client"];

/**
 * Last ned hele aktiv katalog fra server og overskriv lokal cache.
 * Idempotent — trygt å kjøre flere ganger.
 */
export async function refreshKatalog(klient: TrpcKlient): Promise<{
  lonnsarter: number;
  aktiviteter: number;
  tillegg: number;
  underprosjekter: number;
  utleggskategorier: number;
}> {
  const db = hentDatabase();
  if (!db) {
    return {
      lonnsarter: 0,
      aktiviteter: 0,
      tillegg: 0,
      underprosjekter: 0,
      utleggskategorier: 0,
    };
  }

  // Cache-bevaring (device-funn 2026-08-08): ECO-pullen fanges IKKE lenger.
  // Alle fire pull-ene kaster nå før den destruktive db.delete under → en feilet
  // pull bevarer ALLE fire cachene (kalleren fanger), symmetrisk med de tre andre.
  // Den gamle `.catch(() => [])` begrunnet seg med «bruker uten firma» (moot:
  // resolverOrgFraInput/krevBrukersOrg kaster FORBIDDEN for org-løse, så lonnsart
  // rejecter Promise.all først uansett) og «ECO-router mangler» (historisk — ruten
  // finnes/er wiret; skulle den mangle, bevares nå alle fire i stedet for at
  // ECO-cachen tømmes → feiler tryggere).
  // U4: utleggskatalogen (kategorier + overstyringer) hentes som femte pull i
  // SAMME Promise.all — den kaster før den destruktive db.delete under, akkurat
  // som de fire andre. Ingen `.catch(() => [])` (cache #7 med samme bug). Mobil
  // med U4-kode snakker alltid med en U4-server (samme deploy), så ingen skew.
  const [lonnsarter, aktiviteter, tillegg, underprosjekter, utleggKatalog] =
    await Promise.all([
      klient.timer.lonnsart.list.query(),
      klient.timer.aktivitet.list.query(),
      klient.timer.tillegg.list.query(),
      klient.eksternKostObjekt.list.query(),
      klient.timer.expenseCategory.katalogForMobil.query(),
    ]);

  const naa = Date.now();

  // Lønnsarter — full overskriving
  db.delete(lonnsartLocal).run();
  for (const l of lonnsarter) {
    db.insert(lonnsartLocal)
      .values({
        id: l.id,
        organizationId: l.organizationId,
        type: l.type,
        kode: l.kode,
        navn: l.navn,
        prisMotKunde: l.prisMotKunde?.toString() ?? null,
        internkostnad: l.internkostnad?.toString() ?? null,
        sats: l.sats?.toString() ?? null,
        satsEnhet: l.satsEnhet,
        rekkefolge: l.rekkefolge,
        aktiv: l.aktiv,
        erStandardvalg: l.erStandardvalg ?? false,
        overtidsnivaa: l.overtidsnivaa ?? null,
        seedNivaa: l.seedNivaa,
        sistOppdatert: naa,
      })
      .run();
  }

  db.delete(aktivitetLocal).run();
  for (const a of aktiviteter) {
    db.insert(aktivitetLocal)
      .values({
        id: a.id,
        organizationId: a.organizationId,
        kode: a.kode,
        navn: a.navn,
        aktiv: a.aktiv,
        seedNivaa: a.seedNivaa,
        sistOppdatert: naa,
      })
      .run();
  }

  db.delete(tilleggLocal).run();
  for (const tl of tillegg) {
    db.insert(tilleggLocal)
      .values({
        id: tl.id,
        organizationId: tl.organizationId,
        kode: tl.kode,
        navn: tl.navn,
        type: tl.type,
        prisMotKunde: tl.prisMotKunde?.toString() ?? null,
        internkostnad: tl.internkostnad?.toString() ?? null,
        rekkefolge: tl.rekkefolge,
        aktiv: tl.aktiv,
        seedNivaa: tl.seedNivaa,
        sistOppdatert: naa,
      })
      .run();
  }

  // Underprosjekter (ECO) — full overskriving
  db.delete(externalCostObjectLocal).run();
  for (const eco of underprosjekter) {
    db.insert(externalCostObjectLocal)
      .values({
        id: eco.id,
        organizationId: eco.organizationId,
        projectId: eco.projectId,
        proAdmId: eco.proAdmId,
        kortNavn: eco.kortNavn,
        kilde: eco.kilde,
        status: eco.status,
        timerregistreringApen: eco.timerregistreringApen,
        sistOppdatert: naa,
      })
      .run();
  }

  // U4: utleggskatalog — full overskriving (kategorier + overstyringer).
  db.delete(expenseCategoryLocal).run();
  for (const k of utleggKatalog.kategorier) {
    db.insert(expenseCategoryLocal)
      .values({
        id: k.id,
        organizationId: utleggKatalog.organizationId,
        navn: k.navn,
        ordning: k.ordning,
        aktiv: k.aktiv,
        sistOppdatert: naa,
      })
      .run();
  }
  db.delete(prosjektOrdningOverstyringLocal).run();
  for (const o of utleggKatalog.overstyringer) {
    db.insert(prosjektOrdningOverstyringLocal)
      .values({
        prosjektId: o.prosjektId,
        expenseCategoryId: o.expenseCategoryId,
        ordning: o.ordning,
        sistOppdatert: naa,
      })
      .run();
  }

  return {
    lonnsarter: lonnsarter.length,
    aktiviteter: aktiviteter.length,
    tillegg: tillegg.length,
    underprosjekter: underprosjekter.length,
    utleggskategorier: utleggKatalog.kategorier.length,
  };
}

/**
 * Synkron lese-funksjon for UI: hent aktive lønnsarter fra lokal cache.
 * Returnerer tom array hvis cache ikke er populert (typisk før første sync).
 */
export function hentLonnsarterLokalt(organizationId: string) {
  const db = hentDatabase();
  if (!db) return [];
  // Stabil orden: reise-resolveren (eneste kaller) tar første regex-treff via
  // `.find()` — uten deterministisk sortering kunne valget skifte mellom to
  // synk-er hos et firma med ≥2 treff. rekkefolge (notNull, firmaets egen
  // katalogorden), så id som absolutt bryter. Ikke kode: den er nullable + tekst
  // (leksikalsk «122» < «20»). For 0/1 treff er atferden identisk med før.
  return db
    .select()
    .from(lonnsartLocal)
    .where(
      and(
        eq(lonnsartLocal.organizationId, organizationId),
        eq(lonnsartLocal.aktiv, true),
      ),
    )
    .orderBy(asc(lonnsartLocal.rekkefolge), asc(lonnsartLocal.id))
    .all();
}

/**
 * Variant B: hent firmaets default-lønnsart (erStandardvalg=true) fra lokal
 * cache. Brukes til å forhåndsvelge lønnsart på første rad av en tom sedel.
 * Returnerer null hvis ingen er markert (f.eks. migrerte firma med tom katalog).
 */
export function hentStandardLonnsartLokalt(organizationId: string) {
  const db = hentDatabase();
  if (!db) return null;
  const rader = db
    .select()
    .from(lonnsartLocal)
    .where(
      and(
        eq(lonnsartLocal.organizationId, organizationId),
        eq(lonnsartLocal.aktiv, true),
        eq(lonnsartLocal.erStandardvalg, true),
      ),
    )
    .all();
  return rader[0] ?? null;
}

/**
 * ③a: har firmaet minst én aktiv ordinær lønnsart med overtidsnivaa satt?
 * Brukes til fallback-banner i [id].tsx — når auto-utkast produserer overtid
 * men firmaet mangler overtid-lønnsart (aldri feil-match, aldri stille drop).
 */
export function harOvertidLonnsartLokalt(organizationId: string): boolean {
  const db = hentDatabase();
  if (!db) return false;
  return (
    db
      .select()
      .from(lonnsartLocal)
      .where(
        and(
          eq(lonnsartLocal.organizationId, organizationId),
          eq(lonnsartLocal.aktiv, true),
          eq(lonnsartLocal.type, "ordinaer"),
        ),
      )
      .all()
      .some((l) => l.overtidsnivaa != null)
  );
}

/**
 * Resolver firmaets reise-lønnsart fra lokal cache — ÉN sannhetskilde delt
 * mellom generering (genererForslag) og render (reise-merking). Prioritet:
 *   1. Avstandsbånd-treff (`løsReiseLonnsartId` mot lokale grensepunkter) —
 *      KUN når `avstandM` er oppgitt og et grensepunkt med en art treffer
 *   2. OrganizationSetting.reiseLonnsartId (eksplisitt valgt av firma-admin)
 *   3. Navne-match (/reise|transport/i) mot aktive lønnsarter
 * Returnerer null hvis ingen passende lønnsart finnes.
 *
 * `avstandM` er VALGFRITT. Utelatt (undefined) → nøyaktig som før: båndene leses
 * ikke, prioritet 2→3 avgjør (render-laget `TimerSeksjon` har ingen avstand i
 * scope, jf. `sheet_timer_local` bærer ikke avstand). Oppgitt (tall eller null)
 * → `løsReiseLonnsartId` avgjør: treff i et bånd med art vinner, ellers faller
 * den konservativt tilbake på prioritet 2→3 (avstand null/<0/hull → fallback).
 */
export function hentReiseLonnsartId(
  organizationId: string,
  avstandM?: number | null,
): string | null {
  const regel = hentOrganizationSettingLokalt(organizationId);
  // Fallback = dagens oppførsel (prioritet 2→3): eksplisitt art, ellers navne-match.
  const fallback =
    regel?.reiseLonnsartId ??
    hentLonnsarterLokalt(organizationId).find((l) =>
      REISE_LONNSART_REGEX.test(l.navn),
    )?.id ??
    null;
  // Uten avstand → uendret oppførsel, båndene røres ikke (render-laget).
  if (avstandM === undefined) return fallback;
  // Med avstand → delt resolver velger båndets art, ellers fallback.
  return løsReiseLonnsartId(
    avstandM,
    hentReiseGrensepunkterLokalt(organizationId),
    fallback,
  );
}

export function hentAktiviteterLokalt(organizationId: string) {
  const db = hentDatabase();
  if (!db) return [];
  return db
    .select()
    .from(aktivitetLocal)
    .where(
      and(
        eq(aktivitetLocal.organizationId, organizationId),
        eq(aktivitetLocal.aktiv, true),
      ),
    )
    .all();
}

export function hentTilleggLokalt(organizationId: string) {
  const db = hentDatabase();
  if (!db) return [];
  return db
    .select()
    .from(tilleggLocal)
    .where(
      and(
        eq(tilleggLocal.organizationId, organizationId),
        eq(tilleggLocal.aktiv, true),
      ),
    )
    .all();
}

/**
 * Hjelper: finn én lønnsart fra lokal cache (for å vise navn på rader
 * uten å hente på nytt fra server).
 */
export function finnLonnsartLokalt(id: string) {
  const db = hentDatabase();
  if (!db) return null;
  const rader = db
    .select()
    .from(lonnsartLocal)
    .where(eq(lonnsartLocal.id, id))
    .all();
  return rader[0] ?? null;
}

export function finnTilleggLokalt(id: string) {
  const db = hentDatabase();
  if (!db) return null;
  const rader = db
    .select()
    .from(tilleggLocal)
    .where(eq(tilleggLocal.id, id))
    .all();
  return rader[0] ?? null;
}

export function finnAktivitetLokalt(id: string) {
  const db = hentDatabase();
  if (!db) return null;
  const rader = db
    .select()
    .from(aktivitetLocal)
    .where(eq(aktivitetLocal.id, id))
    .all();
  return rader[0] ?? null;
}

/**
 * Hent aktive Underprosjekter (ECO) for et prosjekt fra lokal cache.
 * Filterer både på status="aktiv" og timerregistreringApen=true.
 */
export function hentUnderprosjekterLokalt(projectId: string) {
  const db = hentDatabase();
  if (!db) return [];
  return db
    .select()
    .from(externalCostObjectLocal)
    .where(
      and(
        eq(externalCostObjectLocal.projectId, projectId),
        eq(externalCostObjectLocal.status, "aktiv"),
        eq(externalCostObjectLocal.timerregistreringApen, true),
      ),
    )
    .all();
}

export function finnUnderprosjektLokalt(id: string) {
  const db = hentDatabase();
  if (!db) return null;
  const rader = db
    .select()
    .from(externalCostObjectLocal)
    .where(eq(externalCostObjectLocal.id, id))
    .all();
  return rader[0] ?? null;
}

/* ============================================================================
 *  U4 — utleggskatalog (offline ordnings-utledning)
 * ========================================================================== */

/** Aktive utleggskategorier for firmaet (registreringsvelgeren). */
export function hentUtleggskategorierLokalt(organizationId: string) {
  const db = hentDatabase();
  if (!db) return [];
  return db
    .select()
    .from(expenseCategoryLocal)
    .where(
      and(
        eq(expenseCategoryLocal.organizationId, organizationId),
        eq(expenseCategoryLocal.aktiv, true),
      ),
    )
    .all();
}

/** Én utleggskategori fra cache (for å vise navn på en ført rad). */
export function finnUtleggskategoriLokalt(id: string) {
  const db = hentDatabase();
  if (!db) return null;
  const rader = db
    .select()
    .from(expenseCategoryLocal)
    .where(eq(expenseCategoryLocal.id, id))
    .all();
  return rader[0] ?? null;
}

/**
 * On-device ordnings-utledning for et prosjekt+kategori — den ENE mobil-veien
 * til ordningen, via delt `utledOrdning` (overstyring ?? firma-default) — pluss
 * KILDEN («firma-standard» / «overstyrt for prosjektet») for kilde-linja (8b).
 * Stemples på raden ved føring. Returnerer null hvis kategorien ikke finnes i
 * cache (da kan raden ikke føres — kalleren håndterer det). Drift-sikring:
 * ugyldig cachet ordning-streng faller til 'utlegg' (som server-lesingen).
 */
export function utledOrdningOgKildeLokalt(
  prosjektId: string,
  expenseCategoryId: string,
): { ordning: UtleggOrdning; kilde: "firma-standard" | "overstyrt" } | null {
  const db = hentDatabase();
  if (!db) return null;
  const kat = finnUtleggskategoriLokalt(expenseCategoryId);
  if (!kat) return null;
  const firmaDefault: UtleggOrdning = erGyldigOrdning(kat.ordning)
    ? kat.ordning
    : "utlegg";
  const overstyringRad = db
    .select()
    .from(prosjektOrdningOverstyringLocal)
    .where(
      and(
        eq(prosjektOrdningOverstyringLocal.prosjektId, prosjektId),
        eq(prosjektOrdningOverstyringLocal.expenseCategoryId, expenseCategoryId),
      ),
    )
    .all()[0];
  const prosjektOverstyring: UtleggOrdning | null =
    overstyringRad && erGyldigOrdning(overstyringRad.ordning)
      ? overstyringRad.ordning
      : null;
  return {
    ordning: utledOrdning({ firmaDefault, prosjektOverstyring }),
    kilde: prosjektOverstyring ? "overstyrt" : "firma-standard",
  };
}

/** Ordningen alene (uten kilde) — for enkle kallere (velger-filter, stempling). */
export function utledOrdningLokalt(
  prosjektId: string,
  expenseCategoryId: string,
): UtleggOrdning | null {
  return utledOrdningOgKildeLokalt(prosjektId, expenseCategoryId)?.ordning ?? null;
}

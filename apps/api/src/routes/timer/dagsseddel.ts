import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma, type PrismaClient as PrismaClientTimer } from "@sitedoc/db-timer";
import { prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../../trpc/trpc";
import { signerHvisPrivat } from "../../utils/hmac";
import {
  autoriserAdminForFirma,
  verifiserProsjektmedlem,
  verifiserProsjekterTilhørerFirma,
  hentBrukersOrg,
  resolverOrgFraInput,
  resolverOrgForEgenTimeføring,
  verifiserAnsattIFirma,
  erAnsattIFirma,
} from "../../trpc/tilgangskontroll";
import { krevTimerAktivert, hentEffektivArbeidstid } from "../../services/timer";
import {
  krevRadInnenforTak,
  maksForSatsEnhet,
  takFeilmelding,
} from "./rad-tak";
import {
  hentErReiseKontekst,
  hentErReiseForLonnsarter,
  utledErReise,
  beregnReiseAvvik,
  validerReiseInvarianter,
  arvReiseSpor,
  type ReiseRadInvariantInput,
  type ReiseSporKilde,
} from "./reise-sporbarhet";
import {
  harGyldigMaskinforerbevis,
  harGyldigMaskinforerbevisBatch,
} from "../../services/kompetanse/maskinforerbevis";
import {
  beregnMaskinBrudd,
  type MaskinBrudd,
  tilErEtterFra,
  finnOverlappendeTidsrom,
  finnTidsromKonflikt,
  utledOrdning,
  erGyldigOrdning,
  baeresAvSheetUtlegg,
  krevesBelop,
  UTLEGG_ORDNINGER,
  type UtleggOrdning,
  beregnUkenorm,
  beregnOvertidsgrunnlag,
  lesOvertidsgrunnlagFraSnapshot,
  type Overtidsgrunnlag,
  type ErReiseKontekst,
  effektiveTimerFraSpenn,
  pauseOverlappMin,
  pauseVinduForDag,
  hhmmTilMin,
  PAUSE_TERSKEL_TIMER,
} from "@sitedoc/shared";
import {
  klassifiserSyncRader,
  type ServerRad as VersjonServerRad,
  type PayloadRad as VersjonPayloadRad,
  type Tombstone as VersjonTombstone,
} from "./sync-versjon";

const STATUS_VERDIER = ["draft", "sent", "returned", "accepted"] as const;
// Lukket ordning-enum for sync-input. Klienten STEMPLER ordningen ved føring
// (U4) — serveren re-utleder ALDRI ved sync (ordningen kan ha endret seg i
// mellomtiden; radens stempel er integritetsbæreren fra U1). Enum-validering +
// CHECK-speil + sats-avvisning her er sikkerhetsnettet mot en feilstemplet rad.
const SYNC_ORDNING_ENUM = z.enum(
  UTLEGG_ORDNINGER as unknown as [UtleggOrdning, ...UtleggOrdning[]],
);
type DagsseddelStatus = (typeof STATUS_VERDIER)[number];

/**
 * Sentinel: syncBatch prøvde å skrive en sedel som ble `accepted` (attestert av
 * leder) i vinduet mellom den utenfor-tx-lesningen (accepted-vakten) og den
 * betingede skrivingen inne i tx. Kastes fra tx-callbacken (ruller den tilbake)
 * og fanges i loop-catchen → `conflict`-resultat med server-tilstanden.
 */
class SedelAttestertConflict extends Error {}

/**
 * §2.D (ufravikelig, Fase 2 / T.10): valider at vehicleId (kostnadsbærer for
 * maskinvedlikehold på SheetTimer) tilhører firmaet. Equipment er svak FK
 * (db-maskin, ingen @relation), så org-isolasjon MÅ håndheves i app-lag — ellers
 * cross-firma-lekkasje av maskin-ID. Dynamisk import speiler tilgangskontroll.ts-
 * mønsteret (unngår sirkulær avhengighet i tRPC-laget).
 */
async function verifiserKjoretoyTilhørerFirma(
  vehicleId: string,
  organizationId: string,
): Promise<void> {
  const { prismaMaskin } = await import("@sitedoc/db-maskin");
  const utstyr = await prismaMaskin.equipment.findFirst({
    where: { id: vehicleId, organizationId },
    select: { id: true },
  });
  if (!utstyr) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Maskin/utstyr finnes ikke i firmaets register",
    });
  }
}

/**
 * Status-livssyklus per Runde 1B-spec:
 *   draft     — redigerbar (av eier)
 *   sent      — låst (venter på leder)
 *   returned  — redigerbar (leder ba om endringer)
 *   accepted  — låst permanent (attestert)
 *
 * timerLockEtterDager (OrganizationSetting) sjekkes kun for status="draft".
 * null = ingen alders-grense.
 */
// Én kilde for hvilke statuser som er redigerbare. Brukes både av `erRedigerbar` (gate ved
// start) og av `forsonDagskort`s status-betingede updateMany (TOCTOU-guard i transaksjonen) —
// de to MÅ aldri drifte, ellers kan guarden slippe en status gaten avviste (eller motsatt).
const REDIGERBARE_STATUSER = ["draft", "returned"] as const;
function erRedigerbar(status: string): boolean {
  return (REDIGERBARE_STATUSER as readonly string[]).includes(status);
}

/**
 * Sjekk om bruker kan godkjenne dagssedler for et prosjekt.
 * Leder = ProjectMember.role="admin" ELLER ProjectMember.kanAttestere=true,
 * eller sitedoc_admin / firma-admin i prosjektets firma.
 * (Boolean-kapabilitet vedtatt 2026-05-02 — erstatter "project_manager"-rolle.)
 */
async function erProsjektLeder(userId: string, projectId: string): Promise<boolean> {
  const bruker = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!bruker) return false;
  if (bruker.role === "sitedoc_admin") return true;

  const brukerOrgId = await hentBrukersOrg(userId);
  if (brukerOrgId) {
    const orgProsjekt = await prisma.projectOrganization.findFirst({
      where: { organizationId: brukerOrgId, projectId },
    });
    if (orgProsjekt) {
      const member = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId, organizationId: brukerOrgId } },
        select: { firmaRoller: true },
      });
      if (member?.firmaRoller.includes("firma_admin")) return true;
    }
  }

  const medlem = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { role: true, kanAttestere: true },
  });
  return medlem?.role === "admin" || medlem?.kanAttestere === true;
}

async function krevProsjektLeder(userId: string, projectId: string): Promise<void> {
  if (!(await erProsjektLeder(userId, projectId))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Kun prosjektleder eller administrator kan godkjenne dagssedler",
    });
  }
}

/**
 * Hent dagsseddel og verifiser at innlogget bruker eier den (eller er admin).
 * Kaster NOT_FOUND hvis ikke funnet, FORBIDDEN hvis ikke eget.
 */
async function hentEgenDagsseddel(
  prismaTimer: Prisma.TransactionClient | typeof import("@sitedoc/db-timer").prismaTimer,
  ctxUserId: string,
  sheetId: string,
  // Kenneth-vedtak 2026-10-09 (2): EGEN timeføring krever aktivt ansettelsesforhold.
  // Default true (skrive-stiene: tilfoy/oppdater/fjern-rader, forson, oppdater sedel) →
  // eieren må være aktivt ansatt i sedelens firma. Lese- og livssyklus-stiene
  // (hentMedId, list/signer-vedlegg, send, gjenåpne, slett) sender `false` — de beholder
  // dagens tilgang (en sluttet ansatt skal fortsatt se og avvikle sine egne sedler).
  opts: { krevAnsatt?: boolean } = {},
) {
  const { krevAnsatt = true } = opts;
  // F4-1b (2026-07-11): identitets-robust oppslag. Mobil sender lokal id
  // (= clientUuid, jf. F4-1 pull-M2). For sedler laget FØR F4-1-invarianten
  // (`id = clientUuid` ved create) er server-PK `id` ≠ `clientUuid` → et rent
  // id-oppslag ga NOT_FOUND på alle ~14 arbeider-kallesteder (gjenåpne/rediger/
  // send/slett). Slå opp på `id` FØRST (server-id: post-invariant + web-klient),
  // fall tilbake til `clientUuid` (pre-invariant mobil-id). Begge @unique →
  // ingen migrering. Bakoverkompat: gammel klient sender server-id → treffer id;
  // ny mobil sender clientUuid → treffer clientUuid.
  const pt = prismaTimer as typeof import("@sitedoc/db-timer").prismaTimer;
  const sheet =
    (await pt.dailySheet.findUnique({ where: { id: sheetId } })) ??
    (await pt.dailySheet.findUnique({ where: { clientUuid: sheetId } }));
  // M4 (2026-07-10): NOT_FOUND uten melding ga tom feiltekst hos klienten. Alle
  // 14 kallesteder (hentMedId/oppdater/tilfoy*/oppdater*/fjern*/send/gjenaapne/
  // slett) propagerer feilen til tRPC uten å mappe på tom melding (verifisert:
  // eneste catch i fila på helper-veien er opprett-P2002, som ikke rører denne).
  if (!sheet) throw new TRPCError({ code: "NOT_FOUND", message: "Dagsseddelen finnes ikke" });

  // Eierskap: kun den som sedelen tilhører, eller admin/firmaadmin
  if (sheet.userId !== ctxUserId) {
    const bruker = await prisma.user.findUniqueOrThrow({
      where: { id: ctxUserId },
      select: { role: true },
    });
    let erAdmin = bruker.role === "sitedoc_admin";
    if (!erAdmin) {
      const member = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: ctxUserId,
            organizationId: sheet.organizationId,
          },
        },
        select: { firmaRoller: true },
      });
      erAdmin = member?.firmaRoller.includes("firma_admin") ?? false;
    }
    if (!erAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Du eier ikke denne dagsseddelen",
      });
    }
    // Admin/firmaadmin som redigerer en ANNENS sedel beholder dagens tilgang
    // (attestering/retting) — ansatt-kravet gjelder kun EGEN timeføring under.
  } else if (krevAnsatt) {
    // Eieren fører egne timer → krev aktivt ansettelsesforhold i sedelens firma.
    await verifiserAnsattIFirma(ctxUserId, sheet.organizationId);
  }

  return sheet;
}

/**
 * F4-1d (2026-07-11): bump `DailySheet.updatedAt` eksplisitt når en rad-mutasjon
 * skriver barn-rader (SheetTimer/Tillegg/Machine/Vedlegg) uten selv å oppdatere
 * sedelen. Prisma bumper `@updatedAt` KUN når selve DailySheet-raden skrives —
 * en barn-`create/update/delete` gjør det ikke. `hentEndringerSiden` bruker
 * `updatedAt > sistSynk` som delta-vindu → uten dette blir web-førte rader
 * usynlige for mobil inkrementell pull (hodet vises, 0 rader; se F4-1d-diagnose).
 * Kall INNI samme `$transaction` som rad-skrivingen der en tx finnes, ellers
 * som eget element i en ny tx (atomisk med rad-writet). Returnerer PrismaPromise
 * så den kan legges rett i en `$transaction([...])`-array.
 */
function touchSedel(
  prismaTimer: Prisma.TransactionClient | typeof import("@sitedoc/db-timer").prismaTimer,
  sheetId: string,
) {
  const pt = prismaTimer as typeof import("@sitedoc/db-timer").prismaTimer;
  return pt.dailySheet.update({
    where: { id: sheetId },
    data: { updatedAt: new Date() },
  });
}

/**
 * Felt-formen for en timer-rad ved opprettelse. ÉN kilde, delt av `tilfoyTimerRad` og
 * `forsonDagskort` — ingen andre kopi av skrive-feltene (unngår drift mellom to
 * create-steder). Rene FK-skalarer (unchecked-create), som den eksisterende raden.
 */
function byggTimerRadData(
  sheetId: string,
  r: {
    projectId: string;
    byggeplassId?: string | null;
    lonnsartId: string;
    aktivitetId: string;
    timer: number;
    fraTid?: string | null;
    tilTid?: string | null;
    // V20/PK1: radens egen matpause (min). Kalleren setter den til den
    // vurderte verdien (vurderRadTimer), aldri rått fra klienten.
    pauseMin?: number | null;
    beskrivelse?: string | null;
    externalCostObjectId?: string | null;
    vehicleId?: string | null;
  },
  // LAG 2 (presisering 2): erReise MÅ settes på hver ny rad — de interaktive
  // skrivestiene sender ikke flagget, så kalleren utleder det (samme regel som
  // backfill/synk) og gir det hit. Ingen reise-rad fødes stille `false`.
  erReise: boolean,
): Prisma.SheetTimerUncheckedCreateInput {
  return {
    sheetId,
    projectId: r.projectId,
    byggeplassId: r.byggeplassId ?? null,
    lonnsartId: r.lonnsartId,
    aktivitetId: r.aktivitetId,
    timer: r.timer,
    fraTid: r.fraTid ?? null,
    tilTid: r.tilTid ?? null,
    pauseMin: r.pauseMin ?? 0,
    beskrivelse: r.beskrivelse ?? null,
    externalCostObjectId: r.externalCostObjectId ?? null,
    vehicleId: r.vehicleId ?? null,
    // Interaktive web-rader bærer ikke reise-spor (kilde/retning/tall) — kun
    // flagget utledes. reiseKilde forblir null (web klassifiserte ikke etappen).
    erReise,
  };
}

/** Reise-sporet som skal skrives på en rad etter C1/C2/C3-behandling i synken. */
type ReiseFelter = {
  erReise: boolean;
  reiseRetning: string | null;
  reiseOppmotestedId: string | null;
  reiseKjoretidMin: number | null;
  reiseAvstandM: number | null;
  reiseKilde: string | null;
  reiseRegel: unknown;
  tidKilde: string | null;
  reiseAvvik: boolean | null;
};

/** Json? til createMany: SQL NULL når vi ikke har en verdi (Prisma-krav). */
function jsonEllerNull(
  v: unknown,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return v == null ? Prisma.DbNull : (v as Prisma.InputJsonValue);
}

// ──────────────────────────────────────────────────────────────────────────
//  V19 (overlapp PC ↔ mobil, Kenneth 2026-10-04 «b») — serverens vakt.
//  Spec timer-overlapp-pc-mobil-spec.md § 3 A-1. ÉN overlapp-regel og ÉN
//  forslags-skriving, så de to stedene flyten møter server-rader (A-1a
//  S2-handleren og A-1b eksisterende-sedel-grenen) aldri bygger hver sin union
//  eller sin egen statusvakt.
// ──────────────────────────────────────────────────────────────────────────

/** Mobilens payload-rad, redusert til det forslags-speilet trenger å bære. */
type OverlappPayloadRad = {
  id: string;
  projectId?: string | null;
  byggeplassId?: string | null;
  lonnsartId: string;
  aktivitetId: string;
  fraTid?: string | null;
  tilTid?: string | null;
  timer: number;
  pauseMin?: number | null;
  beskrivelse?: string | null;
  externalCostObjectId?: string | null;
  vehicleId?: string | null;
  erReise?: boolean;
  reiseRetning?: "ut" | "retur" | null;
  reiseOppmotestedId?: string | null;
  reiseKjoretidMin?: number | null;
  reiseAvstandM?: number | null;
  reiseKilde?: "matrise" | "manuell" | null;
  reiseRegel?: unknown;
  tidKilde?: "stempel" | "utledet" | "manuell" | null;
};

/**
 * V19.7 — overlapp mellom mobilens rader og serverradene som OVERLEVER, avgjort av
 * den eksisterende `finnTidsromKonflikt` på UNIONEN (ingen ny kopi). Begge sider er
 * alt internt validert (payload ved SYNC-2 `:5441`, serverrader ved sine skrive-
 * stier), så et «overlapp»-treff i unionen er pr. definisjon et KRYSS (payload ×
 * server). Tid-løse rader hoppes over som i dag (reise før V8).
 */
function finnOverlappMotServer(
  serverRader: readonly { fraTid: string | null; tilTid: string | null }[],
  payloadRader: readonly { fraTid?: string | null; tilTid?: string | null }[],
): boolean {
  const konflikt = finnTidsromKonflikt([...serverRader, ...payloadRader]);
  return konflikt?.type === "overlapp";
}

/**
 * V19.1/§8.6 — skriv mobilens payload som FORSLAG (ikke på sheet_timer) i den tx-en
 * kalleren alt står i. Den status-betingede `updateMany` er BÅDE statusvakt og
 * radlås (samme mønster som `SedelAttestertConflict`-guarden `:5596` og
 * `forsonDagskort` `:2032`): 0 rader truffet ⇒ sedelen er låst (`sent`/`accepted`)
 * ⇒ returner `"laast"` UTEN å skrive noe (ingen forslag, ingen `konfliktVentendeSiden`
 * på en låst sedel). Ellers: idempotent erstatning av forslaget pr. sedel + `"overlapp"`.
 * INGEN `throw`, ingen egen feilklasse, ingen annen tx (v4.1 — én tx lukker
 * TOCTOU-vinduet den forkastede to-tx-varianten hadde).
 */
async function lagreOverlappForslag(
  tx: Prisma.TransactionClient,
  sheetId: string,
  // V19.9.6 (A'-4): hver rad kan bære `grunn` (default "overlapp" → V19-A-kallerne
  // uendret). "endret_begge"/"slettet_pc"/"slettet_telefon" styrer attestantens
  // årsaks-tekst (C-2) + paringen i parForslagMotSedel.
  payloadRader: readonly (OverlappPayloadRad & { grunn?: string })[],
  sedelProjectId: string | null,
): Promise<"overlapp" | "laast"> {
  const laast = await tx.dailySheet.updateMany({
    where: { id: sheetId, status: { notIn: ["sent", "accepted"] } },
    data: { konfliktVentendeSiden: new Date() },
  });
  if (laast.count === 0) {
    // Låst sedel → dagens server-wins (`laast`), ingen forslag, ingen felt satt.
    return "laast";
  }

  // Idempotent erstatning pr. sedel: ny push av samme forslag dobler ikke radene.
  await tx.sheetTimerForslag.deleteMany({ where: { sheetId } });
  if (payloadRader.length > 0) {
    await tx.sheetTimerForslag.createMany({
      data: payloadRader.map((r) => ({
        // id = mobilens rad-id (idempotent erstatning). projectId resolveres som
        // i radProsjekt (rad-nivå ?? sedel-nivå); upstream-validering (`:5390`)
        // garanterer at minst én er satt når vi når hit.
        id: r.id,
        sheetId,
        projectId: (r.projectId ?? sedelProjectId)!,
        byggeplassId: r.byggeplassId ?? null,
        lonnsartId: r.lonnsartId,
        aktivitetId: r.aktivitetId,
        fraTid: r.fraTid ?? null,
        tilTid: r.tilTid ?? null,
        timer: r.timer,
        pauseMin: r.pauseMin ?? 0,
        beskrivelse: r.beskrivelse ?? null,
        externalCostObjectId: r.externalCostObjectId ?? null,
        vehicleId: r.vehicleId ?? null,
        // Lag 2-sporet lagres slik mobilen sendte det (ingen C2/C3-kontroll —
        // forslaget er ikke lønnsdata; forsonDagskort re-utleder reise ved valget).
        erReise: r.erReise ?? false,
        reiseRetning: r.reiseRetning ?? null,
        reiseOppmotestedId: r.reiseOppmotestedId ?? null,
        reiseKjoretidMin: r.reiseKjoretidMin ?? null,
        reiseAvstandM: r.reiseAvstandM ?? null,
        reiseKilde: r.reiseKilde ?? null,
        reiseRegel: jsonEllerNull(r.reiseRegel),
        tidKilde: r.tidKilde ?? null,
        kilde: "mobil",
        // V19.9.6: default "overlapp" → V19-A-forslag uendret.
        grunn: r.grunn ?? "overlapp",
      })),
    });
  }
  return "overlapp";
}

// ──────────────────────────────────────────────────────────────────────────
//  V20 (pause — én kilde) — PK4/PK5/PK6-server. Radens `pauseMin` er kilden;
//  hodet `DailySheet.pauseMin` utledes (Σ rad). Spec timer-pause-en-kilde-spec.md.
// ──────────────────────────────────────────────────────────────────────────

/** Timebasert lønnsart — kun disse vurderes mot fra/til-spennet (PK4). */
function erTimebasert(satsEnhet: string | null | undefined): boolean {
  return satsEnhet == null || satsEnhet === "per_time";
}

const PAUSE_TOLERANSE = 0.01;

/**
 * PK5/PK6 — pausevinduet + firma-standardpause for en sedel. `rader` brukes kun
 * for `pauseReferanse = "ankomst"` (vinduet regnes fra tidligste rad-fraTid).
 */
async function hentPauseVinduForSedel(
  orgId: string,
  dato: Date,
  rader: readonly { fraTid?: string | null }[],
): Promise<{ pauseVindu: string; standardPauseMin: number }> {
  const eff = await hentEffektivArbeidstid(orgId, dato);
  return {
    pauseVindu: pauseVinduForDag(rader, {
      startTid: eff.startTid,
      pauseEtterTimer: eff.pauseEtterTimer,
      pauseReferanse: eff.pauseReferanse,
    }),
    standardPauseMin: eff.pauseMin,
  };
}

type RadVurdering = {
  // Hva som skal skrives som radens pauseMin.
  pauseMin: number;
  // Telling/logging (PK4b-3) — null = intet å telle.
  teller: null | "baerer" | "to_baerere" | "avvik";
  // Interaktiv ny klient (eksplisitt pauseMin) med inkonsistent timer → kast.
  kast: boolean;
};

/**
 * PK4 — kjernen i server-vakten. Avgjør radens `pauseMin` ut fra timetallet og
 * pausevinduet, i to modi:
 *   - `interaktiv`: en NY klient som oppgir `pauseMin` får streng kontroll —
 *     timer må stemme med formelen gitt den pausen, ellers `kast` (→ avvis).
 *     En GAMMEL klient (pauseMin ikke oppgitt) normaliseres som i synk (ingen
 *     bruker skal avvises for en app de ikke har oppdatert ennå).
 *   - `sync`: aldri `kast`. Normaliserer: (1) oppgitt pause konsistent → skriv;
 *     (2) skjult fradrag (timer stemmer med standardPauseMin og vinduet krysser
 *     raden) → sett bæreren hvis ingen annen bærer, ellers skriv uendret + tell;
 *     (3) stemmer med ingen → skriv uendret + tell (`timer_avvik_sync`).
 * Rør ALDRI `timer` (test 8/13). Kun timebaserte rader med fra+til vurderes.
 */
export function vurderRadTimer(args: {
  modus: "interaktiv" | "sync";
  satsEnhet: string | null | undefined;
  fraTid: string | null | undefined;
  tilTid: string | null | undefined;
  timer: number;
  pauseMinAngitt: number | undefined;
  pauseVindu: string;
  standardPauseMin: number;
  finnesAlleredeBaerer: boolean;
}): RadVurdering {
  const {
    modus,
    satsEnhet,
    fraTid,
    tilTid,
    timer,
    pauseMinAngitt,
    pauseVindu,
    standardPauseMin,
    finnesAlleredeBaerer,
  } = args;

  // Ikke-timebasert eller tid-løs rad vurderes aldri mot spennet — behold det
  // klienten sendte (km/dag/natt bærer aldri pause).
  if (!erTimebasert(satsEnhet) || !fraTid || !tilTid) {
    return { pauseMin: pauseMinAngitt ?? 0, teller: null, kast: false };
  }

  const stemmer = (pm: number) =>
    Math.abs(timer - effektiveTimerFraSpenn(fraTid, tilTid, pauseVindu, pm)) <=
    PAUSE_TOLERANSE;
  const krysser =
    pauseOverlappMin(
      hhmmTilMin(fraTid),
      hhmmTilMin(tilTid),
      hhmmTilMin(pauseVindu),
      standardPauseMin,
    ) > 0;

  // Interaktiv NY klient: streng kontrakt mot oppgitt pause.
  if (modus === "interaktiv" && pauseMinAngitt !== undefined) {
    return stemmer(pauseMinAngitt)
      ? { pauseMin: pauseMinAngitt, teller: null, kast: false }
      : { pauseMin: pauseMinAngitt, teller: null, kast: true };
  }

  // Normalisering (synk alltid; interaktiv gammel klient uten oppgitt pause).
  // PK4b-1: oppgitt pause (F5 per-rad i synk) konsistent → behold.
  if (pauseMinAngitt !== undefined && stemmer(pauseMinAngitt)) {
    return { pauseMin: pauseMinAngitt, teller: null, kast: false };
  }
  // PK4b-2: skjult fradrag. Starter fra pause 0/mangler.
  if (pauseMinAngitt === undefined || pauseMinAngitt === 0) {
    if (stemmer(0)) {
      return { pauseMin: 0, teller: null, kast: false };
    }
    if (krysser && stemmer(standardPauseMin)) {
      return finnesAlleredeBaerer
        ? { pauseMin: 0, teller: "to_baerere", kast: false }
        : { pauseMin: standardPauseMin, teller: "baerer", kast: false };
    }
  }
  // PK4b-3: stemmer med ingen → godta som før (status quo), tell.
  return { pauseMin: pauseMinAngitt ?? 0, teller: "avvik", kast: false };
}

/**
 * RETUR 1 (V20-S) — fordel bærerens pause ved SPLITT av en timer-rad. Originalens
 * `pauseMin` flyttes til den delraden som KRYSSER pausevinduet (størst overlapp;
 * uavgjort → første; krysser ingen → første). De øvrige får 0. Σ fordeling =
 * `originalPauseMin` (bæreren forsvinner ikke og dupliseres ikke), og timetallet
 * på delradene (klient-oppgitt, sum-validert mot originalen) røres aldri — kun
 * HVILKEN delrad som eier fradrags-markøren flyttes. Returnerer pauseMin pr.
 * delrad i samme rekkefølge som input.
 */
export function fordelPauseVedSplitt(
  nyeRader: readonly { fraTid?: string | null; tilTid?: string | null }[],
  originalPauseMin: number,
  pauseVindu: string,
): number[] {
  const fordeling = new Array<number>(nyeRader.length).fill(0);
  if (originalPauseMin <= 0 || nyeRader.length === 0) return fordeling;
  const pauseFraMin = hhmmTilMin(pauseVindu);
  let beste = -1;
  let besteOverlapp = 0;
  for (let i = 0; i < nyeRader.length; i++) {
    const r = nyeRader[i]!;
    if (!r.fraTid || !r.tilTid) continue;
    const ov = pauseOverlappMin(
      hhmmTilMin(r.fraTid),
      hhmmTilMin(r.tilTid),
      pauseFraMin,
      originalPauseMin,
    );
    if (ov > besteOverlapp) {
      besteOverlapp = ov;
      beste = i;
    }
  }
  // Krysser ingen delrad vinduet → bæreren legges på første rad (RETUR punkt 1).
  fordeling[beste >= 0 ? beste : 0] = originalPauseMin;
  return fordeling;
}

/** PK4a — interaktiv avvisning når timetallet ikke stemmer med oppgitt pause. */
function avvisTimerAvvik(
  fraTid: string,
  tilTid: string,
  timer: number,
  pauseVindu: string,
  pauseMin: number,
): never {
  const forventet = effektiveTimerFraSpenn(fraTid, tilTid, pauseVindu, pauseMin);
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `Antall timer (${timer}) stemmer ikke med tidsrommet ${fraTid}–${tilTid} (forventet ${forventet.toFixed(
      2,
    )} t). Juster fra/til eller antall.`,
  });
}

/**
 * PK6 — hodet `DailySheet.pauseMin` = Σ aktive rad.pauseMin, utledet server-side
 * etter hver radskriving. ÉN kilde; ingen klient skriver hodet direkte. Kjøres i
 * samme tx som radskrivingen, og speiles til mobil ved pull. `erstattet`-rader
 * (firma-admin rediger-historikk) teller ikke.
 */
async function synkroniserHodePause(
  tx: Prisma.TransactionClient,
  sheetId: string,
): Promise<void> {
  const agg = await tx.sheetTimer.aggregate({
    where: { sheetId, attestertStatus: { not: "erstattet" } },
    _sum: { pauseMin: true },
  });
  // Bumper `updatedAt` samtidig (subsumerer touchSedel i radskrive-stiene) så
  // mobil pull ser endringen i én skriving.
  await tx.dailySheet.update({
    where: { id: sheetId },
    data: { pauseMin: agg._sum.pauseMin ?? 0, updatedAt: new Date() },
  });
}

/**
 * V19.5 (A-4) — attester-vakt. Attesteringen BLOKKERES så lenge en sedel har en
 * uavklart overlapp (`konfliktVentendeSiden` satt / forslag finnes). Lederen ser
 * forslaget og blokkeringen (C-2); utveien er retur, aldri attestering av et sett
 * arbeideren ikke har valgt. Delt helper begge attesteringsveiene kaller (M13:
 * `attesterRader` og `attester`), FØR `status: "accepted"` skrives — så regelen
 * finnes ett sted og kan ikke divergere.
 */
async function krevIngenUavklartOverlapp(
  prismaTimer: PrismaClientTimer,
  sheetIds: readonly string[],
): Promise<void> {
  if (sheetIds.length === 0) return;
  const uavklart = await prismaTimer.dailySheet.findFirst({
    where: { id: { in: Array.from(sheetIds) }, konfliktVentendeSiden: { not: null } },
    select: { id: true },
  });
  if (uavklart) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Arbeideren har en uavklart overlapp mellom PC og mobil — avvent eller returner sedelen",
    });
  }
}

/** En synket timer-rad, redusert til feltene reise-behandlingen leser. */
type SynkTimerRad = {
  id: string;
  lonnsartId: string;
  byggeplassId?: string | null;
  erReise?: boolean;
  reiseRetning?: "ut" | "retur" | null;
  reiseOppmotestedId?: string | null;
  reiseKjoretidMin?: number | null;
  reiseAvstandM?: number | null;
  reiseKilde?: "matrise" | "manuell" | null;
  reiseRegel?: unknown;
  tidKilde?: "stempel" | "utledet" | "manuell" | null;
};

/**
 * LAG 2 (C1/C2/C3) — bygg reise-sporet for alle timer-rader på én sedel.
 *
 * K5 «mottak med sporbarhet»: sendte klienten erReise EKSPLISITT, valideres
 * invariantene (C2) og matrise-rader kontrolleres mot cellen (C3, reiseAvvik) —
 * men ingenting regnes om. Sendte den IKKE erReise (overgangsperioden), UTLEDES
 * flagget fra samme regel som backfillen (presisering 2), med null-spor.
 *
 * Returnerer et kart rad-id → felter, eller en navngitt feil (C2-brudd) som
 * kalleren bruker til å avvise HELE sedelen (resten av synken går gjennom).
 */
async function byggReiseFelterForSynk(
  rader: SynkTimerRad[],
  sedelByggeplassId: string | null,
  ktx: ErReiseKontekst,
  lonnsartNavnMap: Map<string, string>,
  gyldigeOppmotesteder: Set<string>,
): Promise<
  | { ok: true; felter: Map<string, ReiseFelter> }
  | { ok: false; feilmelding: string }
> {
  // Forhånds-hent matrisecellene for eksplisitte matrise-rader (C3). Ett oppslag
  // mot kjernen, aldri N — cellen bor i reisetid_matrise (public-schema).
  const matriseNokler = new Map<
    string,
    { oppmotestedId: string; byggeplassId: string }
  >();
  for (const r of rader) {
    if (r.erReise === true && r.reiseKilde === "matrise") {
      const bygg = r.byggeplassId ?? sedelByggeplassId ?? null;
      if (r.reiseOppmotestedId && bygg) {
        matriseNokler.set(`${r.reiseOppmotestedId}::${bygg}`, {
          oppmotestedId: r.reiseOppmotestedId,
          byggeplassId: bygg,
        });
      }
    }
  }
  const celleMap = new Map<
    string,
    { avstandM: number | null; kjoretidMin: number }
  >();
  if (matriseNokler.size > 0) {
    const celler = await prisma.reisetidMatrise.findMany({
      where: {
        OR: Array.from(matriseNokler.values()).map((n) => ({
          oppmotestedId: n.oppmotestedId,
          byggeplassId: n.byggeplassId,
        })),
      },
      select: { oppmotestedId: true, byggeplassId: true, avstandM: true, kjoretidMin: true },
    });
    for (const c of celler) {
      celleMap.set(`${c.oppmotestedId}::${c.byggeplassId}`, {
        avstandM: c.avstandM,
        kjoretidMin: c.kjoretidMin,
      });
    }
  }

  const felter = new Map<string, ReiseFelter>();
  for (const r of rader) {
    if (r.erReise === undefined) {
      // Overgangsperioden: klienten sendte ikke flagget → utled fra lønnsarten
      // (samme regel som backfillen). Ingen klassifisering fra arbeideren → spor
      // er null, reiseAvvik null (ikke kontrollerbart uten snapshot).
      const navn = lonnsartNavnMap.get(r.lonnsartId) ?? "";
      felter.set(r.id, {
        erReise: utledErReise(r.lonnsartId, navn, ktx),
        reiseRetning: null,
        reiseOppmotestedId: null,
        reiseKjoretidMin: null,
        reiseAvstandM: null,
        reiseKilde: null,
        reiseRegel: null,
        tidKilde: r.tidKilde ?? null,
        reiseAvvik: null,
      });
      continue;
    }

    // Eksplisitt erReise: C2-validering.
    const invariantInput: ReiseRadInvariantInput = {
      erReise: r.erReise,
      reiseRetning: r.reiseRetning ?? null,
      reiseKilde: r.reiseKilde ?? null,
      reiseOppmotestedId: r.reiseOppmotestedId ?? null,
      reiseKjoretidMin: r.reiseKjoretidMin ?? null,
      reiseAvstandM: r.reiseAvstandM ?? null,
      reiseRegel: r.reiseRegel ?? null,
    };
    const feil = validerReiseInvarianter(invariantInput, gyldigeOppmotesteder);
    if (feil) return { ok: false, feilmelding: feil };

    // C3-kontroll for matrise-rader (varsel, ingen omregning).
    let reiseAvvik: boolean | null = null;
    if (r.erReise && r.reiseKilde === "matrise") {
      const bygg = r.byggeplassId ?? sedelByggeplassId ?? null;
      const celle =
        r.reiseOppmotestedId && bygg
          ? celleMap.get(`${r.reiseOppmotestedId}::${bygg}`) ?? null
          : null;
      reiseAvvik = beregnReiseAvvik(
        { avstandM: r.reiseAvstandM ?? null, kjoretidMin: r.reiseKjoretidMin ?? null },
        celle,
      );
    }

    felter.set(r.id, {
      erReise: r.erReise,
      reiseRetning: r.reiseRetning ?? null,
      reiseOppmotestedId: r.reiseOppmotestedId ?? null,
      reiseKjoretidMin: r.reiseKjoretidMin ?? null,
      reiseAvstandM: r.reiseAvstandM ?? null,
      reiseKilde: r.reiseKilde ?? null,
      reiseRegel: r.reiseRegel ?? null,
      tidKilde: r.tidKilde ?? null,
      reiseAvvik,
    });
  }
  return { ok: true, felter };
}

async function sjekkAldersgrense(
  organizationId: string,
  status: string,
  dato: Date,
): Promise<void> {
  if (status !== "draft") return; // Kun draft har alders-grense
  const setting = await prisma.organizationSetting.findUnique({
    where: { organizationId },
    select: { timerLockEtterDager: true },
  });
  const grense = setting?.timerLockEtterDager;
  if (grense === null || grense === undefined) return; // null = ingen grense

  const naa = new Date();
  const dagerSiden = Math.floor((naa.getTime() - dato.getTime()) / (1000 * 60 * 60 * 24));
  if (dagerSiden > grense) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Dagsseddel er låst — eldre enn ${grense} dager (firma-policy)`,
    });
  }
}

// T7-2c1: snapshot-helpers for audit-log ved rediger og splitt.
// Reduserer Prisma-rad til ren JSON-serialiserbar payload (Decimal → number).
// Returtype matcher Prisma.InputJsonValue så payload kan brukes direkte i activity.create.
type TimerSnapshot = {
  id: string;
  projectId: string;
  lonnsartId: string;
  aktivitetId: string;
  externalCostObjectId: string | null;
  byggeplassId: string | null;
  fraTid: string | null;
  tilTid: string | null;
  timer: number | null;
  parentRadId: string | null;
};
type TilleggSnapshot = {
  id: string;
  projectId: string;
  tilleggId: string;
  antall: number | null;
  kommentar: string | null;
  parentRadId: string | null;
};
type MaskinSnapshot = {
  id: string;
  projectId: string;
  externalCostObjectId: string | null;
  vehicleId: string;
  byggeplassId: string | null;
  fraTid: string | null;
  tilTid: string | null;
  timer: number | null;
  mengde: number | null;
  enhet: string | null;
  parentRadId: string | null;
};

type TimerRow = {
  id: string;
  projectId: string;
  lonnsartId: string;
  aktivitetId: string;
  externalCostObjectId: string | null;
  byggeplassId: string | null;
  fraTid: string | null;
  tilTid: string | null;
  timer: Prisma.Decimal;
  parentRadId: string | null;
};
type TilleggRow = {
  id: string;
  projectId: string;
  tilleggId: string;
  antall: Prisma.Decimal;
  kommentar: string | null;
  parentRadId: string | null;
};
type MaskinRow = {
  id: string;
  projectId: string;
  externalCostObjectId: string | null;
  vehicleId: string;
  byggeplassId: string | null;
  fraTid: string | null;
  tilTid: string | null;
  timer: Prisma.Decimal;
  mengde: Prisma.Decimal | null;
  enhet: string | null;
  parentRadId: string | null;
};

function snapshotTimer(r: TimerRow): TimerSnapshot {
  return {
    id: r.id,
    projectId: r.projectId,
    lonnsartId: r.lonnsartId,
    aktivitetId: r.aktivitetId,
    externalCostObjectId: r.externalCostObjectId,
    byggeplassId: r.byggeplassId,
    fraTid: r.fraTid,
    tilTid: r.tilTid,
    timer: Number(r.timer),
    parentRadId: r.parentRadId,
  };
}
function snapshotTillegg(r: TilleggRow): TilleggSnapshot {
  return {
    id: r.id,
    projectId: r.projectId,
    tilleggId: r.tilleggId,
    antall: Number(r.antall),
    kommentar: r.kommentar,
    parentRadId: r.parentRadId,
  };
}
function snapshotMaskin(r: MaskinRow): MaskinSnapshot {
  return {
    id: r.id,
    projectId: r.projectId,
    externalCostObjectId: r.externalCostObjectId,
    vehicleId: r.vehicleId,
    byggeplassId: r.byggeplassId,
    fraTid: r.fraTid,
    tilTid: r.tilTid,
    timer: Number(r.timer),
    mengde: r.mengde === null ? null : Number(r.mengde),
    enhet: r.enhet,
    parentRadId: r.parentRadId,
  };
}

// ============================================================================
//  ORDRE 2 STEG 1 — uke-nivå overtidsgrunnlag for attestert-snapshot.
//
//  Fabels krav (D2): ved attestering skrives et ETTERPRØVBART grunnlag for
//  overtidsvarselet attestanten handlet på — norm for uken, sum ordinært, sum
//  overtid, beregnet vs. valgt. Samme tidspunkt/mønster som pris-snapshotet.
//  Ren beregning: leser ukens ikke-erstattede rader (org-isolert) + effektiv
//  dagsnorm, rører ALDRI lonnsartId. attestertSnapshot er Json? → migreringsfri.
// ============================================================================

/** Legg n dager til en ISO-dato (YYYY-MM-DD) i UTC. */
function leggTilDagerIso(iso: string, n: number): string {
  const [aar, mnd, dag] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(aar ?? 1970, (mnd ?? 1) - 1, dag ?? 1));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Mandagens ISO-dato for uken en gitt dato faller i (UTC). */
function mandagIso(dato: Date): string {
  const d = new Date(
    Date.UTC(dato.getUTCFullYear(), dato.getUTCMonth(), dato.getUTCDate()),
  );
  const dag = d.getUTCDay(); // 0=søndag, 1=mandag
  const diff = dag === 0 ? -6 : 1 - dag;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

type PrismaTimerKlient =
  | Prisma.TransactionClient
  | typeof import("@sitedoc/db-timer").prismaTimer;

async function byggUkeOvertidsgrunnlag(
  prismaTimer: PrismaTimerKlient,
  organizationId: string,
  userId: string,
  dato: Date,
): Promise<Overtidsgrunnlag> {
  const ukestart = mandagIso(dato);
  const ukeslutt = leggTilDagerIso(ukestart, 4); // fredag

  // Effektiv (sommertid-bevisst) dagsnorm for ukens fem arbeidsdager.
  const dagsnormMap = new Map<string, number>();
  await Promise.all(
    [0, 1, 2, 3, 4].map(async (i) => {
      const iso = leggTilDagerIso(ukestart, i);
      const eff = await hentEffektivArbeidstid(
        organizationId,
        new Date(`${iso}T00:00:00.000Z`),
      );
      dagsnormMap.set(iso, eff.dagsnorm);
    }),
  );
  const uke = beregnUkenorm(ukestart, (iso) => dagsnormMap.get(iso) ?? 0);

  // Ukens aktive timer-rader for brukeren (org-isolert, ikke-erstattet).
  const rader = await prismaTimer.sheetTimer.findMany({
    where: {
      attestertStatus: { not: "erstattet" },
      sheet: {
        organizationId,
        userId,
        dato: {
          gte: new Date(`${ukestart}T00:00:00.000Z`),
          lte: new Date(`${ukeslutt}T23:59:59.999Z`),
        },
      },
    },
    select: {
      timer: true,
      erReise: true,
      lonnsart: { select: { overtidsnivaa: true } },
    },
  });

  return beregnOvertidsgrunnlag(
    rader.map((r) => ({
      timer: Number(r.timer),
      overtidsnivaa: r.lonnsart?.overtidsnivaa ?? null,
      // V1: reise holdes utenfor overtidsgrunnlaget.
      erReise: r.erReise,
    })),
    uke.norm,
  );
}

// ============================================================================
//  T7-4b (2026-05-16) — validerMaskinUnderArbeid
//
//  Per T.7-vedtak (låst 2026-05-16): maskin er utstyrsbidrag av samme
//  tidsperiode som arbeidstimer, ikke additivt. Invariant per sedel:
//
//      sum(SheetMachine.timer) ≤ sum(SheetTimer.timer)
//
//  beregnet per (projectId, externalCostObjectId)-gruppe.
//
//  Grandfather: kun nye/redigerte rader valideres. Eksisterende sedler
//  med maskin > arbeid (registrert før T7-4b-deploy) berøres ikke før
//  de aktivt redigeres. Validering kjøres på POST-state — alle aktive
//  rader (alle attestertStatus unntatt "erstattet") + den foreslåtte
//  endringen, og rejected ved overshoot.
// ============================================================================

type ValiderRad = {
  projectId: string;
  externalCostObjectId: string | null;
  timer: number | Prisma.Decimal;
};

/**
 * Delegerer til @sitedoc/shared `beregnMaskinBrudd` — samme bucket-regel,
 * epsilon og pause-modell brukes av klient-disable (web + mobil). Serveren
 * konverterer kun Decimal → number før den delte funksjonen kalles.
 */
function validerMaskinUnderArbeid(
  timer: ValiderRad[],
  maskin: ValiderRad[],
  pauseMin = 0,
) {
  const tilNum = (v: ValiderRad["timer"]): number =>
    typeof v === "number" ? v : Number(v);
  const map = (rad: ValiderRad) => ({
    projectId: rad.projectId,
    externalCostObjectId: rad.externalCostObjectId,
    timer: tilNum(rad.timer),
  });
  return beregnMaskinBrudd(timer.map(map), maskin.map(map), pauseMin);
}

/**
 * Henter alle aktive rader (alle attestertStatus unntatt "erstattet") for
 * validerings-formål. Brukes som baseline for å bygge post-state ved
 * insert/update/delete-mutasjoner.
 */
async function hentRaderForValidering(
  prismaTimer:
    | Prisma.TransactionClient
    | typeof import("@sitedoc/db-timer").prismaTimer,
  sheetId: string,
): Promise<{
  timer: Array<{
    id: string;
    projectId: string;
    externalCostObjectId: string | null;
    timer: Prisma.Decimal;
  }>;
  maskin: Array<{
    id: string;
    projectId: string;
    externalCostObjectId: string | null;
    timer: Prisma.Decimal;
  }>;
}> {
  const tx = prismaTimer as typeof import("@sitedoc/db-timer").prismaTimer;
  const [timer, maskin] = await Promise.all([
    tx.sheetTimer.findMany({
      where: { sheetId, attestertStatus: { not: "erstattet" } },
      select: {
        id: true,
        projectId: true,
        externalCostObjectId: true,
        timer: true,
      },
    }),
    tx.sheetMachine.findMany({
      where: { sheetId, attestertStatus: { not: "erstattet" } },
      select: {
        id: true,
        projectId: true,
        externalCostObjectId: true,
        timer: true,
      },
    }),
  ]);
  return { timer, maskin };
}

/**
 * T7-2b-oppfølger (2026-07-13): bygg en SheetRadHistorikk-post fra en
 * hovedtabell-rad som FLYTTES ut ved firma-admin rediger/splitt. snapshot =
 * full rad som JSON (Decimal→streng, Date→ISO via JSON-serialisering) —
 * historikk leses aldri for beregning, kun revisjonsspor. Skrives i SAMME
 * transaksjon som DELETE av originalen (MOVE, aldri hard-delete). Bevarer
 * lenke-kjeden: ny rad.parentRadId → historikk.originalRadId.
 */
function byggHistorikkPost(
  radType: "timer" | "tillegg" | "maskin",
  rad: { id: string; sheetId: string; parentRadId: string | null },
  erstattetAvUserId: string | null | undefined,
  erstattetVed: Date,
): Prisma.SheetRadHistorikkCreateManyInput {
  return {
    radType,
    originalRadId: rad.id,
    sheetId: rad.sheetId,
    parentRadId: rad.parentRadId,
    snapshot: JSON.parse(JSON.stringify(rad)) as Prisma.InputJsonValue,
    erstattetAvUserId,
    erstattetVed,
  };
}

/**
 * Bolk (g), 2026-07-09 — fra/til-gyldighet: når begge tider er satt, må til > fra.
 * Delt superRefine for timer- og maskin-rad-inputene (tilfoy + oppdater).
 */
function refineFraForTil(
  val: { fraTid?: string | null; tilTid?: string | null },
  ctx: z.RefinementCtx,
): void {
  // Delt regel (@sitedoc/shared) — samme funksjon som syncBatch bruker (SYNC-2).
  if (!tilErEtterFra(val.fraTid, val.tilTid)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Til-tid må være etter fra-tid",
      path: ["tilTid"],
    });
  }
}

/**
 * Bolk (g), 2026-07-09 — overlapp-vakt: en arbeider kan ikke være to steder. To
 * TIMER-rader med begge tider satt kan ikke overlappe innen samme sheetId, PÅ
 * TVERS av prosjekt og ECO/underprosjekt (hard sperre — Kenneth 2026-07-09).
 * Berøring i endepunkt (12:00 slutt = 12:00 start) er IKKE overlapp. Rader uten
 * tider hoppes over; egen rad ekskluderes ved oppdatering. Kun ny/redigert rad
 * sjekkes — eksisterende overlapp retro-avvises ikke (samme scoping som B2).
 * Maskin-rader hører til en timer-rad og overlapp-sjekkes IKKE her.
 */
async function sjekkTimerOverlapp(
  prismaTimer:
    | Prisma.TransactionClient
    | typeof import("@sitedoc/db-timer").prismaTimer,
  sheetId: string,
  nyFra: string | null | undefined,
  nyTil: string | null | undefined,
  ekskluderRadId?: string,
): Promise<void> {
  if (!nyFra || !nyTil) return;
  const tx = prismaTimer as typeof import("@sitedoc/db-timer").prismaTimer;
  const andre = await tx.sheetTimer.findMany({
    where: {
      sheetId,
      attestertStatus: { not: "erstattet" },
      fraTid: { not: null },
      tilTid: { not: null },
      ...(ekskluderRadId ? { id: { not: ekskluderRadId } } : {}),
    },
    select: { fraTid: true, tilTid: true },
  });
  // Delt regel (@sitedoc/shared) — samme overlapp-definisjon som syncBatch.
  const overlapp = finnOverlappendeTidsrom(nyFra, nyTil, andre);
  if (overlapp) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Tidsrommet overlapper en annen rad (${overlapp.fraTid}–${overlapp.tilTid}) på samme dagsseddel. Én arbeider kan ikke være to steder samtidig.`,
    });
  }
}

/**
 * Berik brytt-resultat med prosjekt- og ECO-navn fra kjernen-databasen og
 * formater til menneskelesbar feilmelding. Én linje per (projectId, ECO)-
 * gruppe som bryter invariant.
 */
async function feilMeldingMaskinOverstiger(
  brytt: MaskinBrudd[],
): Promise<string> {
  const projectIds = Array.from(new Set(brytt.map((b) => b.projectId)));
  const ecoIds = Array.from(
    new Set(
      brytt
        .map((b) => b.externalCostObjectId)
        .filter((e): e is string => e !== null),
    ),
  );
  const [prosjekter, ecoer] = await Promise.all([
    projectIds.length > 0
      ? prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, name: true, projectNumber: true },
        })
      : Promise.resolve([]),
    ecoIds.length > 0
      ? prisma.externalCostObject.findMany({
          where: { id: { in: ecoIds } },
          select: { id: true, kortNavn: true, proAdmId: true },
        })
      : Promise.resolve([]),
  ]);
  const pMap = new Map(prosjekter.map((p) => [p.id, p]));
  const eMap = new Map(ecoer.map((e) => [e.id, e]));

  return brytt
    .map((b) => {
      const p = pMap.get(b.projectId);
      const pNavn = p
        ? `${p.projectNumber ?? ""} ${p.name}`.trim() || b.projectId
        : b.projectId;
      let suffix = "";
      if (b.externalCostObjectId) {
        const e = eMap.get(b.externalCostObjectId);
        suffix = e
          ? ` / underprosjekt ${e.proAdmId} · ${e.kortNavn}`
          : ` / underprosjekt ${b.externalCostObjectId}`;
      }
      return `Maskintimer (${b.maskinSum.toFixed(2)}t) overstiger arbeidstimer (${b.timerSum.toFixed(2)}t) for prosjekt ${pNavn}${suffix}`;
    })
    .join("\n");
}

/**
 * a2 (2026-07-06): Bygg en absolutt instant som representerer et veggur-
 * tidspunkt (HH:MM) på gitt dato i norsk tidssone (Europe/Oslo, DST-bevisst).
 * Serveren kjører UTC i Docker, så en naiv `new Date(`${dato}T${hhmm}`)` ville
 * lagret feil veggur-tid; vi anker eksplisitt til Oslo siden firma-kalenderens
 * standardtider er norske veggur-tider. Kun brukt til prefyll av arbeidstids-
 * vinduet — varsel/dagsnorm er varighetsbasert og dermed TZ-invariant.
 */
function osloVeggurTilInstant(dato: Date, hhmm: string): Date {
  const [timer = 0, minutter = 0] = hhmm.split(":").map(Number);
  const antattUtc = new Date(
    Date.UTC(
      dato.getUTCFullYear(),
      dato.getUTCMonth(),
      dato.getUTCDate(),
      timer,
      minutter,
      0,
    ),
  );
  // Mål Oslo-offset for datoen: hva viser Oslo-klokken for antattUtc?
  const osloVeggur = new Date(
    antattUtc.toLocaleString("sv-SE", { timeZone: "Europe/Oslo" }).replace(" ", "T") +
      "Z",
  );
  const offsetMs = osloVeggur.getTime() - antattUtc.getTime();
  return new Date(antattUtc.getTime() - offsetMs);
}

/** Instant → «HH:MM» i Europe/Oslo (24t). Invers av osloVeggurTilInstant. */
function instantTilOsloHHMM(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/**
 * SAK 1 (web-friksjon 2026-08-20): auto-opprett ÉN timer-rad som dekker
 * arbeidstidsvinduet ved manuell sedel-opprettelse med prosjekt. Speiler mobils
 * genererForslag-PRINSIPP (forslag, fritt redigerbart) — men uten OT-splitt: én
 * rad på firmaets standard-lønnsart, akkurat det «Legg til timer-rad»-modalen
 * ellers ville prefylt (samme felt som tilfoyTimerRad; sedelen holder pauseMin,
 * timer-verdien har pausen trukket fra). Idempotent + defensiv: hopper over hvis
 * sedelen alt har rader, vindu mangler, standard-lønnsart mangler, eller vinduet
 * gir 0 timer. Første rad ⇒ ingen overlapp/maskin-validering nødvendig.
 */
async function opprettForsteTimerRadForslag(
  prismaTimer: typeof import("@sitedoc/db-timer").prismaTimer,
  args: {
    sheetId: string;
    orgId: string;
    projectId: string;
    aktivitetId: string;
    byggeplassId: string | null;
    dato: Date;
    startAt: Date | null;
    endAt: Date | null;
  },
): Promise<void> {
  const { sheetId, orgId, projectId, aktivitetId, byggeplassId, dato, startAt, endAt } =
    args;
  if (!startAt || !endAt) return;

  // Idempotens: kun på en tom sedel (re-send av samme clientUuid, eller en
  // eksisterende sedel, rører ingenting).
  const antallRader = await prismaTimer.sheetTimer.count({ where: { sheetId } });
  if (antallRader > 0) return;

  // Firmaets standard-lønnsart (samme kilde som modalens default + mobils
  // normaltid-rad). Uten en standard-lønnsart lages ingen rad — brukeren legger
  // til manuelt (modalen ville hatt samme tomme default).
  const standardLonnsart = await prismaTimer.lonnsart.findFirst({
    where: { organizationId: orgId, erStandardvalg: true, aktiv: true },
    select: { id: true, navn: true },
  });
  if (!standardLonnsart) return;

  const fraTid = instantTilOsloHHMM(startAt);
  const tilTid = instantTilOsloHHMM(endAt);

  // V20/PK9: pausen hentes fra NORMEN (V16), ikke hodet, og skrives PÅ raden som
  // bærer når regelen trigger (dagsbrutto > 5,5 t OG raden krysser pausevinduet).
  // Pausevinduet (PK5) følger firmaets pauseReferanse. Ingen skjult fradrag.
  const eff = await hentEffektivArbeidstid(orgId, dato);
  const pauseVindu = pauseVinduForDag([{ fraTid }], {
    startTid: eff.startTid,
    pauseEtterTimer: eff.pauseEtterTimer,
    pauseReferanse: eff.pauseReferanse,
  });
  const bruttoTimer = (endAt.getTime() - startAt.getTime()) / 3_600_000;
  const krysser =
    pauseOverlappMin(
      hhmmTilMin(fraTid),
      hhmmTilMin(tilTid),
      hhmmTilMin(pauseVindu),
      eff.pauseMin,
    ) > 0;
  const radPauseMin =
    bruttoTimer > PAUSE_TERSKEL_TIMER && krysser ? eff.pauseMin : 0;
  const timer = effektiveTimerFraSpenn(fraTid, tilTid, pauseVindu, radPauseMin);
  if (timer <= 0) return;

  // LAG 2 (presisering 2): utled erReise også her. Standard-lønnsarten er normalt
  // en ordinær art (erReise=false), men vi gjetter ikke — regelen avgjør.
  const erReiseKtx = await hentErReiseKontekst(orgId);
  const erReise = utledErReise(standardLonnsart.id, standardLonnsart.navn, erReiseKtx);

  await prismaTimer.$transaction(async (tx) => {
    await tx.sheetTimer.create({
      data: {
        sheetId,
        projectId,
        byggeplassId,
        lonnsartId: standardLonnsart.id,
        aktivitetId,
        timer,
        fraTid,
        tilTid,
        pauseMin: radPauseMin,
        erReise,
      },
    });
    // PK6: hodet = Σ rad (her = radPauseMin), speiler bæreren.
    await synkroniserHodePause(tx, sheetId);
  });
}

// ============================================================================
//  Splitt-rad — delt input-skjema + validerings-kjerne (P2)
//  Delt av leder-`splittRad` (attestering, status=sent) og arbeider-
//  `splittRadEier` (eier, draft/returned). VALIDERINGEN deles; AUTORISASJON +
//  audit ligger per inngang (delte-kilder-prinsippet): leder markerer erstattet
//  + parentRadId + Activity-snapshot; arbeider sletter original (draft har ingen
//  attesterings-audit å bevare).
// ============================================================================
const splittRadInput = z.discriminatedUnion("radType", [
  z.object({
    radType: z.literal("timer"),
    radId: z.string().uuid(),
    nyeRader: z
      .array(
        z.object({
          projectId: z.string().uuid(),
          lonnsartId: z.string().uuid(),
          aktivitetId: z.string().uuid(),
          externalCostObjectId: z.string().uuid().nullable().optional(),
          byggeplassId: z.string().uuid().nullable().optional(),
          fraTid: z.string().nullable().optional(),
          tilTid: z.string().nullable().optional(),
          timer: z.number().positive(),
        }),
      )
      .min(2, "Splitt krever minst 2 nye rader"),
  }),
  z.object({
    radType: z.literal("tillegg"),
    radId: z.string().uuid(),
    nyeRader: z
      .array(
        z.object({
          projectId: z.string().uuid(),
          tilleggId: z.string().uuid(),
          antall: z.number().positive(),
          kommentar: z.string().nullable().optional(),
        }),
      )
      .min(2, "Splitt krever minst 2 nye rader"),
  }),
  z.object({
    radType: z.literal("maskin"),
    radId: z.string().uuid(),
    nyeRader: z
      .array(
        z.object({
          projectId: z.string().uuid(),
          externalCostObjectId: z.string().uuid().nullable().optional(),
          vehicleId: z.string().uuid(),
          byggeplassId: z.string().uuid().nullable().optional(),
          fraTid: z.string().nullable().optional(),
          tilTid: z.string().nullable().optional(),
          timer: z.number().positive(),
          mengde: z.number().nullable().optional(),
          enhet: z.string().nullable().optional(),
        }),
      )
      .min(2, "Splitt krever minst 2 nye rader"),
  }),
]);
type SplittRadInput = z.infer<typeof splittRadInput>;

/**
 * Delt validerings-kjerne for splitt (P2). Kalles av begge splitt-innganger FØR
 * transaksjonen: firma-grense på nye projectId, org-validering av nye maskin-
 * vehicleId, sum-validering (nye rader summerer til original), og maskin ≤ arbeid
 * post-state ved maskin-splitt. Kaster TRPCError ved brudd. Ren flytting fra
 * leder-`splittRad`s steg 6/6b/7 + maskin-kapasitet — atferdsbevarende.
 */
async function validerSplittFelles(
  prismaTimer:
    | Prisma.TransactionClient
    | typeof import("@sitedoc/db-timer").prismaTimer,
  input: SplittRadInput,
  sheet: { id: string; organizationId: string; pauseMin: number },
  original: { id: string; sum: number },
): Promise<void> {
  // Fra/til obligatorisk på timer-rader (2026-07-13). REVERSERER a2-
  // degraderingen (2026-07-06). Nye split-rader er NYE rader → må ha begge
  // tider (tid-løse rader er ufullstendige lønnsdata + usynlige for overlapp-
  // vakten). Gjelder KUN timer-splitt; maskin/tillegg-rader er unntatt.
  if (input.radType === "timer") {
    const manglerTid = input.nyeRader.some((r) => !r.fraTid || !r.tilTid);
    if (manglerTid) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Fra- og til-tid er påkrevd på timer-rader",
      });
    }
  }

  // Firma-grense på alle nye projectId (delt helper).
  await verifiserProsjekterTilhørerFirma(
    input.nyeRader.map((r) => r.projectId),
    sheet.organizationId,
  );
  // Maskin-splitt tar nye vehicleId fra input — org-valider hver unik mot
  // firmaets maskinregister. Timer-splitt arver original-radens vehicleId.
  if (input.radType === "maskin") {
    const splittVehicleIder = Array.from(
      new Set(input.nyeRader.map((r) => r.vehicleId)),
    );
    for (const vid of splittVehicleIder) {
      await verifiserKjoretoyTilhørerFirma(vid, sheet.organizationId);
    }
  }
  // Sum-validering: nye rader må summere til originalens sum-felt (timer/antall).
  const nySum = input.nyeRader.reduce(
    (acc, r) =>
      acc +
      (input.radType === "tillegg"
        ? (r as { antall: number }).antall
        : (r as { timer: number }).timer),
    0,
  );
  if (Math.abs(nySum - original.sum) >= 0.001) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Sum av split-rader (${nySum}) matcher ikke original (${original.sum})`,
    });
  }
  // Maskin-splitt: revalider post-state maskin ≤ arbeid (nye rader kan ha annet
  // ECO/prosjekt → forskyve buckets).
  if (input.radType === "maskin") {
    const baseline = await hentRaderForValidering(prismaTimer, sheet.id);
    const postMaskin: ValiderRad[] = [
      ...baseline.maskin.filter((r) => r.id !== original.id),
      ...input.nyeRader.map((rad) => ({
        projectId: rad.projectId,
        externalCostObjectId: rad.externalCostObjectId ?? null,
        timer: rad.timer,
      })),
    ];
    const brytt = validerMaskinUnderArbeid(
      baseline.timer,
      postMaskin,
      sheet.pauseMin,
    );
    if (brytt.length > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: await feilMeldingMaskinOverstiger(brytt),
      });
    }
  }
}

export const dagsseddelRouter = router({
  // List dagssedler for innlogget bruker, eller for et prosjekt (admin-perspektiv senere).
  list: protectedProcedure
    .input(
      z
        .object({
          projectId: z.string().uuid().optional(),
          // Hent egne sedler hvis userId ikke sendes
          userId: z.string().uuid().optional(),
          // Periode-filter — alt med dato i [fra, til] inklusivt. ISO-dato uten tidsone.
          fra: z.string().optional(),
          til: z.string().optional(),
          status: z.enum(STATUS_VERDIER).optional(),
          // Valgt/innlogget firma (Kenneth-vedtak 2026-10-09). Utelatt → egen org.
          organizationId: z.string().uuid().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const orgId = await resolverOrgFraInput(ctx.userId, input?.organizationId);

      // Default: kun egne dagssedler
      const userId = input?.userId ?? ctx.userId;

      // Hvis bruker ber om noen andres seddel: krev admin
      if (userId !== ctx.userId) {
        const bruker = await prisma.user.findUniqueOrThrow({
          where: { id: ctx.userId },
          select: { role: true },
        });
        let tillatt = bruker.role === "sitedoc_admin";
        if (!tillatt) {
          const member = await prisma.organizationMember.findUnique({
            where: { userId_organizationId: { userId: ctx.userId, organizationId: orgId } },
            select: { firmaRoller: true },
          });
          tillatt = member?.firmaRoller.includes("firma_admin") ?? false;
        }
        if (!tillatt) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Krever admin for å se andres dagssedler",
          });
        }
      }

      const where: Prisma.DailySheetWhereInput = {
        organizationId: orgId,
        userId,
        // T.1: DailySheet har ikke projectId — prosjekttilhørighet ligger på
        // rad-nivå (SheetTimer/SheetMachine/SheetTillegg). Prosjekt-kontekst-
        // filteret matcher sedler med ≥1 rad for prosjektet.
        ...(input?.projectId ? { timer: { some: { projectId: input.projectId } } } : {}),
        ...(input?.status ? { status: input.status } : {}),
        ...(input?.fra || input?.til
          ? {
              dato: {
                ...(input.fra ? { gte: new Date(input.fra) } : {}),
                ...(input.til ? { lte: new Date(input.til) } : {}),
              },
            }
          : {}),
      };

      // Kontrollør-funn 2026-10-09: taket var stille (take:200 uten at klienten fikk vite
      // om noe ble kuttet → stille tomhet forbudt). Returner `totalt` (count på samme
      // where) ved siden av de `grense` nyeste, så klienten kan vise «Viser X av N —
      // avgrens perioden». Count + findMany samlet (to spørringer, ett rundtur-sett).
      const GRENSE = 200;
      const [totalt, sedler] = await Promise.all([
        ctx.prismaTimer.dailySheet.count({ where }),
        ctx.prismaTimer.dailySheet.findMany({
          where,
          include: {
            aktivitet: { select: { id: true, navn: true, kode: true } },
            timer: true,
            tillegg: true,
            maskiner: true,
          },
          orderBy: [{ dato: "desc" }, { createdAt: "desc" }],
          take: GRENSE,
        }),
      ]);

      // Berik med totaltimer (sum av alle SheetTimer-rader) for liste-visning.
      // T.1: prosjekt(er) utledes fra radene (DailySheet har ikke projectId) —
      // distinct projectId på tvers av timer-/maskin-/tillegg-rader.
      const berikede = sedler.map((s) => {
        const prosjektIder = [
          ...new Set(
            [
              ...s.timer.map((t) => t.projectId),
              ...s.maskiner.map((m) => m.projectId),
              ...s.tillegg.map((t) => t.projectId),
            ].filter((id): id is string => !!id),
          ),
        ];
        return {
          ...s,
          prosjektIder,
          totaltimer: s.timer.reduce((acc, t) => acc + Number(t.timer), 0),
          antallRader: s.timer.length + s.tillegg.length + s.maskiner.length,
        };
      });

      return { sedler: berikede, totalt, grense: GRENSE };
    }),

  // Kenneth-vedtak 2026-10-09 (2): kan innlogget bruker føre EGNE timer i firmaet?
  // = aktivt ansettelsesforhold (samme regel som skrive-gaten `verifiserAnsattIFirma`,
  // ingen admin-bypass). Klienten bruker svaret til å deaktivere «Ny dagsseddel» med en
  // forklaring. `firmanavn` følger med (kun når sperret) til meldingsteksten.
  kanFoereTimer: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      // Kontrollør-funn 2026-10-09: firmanavnet må ALDRI lekke til en kaller uten forhold
      // til firmaet (ellers kan en fremmed enumerere firmanavn via gjettede org-UUID-er).
      // `resolverOrgFraInput` gater relasjonen: sitedoc_admin → hvilket som helst firma;
      // andre → kun eget aktivt medlemskap, ellers FORBIDDEN. Org-løs bruker uten oppgitt
      // firma (standalone, ingen timer-tilgang) får et nøytralt svar uten navn i stedet
      // for en kastet feil, så UI-et ikke knekker.
      if (!input?.organizationId && !(await hentBrukersOrg(ctx.userId))) {
        return { kanFoere: false, firmanavn: null };
      }
      const orgId = await resolverOrgFraInput(ctx.userId, input?.organizationId);
      const kanFoere = await erAnsattIFirma(ctx.userId, orgId);
      let firmanavn: string | null = null;
      if (!kanFoere) {
        // Trygt å hente navnet nå — kalleren er verifisert medlem/admin for firmaet.
        const org = await ctx.prisma.organization.findUnique({
          where: { id: orgId },
          select: { name: true },
        });
        firmanavn = org?.name ?? null;
      }
      return { kanFoere, firmanavn };
    }),

  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, input.id, { krevAnsatt: false });
      const [aktivitet, timer, tillegg, maskiner, utlegg, forslag] = await Promise.all([
        sheet.aktivitetId
          ? ctx.prismaTimer.aktivitet.findUnique({ where: { id: sheet.aktivitetId } })
          : Promise.resolve(null),
        ctx.prismaTimer.sheetTimer.findMany({
          where: { sheetId: sheet.id },
          orderBy: { createdAt: "asc" },
        }),
        ctx.prismaTimer.sheetTillegg.findMany({
          where: { sheetId: sheet.id },
          orderBy: { createdAt: "asc" },
        }),
        ctx.prismaTimer.sheetMachine.findMany({
          where: { sheetId: sheet.id },
          orderBy: { createdAt: "asc" },
        }),
        // U3 (2026-08-08): utlegg-rader (SheetUtlegg) — egen bærer, med
        // ordningVedFoering-stempel. Ordnings-pillen/kilde-linjen utledes
        // klient-side fra expenseCategory.list (samme delte utledning).
        ctx.prismaTimer.sheetUtlegg.findMany({
          where: { sheetId: sheet.id },
          orderBy: { createdAt: "asc" },
        }),
        // V19 (A-7): forslaget (mobilens overlappende rader) til EIEREN, så
        // sammenligningen på web (C-1) og mobil (M6) viser samme kilde. Dette er
        // ett av KUN to stedene forslaget leses — aldri en lønnsleser (M15).
        ctx.prismaTimer.sheetTimerForslag.findMany({
          where: { sheetId: sheet.id },
          orderBy: { mottattAt: "asc" },
        }),
      ]);
      // T.1 (2026-05-11): DailySheet har ikke projectId. Bruk første rad som proxy.
      const projectId =
        timer[0]?.projectId ??
        maskiner[0]?.projectId ??
        tillegg[0]?.projectId ??
        utlegg[0]?.projectId ??
        null;
      const prosjekt = projectId
        ? await ctx.prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true, name: true, projectNumber: true },
          })
        : null;
      // Funn #2: hent kvittering-vedlegg for tillegg-radene og fest per rad.
      const tilleggIder = tillegg.map((t) => t.id);
      const vedlegg = tilleggIder.length
        ? await ctx.prismaTimer.sheetTilleggVedlegg.findMany({
            where: { sheetTilleggId: { in: tilleggIder } },
            orderBy: { createdAt: "asc" },
          })
        : [];
      // Web-detalj viser fra svaret umiddelbart → signer privat-URL-er her
      // (målrettet signering, S1 Fase 1). Mobil-sync persisterer og signeres
      // ikke (den bruker signerTilleggVedlegg on-demand).
      const tilleggMedVedlegg = tillegg.map((t) => ({
        ...t,
        vedlegg: vedlegg
          .filter((v) => v.sheetTilleggId === t.id)
          .map((v) => ({ ...v, fileUrl: signerHvisPrivat(v.fileUrl) ?? v.fileUrl })),
      }));
      // U3: samme mønster for utlegg-radenes kvittering-vedlegg.
      const utleggIder = utlegg.map((u) => u.id);
      const utleggVedlegg = utleggIder.length
        ? await ctx.prismaTimer.sheetUtleggVedlegg.findMany({
            where: { sheetUtleggId: { in: utleggIder } },
            orderBy: { createdAt: "asc" },
          })
        : [];
      const utleggMedVedlegg = utlegg.map((u) => ({
        ...u,
        vedlegg: utleggVedlegg
          .filter((v) => v.sheetUtleggId === u.id)
          .map((v) => ({ ...v, fileUrl: signerHvisPrivat(v.fileUrl) ?? v.fileUrl })),
      }));
      // D5 (web-paritet 2026-07-09): eksponer maskinførerbevis-status til
      // arbeideren (mobil T.11 varsler arbeideren; web viste det kun i
      // attestering). Informativt, aldri blokkerende. Kun relevant m/ maskin-rader.
      const manglerMaskinforerbevis =
        maskiner.length > 0 &&
        !(await harGyldigMaskinforerbevis(sheet.userId, sheet.organizationId));
      return {
        ...sheet,
        aktivitet,
        timer,
        tillegg: tilleggMedVedlegg,
        maskiner,
        utlegg: utleggMedVedlegg,
        prosjekt,
        manglerMaskinforerbevis,
        // V19 (A-7): forslaget + konfliktVentendeSiden (fra ...sheet). Eieren
        // velger mellom PC og mobil (C-1); tomt array når ingen overlapp venter.
        forslag,
      };
    }),

  opprett: protectedProcedure
    .input(
      z.object({
        // Idempotens-nøkkel — klient genererer UUID, server upserter
        clientUuid: z.string().uuid(),
        aktivitetId: z.string().uuid(),
        avdelingId: z.string().uuid().nullable().optional(),
        byggeplassId: z.string().uuid().nullable().optional(),
        // SAK 1: prosjekt for auto-første-rad. Uten den lages ingen rad (dagens
        // oppførsel — tom sedel). Lagres IKKE på sedelen (T.1 dato-only); brukes
        // kun til å opprette den første timer-raden.
        projectId: z.string().uuid().nullable().optional(),
        dato: z.string(), // ISO-dato (YYYY-MM-DD)
        startAt: z.string().nullable().optional(), // ISO timestamp
        endAt: z.string().nullable().optional(),
        pauseMin: z.number().int().min(0).default(0),
        sluttTidKilde: z.enum(["bruker", "midnatt", "system"]).default("bruker"),
        beskrivelse: z.string().nullable().optional(),
        // Valgt/innlogget firma (Kenneth-vedtak 2026-10-09): sedelen lagres på DETTE
        // firmaet, ikke på medlemskapet. Serveren verifiserer tilgang. Utelatt → egen org.
        organizationId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Kenneth-vedtak 2026-10-09 (2): egen timeføring krever aktivt ansettelsesforhold
      // i det valgte firmaet — ingen admin-bypass (jf. resolverOrgForEgenTimeføring).
      const orgId = await resolverOrgForEgenTimeføring(ctx.userId, input.organizationId);
      await krevTimerAktivert(orgId);

      // T.1: Web-opprett er dato-only — sedelen eies av arbeider/firma og har
      // ingen prosjekttilhørighet. Org-tilgang (resolverOrgFraInput + krevTimerAktivert)
      // er tilstrekkelig auth; prosjekt legges per rad på detalj-siden.

      // Verifiser at aktiviteten tilhører firmaet
      const aktivitet = await ctx.prismaTimer.aktivitet.findFirst({
        where: { id: input.aktivitetId, organizationId: orgId },
      });
      if (!aktivitet) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Aktivitet finnes ikke i firmaets katalog",
        });
      }

      // SAK 1: prosjekt for auto-første-rad må tilhøre firmaet (samme grense som
      // rad-mutasjonene). Verifiseres FØR sedel-opprettelse så en ugyldig
      // prosjekt-referanse ikke etterlater en sedel uten rad.
      if (input.projectId) {
        await verifiserProsjekterTilhørerFirma([input.projectId], orgId);
      }

      const dato = new Date(input.dato);

      // a2 (2026-07-06): Prefyll arbeidstids-vinduet fra firma-kalenderen når
      // klienten ikke sender et eksplisitt vindu. Vinduet er sekundært/
      // overstyrbart (auto-gen/badge/varsel bruker det) — ikke lenger et
      // påkrevd manuelt steg; radene + topp-sum er primær-flaten. pauseMin
      // forblir sedel-felt (maskin ≤ arbeid-validering bruker den som buffer).
      let startAtVerdi = input.startAt ? new Date(input.startAt) : null;
      let endAtVerdi = input.endAt ? new Date(input.endAt) : null;
      let pauseMinVerdi = input.pauseMin;
      if (!startAtVerdi && !endAtVerdi) {
        const norm = await hentEffektivArbeidstid(orgId, dato);
        startAtVerdi = osloVeggurTilInstant(dato, norm.startTid);
        endAtVerdi = osloVeggurTilInstant(dato, norm.sluttTid);
        pauseMinVerdi = norm.pauseMin;
      }

      // Idempotent upsert via clientUuid
      // T.1 (2026-05-11): projectId lagres ikke på DailySheet — kun på rad-nivå.
      // Klient sender projectId ved opprettelse av rader (leggTilTimerRad etc.).
      // @@unique([userId, dato]): én sedel per arbeider per dato (P2002 = duplikat-dato).
      try {
        const sheet = await ctx.prismaTimer.dailySheet.upsert({
          where: { clientUuid: input.clientUuid },
          create: {
            // Synk-identitet (2026-07-11): id == clientUuid ved create. Mobil
            // antar `id = clientUuid` (schema.ts:84) og pusher/puller på den ene
            // identiteten; server-generert uuid brøt antagelsen (pull-duplikat +
            // pull-så-redigert-P2002). Eksisterende sedler (id != clientUuid)
            // beholdes urørt — kun nye får invarianten.
            id: input.clientUuid,
            clientUuid: input.clientUuid,
            organizationId: orgId,
            userId: ctx.userId,
            registrertAvUserId: ctx.userId,
            aktivitetId: input.aktivitetId,
            avdelingId: input.avdelingId ?? null,
            byggeplassId: input.byggeplassId ?? null,
            dato,
            startAt: startAtVerdi,
            endAt: endAtVerdi,
            pauseMin: pauseMinVerdi,
            sluttTidKilde: input.sluttTidKilde,
            beskrivelse: input.beskrivelse ?? null,
            status: "draft",
          },
          // Re-send av samme clientUuid: returner eksisterende uten endring
          update: {},
        });
        // SAK 1: opprett auto-første-rad når klienten sendte prosjekt. Idempotent
        // (hopper over hvis sedelen alt har rader) — trygt selv om upsert traff
        // en eksisterende sedel via clientUuid-re-send.
        if (input.projectId) {
          await opprettForsteTimerRadForslag(ctx.prismaTimer, {
            sheetId: sheet.id,
            orgId,
            projectId: input.projectId,
            aktivitetId: input.aktivitetId,
            byggeplassId: input.byggeplassId ?? null,
            dato,
            startAt: startAtVerdi,
            endAt: endAtVerdi,
          });
        }
        return { ...sheet, eksisterte: false };
      } catch (e) {
        // D1 (web-paritet 2026-07-08): duplikat-dato er IKKE en feil — mobil
        // (finnEllerOpprettDagsseddel) åpner eksisterende sedel. Speiler den
        // atferden: hent sedelen for (userId, dato) og returner den urørt med
        // `eksisterte: true` så klienten kan redirecte + vise notis. P2002 kan
        // treffe enten @@unique([userId, dato]) eller clientUuid — findUnique på
        // (userId, dato) dekker begge (samme dato = samme sedel).
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          const eksisterende = await ctx.prismaTimer.dailySheet.findUnique({
            where: { userId_dato: { userId: ctx.userId, dato } },
          });
          if (eksisterende) return { ...eksisterende, eksisterte: true };
        }
        throw e;
      }
    }),

  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        aktivitetId: z.string().uuid().optional(),
        avdelingId: z.string().uuid().nullable().optional(),
        byggeplassId: z.string().uuid().nullable().optional(),
        dato: z.string().optional(),
        startAt: z.string().nullable().optional(),
        endAt: z.string().nullable().optional(),
        pauseMin: z.number().int().min(0).optional(),
        sluttTidKilde: z.enum(["bruker", "midnatt", "system"]).optional(),
        beskrivelse: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, input.id);

      if (!erRedigerbar(sheet.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Dagsseddel er låst (status: ${sheet.status})`,
        });
      }
      await sjekkAldersgrense(sheet.organizationId, sheet.status, sheet.dato);

      const data: Prisma.DailySheetUpdateInput = {};
      if (input.aktivitetId !== undefined) {
        data.aktivitet = { connect: { id: input.aktivitetId } };
      }
      if (input.avdelingId !== undefined) data.avdelingId = input.avdelingId;
      if (input.byggeplassId !== undefined) data.byggeplassId = input.byggeplassId;
      if (input.dato !== undefined) data.dato = new Date(input.dato);
      if (input.startAt !== undefined) {
        data.startAt = input.startAt ? new Date(input.startAt) : null;
      }
      if (input.endAt !== undefined) {
        data.endAt = input.endAt ? new Date(input.endAt) : null;
      }
      if (input.pauseMin !== undefined) data.pauseMin = input.pauseMin;
      if (input.beskrivelse !== undefined) data.beskrivelse = input.beskrivelse;
      // Slice 4b-2: eksplisitt sluttTidKilde vinner; ellers — endres slutt-tiden
      // manuelt (input.endAt satt) er det en bruker-bekreftet tid → "bruker"
      // (nullstiller evt. "system"/"midnatt"). Dekker web-redigering som ikke
      // sender feltet eksplisitt.
      if (input.sluttTidKilde !== undefined) {
        data.sluttTidKilde = input.sluttTidKilde;
      } else if (input.endAt !== undefined) {
        data.sluttTidKilde = "bruker";
      }

      return ctx.prismaTimer.dailySheet.update({
        where: { id: input.id },
        data,
      });
    }),

  // ----- Timer-rader (lønnsart × timer × aktivitet) -----------------------
  // Per C9 (2026-05-02): aktivitetId er per rad. Klient sender alltid
  // (default fra sedel hvis ikke overstyrt).
  tilfoyTimerRad: protectedProcedure
    .input(
      z.object({
        sheetId: z.string().uuid(),
        projectId: z.string().uuid(),
        byggeplassId: z.string().uuid().nullable().optional(),
        lonnsartId: z.string().uuid(),
        aktivitetId: z.string().uuid(),
        // LAG 0a (H5): Zod kjenner ikke lønnsarten, så det faste taket er fjernet
        // her. Km-/time-taket legges lønnsart-bevisst i handleren (rad-tak.ts).
        timer: z.number().min(0),
        fraTid: z.string().nullable().optional(),
        tilTid: z.string().nullable().optional(),
        // V20/PK3: radens matpause. Valgfri — gammel klient sender den ikke
        // (serveren normaliserer da som i synk); ny klient sender den og får
        // streng kontroll mot timetallet.
        pauseMin: z.number().int().min(0).optional(),
        // T.12: fritekst per rad («hva jeg gjorde»).
        beskrivelse: z.string().nullable().optional(),
        externalCostObjectId: z.string().uuid().nullable().optional(),
        // T.10: kostnadsbærer for maskinvedlikehold (svak FK → Equipment).
        vehicleId: z.string().uuid().nullable().optional(),
      }).superRefine(refineFraForTil),
    )
    .mutation(async ({ ctx, input }) => {
      // Fra/til obligatorisk på timer-rader (2026-07-13). REVERSERER a2-
      // degraderingen (2026-07-06) som gjorde per-rad fra/til valgfritt —
      // bevisst reversering: tid-løse timer-rader er ufullstendige lønnsdata
      // OG usynlige for overlapp-vakten (Kenneth-klassifisert bug, fabel-vedtak).
      if (!input.fraTid || !input.tilTid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Fra- og til-tid er påkrevd på timer-rader",
        });
      }

      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, input.sheetId);
      if (!erRedigerbar(sheet.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Dagsseddel er låst (status: ${sheet.status})`,
        });
      }
      // Funn 2 (modul-resolver): NYE rader krever aktiv Timer-firmatak. Slår
      // firmaet av Timer, kan ingen nye rader føres. Redigering/fjerning av rader
      // som alt finnes gates IKKE — en påbegynt dagsseddel skal aldri bli ulagrbar
      // fordi firmaet slår av Timer midt i en arbeidsdag (Kenneth-grense 2026-08-31).
      await krevTimerAktivert(sheet.organizationId);
      await sjekkAldersgrense(sheet.organizationId, sheet.status, sheet.dato);

      // Verifiser lønnsart + aktivitet tilhører samme firma
      const [lonnsart, aktivitet] = await Promise.all([
        ctx.prismaTimer.lonnsart.findFirst({
          where: { id: input.lonnsartId, organizationId: sheet.organizationId },
        }),
        ctx.prismaTimer.aktivitet.findFirst({
          where: { id: input.aktivitetId, organizationId: sheet.organizationId },
        }),
      ]);
      if (!lonnsart) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Lønnsart finnes ikke i firmaets katalog",
        });
      }
      if (!aktivitet) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Aktivitet finnes ikke i firmaets katalog",
        });
      }

      // LAG 0a (H5): lønnsart-bevisst tak. per_km → km-tak, ellers 24 timer.
      krevRadInnenforTak(input.timer, lonnsart.satsEnhet);

      // Fase 1b: firma-grense på rad-projectId (lukker cross-firma-lekkasje).
      await verifiserProsjekterTilhørerFirma([input.projectId], sheet.organizationId);

      // §2.D: vehicleId (maskinvedlikehold-kostnadsbærer) må tilhøre firmaet.
      if (input.vehicleId) {
        await verifiserKjoretoyTilhørerFirma(input.vehicleId, sheet.organizationId);
      }

      // T7-4b: valider sum(maskin) ≤ sum(timer) per (projectId, ECO).
      // Defensiv — å legge til en timer-rad kan kun øke timer-summen i
      // bucket. Beholdes for konsistens på tvers av mutasjoner.
      const naa = await hentRaderForValidering(ctx.prismaTimer, input.sheetId);
      const postTimer: ValiderRad[] = [
        ...naa.timer,
        {
          projectId: input.projectId,
          externalCostObjectId: input.externalCostObjectId ?? null,
          timer: input.timer,
        },
      ];
      const brytt = validerMaskinUnderArbeid(postTimer, naa.maskin, sheet.pauseMin);
      if (brytt.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: await feilMeldingMaskinOverstiger(brytt),
        });
      }

      // Bolk (g): overlapp-vakt — ny rads spenn kan ikke overlappe en annen
      // timer-rad på sedelen (på tvers av prosjekt/ECO).
      await sjekkTimerOverlapp(
        ctx.prismaTimer,
        input.sheetId,
        input.fraTid,
        input.tilTid,
      );

      // LAG 2 (presisering 2): utled erReise fra lønnsarten (web sender ikke
      // flagget). Samme regel som backfill/synk; bruker navnet vi alt lastet.
      const erReiseKtx = await hentErReiseKontekst(sheet.organizationId);
      const erReise = utledErReise(input.lonnsartId, lonnsart.navn, erReiseKtx);

      // V20/PK4a — vurder timetallet mot radens pause og pausevinduet. Vinduet
      // (PK5) regnes fra alle rader på dagen (ankomst = tidligste fraTid, inkl.
      // den nye). `finnesAlleredeBaerer` holder kun-én-pr-dag.
      const eksisterendeRader = await ctx.prismaTimer.sheetTimer.findMany({
        where: { sheetId: input.sheetId, attestertStatus: { not: "erstattet" } },
        select: { fraTid: true, pauseMin: true },
      });
      const { pauseVindu, standardPauseMin } = await hentPauseVinduForSedel(
        sheet.organizationId,
        sheet.dato,
        [...eksisterendeRader, { fraTid: input.fraTid }],
      );
      const vurdering = vurderRadTimer({
        modus: "interaktiv",
        satsEnhet: lonnsart.satsEnhet,
        fraTid: input.fraTid,
        tilTid: input.tilTid,
        timer: input.timer,
        pauseMinAngitt: input.pauseMin,
        pauseVindu,
        standardPauseMin,
        finnesAlleredeBaerer: eksisterendeRader.some(
          (r) => (r.pauseMin ?? 0) > 0,
        ),
      });
      if (vurdering.kast) {
        avvisTimerAvvik(
          input.fraTid,
          input.tilTid,
          input.timer,
          pauseVindu,
          input.pauseMin ?? 0,
        );
      }

      // F4-1d: rad-write + hode-synk (PK6) atomisk så mobil pull ser den nye
      // raden og hodet = Σ rad i samme skriving.
      const rad = await ctx.prismaTimer.$transaction(async (tx) => {
        const ny = await tx.sheetTimer.create({
          data: byggTimerRadData(
            input.sheetId,
            { ...input, pauseMin: vurdering.pauseMin },
            erReise,
          ),
        });
        await synkroniserHodePause(tx, input.sheetId);
        return ny;
      });
      return rad;
    }),

  oppdaterTimerRad: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        lonnsartId: z.string().uuid().optional(),
        aktivitetId: z.string().uuid().optional(),
        // LAG 0a (H5): tak fjernet fra Zod — settes lønnsart-bevisst i handleren.
        timer: z.number().min(0).optional(),
        // T.12: fritekst per rad («hva jeg gjorde»).
        beskrivelse: z.string().nullable().optional(),
        externalCostObjectId: z.string().uuid().nullable().optional(),
        // T.10: kostnadsbærer for maskinvedlikehold (svak FK → Equipment).
        vehicleId: z.string().uuid().nullable().optional(),
        // D2 (web-paritet 2026-07-08): per-rad fra/til (HH:MM). tilfoyTimerRad
        // hadde disse fra før; oppdater manglet dem → web kunne ikke lagre
        // tids-endringer. Nullable/optional — sendes kun når feltet er i bruk.
        fraTid: z.string().nullable().optional(),
        tilTid: z.string().nullable().optional(),
        // V20/PK3: radens matpause (se tilfoyTimerRad).
        pauseMin: z.number().int().min(0).optional(),
      }).superRefine(refineFraForTil),
    )
    .mutation(async ({ ctx, input }) => {
      // Fra/til obligatorisk på timer-rader (2026-07-13). REVERSERER a2-
      // degraderingen (2026-07-06) som gjorde per-rad fra/til valgfritt —
      // bevisst reversering: tid-løse timer-rader er ufullstendige lønnsdata
      // OG usynlige for overlapp-vakten (Kenneth-klassifisert bug, fabel-vedtak).
      if (!input.fraTid || !input.tilTid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Fra- og til-tid er påkrevd på timer-rader",
        });
      }

      const rad = await ctx.prismaTimer.sheetTimer.findUnique({
        where: { id: input.id },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });

      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, rad.sheetId);
      if (!erRedigerbar(sheet.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Dagsseddel er låst (status: ${sheet.status})`,
        });
      }
      await sjekkAldersgrense(sheet.organizationId, sheet.status, sheet.dato);

      // LAG 0a (H5): lønnsart-bevisst tak. Handleren laster ikke lønnsarten ellers,
      // så vi henter satsEnhet for den EFFEKTIVE lønnsarten (ny hvis satt, ellers
      // radens egen) når enten verdien eller lønnsarten endres — et bytte til en
      // time-lønnsart uten å endre en km-verdi skal også fanges. Ukjent lønnsart →
      // satsEnhet=null → konservativt 24-tak.
      if (input.timer !== undefined || input.lonnsartId !== undefined) {
        const effektivLonnsartId = input.lonnsartId ?? rad.lonnsartId;
        const effektivTimer = input.timer ?? Number(rad.timer);
        const lonnsart = await ctx.prismaTimer.lonnsart.findFirst({
          where: { id: effektivLonnsartId, organizationId: sheet.organizationId },
          select: { satsEnhet: true },
        });
        krevRadInnenforTak(effektivTimer, lonnsart?.satsEnhet);
      }

      const data: Prisma.SheetTimerUpdateInput = {};
      if (input.lonnsartId !== undefined) {
        data.lonnsart = { connect: { id: input.lonnsartId } };
        // LAG 2 (presisering 2): lønnsart-bytte → re-utled erReise (klienten sender
        // ikke flagget). Raden kan gå fra arbeid til reise eller omvendt.
        const erReiseMap = await hentErReiseForLonnsarter(
          ctx.prismaTimer,
          sheet.organizationId,
          [input.lonnsartId],
        );
        data.erReise = erReiseMap.get(input.lonnsartId) ?? false;
      }
      if (input.aktivitetId !== undefined) {
        data.aktivitet = { connect: { id: input.aktivitetId } };
      }
      if (input.timer !== undefined) data.timer = input.timer;
      if (input.beskrivelse !== undefined) data.beskrivelse = input.beskrivelse;
      if (input.externalCostObjectId !== undefined) {
        data.externalCostObjectId = input.externalCostObjectId;
      }
      if (input.vehicleId !== undefined) {
        // §2.D: valider mot firmaets maskinregister når en ID settes (ikke ved null).
        if (input.vehicleId) {
          await verifiserKjoretoyTilhørerFirma(input.vehicleId, sheet.organizationId);
        }
        data.vehicleId = input.vehicleId;
      }
      if (input.fraTid !== undefined) data.fraTid = input.fraTid;
      if (input.tilTid !== undefined) data.tilTid = input.tilTid;

      // T7-4b: valider post-state. Reduksjon av timer eller flytting til
      // annen ECO kan få maskin-totalen til å overstige.
      const naa = await hentRaderForValidering(ctx.prismaTimer, rad.sheetId);
      const postTimer: ValiderRad[] = naa.timer.map((r) =>
        r.id === input.id
          ? {
              projectId: r.projectId, // projectId endres ikke i oppdaterTimerRad
              externalCostObjectId:
                input.externalCostObjectId !== undefined
                  ? input.externalCostObjectId
                  : r.externalCostObjectId,
              timer: input.timer !== undefined ? input.timer : r.timer,
            }
          : r,
      );
      const brytt = validerMaskinUnderArbeid(postTimer, naa.maskin, sheet.pauseMin);
      if (brytt.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: await feilMeldingMaskinOverstiger(brytt),
        });
      }

      // Bolk (g): overlapp-vakt på post-state fra/til (delvis oppdatering →
      // fall tilbake til radens eksisterende verdi). Egen rad ekskluderes.
      await sjekkTimerOverlapp(
        ctx.prismaTimer,
        rad.sheetId,
        input.fraTid !== undefined ? input.fraTid : rad.fraTid,
        input.tilTid !== undefined ? input.tilTid : rad.tilTid,
        input.id,
      );

      // V20/PK4a — vurder post-state timetall mot pause + vindu. Effektiv
      // lønnsart/tid/timer er ny verdi hvis satt, ellers radens egen.
      const vurderLonnsart = await ctx.prismaTimer.lonnsart.findFirst({
        where: {
          id: input.lonnsartId ?? rad.lonnsartId,
          organizationId: sheet.organizationId,
        },
        select: { satsEnhet: true },
      });
      const andreRader = await ctx.prismaTimer.sheetTimer.findMany({
        where: {
          sheetId: rad.sheetId,
          attestertStatus: { not: "erstattet" },
          id: { not: input.id },
        },
        select: { fraTid: true, pauseMin: true },
      });
      const { pauseVindu, standardPauseMin } = await hentPauseVinduForSedel(
        sheet.organizationId,
        sheet.dato,
        [...andreRader, { fraTid: input.fraTid }],
      );
      const vurdering = vurderRadTimer({
        modus: "interaktiv",
        satsEnhet: vurderLonnsart?.satsEnhet,
        fraTid: input.fraTid,
        tilTid: input.tilTid,
        timer: input.timer ?? Number(rad.timer),
        pauseMinAngitt: input.pauseMin,
        pauseVindu,
        standardPauseMin,
        finnesAlleredeBaerer: andreRader.some((r) => (r.pauseMin ?? 0) > 0),
      });
      if (vurdering.kast) {
        avvisTimerAvvik(
          input.fraTid,
          input.tilTid,
          input.timer ?? Number(rad.timer),
          pauseVindu,
          input.pauseMin ?? 0,
        );
      }
      data.pauseMin = vurdering.pauseMin;

      // F4-1d: rad-write + hode-synk (PK6) atomisk.
      const oppdatert = await ctx.prismaTimer.$transaction(async (tx) => {
        const o = await tx.sheetTimer.update({
          where: { id: input.id },
          data,
        });
        await synkroniserHodePause(tx, rad.sheetId);
        return o;
      });
      return oppdatert;
    }),

  fjernTimerRad: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const rad = await ctx.prismaTimer.sheetTimer.findUnique({
        where: { id: input.id },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });

      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, rad.sheetId);
      if (!erRedigerbar(sheet.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Dagsseddel er låst (status: ${sheet.status})`,
        });
      }

      // F4-1d: rad-write + hode-synk (PK6) atomisk — sletting kan fjerne
      // bæreren, så hodet må re-utledes (Σ rad).
      const slettet = await ctx.prismaTimer.$transaction(async (tx) => {
        const s = await tx.sheetTimer.delete({ where: { id: input.id } });
        await synkroniserHodePause(tx, rad.sheetId);
        return s;
      });
      return slettet;
    }),

  // U-BEKREFT steg 2 (2026-10-01): FORSON et dagskort i konflikt. Arbeideren har valgt
  // pr. tidsrom i sammenligningsvisningen; her anvendes valgene ATOMISK på det redigerbare
  // web-kortet. Komponerer de SAMME skrivereglene som tilfoy/oppdaterTimerRad (byggTimerRadData
  // + erRedigerbar + firma-grenser + finnOverlappendeTidsrom + validerMaskinUnderArbeid), men i
  // ÉN $transaction så en halvveis feil etterlater kortet UENDRET — et halvt anvendt valg på
  // lønnsdata er en tredje tilstand ingen har designet.
  //
  // Kun TIMER-rader (det sammenligningsvisningen stiller opp pr. tidsrom). `oppdateringer` =
  // valgt-lokal på et tidsrom begge hadde → erstatt server-raden IN-PLACE på dens id (ingen
  // duplikat). `nyeRader` = lokal-only beholdt → opprett. Valgt-server / server-only beholdt er
  // no-op (ligger alt på kortet). Svaret er det autoritative forsonede settet — klienten
  // speiler det til lokal, så flatene ikke kan divergere.
  //
  // 🔴 Modus C-vern ligger HER, ikke bare i UI-et: et kall mot en sent/accepted sedel avvises
  // av serveren (PRECONDITION_FAILED). Veien for et låst kort er lederens retur (Kenneth alt A).
  //
  // 🔴 Q3(b) — «ingen fjern»-invarianten er IMPLISITT og forutsetter at tomme sider ikke er
  // trykkbare: visningen (apps/mobile/src/components/timer-detalj/DagskortSammenligning.tsx:89
  // `kanTrykke`) lar deg aldri velge bort en enkeltstående rad — det fravalgte er alltid den
  // ANDRE siden av et tidsrom begge hadde. Derfor har denne mutasjonen ingen `fjern`-op.
  // Tillater en senere UI-endring at en enkeltstående rad velges bort, KAN serveren ikke
  // uttrykke det — og den som endrer visningen vil ikke se det her. Endres `kanTrykke`, må
  // forkast-veien bygges inn her samtidig.
  forsonDagskort: protectedProcedure
    .input(
      z.object({
        sheetId: z.string().uuid(),
        oppdateringer: z
          .array(
            z
              .object({
                id: z.string().uuid(),
                projectId: z.string().uuid(),
                byggeplassId: z.string().uuid().nullable().optional(),
                lonnsartId: z.string().uuid(),
                aktivitetId: z.string().uuid(),
                // LAG 0a (H5): tak settes lønnsart-bevisst i handleren (rad-tak.ts).
                timer: z.number().min(0),
                fraTid: z.string(),
                tilTid: z.string(),
                // V20/PK3: radens matpause.
                pauseMin: z.number().int().min(0).optional(),
                beskrivelse: z.string().nullable().optional(),
                externalCostObjectId: z.string().uuid().nullable().optional(),
                vehicleId: z.string().uuid().nullable().optional(),
              })
              .superRefine(refineFraForTil),
          )
          .default([]),
        nyeRader: z
          .array(
            z
              .object({
                projectId: z.string().uuid(),
                byggeplassId: z.string().uuid().nullable().optional(),
                lonnsartId: z.string().uuid(),
                aktivitetId: z.string().uuid(),
                // LAG 0a (H5): tak settes lønnsart-bevisst i handleren (rad-tak.ts).
                timer: z.number().min(0),
                fraTid: z.string(),
                tilTid: z.string(),
                // V20/PK3: radens matpause.
                pauseMin: z.number().int().min(0).optional(),
                beskrivelse: z.string().nullable().optional(),
                externalCostObjectId: z.string().uuid().nullable().optional(),
                vehicleId: z.string().uuid().nullable().optional(),
              })
              .superRefine(refineFraForTil),
          )
          .default([]),
        // V19.9.7 (A'-7): serverrad-id-er arbeideren valgte å SLETTE (valg «forslag»
        // på en slettet_telefon-slot). Slettes i SAMME tx, FØR overlapp-vakten.
        // Default [] → ren V19-A-forsoning uendret. Kommer fra byggForsonInputFraValg.
        slettinger: z.array(z.string().uuid()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, input.sheetId);
      // 🔴 Modus C-vern i server-laget: låst sedel kan ikke forsones (retur via leder).
      if (!erRedigerbar(sheet.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Dagsseddel er låst (status: ${sheet.status})`,
        });
      }
      // Nye rader krever aktiv Timer-firmatak (samme grense som tilfoyTimerRad). Oppdatering
      // av rader som alt finnes gates IKKE (en påbegynt sedel skal ikke bli ulagrbar).
      if (input.nyeRader.length > 0) {
        await krevTimerAktivert(sheet.organizationId);
      }
      await sjekkAldersgrense(sheet.organizationId, sheet.status, sheet.dato);

      const alleRader = [...input.oppdateringer, ...input.nyeRader];
      if (alleRader.length === 0 && input.slettinger.length === 0) {
        // Alt valgt-server / «behold PC for hele dagen» → ingen rad-endring. Men
        // forsoningen ER fullført: V19 (A-5) krever at forslaget slettes og
        // konfliktVentendeSiden nulles — ellers står invarianten (felt ⇔ forslag)
        // brutt og attesteringen forblir blokkert. Dagens tidlige `return` (ren
        // findMany) måtte derfor inn i tx-en. Samme status-betingede updateMany
        // som den fulle veien (TOCTOU: en sedel attestert i vinduet gir count 0).
        return ctx.prismaTimer.$transaction(async (tx) => {
          const laast = await tx.dailySheet.updateMany({
            where: { id: input.sheetId, status: { in: [...REDIGERBARE_STATUSER] } },
            data: { updatedAt: new Date(), konfliktVentendeSiden: null },
          });
          if (laast.count === 0) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message:
                "Dagsseddel ble låst under forsoningen — den er attestert. Be leder returnere den.",
            });
          }
          await tx.sheetTimerForslag.deleteMany({ where: { sheetId: input.sheetId } });
          return tx.sheetTimer.findMany({
            where: { sheetId: input.sheetId },
            orderBy: { createdAt: "asc" },
          });
        });
      }

      // Firma-grenser (samme regler som rad-mutasjonene): prosjekt, lønnsart, aktivitet og
      // evt. kjøretøy må tilhøre sedelens firma.
      await verifiserProsjekterTilhørerFirma(
        Array.from(new Set(alleRader.map((r) => r.projectId))),
        sheet.organizationId,
      );
      const lonnsartIder = Array.from(new Set(alleRader.map((r) => r.lonnsartId)));
      const aktivitetIder = Array.from(new Set(alleRader.map((r) => r.aktivitetId)));
      const [lonnsartTreff, aktivitetTreff] = await Promise.all([
        ctx.prismaTimer.lonnsart.findMany({
          where: { id: { in: lonnsartIder }, organizationId: sheet.organizationId },
          // LAG 0a (H5): satsEnhet lastes for det lønnsart-bevisste taket (én
          // spørring for alle rader, ikke pr. rad).
          select: { id: true, satsEnhet: true },
        }),
        ctx.prismaTimer.aktivitet.findMany({
          where: { id: { in: aktivitetIder }, organizationId: sheet.organizationId },
          select: { id: true },
        }),
      ]);
      if (lonnsartTreff.length !== lonnsartIder.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Lønnsart finnes ikke i firmaets katalog" });
      }
      if (aktivitetTreff.length !== aktivitetIder.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Aktivitet finnes ikke i firmaets katalog" });
      }
      // LAG 0a (H5): lønnsart-bevisst tak pr. rad fra det delte opplaget over.
      const satsEnhetEtterLonnsart = new Map(
        lonnsartTreff.map((l) => [l.id, l.satsEnhet]),
      );
      for (const r of alleRader) {
        krevRadInnenforTak(r.timer, satsEnhetEtterLonnsart.get(r.lonnsartId));
      }
      const kjoretoyIder = Array.from(
        new Set(alleRader.map((r) => r.vehicleId).filter((v): v is string => !!v)),
      );
      for (const vid of kjoretoyIder) {
        await verifiserKjoretoyTilhørerFirma(vid, sheet.organizationId);
      }

      // Bygg SLUTT-settet og valider ÉN gang (ikke per rad — per-rad mot DB-mellomtilstand
      // ville gi falske overlapp-brudd mens flere rader endres i samme runde). Server-rader
      // som ikke oppdateres står; oppdaterte får nye verdier; nye legges til.
      const naavaerendeAlle = await ctx.prismaTimer.sheetTimer.findMany({
        where: { sheetId: input.sheetId },
      });
      // V19.9.7: rader som skal SLETTES holdes utenfor sluttsettet — ellers ville en
      // slettet rad telt i overlapp-/maskinvakten mot en ny rad som tar dens plass.
      const slettingerSet = new Set(input.slettinger);
      const naavaerende = naavaerendeAlle.filter((r) => !slettingerSet.has(r.id));
      // 🔴 Hver oppdatering MÅ treffe en eksisterende rad på DETTE kortet (in-place, ingen
      // duplikat, ingen kryss-sedel-skriving). Ukjent id → avvis.
      for (const o of input.oppdateringer) {
        if (!naavaerende.some((r) => r.id === o.id)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Rad som skal erstattes finnes ikke på dagskortet",
          });
        }
      }
      const oppdatertEtterId = new Map(input.oppdateringer.map((o) => [o.id, o]));
      type SluttRad = {
        projectId: string;
        externalCostObjectId: string | null;
        timer: number;
        fraTid: string;
        tilTid: string;
      };
      const sluttTimer: SluttRad[] = [
        ...naavaerende.map((r): SluttRad => {
          const o = oppdatertEtterId.get(r.id);
          return o
            ? {
                projectId: o.projectId,
                externalCostObjectId: o.externalCostObjectId ?? null,
                timer: o.timer,
                fraTid: o.fraTid,
                tilTid: o.tilTid,
              }
            : {
                projectId: r.projectId,
                externalCostObjectId: r.externalCostObjectId,
                timer: Number(r.timer),
                fraTid: r.fraTid ?? "",
                tilTid: r.tilTid ?? "",
              };
        }),
        ...input.nyeRader.map((r): SluttRad => ({
          projectId: r.projectId,
          externalCostObjectId: r.externalCostObjectId ?? null,
          timer: r.timer,
          fraTid: r.fraTid,
          tilTid: r.tilTid,
        })),
      ];

      // Overlapp-vakt på SLUTT-settet (all-pairs), samme delte regel som rad-mutasjonene.
      const medTid = sluttTimer.filter((r) => r.fraTid && r.tilTid);
      for (let i = 0; i < medTid.length; i++) {
        const r = medTid[i]!;
        const andre = medTid
          .filter((_, j) => j !== i)
          .map((x) => ({ fraTid: x.fraTid, tilTid: x.tilTid }));
        const overlapp = finnOverlappendeTidsrom(r.fraTid, r.tilTid, andre);
        if (overlapp) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Tidsrommet overlapper en annen rad (${overlapp.fraTid}–${overlapp.tilTid}) på samme dagsseddel. Én arbeider kan ikke være to steder samtidig.`,
          });
        }
      }

      // Maskin-under-arbeid på SLUTT-settet (samme delte bucket-regel).
      const naa = await hentRaderForValidering(ctx.prismaTimer, input.sheetId);
      const brytt = validerMaskinUnderArbeid(
        sluttTimer.map((r) => ({
          projectId: r.projectId,
          externalCostObjectId: r.externalCostObjectId,
          timer: r.timer,
        })),
        naa.maskin,
        sheet.pauseMin,
      );
      if (brytt.length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: await feilMeldingMaskinOverstiger(brytt) });
      }

      // 🔴 ATOMISK + TOCTOU-lukket: erRedigerbar leses over (:1638) UTENFOR transaksjonen. Blir
      // sedelen attestert i vinduet mellom validering og skriving, ville en array-$transaction
      // landet lønnsdata på et låst kort — Kenneths alt A håndhevet i skjermen, ikke i koden.
      // Vernet er samme mønster som SedelAttestertConflict-guarden (:5131): en status-betinget
      // updateMany ÅPNER den interaktive tx-en. UPDATE tar radlås til commit, så en samtidig
      // attestering ser enten draft/returned (vi vinner) eller har alt committet accepted
      // (count=0 → vi kaster → ALT rulles tilbake). updateMany erstatter samtidig touchSedel
      // (begge bumper updatedAt). Alle rad-writes + sluttlesningen kjører på samme `tx`.
      // LAG 2 (presisering 2): utled erReise for hver rad (oppdatering = kan ha
      // byttet lønnsart → re-utled; ny rad = utled). Ett oppslag for alle arter.
      const erReiseMap = await hentErReiseForLonnsarter(
        ctx.prismaTimer,
        sheet.organizationId,
        [
          ...input.oppdateringer.map((o) => o.lonnsartId),
          ...input.nyeRader.map((r) => r.lonnsartId),
        ],
      );

      // V20/PK4a — vurder timetallet mot pause + vindu for hver skrevne rad.
      // Vinduet (PK5) regnes fra hele sluttsettet. Bæreren spores på tvers av
      // batchen (kun-én-pr-dag): starter true hvis en BEHOLDT server-rad alt
      // bærer, settes når en skrevet rad blir bærer.
      const { pauseVindu, standardPauseMin } = await hentPauseVinduForSedel(
        sheet.organizationId,
        sheet.dato,
        sluttTimer.map((r) => ({ fraTid: r.fraTid })),
      );
      const beholdtBaerer = naavaerende.some(
        (r) => !oppdatertEtterId.has(r.id) && (r.pauseMin ?? 0) > 0,
      );
      let baererTatt = beholdtBaerer;
      const oppdateringPause = new Map<string, number>();
      const nyRadPause: number[] = [];
      for (const o of input.oppdateringer) {
        const v = vurderRadTimer({
          modus: "interaktiv",
          satsEnhet: satsEnhetEtterLonnsart.get(o.lonnsartId),
          fraTid: o.fraTid,
          tilTid: o.tilTid,
          timer: o.timer,
          pauseMinAngitt: o.pauseMin,
          pauseVindu,
          standardPauseMin,
          finnesAlleredeBaerer: baererTatt,
        });
        if (v.kast) {
          avvisTimerAvvik(o.fraTid, o.tilTid, o.timer, pauseVindu, o.pauseMin ?? 0);
        }
        if (v.pauseMin > 0) baererTatt = true;
        oppdateringPause.set(o.id, v.pauseMin);
      }
      for (const r of input.nyeRader) {
        const v = vurderRadTimer({
          modus: "interaktiv",
          satsEnhet: satsEnhetEtterLonnsart.get(r.lonnsartId),
          fraTid: r.fraTid,
          tilTid: r.tilTid,
          timer: r.timer,
          pauseMinAngitt: r.pauseMin,
          pauseVindu,
          standardPauseMin,
          finnesAlleredeBaerer: baererTatt,
        });
        if (v.kast) {
          avvisTimerAvvik(r.fraTid, r.tilTid, r.timer, pauseVindu, r.pauseMin ?? 0);
        }
        if (v.pauseMin > 0) baererTatt = true;
        nyRadPause.push(v.pauseMin);
      }

      return ctx.prismaTimer.$transaction(async (tx) => {
        const laast = await tx.dailySheet.updateMany({
          where: { id: input.sheetId, status: { in: [...REDIGERBARE_STATUSER] } },
          // V19 (A-3/A-5): forsoningen avslutter overlappen → null
          // konfliktVentendeSiden i SAMME tx som forslaget slettes (invariant:
          // felt ⇔ forslag). Alltid trygt å nulle — var det ingen overlapp, var
          // feltet alt null.
          data: { updatedAt: new Date(), konfliktVentendeSiden: null },
        });
        if (laast.count === 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Dagsseddel ble låst under forsoningen — den er attestert. Be leder returnere den.",
          });
        }
        // V19.9.7 (A'-7): valgte slettinger (slettet_telefon → «forslag») utføres i
        // SAMME tx, FØR rad-skrivingen og overlapp-vakten. Scopet på sheetId så
        // arbeideren aldri kan slette rader på en annen sedel. Etter dette kjører
        // sluttsettets finnTidsromKonflikt på det som faktisk står igjen.
        if (input.slettinger.length > 0) {
          await tx.sheetTimer.deleteMany({
            where: { sheetId: input.sheetId, id: { in: input.slettinger } },
          });
        }
        for (const o of input.oppdateringer) {
          await tx.sheetTimer.update({
            where: { id: o.id },
            data: byggTimerRadData(
              input.sheetId,
              { ...o, pauseMin: oppdateringPause.get(o.id) ?? 0 },
              erReiseMap.get(o.lonnsartId) ?? false,
            ),
          });
        }
        for (let i = 0; i < input.nyeRader.length; i++) {
          const r = input.nyeRader[i]!;
          await tx.sheetTimer.create({
            data: byggTimerRadData(
              input.sheetId,
              { ...r, pauseMin: nyRadPause[i] ?? 0 },
              erReiseMap.get(r.lonnsartId) ?? false,
            ),
          });
        }
        // V20/PK6: hodet = Σ rad etter alle skrivinger (slett + oppdater + ny).
        await synkroniserHodePause(tx, input.sheetId);
        // V19 (A-5): forslaget er anvendt → slett det i samme tx.
        await tx.sheetTimerForslag.deleteMany({ where: { sheetId: input.sheetId } });
        const forsonet = await tx.sheetTimer.findMany({
          where: { sheetId: input.sheetId },
          orderBy: { createdAt: "asc" },
        });
        // V19 (A-5, vakt): forsoningen skal ALDRI etterlate en overlapp. Dette er
        // sluttsettet (alle rad-writes committet i tx-en over) — kjør den delte
        // regelen og kast (ruller tx tilbake) hvis den brøt. Et halvt anvendt valg
        // som gjeninnfører overlappen er verre enn å avvise.
        const sluttKonflikt = finnTidsromKonflikt(
          forsonet.map((r) => ({ fraTid: r.fraTid, tilTid: r.tilTid })),
        );
        if (sluttKonflikt?.type === "overlapp") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Valget etterlater to overlappende tidsrom på dagsseddelen. Velg én side pr. tidsrom.",
          });
        }
        return forsonet;
      });
    }),

  // ----- Tillegg-vedlegg (kvittering) — Funn #2 --------------------------
  // Bilde-/kvittering-vedlegg på en tillegg-rad. Filen lastes opp via REST
  // /upload (lokal disk); denne prosedyren registrerer kun metadata. Eierskap
  // verifiseres via tillegg-radens egen dagsseddel (hentEgenDagsseddel).
  tilfoyTilleggVedlegg: protectedProcedure
    .input(
      z.object({
        // Klient-generert id (= lokal vedleggId) for idempotens + id-konsistens
        // mot mobil-cachen (hindrer duplikater ved pull). Valgfri for kompat.
        id: z.string().uuid().optional(),
        sheetTilleggId: z.string().uuid(),
        fileUrl: z.string(),
        fileName: z.string(),
        mimeType: z.string(),
        fileSize: z.number().int().min(0),
        gpsLat: z.number().nullable().optional(),
        gpsLng: z.number().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rad = await ctx.prismaTimer.sheetTillegg.findUnique({
        where: { id: input.sheetTilleggId },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });
      // Firma-grense: brukeren må eie dagsseddelen tillegg-raden ligger på.
      await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, rad.sheetId, { krevAnsatt: false });
      const data = {
        sheetTilleggId: input.sheetTilleggId,
        fileUrl: input.fileUrl,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        gpsLat: input.gpsLat ?? null,
        gpsLng: input.gpsLng ?? null,
      };
      // Idempotent upsert på klient-id (re-sync av samme vedlegg → ingen duplikat).
      // F4-1d: touchSedel så mobil pull ser vedlegget (pull synk-er vedlegg per
      // tillegg-rad). rad.sheetId er sedelen vedlegget hører til.
      if (input.id) {
        const [vedlegg] = await ctx.prismaTimer.$transaction([
          ctx.prismaTimer.sheetTilleggVedlegg.upsert({
            where: { id: input.id },
            create: { id: input.id, ...data },
            update: { fileUrl: input.fileUrl },
          }),
          touchSedel(ctx.prismaTimer, rad.sheetId),
        ]);
        return vedlegg;
      }
      const [vedlegg] = await ctx.prismaTimer.$transaction([
        ctx.prismaTimer.sheetTilleggVedlegg.create({ data }),
        touchSedel(ctx.prismaTimer, rad.sheetId),
      ]);
      return vedlegg;
    }),

  listTilleggVedlegg: protectedProcedure
    .input(z.object({ sheetId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Eierskap via egen dagsseddel. Returnerer alle vedlegg for sedlens
      // tillegg-rader (fileUrl = /uploads/...; aldri rå lagrings-nøkler).
      await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, input.sheetId, { krevAnsatt: false });
      const rader = await ctx.prismaTimer.sheetTillegg.findMany({
        where: { sheetId: input.sheetId },
        select: { id: true },
      });
      if (rader.length === 0) return [];
      const vedlegg = await ctx.prismaTimer.sheetTilleggVedlegg.findMany({
        where: { sheetTilleggId: { in: rader.map((r) => r.id) } },
        orderBy: { createdAt: "asc" },
      });
      // Web viser fra svaret → signer privat-URL-er (målrettet signering).
      return vedlegg.map((v) => ({ ...v, fileUrl: signerHvisPrivat(v.fileUrl) ?? v.fileUrl }));
    }),

  // M1 (S1 Fase 1): record-nøklet sign-query for én timer-kvittering.
  // Sensitive vedlegg bor under /uploads/privat/ og serveres signatur-KUN, så
  // mobil (naken <Image>, ingen cookie) trenger en signert URL for visning etter
  // at den lokale filen er slettet. Authz via samme eierskaps-sjekk som resten;
  // den rå /uploads/privat-URL-en signeres sentralt i tRPC-svaret.
  signerTilleggVedlegg: protectedProcedure
    .input(z.object({ vedleggId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const vedlegg = await ctx.prismaTimer.sheetTilleggVedlegg.findUnique({
        where: { id: input.vedleggId },
        select: { fileUrl: true, sheetTilleggId: true },
      });
      if (!vedlegg) throw new TRPCError({ code: "NOT_FOUND" });
      const rad = await ctx.prismaTimer.sheetTillegg.findUnique({
        where: { id: vedlegg.sheetTilleggId },
        select: { sheetId: true },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });
      // Eierskaps-/firma-authz (kaster FORBIDDEN ellers).
      await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, rad.sheetId, { krevAnsatt: false });
      // M1: signer på stedet (mobil viser umiddelbart, persisterer ikke denne).
      return { url: signerHvisPrivat(vedlegg.fileUrl) ?? vedlegg.fileUrl };
    }),

  fjernTilleggVedlegg: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const vedlegg = await ctx.prismaTimer.sheetTilleggVedlegg.findUnique({
        where: { id: input.id },
      });
      if (!vedlegg) throw new TRPCError({ code: "NOT_FOUND" });
      const rad = await ctx.prismaTimer.sheetTillegg.findUnique({
        where: { id: vedlegg.sheetTilleggId },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });
      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, rad.sheetId, { krevAnsatt: false });
      if (!erRedigerbar(sheet.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Dagsseddel er låst (status: ${sheet.status})`,
        });
      }
      // F4-1d: rad-write + touchSedel atomisk (sheet = sedelen tillegg-raden ligger på).
      const [slettet] = await ctx.prismaTimer.$transaction([
        ctx.prismaTimer.sheetTilleggVedlegg.delete({
          where: { id: input.id },
        }),
        touchSedel(ctx.prismaTimer, sheet.id),
      ]);
      return slettet;
    }),

  // ----- Tillegg-rader ---------------------------------------------------
  tilfoyTilleggRad: protectedProcedure
    .input(
      z.object({
        sheetId: z.string().uuid(),
        projectId: z.string().uuid(),
        tilleggId: z.string().uuid(),
        antall: z.number().min(0),
        kommentar: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, input.sheetId);
      if (!erRedigerbar(sheet.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Dagsseddel er låst (status: ${sheet.status})`,
        });
      }
      // Funn 2 (modul-resolver): NYE rader krever aktiv Timer-firmatak. Redigering/
      // fjerning av eksisterende rader gates IKKE — arbeid i gang skal aldri låses.
      await krevTimerAktivert(sheet.organizationId);
      await sjekkAldersgrense(sheet.organizationId, sheet.status, sheet.dato);

      const tillegg = await ctx.prismaTimer.tillegg.findFirst({
        where: { id: input.tilleggId, organizationId: sheet.organizationId },
      });
      if (!tillegg) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tillegg finnes ikke i firmaets katalog",
        });
      }

      // F4-1d: rad-write + touchSedel atomisk.
      const [rad] = await ctx.prismaTimer.$transaction([
        ctx.prismaTimer.sheetTillegg.create({
          data: {
            sheetId: input.sheetId,
            projectId: input.projectId,
            tilleggId: input.tilleggId,
            antall: input.antall,
            kommentar: input.kommentar ?? null,
          },
        }),
        touchSedel(ctx.prismaTimer, input.sheetId),
      ]);
      return rad;
    }),

  oppdaterTilleggRad: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        tilleggId: z.string().uuid().optional(),
        antall: z.number().min(0).optional(),
        kommentar: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rad = await ctx.prismaTimer.sheetTillegg.findUnique({
        where: { id: input.id },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });

      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, rad.sheetId);
      if (!erRedigerbar(sheet.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Dagsseddel er låst (status: ${sheet.status})`,
        });
      }
      await sjekkAldersgrense(sheet.organizationId, sheet.status, sheet.dato);

      const data: Prisma.SheetTilleggUpdateInput = {};
      if (input.tilleggId !== undefined) {
        data.tillegg = { connect: { id: input.tilleggId } };
      }
      if (input.antall !== undefined) data.antall = input.antall;
      if (input.kommentar !== undefined) data.kommentar = input.kommentar;

      // F4-1d: rad-write + touchSedel atomisk.
      const [oppdatert] = await ctx.prismaTimer.$transaction([
        ctx.prismaTimer.sheetTillegg.update({
          where: { id: input.id },
          data,
        }),
        touchSedel(ctx.prismaTimer, rad.sheetId),
      ]);
      return oppdatert;
    }),

  fjernTilleggRad: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const rad = await ctx.prismaTimer.sheetTillegg.findUnique({
        where: { id: input.id },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });

      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, rad.sheetId);
      if (!erRedigerbar(sheet.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Dagsseddel er låst (status: ${sheet.status})`,
        });
      }

      // F4-1d: rad-write + touchSedel atomisk.
      const [slettet] = await ctx.prismaTimer.$transaction([
        ctx.prismaTimer.sheetTillegg.delete({ where: { id: input.id } }),
        touchSedel(ctx.prismaTimer, rad.sheetId),
      ]);
      return slettet;
    }),

  // ----- Utlegg-vedlegg (kvittering) — U3 (2026-08-08) -------------------
  // Speiler tillegg-vedlegg 1:1, men på sheet_utlegg_vedlegg. Eierskap via
  // utlegg-radens egen dagsseddel (hentEgenDagsseddel). Fil lastes opp via REST
  // /upload (privat disk); prosedyren registrerer kun metadata.
  tilfoyUtleggVedlegg: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        sheetUtleggId: z.string().uuid(),
        fileUrl: z.string(),
        fileName: z.string(),
        mimeType: z.string(),
        fileSize: z.number().int().min(0),
        gpsLat: z.number().nullable().optional(),
        gpsLng: z.number().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rad = await ctx.prismaTimer.sheetUtlegg.findUnique({
        where: { id: input.sheetUtleggId },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });
      await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, rad.sheetId, { krevAnsatt: false });
      const data = {
        sheetUtleggId: input.sheetUtleggId,
        fileUrl: input.fileUrl,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        gpsLat: input.gpsLat ?? null,
        gpsLng: input.gpsLng ?? null,
      };
      if (input.id) {
        const [vedlegg] = await ctx.prismaTimer.$transaction([
          ctx.prismaTimer.sheetUtleggVedlegg.upsert({
            where: { id: input.id },
            create: { id: input.id, ...data },
            update: { fileUrl: input.fileUrl },
          }),
          touchSedel(ctx.prismaTimer, rad.sheetId),
        ]);
        return vedlegg;
      }
      const [vedlegg] = await ctx.prismaTimer.$transaction([
        ctx.prismaTimer.sheetUtleggVedlegg.create({ data }),
        touchSedel(ctx.prismaTimer, rad.sheetId),
      ]);
      return vedlegg;
    }),

  listUtleggVedlegg: protectedProcedure
    .input(z.object({ sheetId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, input.sheetId, { krevAnsatt: false });
      const rader = await ctx.prismaTimer.sheetUtlegg.findMany({
        where: { sheetId: input.sheetId },
        select: { id: true },
      });
      if (rader.length === 0) return [];
      const vedlegg = await ctx.prismaTimer.sheetUtleggVedlegg.findMany({
        where: { sheetUtleggId: { in: rader.map((r) => r.id) } },
        orderBy: { createdAt: "asc" },
      });
      return vedlegg.map((v) => ({ ...v, fileUrl: signerHvisPrivat(v.fileUrl) ?? v.fileUrl }));
    }),

  signerUtleggVedlegg: protectedProcedure
    .input(z.object({ vedleggId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const vedlegg = await ctx.prismaTimer.sheetUtleggVedlegg.findUnique({
        where: { id: input.vedleggId },
        select: { fileUrl: true, sheetUtleggId: true },
      });
      if (!vedlegg) throw new TRPCError({ code: "NOT_FOUND" });
      const rad = await ctx.prismaTimer.sheetUtlegg.findUnique({
        where: { id: vedlegg.sheetUtleggId },
        select: { sheetId: true },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });
      await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, rad.sheetId, { krevAnsatt: false });
      return { url: signerHvisPrivat(vedlegg.fileUrl) ?? vedlegg.fileUrl };
    }),

  fjernUtleggVedlegg: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const vedlegg = await ctx.prismaTimer.sheetUtleggVedlegg.findUnique({
        where: { id: input.id },
      });
      if (!vedlegg) throw new TRPCError({ code: "NOT_FOUND" });
      const rad = await ctx.prismaTimer.sheetUtlegg.findUnique({
        where: { id: vedlegg.sheetUtleggId },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });
      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, rad.sheetId, { krevAnsatt: false });
      if (!erRedigerbar(sheet.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Dagsseddel er låst (status: ${sheet.status})`,
        });
      }
      const [slettet] = await ctx.prismaTimer.$transaction([
        ctx.prismaTimer.sheetUtleggVedlegg.delete({ where: { id: input.id } }),
        touchSedel(ctx.prismaTimer, sheet.id),
      ]);
      return slettet;
    }),

  // ----- Utlegg-rader (U3, ordningsmodell) -------------------------------
  // Ny bærer atskilt fra tillegg: beløp/kvittering per ExpenseCategory, med
  // utledet ordning (overstyring ?? firma-default) STEMPLET på raden ved insert.
  // Stempelet er immutabelt (ordningsbytte = korreksjon, ikke mutasjon) og er
  // integritetsbæreren CHECK-constrainten håndhever beløps-regelen mot.
  tilfoyUtleggRad: protectedProcedure
    .input(
      z.object({
        sheetId: z.string().uuid(),
        projectId: z.string().uuid(),
        expenseCategoryId: z.string().uuid(),
        // Nullable: 'fakturert' fører ingen beløp. Server utleder ordning og
        // håndhever beløps-regelen — klienten kan ikke overstyre den.
        belop: z.number().min(0).nullable().optional(),
        kommentar: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, input.sheetId);
      if (!erRedigerbar(sheet.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Dagsseddel er låst (status: ${sheet.status})`,
        });
      }
      // Funn 2 (modul-resolver): NYE rader krever aktiv Timer-firmatak. Redigering/
      // fjerning av eksisterende rader gates IKKE — arbeid i gang skal aldri låses.
      await krevTimerAktivert(sheet.organizationId);
      await sjekkAldersgrense(sheet.organizationId, sheet.status, sheet.dato);

      const kategori = await ctx.prismaTimer.expenseCategory.findFirst({
        where: { id: input.expenseCategoryId, organizationId: sheet.organizationId },
      });
      if (!kategori) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Utleggskategori finnes ikke i firmaets katalog",
        });
      }

      // Utled ordning: overstyring for DETTE prosjektet ?? firma-default.
      const overstyring = await ctx.prismaTimer.prosjektOrdningOverstyring.findFirst({
        where: { prosjektId: input.projectId, expenseCategoryId: input.expenseCategoryId },
      });
      const firmaDefault: UtleggOrdning = erGyldigOrdning(kategori.ordning)
        ? kategori.ordning
        : "utlegg";
      const prosjektOverstyring: UtleggOrdning | null =
        overstyring && erGyldigOrdning(overstyring.ordning) ? overstyring.ordning : null;
      const ordning = utledOrdning({ firmaDefault, prosjektOverstyring });

      // lonnstillegg-ordning bæres av SheetTillegg (lønnsart), ikke av SheetUtlegg.
      // En ExpenseCategory med lonnstillegg-ordning har ingen lønnsart-kobling i
      // U1-modellen — avvis heller enn å skrive en semantisk feil rad. (Named
      // oppfølger: «bro ExpenseCategory→lønnsart» — se timer.md.)
      if (!baeresAvSheetUtlegg(ordning)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Kategori med ordning «lønnstillegg» føres som lønnstillegg, ikke utlegg. Kontakt firma-administrator.",
        });
      }

      // Beløps-regel (app-speil av CHECK): 'fakturert' → ingen beløp; ellers påkrevd.
      let belop: number | null;
      if (krevesBelop(ordning)) {
        if (input.belop === null || input.belop === undefined || input.belop <= 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Beløp er påkrevd for denne ordningen",
          });
        }
        belop = input.belop;
      } else {
        // fakturert: beløp skal alltid være null (håndheves av CHECK).
        belop = null;
      }

      const [rad] = await ctx.prismaTimer.$transaction([
        ctx.prismaTimer.sheetUtlegg.create({
          data: {
            sheetId: input.sheetId,
            projectId: input.projectId,
            expenseCategoryId: input.expenseCategoryId,
            belop,
            kommentar: input.kommentar ?? null,
            ordningVedFoering: ordning,
          },
        }),
        touchSedel(ctx.prismaTimer, input.sheetId),
      ]);
      return rad;
    }),

  // Kun beløp (innenfor radens ordning) + kommentar er redigerbart. Kategori og
  // ordningVedFoering er IMMUTABLE — ordningsbytte = ny rad (korreksjon).
  oppdaterUtleggRad: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        belop: z.number().min(0).nullable().optional(),
        kommentar: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rad = await ctx.prismaTimer.sheetUtlegg.findUnique({
        where: { id: input.id },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });

      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, rad.sheetId);
      if (!erRedigerbar(sheet.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Dagsseddel er låst (status: ${sheet.status})`,
        });
      }
      await sjekkAldersgrense(sheet.organizationId, sheet.status, sheet.dato);

      const ordning: UtleggOrdning = erGyldigOrdning(rad.ordningVedFoering)
        ? rad.ordningVedFoering
        : "utlegg";

      const data: Prisma.SheetUtleggUpdateInput = {};
      if (input.belop !== undefined) {
        if (krevesBelop(ordning)) {
          if (input.belop === null || input.belop <= 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Beløp er påkrevd for denne ordningen",
            });
          }
          data.belop = input.belop;
        } else if (input.belop !== null) {
          // fakturert kan ikke få et beløp (CHECK ville uansett avvist).
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Denne ordningen fører ingen beløp",
          });
        }
      }
      if (input.kommentar !== undefined) data.kommentar = input.kommentar;

      const [oppdatert] = await ctx.prismaTimer.$transaction([
        ctx.prismaTimer.sheetUtlegg.update({ where: { id: input.id }, data }),
        touchSedel(ctx.prismaTimer, rad.sheetId),
      ]);
      return oppdatert;
    }),

  fjernUtleggRad: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const rad = await ctx.prismaTimer.sheetUtlegg.findUnique({
        where: { id: input.id },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });

      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, rad.sheetId);
      if (!erRedigerbar(sheet.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Dagsseddel er låst (status: ${sheet.status})`,
        });
      }

      const [slettet] = await ctx.prismaTimer.$transaction([
        ctx.prismaTimer.sheetUtlegg.delete({ where: { id: input.id } }),
        touchSedel(ctx.prismaTimer, rad.sheetId),
      ]);
      return slettet;
    }),

  // ----- Status-overgang -------------------------------------------------
  // draft → sent. Krever minst én timer-rad. Leder-attestering (sent → returned/accepted)
  // implementeres i Runde 1C.
  send: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, input.id, { krevAnsatt: false });

      if (sheet.status !== "draft" && sheet.status !== "returned") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Kan ikke sende dagsseddel med status «${sheet.status}»`,
        });
      }

      const antallTimerRader = await ctx.prismaTimer.sheetTimer.count({
        where: { sheetId: sheet.id },
      });
      if (antallTimerRader === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Dagsseddel må ha minst én timer-rad før den kan sendes",
        });
      }

      // Re-send etter returnering (2026-05-27): nullstill returnerte rader
      // til pending så leder kan attestere på nytt. Uten dette ville rader
      // med attestertStatus="returnert" blokkere attester-mutationen
      // («Kun rader med status «pending» kan attesteres»).
      //
      // Audit-felter (attestertAvUserId, attestertVed) nullstilles også —
      // permanent audit-spor hører hjemme i Activity-tabellen (T7-2b3),
      // ikke i status-feltene. Når raden senere attesteres, settes feltene
      // med nye verdier.
      if (sheet.status === "returned") {
        await ctx.prismaTimer.$transaction([
          ctx.prismaTimer.sheetTimer.updateMany({
            where: { sheetId: sheet.id, attestertStatus: "returnert" },
            data: {
              attestertStatus: "pending",
              attestertAvUserId: null,
              attestertVed: null,
            },
          }),
          ctx.prismaTimer.sheetTillegg.updateMany({
            where: { sheetId: sheet.id, attestertStatus: "returnert" },
            data: {
              attestertStatus: "pending",
              attestertAvUserId: null,
              attestertVed: null,
            },
          }),
          ctx.prismaTimer.sheetMachine.updateMany({
            where: { sheetId: sheet.id, attestertStatus: "returnert" },
            data: {
              attestertStatus: "pending",
              attestertAvUserId: null,
              attestertVed: null,
            },
          }),
        ]);
      }

      return ctx.prismaTimer.dailySheet.update({
        where: { id: sheet.id },
        data: { status: "sent" },
      });
    }),

  // Recall (UF-4, 2026-06-22): arbeider gjenåpner sin egen SENDTE (ikke godkjente)
  // dagsseddel for etter-registrering (f.eks. glemte maskintimer). sent → draft.
  // Guards: eier-only (hentEgenDagsseddel), KUN status="sent". "accepted" blokkeres
  // med tydelig melding (leder har godkjent → kontakt leder). draft/returned er alt
  // redigerbar → samme guard avviser.
  //
  // Vakt (2026-07-09, Kenneth): har leder attestert minst én rad, BLOKKERES
  // gjenåpning — arbeideren må be leder RETURNERE i stedet (attestertStatus=
  // "returnert" → status "returned", som er redigerbar). Ellers ville arbeideren
  // kastet lederens arbeid stille. Er ingen rad attestert, nullstilles rad-status
  // til pending (defensivt) og sedelen går til draft. Permanent audit-spor hører
  // hjemme i Activity-tabellen (T7-2b3). Leder-køen (status="sent") slipper
  // sedelen automatisk når status endres.
  gjenaapneDagsseddel: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, input.id, { krevAnsatt: false });

      // M4 (2026-07-10): distinkte koder for de tre avvisningene så klienten
      // kan mappe på e.data.code i stedet for delstreng på meldingen. Meldingene
      // er UENDRET (web-onError leser fortsatt e.message.includes("godkjent")).
      // accepted → CONFLICT, annen ikke-sent-status → BAD_REQUEST, attestert
      // rad → PRECONDITION_FAILED (under).
      if (sheet.status !== "sent") {
        if (sheet.status === "accepted") {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Dagsseddelen er allerede godkjent av leder — kontakt leder for endring",
          });
        }
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Kan ikke gjenåpne dagsseddel med status «${sheet.status}»`,
        });
      }

      // Attestert-vakt (2026-07-09): har leder attestert minst én rad, kan ikke
      // arbeideren gjenåpne selv — det ville kastet lederens arbeid uten varsel.
      // Han må be leder RETURNERE sedelen (retur-flyten setter attestertStatus=
      // "returnert" + status="returned", som er redigerbar).
      const [attTimer, attTillegg, attMaskin] = await ctx.prismaTimer.$transaction(
        [
          ctx.prismaTimer.sheetTimer.count({
            where: { sheetId: sheet.id, attestertStatus: "attestert" },
          }),
          ctx.prismaTimer.sheetTillegg.count({
            where: { sheetId: sheet.id, attestertStatus: "attestert" },
          }),
          ctx.prismaTimer.sheetMachine.count({
            where: { sheetId: sheet.id, attestertStatus: "attestert" },
          }),
        ],
      );
      if (attTimer + attTillegg + attMaskin > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Leder har alt attestert minst én rad — be leder returnere dagsseddelen for endring",
        });
      }

      await ctx.prismaTimer.$transaction([
        ctx.prismaTimer.sheetTimer.updateMany({
          where: { sheetId: sheet.id },
          data: {
            attestertStatus: "pending",
            attestertAvUserId: null,
            attestertVed: null,
          },
        }),
        ctx.prismaTimer.sheetTillegg.updateMany({
          where: { sheetId: sheet.id },
          data: {
            attestertStatus: "pending",
            attestertAvUserId: null,
            attestertVed: null,
          },
        }),
        ctx.prismaTimer.sheetMachine.updateMany({
          where: { sheetId: sheet.id },
          data: {
            attestertStatus: "pending",
            attestertAvUserId: null,
            attestertVed: null,
          },
        }),
      ]);

      return ctx.prismaTimer.dailySheet.update({
        where: { id: sheet.id },
        data: { status: "draft", attestertVed: null, attestertAvUserId: null },
      });
    }),

  // Slett egen dagsseddel — utkast (draft) ELLER returnert-og-ikke-attestert.
  // Kenneth-vedtak 2026-10-09 (2): en returnert dagsseddel (status="returned") som ennå
  // ikke er attestert (attestertVed IS NULL) kan slettes av eieren, som et utkast — den
  // skal uansett føres på nytt. Sendte, attesterte og eksporterte sedler kan IKKE slettes.
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, input.id, { krevAnsatt: false });
      const kanSlettes =
        sheet.status === "draft" ||
        (sheet.status === "returned" && sheet.attestertVed === null);
      if (!kanSlettes) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Bare utkast eller returnerte (ikke-attesterte) dagssedler kan slettes",
        });
      }
      // Cascade på sheetId-FK sletter SheetTimer + SheetTillegg automatisk
      return ctx.prismaTimer.dailySheet.delete({ where: { id: sheet.id } });
    }),

  // ============================================================================
  //  Leder-attestering (Runde 1C)
  // ============================================================================

  // Hent alle dagssedler med status=sent som innlogget bruker er leder for.
  // Brukes av leder-vy /dashbord/[prosjektId]/timer/attestering.
  hentTilAttestering: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await krevProsjektLeder(ctx.userId, input.projectId);

      const sedler = await ctx.prismaTimer.dailySheet.findMany({
        where: {
          // T.1 (2026-05-11): projectId ligger på rad — filtrer via timer-relasjon.
          timer: { some: { projectId: input.projectId } },
          status: "sent",
        },
        include: {
          aktivitet: { select: { id: true, navn: true, kode: true } },
          // ORDRE 2 STEG 1 (2026-08-20): filtrer ut "erstattet"-rader (audit-spor
          // fra rediger-mutasjoner). Uten dette dobbelttelles redigerte rader i
          // `totaltimer`/`antallRader` — en bug uavhengig av aggregat-designet
          // (samme filter som hentTilAttesteringFirma :2315).
          timer: { where: { attestertStatus: { not: "erstattet" } } },
          tillegg: { where: { attestertStatus: { not: "erstattet" } } },
        },
        orderBy: [{ dato: "asc" }, { createdAt: "asc" }],
      });

      // Berik med ansatt-navn (cross-package: må slå opp i kjernen-DB)
      const userIder = Array.from(new Set(sedler.map((s) => s.userId)));
      const brukere = await prisma.user.findMany({
        where: { id: { in: userIder } },
        select: { id: true, name: true, email: true },
      });
      const medlemmer = await prisma.organizationMember.findMany({
        where: { userId: { in: userIder } },
        select: { userId: true, ansattnummer: true },
      });
      const ansattnummerMap = new Map(medlemmer.map((m) => [m.userId, m.ansattnummer]));
      const brukerMap = new Map(
        brukere.map((b) => [b.id, { ...b, ansattnummer: ansattnummerMap.get(b.id) ?? null }]),
      );

      return sedler.map((s) => ({
        ...s,
        ansatt: brukerMap.get(s.userId) ?? null,
        totaltimer: s.timer.reduce((acc, t) => acc + Number(t.timer), 0),
        antallRader: s.timer.length + s.tillegg.length,
      }));
    }),

  // Boolean-flagg som sidebar/UI bruker for å gate Attestering-lenken.
  kanAttestere: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return erProsjektLeder(ctx.userId, input.projectId);
    }),

  // ============================================================================
  //  Firma-attestering (T7-2a) — sedler på tvers av prosjekter
  // ============================================================================
  //
  // Brukes av firma-admin-vy /dashbord/firma/timer/attestering.
  // Gjelder sedler med minst én rad knyttet til et prosjekt eid av firmaet
  // (primary- eller partner-rolle via ProjectOrganization).

  hentTilAttesteringFirma: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        // T7-4f-3: dato-range-filter for uke-navigasjon (valgfritt).
        // ISO-dato YYYY-MM-DD (start- og slutt-inklusive). Begge må gis sammen.
        fraOgMed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        tilOgMed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        // T7-5e: fane-filter på attestering-listen.
        // "sent" = venter på attestering (default, bakover-kompat).
        // "accepted" = ferdig attestert (read-only-visning).
        // ORDRE 2 STEG 1 (2026-08-20): tar nå ENTEN én status ELLER en liste
        // (multi-status i ett kall — aggregat-visningene trenger sent+accepted
        // for komplett uke). Enkelt-string beholdt → eksisterende web-kallere
        // (fane-filteret) er uendret.
        status: z
          .union([
            z.enum(["sent", "accepted"]),
            z.array(z.enum(["sent", "accepted"])).min(1),
          ])
          .optional()
          .default("sent"),
      }),
    )
    .query(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);

      const prosjekter = await ctx.prisma.project.findMany({
        where: {
          projectOrganizations: {
            some: { organizationId: input.organizationId },
          },
        },
        select: { id: true, name: true, projectNumber: true, internalProjectNumber: true },
      });
      const prosjektIder = prosjekter.map((p) => p.id);
      if (prosjektIder.length === 0) return [];

      // T7-4f-3: dato-range-filter for uke-navigasjon. Bruker DateTime-instanser
      // med UTC for ren grense — DailySheet.dato lagres som timestamp.
      const datoFilter =
        input.fraOgMed && input.tilOgMed
          ? {
              gte: new Date(`${input.fraOgMed}T00:00:00.000Z`),
              lte: new Date(`${input.tilOgMed}T23:59:59.999Z`),
            }
          : undefined;

      // T7-2b1: delvis-attesterte sedler beholder sheet.status="sent" inntil ALLE
      // rader er attestert — eksisterende filter dekker dem. Inkluderer maskiner
      // og rad-status så klient kan vise fremdrift (X av Y attestert).
      // T7-5e: status-input styrer fane — "sent" venter, "accepted" attestert.
      // ORDRE 2 STEG 1: normaliser status til liste (union: én ELLER flere).
      const statuser = Array.isArray(input.status) ? input.status : [input.status];

      const sedler = await ctx.prismaTimer.dailySheet.findMany({
        where: {
          status: { in: statuser },
          timer: { some: { projectId: { in: prosjektIder } } },
          ...(datoFilter ? { dato: datoFilter } : {}),
        },
        include: {
          aktivitet: { select: { id: true, navn: true, kode: true } },
          // Filtrer ut "erstattet"-rader (audit-spor fra rediger-mutasjoner).
          // Uten dette vises gamle rader sammen med erstatningene i listen.
          // ORDRE 2 STEG 1: lonnsart.overtidsnivaa lastes for backstop-avledningen
          // (beregnet vs. valgt overtid) — brukes kun til beregning, rører aldri
          // rad.lonnsartId.
          timer: {
            where: { attestertStatus: { not: "erstattet" } },
            include: { lonnsart: { select: { overtidsnivaa: true } } },
          },
          tillegg: { where: { attestertStatus: { not: "erstattet" } } },
          maskiner: { where: { attestertStatus: { not: "erstattet" } } },
          // Dagskortet viser «alt registrert den dagen» → utlegg med. `select`
          // (ikke `include`) → KUN beløp + kategorinavn i denne uke-scopede
          // firma-spørringen; henter IKKE kommentar (@db.Text), mvaSats,
          // ordningVedFoering, projectId eller timestamps unødig. Vedlegg er
          // UMULIG å dra med her: SheetUtleggVedlegg er svak FK uten @relation,
          // så Prisma har ingen relasjon å traversere (sterkere enn å «la være»
          // — de kan uansett ikke lekke via denne spørringen). Vedlegg ses i
          // detaljen (private, signeres per URL). SheetUtlegg har ingen
          // attestertStatus (ingen rediger-erstatt-modell) → intet erstattet-filter.
          utlegg: {
            select: {
              id: true,
              belop: true,
              expenseCategory: { select: { navn: true } },
            },
          },
        },
        orderBy: [{ dato: "asc" }, { createdAt: "asc" }],
      });

      // Berik med ansatt-info (cross-package til kjernen-DB)
      const userIder = Array.from(new Set(sedler.map((s) => s.userId)));

      // T7-4f-1: per-rad project-join — rader kan peke til andre prosjekt-IDer
      // enn firma-eide (cross-project shift). Batch alle unike på tvers av
      // timer/tillegg/maskiner i én findMany.
      const radProjectIder = new Set<string>();
      for (const s of sedler) {
        for (const r of s.timer) radProjectIder.add(r.projectId);
        for (const r of s.tillegg) radProjectIder.add(r.projectId);
        for (const r of s.maskiner) radProjectIder.add(r.projectId);
      }

      const [brukere, medlemmer, ekstraProsjekter, orgSetting] = await Promise.all([
        prisma.user.findMany({
          where: { id: { in: userIder } },
          select: { id: true, name: true, email: true },
        }),
        prisma.organizationMember.findMany({
          where: { userId: { in: userIder }, organizationId: input.organizationId },
          // T7-4f-3: avdelingId for avdeling-filter-pill på klient
          select: { userId: true, ansattnummer: true, avdelingId: true },
        }),
        radProjectIder.size > 0
          ? prisma.project.findMany({
              where: { id: { in: Array.from(radProjectIder) } },
              select: { id: true, name: true, projectNumber: true, internalProjectNumber: true },
            })
          : Promise.resolve([]),
        prisma.organizationSetting.findUnique({
          where: { organizationId: input.organizationId },
          select: { dagsnorm: true, tillattRedigerVedAttestering: true },
        }),
      ]);

      const ansattnummerMap = new Map(medlemmer.map((m) => [m.userId, m.ansattnummer]));
      const avdelingIdMap = new Map(medlemmer.map((m) => [m.userId, m.avdelingId]));
      const brukerMap = new Map(
        brukere.map((b) => [
          b.id,
          {
            ...b,
            ansattnummer: ansattnummerMap.get(b.id) ?? null,
            avdelingId: avdelingIdMap.get(b.id) ?? null,
          },
        ]),
      );
      // Slå sammen firma-prosjekter (sedel-hode) + rad-prosjekter (alle unike).
      const prosjektMap = new Map<
        string,
        { id: string; name: string; projectNumber: string | null; internalProjectNumber: string | null }
      >();
      for (const p of prosjekter) prosjektMap.set(p.id, p);
      for (const p of ekstraProsjekter) prosjektMap.set(p.id, p);

      // Fallback til Prisma-default hvis settings-rad ikke finnes for firmaet.
      const dagsnorm = orgSetting ? Number(orgSetting.dagsnorm) : 7.5;
      const redigerTillatt = orgSetting?.tillattRedigerVedAttestering ?? false;

      // T.11: avledet (live) sertifikat-flagg for leder-synlighet. Kun sedler
      // med maskin-rader er relevante — batch ett oppslag for deres eiere.
      const maskinUserIder = Array.from(
        new Set(
          sedler.filter((s) => s.maskiner.length > 0).map((s) => s.userId),
        ),
      );
      const maskinforerbevisMap = await harGyldigMaskinforerbevisBatch(
        maskinUserIder,
        input.organizationId,
      );

      // ORDRE 2 STEG 1 — backstop som LESE-avledning: server beregner
      // klassifisering (beregnet vs. valgt overtid) per sedel on-the-fly fra
      // radenes timer + EFFEKTIV dagsnorm (sommertid-bevisst, ikke flat
      // orgSetting.dagsnorm). Rører ALDRI rad.lonnsartId.
      //
      // ORDRE 2 STEG 2 — ukenorm per sedel (D3 per-ansatt-visningens norm-
      // kolonne). Batch effektiv dagsnorm for (a) hver sedels dato og (b) alle
      // fem arbeidsdager i hver representerte uke, så beregnUkenorm får hele
      // uken (overgangsuker/helligdager stemmer også for dager uten sedel).
      const unikeUker = Array.from(new Set(sedler.map((s) => mandagIso(s.dato))));
      const datoBehov = new Set<string>();
      for (const s of sedler) datoBehov.add(s.dato.toISOString().slice(0, 10));
      for (const uke of unikeUker) {
        for (let i = 0; i < 5; i++) datoBehov.add(leggTilDagerIso(uke, i));
      }
      const effektivDagsnormMap = new Map<string, number>();
      await Promise.all(
        Array.from(datoBehov).map(async (iso) => {
          const eff = await hentEffektivArbeidstid(
            input.organizationId,
            new Date(`${iso}T00:00:00.000Z`),
          );
          effektivDagsnormMap.set(iso, eff.dagsnorm);
        }),
      );
      const ukenormMap = new Map<string, number>();
      for (const uke of unikeUker) {
        ukenormMap.set(
          uke,
          beregnUkenorm(uke, (iso) => effektivDagsnormMap.get(iso) ?? 0).norm,
        );
      }

      return sedler.map((s) => {
        const projectId = s.timer[0]?.projectId ?? null;
        const isoDato = s.dato.toISOString().slice(0, 10);
        const overtidsgrunnlag: Overtidsgrunnlag = beregnOvertidsgrunnlag(
          s.timer.map((r) => ({
            timer: Number(r.timer),
            overtidsnivaa: r.lonnsart?.overtidsnivaa ?? null,
            // V1: reise holdes utenfor overtidsgrunnlaget.
            erReise: r.erReise,
          })),
          effektivDagsnormMap.get(isoDato) ?? 0,
        );
        const ukenorm = ukenormMap.get(mandagIso(s.dato)) ?? 0;
        const timerMedProsjekt = s.timer.map((r) => ({
          ...r,
          project: prosjektMap.get(r.projectId) ?? null,
        }));
        const tilleggMedProsjekt = s.tillegg.map((r) => ({
          ...r,
          project: prosjektMap.get(r.projectId) ?? null,
        }));
        const maskinerMedProsjekt = s.maskiner.map((r) => ({
          ...r,
          project: prosjektMap.get(r.projectId) ?? null,
        }));
        return {
          ...s,
          timer: timerMedProsjekt,
          tillegg: tilleggMedProsjekt,
          maskiner: maskinerMedProsjekt,
          ansatt: brukerMap.get(s.userId) ?? null,
          prosjekt: projectId ? (prosjektMap.get(projectId) ?? null) : null,
          totaltimer: s.timer.reduce((acc, t) => acc + Number(t.timer), 0),
          // C4 (V1): del totalen i arbeid vs. reise — attestanten ser reise som
          // en egen størrelse, aldri blandet inn i overtidsgrunnlaget. Tallene
          // kommer fra samme beregning som overtidsgrunnlaget (reise ekskludert).
          arbeidstimer: overtidsgrunnlag.arbeidstimer,
          reisetimer: overtidsgrunnlag.reisetimer,
          antallRader: s.timer.length + s.tillegg.length,
          tilleggHarKrav: s.tillegg.length > 0,
          // B6 v3 (H22): sedelens norm fra servicen pr. dato (sommertid +
          // normKilde), ikke den flate kolonnen. Flat `dagsnorm` er kun fallback.
          dagsnorm: effektivDagsnormMap.get(isoDato) ?? dagsnorm,
          redigerTillatt,
          // ORDRE 2 STEG 1: beregnet vs. valgt overtid (dag-nivå) — attestanten
          // ser avvik, systemet retter aldri lonnsartId. Uke-nivå-varselet (D2)
          // bygges i STEG 3 oppå denne.
          overtidsgrunnlag,
          // ORDRE 2 STEG 2: ukenorm for sedelens uke (D3 per-ansatt norm-kolonne).
          ukenorm,
          // T.11: true når sedel har maskinarbeid og eier mangler gyldig bevis.
          manglerMaskinforerbevis:
            s.maskiner.length > 0 && !maskinforerbevisMap.get(s.userId),
        };
      });
    }),

  // Sidebar-gating for firma-attesterings-fanen.
  kanAttestereFirma: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        await autoriserAdminForFirma(ctx.userId, input.organizationId);
        return { kanAttestere: true };
      } catch {
        return { kanAttestere: false };
      }
    }),

  // Hent én dagsseddel som prosjektleder (for attestering-detaljside).
  // Skiller seg fra hentMedId ved at den autoriserer på krevProsjektLeder
  // (ProjectMember.role="admin" eller kanAttestere=true) i stedet for
  // eierskap. Beriker med ansatt-info fra kjernen.
  hentForAttestering: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const sheet = await ctx.prismaTimer.dailySheet.findUnique({
        where: { id: input.id },
      });
      if (!sheet) throw new TRPCError({ code: "NOT_FOUND" });

      // T.1 (2026-05-11): Hent rader først for å få projectId (per rad-nivå).
      // Bruker første rad som proxy for autorisering (PR 2A — full per-rad-auth
      // kommer i senere PR per T.3).
      const [timer, tillegg, maskiner, forslag] = await Promise.all([
        // Filtrer ut "erstattet"-rader (audit-spor fra rediger-mutasjoner).
        ctx.prismaTimer.sheetTimer.findMany({
          where: { sheetId: sheet.id, attestertStatus: { not: "erstattet" } },
          orderBy: { createdAt: "asc" },
        }),
        ctx.prismaTimer.sheetTillegg.findMany({
          where: { sheetId: sheet.id, attestertStatus: { not: "erstattet" } },
          orderBy: { createdAt: "asc" },
        }),
        ctx.prismaTimer.sheetMachine.findMany({
          where: { sheetId: sheet.id, attestertStatus: { not: "erstattet" } },
          orderBy: { createdAt: "asc" },
        }),
        // V19 (A-7, C-2): forslaget LESES av attestanten — vist side om side med
        // radene, men ALDRI valgt eller attestert (V19.5). Attester-knappen er
        // blokkert av konfliktVentendeSiden (fra ...sheet). Andre av KUN to
        // forslags-lesere (M15).
        ctx.prismaTimer.sheetTimerForslag.findMany({
          where: { sheetId: sheet.id },
          orderBy: { mottattAt: "asc" },
        }),
      ]);
      const projectId =
        timer[0]?.projectId ?? maskiner[0]?.projectId ?? tillegg[0]?.projectId;
      if (!projectId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Dagsseddel har ingen rader — kan ikke autorisere",
        });
      }
      // T7-2b1 (2026-05-14): prosjektleder-auth som primær, firma-admin-fallback
      // slik at firma-admin-detalj-siden også kan bruke samme query.
      try {
        await krevProsjektLeder(ctx.userId, projectId);
      } catch {
        await autoriserAdminForFirma(ctx.userId, sheet.organizationId);
      }

      // T7-2d (2026-05-16): Per-rad prosjekt-join. SheetTimer/Tillegg/Machine
      // har "svak FK" til Project (A.20 — ingen Prisma @relation pga cross-package).
      // Vi bygger app-layer-join: hent alle unike projectIds, lookup i én query,
      // legg på rad som rad.project = { id, name, projectNumber }.
      const alleProjectIds = Array.from(
        new Set([
          ...timer.map((r) => r.projectId),
          ...tillegg.map((r) => r.projectId),
          ...maskiner.map((r) => r.projectId),
        ]),
      );

      const [aktivitet, prosjekt, prosjekterPerRad, brukerData, ansattMedlem, orgSetting] =
        await Promise.all([
          sheet.aktivitetId
            ? ctx.prismaTimer.aktivitet.findUnique({
                where: { id: sheet.aktivitetId },
              })
            : Promise.resolve(null),
          ctx.prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true, name: true, projectNumber: true, internalProjectNumber: true },
          }),
          // T7-2d: per-rad prosjekt-lookup
          alleProjectIds.length > 0
            ? ctx.prisma.project.findMany({
                where: { id: { in: alleProjectIds } },
                select: { id: true, name: true, projectNumber: true, internalProjectNumber: true },
              })
            : Promise.resolve([]),
          prisma.user.findUnique({
            where: { id: sheet.userId },
            select: { id: true, name: true, email: true },
          }),
          prisma.organizationMember.findUnique({
            where: {
              userId_organizationId: {
                userId: sheet.userId,
                organizationId: sheet.organizationId,
              },
            },
            select: { ansattnummer: true },
          }),
          // T7-2b2: hent firmaets flagg for å gate Rediger-knapp i UI.
          // Slice 4b-2: + arbeidstidVarselTimer for arbeidstids-varsel-badge.
          prisma.organizationSetting.findUnique({
            where: { organizationId: sheet.organizationId },
            select: {
              tillattRedigerVedAttestering: true,
              arbeidstidVarselTimer: true,
            },
          }),
        ]);

      // T7-2d: bygg map og berik radene
      const prosjektMap = new Map(prosjekterPerRad.map((p) => [p.id, p]));
      const timerMedProsjekt = timer.map((r) => ({
        ...r,
        project: prosjektMap.get(r.projectId) ?? null,
      }));
      const tilleggMedProsjekt = tillegg.map((r) => ({
        ...r,
        project: prosjektMap.get(r.projectId) ?? null,
      }));
      const maskinerMedProsjekt = maskiner.map((r) => ({
        ...r,
        project: prosjektMap.get(r.projectId) ?? null,
      }));

      const ansatt = brukerData
        ? { ...brukerData, ansattnummer: ansattMedlem?.ansattnummer ?? null }
        : null;
      const redigerTillatt = orgSetting?.tillattRedigerVedAttestering ?? false;

      // T.11: live sertifikat-status for seddel-eier (kun relevant ved
      // maskin-rader). Flagg for leder-synlighet — aldri blokkerende.
      const manglerMaskinforerbevis =
        maskiner.length > 0 &&
        !(await harGyldigMaskinforerbevis(sheet.userId, sheet.organizationId));

      // ORDRE 2 STEG 3 ledd 2 (D2): uke-overtidsgrunnlag for detalj-banneret.
      // Kilde-regel (uendret fra STEG 1): attestert sedel leser FROSSET snapshot
      // (tallene som gjaldt ved attestering, ikke live omregning); uattestert
      // beregnes live så banneret speiler nåtilstand. Fallback til live når en
      // gammel snapshot mangler grunnlaget (attestert før STEG 1 fantes).
      let ukeOvertidsgrunnlag: Overtidsgrunnlag | null = null;
      if (sheet.status === "accepted") {
        const snap = timer.find((r) => r.attestertSnapshot)?.attestertSnapshot;
        ukeOvertidsgrunnlag = lesOvertidsgrunnlagFraSnapshot(snap);
      }
      if (!ukeOvertidsgrunnlag && sheet.organizationId) {
        ukeOvertidsgrunnlag = await byggUkeOvertidsgrunnlag(
          ctx.prismaTimer,
          sheet.organizationId,
          sheet.userId,
          sheet.dato,
        );
      }

      return {
        ...sheet,
        aktivitet,
        timer: timerMedProsjekt,
        tillegg: tilleggMedProsjekt,
        maskiner: maskinerMedProsjekt,
        prosjekt,
        ansatt,
        redigerTillatt,
        // Slice 4b-2: terskel for arbeidstids-varsel-badge i attestering.
        arbeidstidVarselTimer: orgSetting?.arbeidstidVarselTimer ?? 13,
        // T.11: flagg for leder — maskinarbeid uten gyldig maskinførerbevis.
        manglerMaskinforerbevis,
        // ORDRE 2 STEG 3 ledd 2: uke-nivå overtidsgrunnlag (norm/ord/overtid)
        // for D2-banneret. null når org mangler eller ingen rader.
        ukeOvertidsgrunnlag,
        // V19 (A-7/C-2): forslaget lederen SER (ikke velger) + konfliktVentendeSiden
        // (fra ...sheet) som blokkerer attester-knappen. Tomt når ingen overlapp.
        forslag,
      };
    }),

  // Flytt ECO på en timer-rad (Steg 4a 2026-05-03). Lederen kan endre
  // kostnadsbærer (externalCostObjectId) på en innsendt sedel før attestering.
  // Kun ECO-feltet kan endres — øvrige felter (timer/lønnsart/aktivitet)
  // er ansattens domene og endres ved retur. Etter attestering låser
  // snapshot-pattern (A.7) verdien permanent.
  flyttTimerRadEco: protectedProcedure
    .input(
      z.object({
        timerRadId: z.string().uuid(),
        externalCostObjectId: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rad = await ctx.prismaTimer.sheetTimer.findUnique({
        where: { id: input.timerRadId },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });

      const sheet = await ctx.prismaTimer.dailySheet.findUnique({
        where: { id: rad.sheetId },
      });
      if (!sheet) throw new TRPCError({ code: "NOT_FOUND" });

      // T.1 (2026-05-11): projectId ligger på rad — bruk rad.projectId
      // for auth og ECO-validering.
      await krevProsjektLeder(ctx.userId, rad.projectId);

      // Status-vakt: kun "sent" tillates. "returned" er hos ansatten,
      // "accepted" er låst av snapshot, "draft" har aldri vært innom leder.
      if (sheet.status !== "sent") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Kan kun flytte ECO på innsendte sedler (status: ${sheet.status})`,
        });
      }

      // ECO-validering hvis ikke null — finnes, samme firma+prosjekt,
      // status=aktiv, åpen for timer-registrering
      if (input.externalCostObjectId !== null) {
        const eco = await prisma.externalCostObject.findUnique({
          where: { id: input.externalCostObjectId },
        });
        if (!eco || eco.slettetVed !== null) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Underprosjektet finnes ikke",
          });
        }
        if (eco.organizationId !== sheet.organizationId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Underprosjektet tilhører ikke firmaet",
          });
        }
        if (eco.projectId !== rad.projectId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Underprosjektet tilhører ikke samme prosjekt",
          });
        }
        if (eco.status !== "aktiv" || !eco.timerregistreringApen) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Underprosjektet er ikke åpent for timer-registrering",
          });
        }
      }

      const fraEcoId = rad.externalCostObjectId;
      // F4-1d: rad-write + touchSedel atomisk.
      const [oppdatert] = await ctx.prismaTimer.$transaction([
        ctx.prismaTimer.sheetTimer.update({
          where: { id: input.timerRadId },
          data: { externalCostObjectId: input.externalCostObjectId },
        }),
        touchSedel(ctx.prismaTimer, rad.sheetId),
      ]);

      // Activity-log (best-effort — ikke blokker ved skrivefeil)
      try {
        await prisma.activity.create({
          data: {
            actorUserId: ctx.userId,
            organizationId: sheet.organizationId,
            projectId: rad.projectId,
            targetType: "sheet_timer",
            targetId: input.timerRadId,
            action: "timer.eco-flyttet",
            payload: {
              sheetId: sheet.id,
              fraEcoId,
              tilEcoId: input.externalCostObjectId,
            },
          },
        });
      } catch {
        // Ikke-blokkerende — selve flyttingen er allerede committed.
      }

      return oppdatert;
    }),

  // ============================================================================
  //  T7-2b1 — Per-rad-attestering (2026-05-14)
  //
  //  attesterRader / returnerRader er primær-mutations. attester / returner
  //  beholdes som thin wrappers for bakoverkompatibilitet (eldre mobil-app
  //  fortsetter å fungere) — fjernes ~1 uke etter klient-migrering.
  //
  //  Per-rad-status lever på SheetTimer/SheetTillegg/SheetMachine.attestertStatus
  //  ("pending" | "attestert" | "returnert"). Sedel-status på DailySheet.status
  //  er fortsatt arbeider-flyt-status ("draft" | "sent" | "returned" | "accepted").
  //  Sedel går til "accepted" først når ALLE rader er "attestert".
  // ============================================================================

  attesterRader: protectedProcedure
    .input(
      z.object({
        radIder: z.object({
          timerIder: z.array(z.string().uuid()).default([]),
          tilleggIder: z.array(z.string().uuid()).default([]),
          maskinIder: z.array(z.string().uuid()).default([]),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { timerIder, tilleggIder, maskinIder } = input.radIder;
      if (timerIder.length + tilleggIder.length + maskinIder.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ingen rader valgt for attestering",
        });
      }

      const [timerRader, tilleggRader, maskinRader] = await Promise.all([
        ctx.prismaTimer.sheetTimer.findMany({
          where: { id: { in: timerIder } },
          include: { lonnsart: true, aktivitet: true },
        }),
        ctx.prismaTimer.sheetTillegg.findMany({
          where: { id: { in: tilleggIder } },
          include: { tillegg: true },
        }),
        ctx.prismaTimer.sheetMachine.findMany({
          where: { id: { in: maskinIder } },
        }),
      ]);

      if (
        timerRader.length !== timerIder.length ||
        tilleggRader.length !== tilleggIder.length ||
        maskinRader.length !== maskinIder.length
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Én eller flere rader finnes ikke",
        });
      }

      const alle = [
        ...timerRader.map((r) => ({ sheetId: r.sheetId, projectId: r.projectId, attestertStatus: r.attestertStatus })),
        ...tilleggRader.map((r) => ({ sheetId: r.sheetId, projectId: r.projectId, attestertStatus: r.attestertStatus })),
        ...maskinRader.map((r) => ({ sheetId: r.sheetId, projectId: r.projectId, attestertStatus: r.attestertStatus })),
      ];

      if (alle.some((r) => r.attestertStatus !== "pending")) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Kun rader med status «pending» kan attesteres",
        });
      }

      // Auth: én sjekk per unike projectId
      const uniqueProjectIds = Array.from(new Set(alle.map((r) => r.projectId)));
      await Promise.all(uniqueProjectIds.map((pid) => krevProsjektLeder(ctx.userId, pid)));

      const naa = new Date();
      const uniqueSheetIds = Array.from(new Set(alle.map((r) => r.sheetId)));

      // V19.5 (A-4): attesteringen blokkeres mens en sedel har uavklart overlapp
      // (PC ↔ mobil). Gjelder også delvis rad-attestering — ingen del av en sedel
      // med ventende valg skal attesteres. Delt helper (samme i `attester`).
      await krevIngenUavklartOverlapp(ctx.prismaTimer, uniqueSheetIds);

      // ORDRE 2 STEG 1 — uke-nivå overtidsgrunnlag per sedel (etterprøvbart
      // snapshot). Cache per (bruker + uke) så samme uke ikke beregnes flere
      // ganger. sheetGrunnlag: sheetId → grunnlag (null hvis org mangler).
      const sheetInfo = await ctx.prismaTimer.dailySheet.findMany({
        where: { id: { in: uniqueSheetIds } },
        select: { id: true, dato: true, userId: true, organizationId: true },
      });
      const ukeCache = new Map<string, Overtidsgrunnlag>();
      const sheetGrunnlag = new Map<string, Overtidsgrunnlag | null>();
      for (const sh of sheetInfo) {
        if (!sh.organizationId) {
          sheetGrunnlag.set(sh.id, null);
          continue;
        }
        const key = `${sh.userId}-${mandagIso(sh.dato)}`;
        let g = ukeCache.get(key);
        if (!g) {
          g = await byggUkeOvertidsgrunnlag(
            ctx.prismaTimer,
            sh.organizationId,
            sh.userId,
            sh.dato,
          );
          ukeCache.set(key, g);
        }
        sheetGrunnlag.set(sh.id, g);
      }

      // Bygg snapshot-operasjoner per rad (Fase 0 A.7)
      const operations = [
        ...timerRader.map((rad) =>
          ctx.prismaTimer.sheetTimer.update({
            where: { id: rad.id },
            data: {
              attestertStatus: "attestert",
              attestertAvUserId: ctx.userId,
              attestertVed: naa,
              attestertSnapshot: {
                lonnsartId: rad.lonnsart.id,
                kode: rad.lonnsart.kode,
                navn: rad.lonnsart.navn,
                type: rad.lonnsart.type,
                prisMotKunde: rad.lonnsart.prisMotKunde?.toString() ?? null,
                internkostnad: rad.lonnsart.internkostnad?.toString() ?? null,
                sats: rad.lonnsart.sats?.toString() ?? null,
                satsEnhet: rad.lonnsart.satsEnhet,
                aktivitetId: rad.aktivitet.id,
                aktivitetKode: rad.aktivitet.kode,
                aktivitetNavn: rad.aktivitet.navn,
                // ORDRE 2 STEG 1: etterprøvbart overtidsgrunnlag (uke-nivå).
                overtidsgrunnlag: (sheetGrunnlag.get(rad.sheetId) ?? null) as unknown as Prisma.InputJsonValue,
                attestertVed: naa.toISOString(),
              },
            },
          }),
        ),
        ...tilleggRader.map((rad) =>
          ctx.prismaTimer.sheetTillegg.update({
            where: { id: rad.id },
            data: {
              attestertStatus: "attestert",
              attestertAvUserId: ctx.userId,
              attestertVed: naa,
              attestertSnapshot: {
                tilleggId: rad.tillegg.id,
                kode: rad.tillegg.kode,
                navn: rad.tillegg.navn,
                type: rad.tillegg.type,
                prisMotKunde: rad.tillegg.prisMotKunde?.toString() ?? null,
                internkostnad: rad.tillegg.internkostnad?.toString() ?? null,
                attestertVed: naa.toISOString(),
              },
            },
          }),
        ),
        ...maskinRader.map((rad) =>
          ctx.prismaTimer.sheetMachine.update({
            where: { id: rad.id },
            data: {
              attestertStatus: "attestert",
              attestertAvUserId: ctx.userId,
              attestertVed: naa,
              attestertSnapshot: {
                vehicleId: rad.vehicleId,
                timer: rad.timer.toString(),
                mengde: rad.mengde !== null ? rad.mengde.toString() : null,
                enhet: rad.enhet,
                attestertVed: naa.toISOString(),
              },
            },
          }),
        ),
      ];

      await ctx.prismaTimer.$transaction(operations);

      // Post-transaction: marker sedler som "accepted" hvis alle rader er attestert
      for (const sheetId of uniqueSheetIds) {
        const [pendingT, pendingTL, pendingM] = await Promise.all([
          ctx.prismaTimer.sheetTimer.count({
            where: { sheetId, attestertStatus: { not: "attestert" } },
          }),
          ctx.prismaTimer.sheetTillegg.count({
            where: { sheetId, attestertStatus: { not: "attestert" } },
          }),
          ctx.prismaTimer.sheetMachine.count({
            where: { sheetId, attestertStatus: { not: "attestert" } },
          }),
        ]);
        if (pendingT + pendingTL + pendingM === 0) {
          await ctx.prismaTimer.dailySheet.update({
            where: { id: sheetId },
            data: {
              status: "accepted",
              attestertAvUserId: ctx.userId,
              attestertVed: naa,
            },
          });
        }
      }

      return { antallAttestert: alle.length, ferdigeSedler: uniqueSheetIds };
    }),

  returnerRader: protectedProcedure
    .input(
      z.object({
        radIder: z.object({
          timerIder: z.array(z.string().uuid()).default([]),
          tilleggIder: z.array(z.string().uuid()).default([]),
          maskinIder: z.array(z.string().uuid()).default([]),
        }),
        kommentar: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { timerIder, tilleggIder, maskinIder } = input.radIder;
      if (timerIder.length + tilleggIder.length + maskinIder.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ingen rader valgt for retur",
        });
      }

      const [timerRader, tilleggRader, maskinRader] = await Promise.all([
        ctx.prismaTimer.sheetTimer.findMany({
          where: { id: { in: timerIder } },
          select: { id: true, sheetId: true, projectId: true, attestertStatus: true },
        }),
        ctx.prismaTimer.sheetTillegg.findMany({
          where: { id: { in: tilleggIder } },
          select: { id: true, sheetId: true, projectId: true, attestertStatus: true },
        }),
        ctx.prismaTimer.sheetMachine.findMany({
          where: { id: { in: maskinIder } },
          select: { id: true, sheetId: true, projectId: true, attestertStatus: true },
        }),
      ]);

      if (
        timerRader.length !== timerIder.length ||
        tilleggRader.length !== tilleggIder.length ||
        maskinRader.length !== maskinIder.length
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Én eller flere rader finnes ikke",
        });
      }

      const alle = [...timerRader, ...tilleggRader, ...maskinRader];
      if (alle.some((r) => r.attestertStatus !== "pending")) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Kun rader med status «pending» kan returneres",
        });
      }

      const uniqueProjectIds = Array.from(new Set(alle.map((r) => r.projectId)));
      await Promise.all(uniqueProjectIds.map((pid) => krevProsjektLeder(ctx.userId, pid)));

      const naa = new Date();
      const uniqueSheetIds = Array.from(new Set(alle.map((r) => r.sheetId)));

      await ctx.prismaTimer.$transaction([
        ctx.prismaTimer.sheetTimer.updateMany({
          where: { id: { in: timerIder } },
          data: {
            attestertStatus: "returnert",
            attestertAvUserId: ctx.userId,
            attestertVed: naa,
          },
        }),
        ctx.prismaTimer.sheetTillegg.updateMany({
          where: { id: { in: tilleggIder } },
          data: {
            attestertStatus: "returnert",
            attestertAvUserId: ctx.userId,
            attestertVed: naa,
          },
        }),
        ctx.prismaTimer.sheetMachine.updateMany({
          where: { id: { in: maskinIder } },
          data: {
            attestertStatus: "returnert",
            attestertAvUserId: ctx.userId,
            attestertVed: naa,
          },
        }),
        // En returnert rad = sedelen må tilbake til arbeider for rettelse.
        // Pending-rader på samme sedel forblir pending — håndteres ved
        // re-attestering etter at arbeider sender på nytt.
        ctx.prismaTimer.dailySheet.updateMany({
          where: { id: { in: uniqueSheetIds } },
          data: {
            status: "returned",
            lederKommentar: input.kommentar.trim(),
          },
        }),
      ]);

      return { antallReturnert: alle.length, returnerSedler: uniqueSheetIds };
    }),

  // F4-2 (2026-07-11): leder angrer en fullført attestering. `attesterRader`
  // flipper sedelen til "accepted" når alle rader er attestert (:2112), og da
  // forsvinner attesterings-/retur-handlingene på web (gated på status "sent").
  // Denne mutasjonen er den rene inversen: reverser HELE attesteringen på
  // sedel-nivå → status "sent" (tilbake i leder-køen for ny vurdering), alle
  // rader tilbake til "pending". Adskilt fra rad-retur (`returnerRader`), som er
  // for delvis flyt UNDER attestering. Speiler auth (unike projectId +
  // krevProsjektLeder, som returnerRader) og rad-reset (som gjenaapneDagsseddel).
  gjenaapneAttestering: protectedProcedure
    .input(z.object({ sheetId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const sheet = await ctx.prismaTimer.dailySheet.findUnique({
        where: { id: input.sheetId },
      });
      if (!sheet) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Dagsseddelen finnes ikke" });
      }

      // Precondition: kun en fullført attestering kan gjenåpnes.
      if (sheet.status !== "accepted") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Kun godkjente dagssedler kan gjenåpnes (status: ${sheet.status})`,
        });
      }

      // Leder-auth: samme oppslag som returnerRader — unike projectId fra
      // sedelens rader, krevProsjektLeder på hver. En accepted-sedel har alltid
      // rader (ble accepted fordi alle ble attestert); tom sedel → kan ikke
      // autorisere (speiler hentForAttestering).
      const [timerRader, tilleggRader, maskinRader] = await Promise.all([
        ctx.prismaTimer.sheetTimer.findMany({
          where: { sheetId: sheet.id },
          select: { projectId: true },
        }),
        ctx.prismaTimer.sheetTillegg.findMany({
          where: { sheetId: sheet.id },
          select: { projectId: true },
        }),
        ctx.prismaTimer.sheetMachine.findMany({
          where: { sheetId: sheet.id },
          select: { projectId: true },
        }),
      ]);
      const uniqueProjectIds = Array.from(
        new Set(
          [...timerRader, ...tilleggRader, ...maskinRader].map((r) => r.projectId),
        ),
      );
      if (uniqueProjectIds.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Dagsseddel har ingen rader — kan ikke autorisere",
        });
      }
      await Promise.all(
        uniqueProjectIds.map((pid) => krevProsjektLeder(ctx.userId, pid)),
      );

      // Reverser attesteringen (samme rad-reset som gjenaapneDagsseddel): alle
      // rader → "pending", nullstill attestertAvUserId/attestertVed; sedel →
      // "sent" (tilbake i leder-køen), nullstill sedel-attestering.
      await ctx.prismaTimer.$transaction([
        ctx.prismaTimer.sheetTimer.updateMany({
          where: { sheetId: sheet.id },
          data: { attestertStatus: "pending", attestertAvUserId: null, attestertVed: null },
        }),
        ctx.prismaTimer.sheetTillegg.updateMany({
          where: { sheetId: sheet.id },
          data: { attestertStatus: "pending", attestertAvUserId: null, attestertVed: null },
        }),
        ctx.prismaTimer.sheetMachine.updateMany({
          where: { sheetId: sheet.id },
          data: { attestertStatus: "pending", attestertAvUserId: null, attestertVed: null },
        }),
        ctx.prismaTimer.dailySheet.update({
          where: { id: sheet.id },
          data: { status: "sent", attestertVed: null, attestertAvUserId: null },
        }),
      ]);

      return { sheetId: sheet.id, status: "sent" as const };
    }),

  // ============================================================================
  //  T7-2b2 — Firma-admin rediger-modus (2026-05-14)
  //
  //  Erstatter alle pending-rader på en sedel med ny rad-sett. Originaler
  //  markeres attestertStatus="erstattet" og beholdes for audit (parentRadId
  //  peker fra ny rad til original). Gates på
  //  OrganizationSetting.tillattRedigerVedAttestering (default false).
  //  Skriver Activity-rad for hver rediger-operasjon.
  // ============================================================================

  redigerSedelRader: protectedProcedure
    .input(
      z.object({
        sheetId: z.string().uuid(),
        // Pause-modell (vedtatt 2026-05-17): hvis begge satt, oppdater
        // DailySheet.pauseFra/pauseTil og deriv pauseMin fra differansen.
        // Hvis begge null, fjern pause-vinduet og sett pauseMin = 0.
        // Hvis undefined (ikke i payload), la pause-feltene være.
        pauseFra: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
          .nullable()
          .optional(),
        pauseTil: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
          .nullable()
          .optional(),
        nyeRader: z.object({
          timer: z.array(
            z.object({
              originalId: z.string().uuid().nullable(),
              projectId: z.string().uuid(),
              lonnsartId: z.string().uuid(),
              aktivitetId: z.string().uuid(),
              externalCostObjectId: z.string().uuid().nullable().optional(),
              byggeplassId: z.string().uuid().nullable().optional(),
              fraTid: z.string().nullable().optional(),
              tilTid: z.string().nullable().optional(),
              timer: z.number().positive(),
              // V20/PK3: radens matpause.
              pauseMin: z.number().int().min(0).optional(),
              // T.10: kostnadsbærer for maskinvedlikehold (svak FK → Equipment).
              vehicleId: z.string().uuid().nullable().optional(),
            }),
          ),
          tillegg: z.array(
            z.object({
              originalId: z.string().uuid().nullable(),
              projectId: z.string().uuid(),
              tilleggId: z.string().uuid(),
              antall: z.number().positive(),
              kommentar: z.string().nullable().optional(),
            }),
          ),
          maskin: z.array(
            z.object({
              originalId: z.string().uuid().nullable(),
              projectId: z.string().uuid(),
              externalCostObjectId: z.string().uuid().nullable().optional(),
              vehicleId: z.string().uuid(),
              byggeplassId: z.string().uuid().nullable().optional(),
              fraTid: z.string().nullable().optional(),
              tilTid: z.string().nullable().optional(),
              timer: z.number().positive(),
              mengde: z.number().nullable().optional(),
              enhet: z.string().nullable().optional(),
            }),
          ),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sheet = await ctx.prismaTimer.dailySheet.findUnique({
        where: { id: input.sheetId },
        select: {
          id: true,
          organizationId: true,
          status: true,
          userId: true,
          pauseMin: true,
          dato: true,
        },
      });
      if (!sheet) throw new TRPCError({ code: "NOT_FOUND" });

      // Auth: kun firma-admin kan redigere
      await autoriserAdminForFirma(ctx.userId, sheet.organizationId);

      // Gate: flagget må være på
      const setting = await ctx.prisma.organizationSetting.findUnique({
        where: { organizationId: sheet.organizationId },
        select: { tillattRedigerVedAttestering: true },
      });
      if (!setting?.tillattRedigerVedAttestering) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Rediger ved attestering er ikke tillatt for dette firmaet. Slå på i innstillinger.",
        });
      }

      if (sheet.status !== "sent") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Kun innsendte dagssedler kan redigeres (status: ${sheet.status})`,
        });
      }

      // Fase 1b: firma-grense på alle nye-rad projectIds (delt helper).
      await verifiserProsjekterTilhørerFirma(
        [
          ...input.nyeRader.timer.map((r) => r.projectId),
          ...input.nyeRader.tillegg.map((r) => r.projectId),
          ...input.nyeRader.maskin.map((r) => r.projectId),
        ],
        sheet.organizationId,
      );

      // §2.D: org-valider alle rad-vehicleId (maskin-kostnadsbærer) mot firmaets
      // maskinregister — timer-rad (nullable) + maskin-rad (påkrevd), samme
      // grense som de andre skrive-stiene. Dedup pr. unik ID.
      const redigerVehicleIder = Array.from(
        new Set(
          [
            ...input.nyeRader.timer.map((r) => r.vehicleId),
            ...input.nyeRader.maskin.map((r) => r.vehicleId),
          ].filter((v): v is string => !!v),
        ),
      );
      for (const vid of redigerVehicleIder) {
        await verifiserKjoretoyTilhørerFirma(vid, sheet.organizationId);
      }

      // Valider originalId hvis gitt: må finnes på sedelen og være pending.
      // T7-2c1: henter også full rad-data for audit-snapshot.
      const eksisterendeIder = {
        timer: new Set<string>(),
        tillegg: new Set<string>(),
        maskin: new Set<string>(),
      };
      const [eksTimer, eksTillegg, eksMaskin] = await Promise.all([
        ctx.prismaTimer.sheetTimer.findMany({
          where: { sheetId: sheet.id, attestertStatus: "pending" },
        }),
        ctx.prismaTimer.sheetTillegg.findMany({
          where: { sheetId: sheet.id, attestertStatus: "pending" },
        }),
        ctx.prismaTimer.sheetMachine.findMany({
          where: { sheetId: sheet.id, attestertStatus: "pending" },
        }),
      ]);
      eksTimer.forEach((r) => eksisterendeIder.timer.add(r.id));
      eksTillegg.forEach((r) => eksisterendeIder.tillegg.add(r.id));
      eksMaskin.forEach((r) => eksisterendeIder.maskin.add(r.id));

      for (const rad of input.nyeRader.timer) {
        if (rad.originalId && !eksisterendeIder.timer.has(rad.originalId)) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Timer-rad ${rad.originalId} finnes ikke som pending på sedelen`,
          });
        }
      }
      for (const rad of input.nyeRader.tillegg) {
        if (rad.originalId && !eksisterendeIder.tillegg.has(rad.originalId)) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Tillegg-rad ${rad.originalId} finnes ikke som pending på sedelen`,
          });
        }
      }
      for (const rad of input.nyeRader.maskin) {
        if (rad.originalId && !eksisterendeIder.maskin.has(rad.originalId)) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Maskin-rad ${rad.originalId} finnes ikke som pending på sedelen`,
          });
        }
      }

      // F-f (2026-07-13): fra/til-vakt på de nye TIMER-radene. redigerSedelRader
      // erstatter alle pending og poster hele timer-settet på nytt — men Zod har
      // fra/til nullable og manglet vakten de interaktive mutasjonene har. Samme
      // DELTE helper som syncBatch (`finnTidsromKonflikt`: fra<til + overlapp
      // innad i settet) + mangler-tid-vakt (gjenbruk fra validerSplittFelles,
      // ikke duplisert regel-logikk). Maskin/tillegg unntatt (som splitt).
      const manglerTid = input.nyeRader.timer.some(
        (r) => !r.fraTid || !r.tilTid,
      );
      if (manglerTid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Fra- og til-tid er påkrevd på timer-rader",
        });
      }
      const tidsromKonflikt = finnTidsromKonflikt(input.nyeRader.timer);
      if (tidsromKonflikt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            tidsromKonflikt.type === "fra_etter_til"
              ? `Til-tid må være etter fra-tid (${tidsromKonflikt.rad.fraTid}–${tidsromKonflikt.rad.tilTid}).`
              : `Tidsrommet ${tidsromKonflikt.rad.fraTid}–${tidsromKonflikt.rad.tilTid} overlapper ${tidsromKonflikt.annen.fraTid}–${tidsromKonflikt.annen.tilTid} på samme dagsseddel. Én arbeider kan ikke være to steder samtidig.`,
        });
      }

      // LAG 0a (H5): lønnsart-bevisst tak på de nye timer-radene. Dette er veien
      // som manglet taket helt (.positive(), intet maks, lastet ikke lønnsarten) —
      // en firma-admin kunne føre 25 timer her. Ett batch-oppslag på satsEnhet,
      // samme regel som de andre skrivestiene. Ukjent lønnsart → 24-tak.
      const redigerSatsEnhet = new Map<string, string | null>();
      if (input.nyeRader.timer.length > 0) {
        const redigerLonnsartIder = Array.from(
          new Set(input.nyeRader.timer.map((r) => r.lonnsartId)),
        );
        const redigerLonnsarter = await ctx.prismaTimer.lonnsart.findMany({
          where: {
            id: { in: redigerLonnsartIder },
            organizationId: sheet.organizationId,
          },
          select: { id: true, satsEnhet: true },
        });
        for (const l of redigerLonnsarter) redigerSatsEnhet.set(l.id, l.satsEnhet);
        for (const r of input.nyeRader.timer) {
          krevRadInnenforTak(r.timer, redigerSatsEnhet.get(r.lonnsartId));
        }
      }

      // V20/PK4a — vurder timetallet pr. timer-rad mot pause + vindu. Edit
      // erstatter hele det pending timer-settet, så vinduet (PK5) regnes fra de
      // nye radenes fraTid, og bæreren spores på tvers av settet (kun-én).
      const { pauseVindu: redigerPauseVindu, standardPauseMin: redigerStdPause } =
        await hentPauseVinduForSedel(
          sheet.organizationId,
          sheet.dato,
          input.nyeRader.timer.map((r) => ({ fraTid: r.fraTid })),
        );
      let redigerBaererTatt = false;
      const timerPause: number[] = [];
      for (const r of input.nyeRader.timer) {
        const v = vurderRadTimer({
          modus: "interaktiv",
          satsEnhet: redigerSatsEnhet.get(r.lonnsartId),
          fraTid: r.fraTid,
          tilTid: r.tilTid,
          timer: r.timer,
          pauseMinAngitt: r.pauseMin,
          pauseVindu: redigerPauseVindu,
          standardPauseMin: redigerStdPause,
          finnesAlleredeBaerer: redigerBaererTatt,
        });
        if (v.kast) {
          avvisTimerAvvik(
            r.fraTid ?? "",
            r.tilTid ?? "",
            r.timer,
            redigerPauseVindu,
            r.pauseMin ?? 0,
          );
        }
        if (v.pauseMin > 0) redigerBaererTatt = true;
        timerPause.push(v.pauseMin);
      }
      // PK6: hodet = Σ rad.pauseMin. Edit erstatter alle pending (MOVE til
      // historikk), så post-state Σ = Σ de nye radenes vurderte pause.
      const redigerSumPause = timerPause.reduce((s, p) => s + p, 0);

      const naa = new Date();
      const antallErstattet =
        eksTimer.length + eksTillegg.length + eksMaskin.length;

      // T7-4b: valider post-state FØR transaksjon. Post-state = ikke-erstattede
      // rader EKSKLUSIV de pending vi nå skal erstatte, PLUSS nyeRader.
      // (eksTimer/eksTillegg/eksMaskin hentes som pending; alle erstattes.)
      const eksisterendePendingTimerIder = new Set(eksTimer.map((r) => r.id));
      const eksisterendePendingMaskinIder = new Set(eksMaskin.map((r) => r.id));
      const baseline = await hentRaderForValidering(ctx.prismaTimer, sheet.id);
      const postTimer: ValiderRad[] = [
        ...baseline.timer.filter((r) => !eksisterendePendingTimerIder.has(r.id)),
        ...input.nyeRader.timer.map((r) => ({
          projectId: r.projectId,
          externalCostObjectId: r.externalCostObjectId ?? null,
          timer: r.timer,
        })),
      ];
      const postMaskin: ValiderRad[] = [
        ...baseline.maskin.filter((r) => !eksisterendePendingMaskinIder.has(r.id)),
        ...input.nyeRader.maskin.map((r) => ({
          projectId: r.projectId,
          externalCostObjectId: r.externalCostObjectId ?? null,
          timer: r.timer,
        })),
      ];
      // Pause-modell (2026-05-17): beregn pauseMin fra pauseFra/pauseTil.
      // Hvis begge undefined: ikke rør pause-feltene.
      // Hvis null eller delvis null: nullstill begge + pauseMin = 0.
      // Ellers: beregn minutter mellom HH:MM-tidspunktene.
      // V20/PK6: pauseFra/pauseTil er fortsatt vindu-kolonner (visning), men
      // hodet `pauseMin` er nå DERIVERT (Σ rad), ikke differansen av vinduet —
      // radens matpause er kilden. Validerer fortsatt at vinduet er gyldig.
      const paussFeltGitt =
        input.pauseFra !== undefined || input.pauseTil !== undefined;
      let pauseUpdate: {
        pauseFra: string | null;
        pauseTil: string | null;
      } | null = null;
      if (paussFeltGitt) {
        if (input.pauseFra && input.pauseTil) {
          const [fH = 0, fM = 0] = input.pauseFra.split(":").map(Number);
          const [tH = 0, tM = 0] = input.pauseTil.split(":").map(Number);
          const diff = tH * 60 + tM - (fH * 60 + fM);
          if (diff <= 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "pauseTil må være etter pauseFra",
            });
          }
          pauseUpdate = { pauseFra: input.pauseFra, pauseTil: input.pauseTil };
        } else {
          pauseUpdate = { pauseFra: null, pauseTil: null };
        }
      }

      // Pause-aware maskin-validering: hodet pauseMin = Σ rad (redigerSumPause).
      const effektivPauseMin = redigerSumPause;
      const brytt = validerMaskinUnderArbeid(postTimer, postMaskin, effektivPauseMin);
      if (brytt.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: await feilMeldingMaskinOverstiger(brytt),
        });
      }

      // LAG 2 (presisering 2): utled erReise for de nye rad-ene (firma-admin
      // rediger sender ikke flagget). Ett oppslag for alle arter i edit-settet.
      const redigerErReiseMap = await hentErReiseForLonnsarter(
        ctx.prismaTimer,
        sheet.organizationId,
        input.nyeRader.timer.map((r) => r.lonnsartId),
      );

      // Transaksjon: marker alle eksisterende pending som "erstattet" + opprett nye
      await ctx.prismaTimer.$transaction([
        // F4-1d: oppdater sedelen ALLTID (ikke bare ved pause-endring) — ellers
        // bumpes ikke updatedAt når leder kun redigerer rader, og de nye radene
        // blir usynlige for mobil inkrementell pull (updatedAt > sistSynk).
        ctx.prismaTimer.dailySheet.update({
          where: { id: sheet.id },
          // PK6: hodet pauseMin = Σ rad (derivert). pauseFra/pauseTil er vindu.
          data: { ...(pauseUpdate ?? {}), pauseMin: redigerSumPause, updatedAt: new Date() },
        }),
        // T7-2b-oppfølger (2026-07-13): MOVE de pending originalene til historikk
        // (INSERT snapshot) + SLETT dem fra hovedtabellene i SAMME transaksjon —
        // i stedet for å sette attestertStatus="erstattet" (som lekket ×N til
        // mobil-pull hentEndringerSiden). eksTimer/eksTillegg/eksMaskin er alt
        // hentet som fulle pending-rader over; snapshot-settet === slette-settet
        // (kun innleste id-er slettes, aldri noe utenfor).
        ctx.prismaTimer.sheetRadHistorikk.createMany({
          data: [
            ...eksTimer.map((r) => byggHistorikkPost("timer", r, ctx.userId, naa)),
            ...eksTillegg.map((r) =>
              byggHistorikkPost("tillegg", r, ctx.userId, naa),
            ),
            ...eksMaskin.map((r) =>
              byggHistorikkPost("maskin", r, ctx.userId, naa),
            ),
          ],
        }),
        ctx.prismaTimer.sheetTimer.deleteMany({
          where: { id: { in: eksTimer.map((r) => r.id) } },
        }),
        ctx.prismaTimer.sheetTillegg.deleteMany({
          where: { id: { in: eksTillegg.map((r) => r.id) } },
        }),
        ctx.prismaTimer.sheetMachine.deleteMany({
          where: { id: { in: eksMaskin.map((r) => r.id) } },
        }),
        ...input.nyeRader.timer.map((rad, i) =>
          ctx.prismaTimer.sheetTimer.create({
            data: {
              sheetId: sheet.id,
              lonnsartId: rad.lonnsartId,
              aktivitetId: rad.aktivitetId,
              projectId: rad.projectId,
              externalCostObjectId: rad.externalCostObjectId ?? null,
              byggeplassId: rad.byggeplassId ?? null,
              fraTid: rad.fraTid ?? null,
              tilTid: rad.tilTid ?? null,
              timer: rad.timer,
              // V20/PK1: radens vurderte matpause (bæreren).
              pauseMin: timerPause[i] ?? 0,
              vehicleId: rad.vehicleId ?? null,
              attestertStatus: "pending",
              parentRadId: rad.originalId,
              // LAG 2: utledet fra (ev. byttet) lønnsart.
              erReise: redigerErReiseMap.get(rad.lonnsartId) ?? false,
            },
          }),
        ),
        ...input.nyeRader.tillegg.map((rad) =>
          ctx.prismaTimer.sheetTillegg.create({
            data: {
              sheetId: sheet.id,
              tilleggId: rad.tilleggId,
              projectId: rad.projectId,
              antall: rad.antall,
              kommentar: rad.kommentar ?? null,
              attestertStatus: "pending",
              parentRadId: rad.originalId,
            },
          }),
        ),
        ...input.nyeRader.maskin.map((rad) =>
          ctx.prismaTimer.sheetMachine.create({
            data: {
              sheetId: sheet.id,
              vehicleId: rad.vehicleId,
              projectId: rad.projectId,
              externalCostObjectId: rad.externalCostObjectId ?? null,
              byggeplassId: rad.byggeplassId ?? null,
              fraTid: rad.fraTid ?? null,
              tilTid: rad.tilTid ?? null,
              timer: rad.timer,
              mengde: rad.mengde ?? null,
              enhet: rad.enhet ?? null,
              attestertStatus: "pending",
              parentRadId: rad.originalId,
            },
          }),
        ),
      ]);

      // Activity-log (etter transaksjonen — separat så feilet log ikke ruller back).
      // T7-2c1: payload utvidet med originalerSnapshot + nyeSnapshot for revisjons-spor.
      await prisma.activity.create({
        data: {
          actorUserId: ctx.userId,
          organizationId: sheet.organizationId,
          targetType: "DailySheet",
          targetId: sheet.id,
          action: "rediger_sedel_rader",
          payload: {
            antallErstattet,
            antallNyeTimer: input.nyeRader.timer.length,
            antallNyeTillegg: input.nyeRader.tillegg.length,
            antallNyeMaskin: input.nyeRader.maskin.length,
            sedelEier: sheet.userId,
            originalerSnapshot: {
              timer: eksTimer.map(snapshotTimer),
              tillegg: eksTillegg.map(snapshotTillegg),
              maskin: eksMaskin.map(snapshotMaskin),
            },
            nyeSnapshot: {
              timer: input.nyeRader.timer,
              tillegg: input.nyeRader.tillegg,
              maskin: input.nyeRader.maskin,
            },
          },
        },
      });

      return {
        antallErstattet,
        antallNyeTimer: input.nyeRader.timer.length,
        antallNyeTillegg: input.nyeRader.tillegg.length,
        antallNyeMaskin: input.nyeRader.maskin.length,
      };
    }),

  // ============================================================================
  //  T7-2c1 — Firma-admin splitter én pending rad (2026-05-16)
  //
  //  Erstatter én pending rad (timer/tillegg/maskin) med N nye rader. Sum
  //  av nye rader må === original (Math.abs(diff) < 0.001). Original
  //  markeres "erstattet", nye rader får parentRadId = original.id.
  //  Maskin: kun timer sum-valideres; mengde distribueres fritt.
  //  Gates på tillattRedigerVedAttestering. Skriver Activity-rad med
  //  originalSnapshot + nyeSnapshot.
  // ============================================================================

  splittRad: protectedProcedure
    .input(splittRadInput)
    .mutation(async ({ ctx, input }) => {
      // 1) Hent original rad ut fra radType
      const original =
        input.radType === "timer"
          ? await ctx.prismaTimer.sheetTimer.findUnique({ where: { id: input.radId } })
          : input.radType === "tillegg"
            ? await ctx.prismaTimer.sheetTillegg.findUnique({ where: { id: input.radId } })
            : await ctx.prismaTimer.sheetMachine.findUnique({ where: { id: input.radId } });
      if (!original) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `${input.radType}-rad ${input.radId} finnes ikke`,
        });
      }
      if (original.attestertStatus !== "pending") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Rad har status "${original.attestertStatus}" — kun pending kan splittes`,
        });
      }

      // 2) Hent sedel for auth + status-sjekk
      const sheet = await ctx.prismaTimer.dailySheet.findUnique({
        where: { id: original.sheetId },
        select: {
          id: true,
          organizationId: true,
          status: true,
          userId: true,
          pauseMin: true,
          dato: true,
        },
      });
      if (!sheet) throw new TRPCError({ code: "NOT_FOUND" });

      // 3) Auth: kun firma-admin
      await autoriserAdminForFirma(ctx.userId, sheet.organizationId);

      // 4) Gate: tillattRedigerVedAttestering må være på
      const setting = await ctx.prisma.organizationSetting.findUnique({
        where: { organizationId: sheet.organizationId },
        select: { tillattRedigerVedAttestering: true },
      });
      if (!setting?.tillattRedigerVedAttestering) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Rediger ved attestering er ikke tillatt for dette firmaet. Slå på i innstillinger.",
        });
      }

      // 5) Sedel-status
      if (sheet.status !== "sent") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Kun innsendte dagssedler kan splittes (status: ${sheet.status})`,
        });
      }

      // 6) Delt validerings-kjerne (P2, atferdsbevarende — flyttet fra steg
      //    6/6b/7 + maskin-kapasitet): firma-grense på nye projectId, org-
      //    validering av nye maskin-vehicleId, sum-validering, og maskin ≤
      //    arbeid post-state ved maskin-splitt.
      const originalSum =
        input.radType === "tillegg"
          ? Number((original as { antall: Prisma.Decimal }).antall)
          : Number((original as { timer: Prisma.Decimal }).timer);
      await validerSplittFelles(ctx.prismaTimer, input, sheet, {
        id: original.id,
        sum: originalSum,
      });

      // 8) Transaksjon: marker original "erstattet" + opprett nye med parentRadId
      const naa = new Date();
      if (input.radType === "timer") {
        // RETUR 1 (V20-S): er originalen bærer, flytt pausen til delraden som
        // krysser pausevinduet (PK5). Ikke bare re-utled hodet — da ville
        // delradenes timetall fortsatt bære fradraget skjult (P1).
        const originalPauseMin = (original as { pauseMin: number }).pauseMin;
        const andreRader = await ctx.prismaTimer.sheetTimer.findMany({
          where: {
            sheetId: sheet.id,
            attestertStatus: { not: "erstattet" },
            id: { not: original.id },
          },
          select: { fraTid: true },
        });
        const { pauseVindu } = await hentPauseVinduForSedel(
          sheet.organizationId,
          sheet.dato,
          [...andreRader, ...input.nyeRader],
        );
        const splittPause = fordelPauseVedSplitt(
          input.nyeRader,
          originalPauseMin,
          pauseVindu,
        );
        // Invariant (RETUR punkt 2): Σ delrad.pauseMin = originalens pauseMin.
        const sumPause = splittPause.reduce((s, p) => s + p, 0);
        if (sumPause !== originalPauseMin) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Splitt bevarte ikke pausen (original ${originalPauseMin}, fordelt ${sumPause})`,
          });
        }
        await ctx.prismaTimer.$transaction(async (tx) => {
          // T7-2b-oppfølger (2026-07-13): MOVE originalen til historikk (INSERT
          // snapshot) + slett fra hovedtabellen i SAMME tx — ikke status="erstattet".
          await tx.sheetRadHistorikk.createMany({
            data: [byggHistorikkPost("timer", original, ctx.userId, naa)],
          });
          await tx.sheetTimer.delete({ where: { id: original.id } });
          for (let i = 0; i < input.nyeRader.length; i++) {
            const rad = input.nyeRader[i]!;
            await tx.sheetTimer.create({
              data: {
                sheetId: sheet.id,
                lonnsartId: rad.lonnsartId,
                aktivitetId: rad.aktivitetId,
                projectId: rad.projectId,
                externalCostObjectId: rad.externalCostObjectId ?? null,
                byggeplassId: rad.byggeplassId ?? null,
                fraTid: rad.fraTid ?? null,
                tilTid: rad.tilTid ?? null,
                timer: rad.timer,
                // RETUR 1: bæreren flyttet til delraden i pausevinduet.
                pauseMin: splittPause[i] ?? 0,
                // T.10: split = samme arbeid → arv original-radens kostnadsbærer.
                // Allerede org-validert da originalen ble opprettet — ingen ny sjekk.
                vehicleId: (original as { vehicleId: string | null }).vehicleId ?? null,
                attestertStatus: "pending",
                parentRadId: original.id,
                // LAG 2: split = samme arbeid → arv hele reise-sporet (sporbarhet).
                ...arvReiseSpor(original as ReiseSporKilde),
              },
            });
          }
          // PK6: hodet = Σ rad etter splitten (bumper updatedAt).
          await synkroniserHodePause(tx, sheet.id);
        });
      } else if (input.radType === "tillegg") {
        await ctx.prismaTimer.$transaction([
          // T7-2b-oppfølger (2026-07-13): MOVE originalen til historikk + slett
          // fra hovedtabellen i SAMME tx — ikke status="erstattet".
          ctx.prismaTimer.sheetRadHistorikk.createMany({
            data: [byggHistorikkPost("tillegg", original, ctx.userId, naa)],
          }),
          ctx.prismaTimer.sheetTillegg.delete({ where: { id: original.id } }),
          ...input.nyeRader.map((rad) =>
            ctx.prismaTimer.sheetTillegg.create({
              data: {
                sheetId: sheet.id,
                tilleggId: rad.tilleggId,
                projectId: rad.projectId,
                antall: rad.antall,
                kommentar: rad.kommentar ?? null,
                attestertStatus: "pending",
                parentRadId: original.id,
              },
            }),
          ),
        ]);
      } else {
        // T7-4b maskin ≤ arbeid post-state er allerede validert i
        // validerSplittFelles (steg 6) — går rett på transaksjonen.
        await ctx.prismaTimer.$transaction([
          // T7-2b-oppfølger (2026-07-13): MOVE originalen til historikk + slett
          // fra hovedtabellen i SAMME tx — ikke status="erstattet".
          ctx.prismaTimer.sheetRadHistorikk.createMany({
            data: [byggHistorikkPost("maskin", original, ctx.userId, naa)],
          }),
          ctx.prismaTimer.sheetMachine.delete({ where: { id: original.id } }),
          ...input.nyeRader.map((rad) =>
            ctx.prismaTimer.sheetMachine.create({
              data: {
                sheetId: sheet.id,
                vehicleId: rad.vehicleId,
                projectId: rad.projectId,
                externalCostObjectId: rad.externalCostObjectId ?? null,
                byggeplassId: rad.byggeplassId ?? null,
                fraTid: rad.fraTid ?? null,
                tilTid: rad.tilTid ?? null,
                timer: rad.timer,
                mengde: rad.mengde ?? null,
                enhet: rad.enhet ?? null,
                attestertStatus: "pending",
                parentRadId: original.id,
              },
            }),
          ),
        ]);
      }

      // F4-1d: bump sedelens updatedAt så de nye split-radene når mobil pull.
      await touchSedel(ctx.prismaTimer, sheet.id);

      // 9) Activity-log med snapshots
      const originalSnapshot =
        input.radType === "timer"
          ? snapshotTimer(original as TimerRow)
          : input.radType === "tillegg"
            ? snapshotTillegg(original as TilleggRow)
            : snapshotMaskin(original as MaskinRow);
      await prisma.activity.create({
        data: {
          actorUserId: ctx.userId,
          organizationId: sheet.organizationId,
          targetType: "DailySheet",
          targetId: sheet.id,
          action: "splitt_rad",
          payload: {
            radType: input.radType,
            antallNye: input.nyeRader.length,
            sedelEier: sheet.userId,
            originalSnapshot,
            nyeSnapshot: input.nyeRader,
          },
        },
      });

      return {
        radType: input.radType,
        antallNye: input.nyeRader.length,
      };
    }),

  // ============================================================================
  //  splittRadEier — ARBEIDER splitter egen rad i draft/returned (P2).
  //  Autorisasjon: sheet.userId === ctx.userId (eier, ALDRI rolle-basert).
  //  Status: kun draft/returned — avvises server-side (ikke bare UI-skjuling).
  //  Semantikk: ren utkast-redigering — SLETT original + opprett N plain rader
  //  (ingen erstattet/parentRadId/Activity; en draft/returnert rad har ingen
  //  attesterings-audit å bevare — speiler fjernTimerRad + tilfoyTimerRad).
  //  Deler validerings-kjernen (validerSplittFelles) med leder-splittRad.
  // ============================================================================
  splittRadEier: protectedProcedure
    .input(splittRadInput)
    .mutation(async ({ ctx, input }) => {
      // 1) Hent original rad ut fra radType
      const original =
        input.radType === "timer"
          ? await ctx.prismaTimer.sheetTimer.findUnique({ where: { id: input.radId } })
          : input.radType === "tillegg"
            ? await ctx.prismaTimer.sheetTillegg.findUnique({ where: { id: input.radId } })
            : await ctx.prismaTimer.sheetMachine.findUnique({ where: { id: input.radId } });
      if (!original) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `${input.radType}-rad ${input.radId} finnes ikke`,
        });
      }

      // 2) Hent sedel for auth + status-sjekk
      const sheet = await ctx.prismaTimer.dailySheet.findUnique({
        where: { id: original.sheetId },
        select: {
          id: true,
          organizationId: true,
          status: true,
          userId: true,
          pauseMin: true,
          dato: true,
        },
      });
      if (!sheet) throw new TRPCError({ code: "NOT_FOUND" });

      // 3) Auth: KUN eier av sedelen (aldri rolle-/admin-basert — arbeider
      //    redigerer eget utkast).
      if (sheet.userId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Kun eier av dagsseddelen kan splitte egne rader",
        });
      }

      // 4) Status: kun draft/returned. Server-side avvisning (ikke bare
      //    UI-skjuling av knappen).
      if (!erRedigerbar(sheet.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Kun utkast/returnerte dagssedler kan splittes av eier (status: ${sheet.status})`,
        });
      }

      // 5) Delt validerings-kjerne (samme som leder-splittRad).
      const originalSum =
        input.radType === "tillegg"
          ? Number((original as { antall: Prisma.Decimal }).antall)
          : Number((original as { timer: Prisma.Decimal }).timer);
      await validerSplittFelles(ctx.prismaTimer, input, sheet, {
        id: original.id,
        sum: originalSum,
      });

      // 6) Transaksjon: SLETT original + opprett N plain rader. Radene speiler
      //    tilfoy*-radene (ingen attestertStatus/parentRadId satt → skjema-
      //    default, identisk med normalt tillagte draft-rader).
      if (input.radType === "timer") {
        // RETUR 1 (V20-S): samme bærer-flytting som leder-splittRad — pausen
        // følger delraden som krysser pausevinduet (PK5), ikke bare hodet.
        const originalPauseMin = (original as { pauseMin: number }).pauseMin;
        const andreRader = await ctx.prismaTimer.sheetTimer.findMany({
          where: {
            sheetId: sheet.id,
            attestertStatus: { not: "erstattet" },
            id: { not: original.id },
          },
          select: { fraTid: true },
        });
        const { pauseVindu } = await hentPauseVinduForSedel(
          sheet.organizationId,
          sheet.dato,
          [...andreRader, ...input.nyeRader],
        );
        const splittPause = fordelPauseVedSplitt(
          input.nyeRader,
          originalPauseMin,
          pauseVindu,
        );
        const sumPause = splittPause.reduce((s, p) => s + p, 0);
        if (sumPause !== originalPauseMin) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Splitt bevarte ikke pausen (original ${originalPauseMin}, fordelt ${sumPause})`,
          });
        }
        await ctx.prismaTimer.$transaction(async (tx) => {
          await tx.sheetTimer.delete({ where: { id: original.id } });
          for (let i = 0; i < input.nyeRader.length; i++) {
            const rad = input.nyeRader[i]!;
            await tx.sheetTimer.create({
              data: {
                sheetId: sheet.id,
                lonnsartId: rad.lonnsartId,
                aktivitetId: rad.aktivitetId,
                projectId: rad.projectId,
                externalCostObjectId: rad.externalCostObjectId ?? null,
                byggeplassId: rad.byggeplassId ?? null,
                fraTid: rad.fraTid ?? null,
                tilTid: rad.tilTid ?? null,
                timer: rad.timer,
                // RETUR 1: bæreren flyttet til delraden i pausevinduet.
                pauseMin: splittPause[i] ?? 0,
                // Split = samme arbeid → arv original-radens kostnadsbærer.
                vehicleId:
                  (original as { vehicleId: string | null }).vehicleId ?? null,
                // LAG 2: arv hele reise-sporet (samme arbeid → samme spor).
                ...arvReiseSpor(original as ReiseSporKilde),
              },
            });
          }
          // PK6: hodet = Σ rad etter splitten (bumper updatedAt).
          await synkroniserHodePause(tx, sheet.id);
        });
      } else if (input.radType === "tillegg") {
        await ctx.prismaTimer.$transaction([
          ctx.prismaTimer.sheetTillegg.delete({ where: { id: original.id } }),
          ...input.nyeRader.map((rad) =>
            ctx.prismaTimer.sheetTillegg.create({
              data: {
                sheetId: sheet.id,
                tilleggId: rad.tilleggId,
                projectId: rad.projectId,
                antall: rad.antall,
                kommentar: rad.kommentar ?? null,
              },
            }),
          ),
        ]);
      } else {
        await ctx.prismaTimer.$transaction([
          ctx.prismaTimer.sheetMachine.delete({ where: { id: original.id } }),
          ...input.nyeRader.map((rad) =>
            ctx.prismaTimer.sheetMachine.create({
              data: {
                sheetId: sheet.id,
                vehicleId: rad.vehicleId,
                projectId: rad.projectId,
                externalCostObjectId: rad.externalCostObjectId ?? null,
                byggeplassId: rad.byggeplassId ?? null,
                fraTid: rad.fraTid ?? null,
                tilTid: rad.tilTid ?? null,
                timer: rad.timer,
                mengde: rad.mengde ?? null,
                enhet: rad.enhet ?? null,
              },
            }),
          ),
        ]);
      }

      // F4-1d: bump sedelens updatedAt så de nye split-radene når mobil pull.
      await touchSedel(ctx.prismaTimer, sheet.id);

      return { radType: input.radType, antallNye: input.nyeRader.length };
    }),

  // @deprecated Thin wrapper — kaller attesterRader for alle pending-rader på sedelen.
  // Beholdes for bakoverkompatibilitet (mobil-app pre-T7-2b1). Fjernes 1 uke etter
  // at klient-migrering er deployet til prod.
  attester: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const sheet = await ctx.prismaTimer.dailySheet.findUnique({
        where: { id: input.id },
        // ORDRE 2 STEG 1: dato/userId/organizationId trengs til uke-grunnlaget.
        select: {
          status: true,
          dato: true,
          userId: true,
          organizationId: true,
        },
      });
      if (!sheet) throw new TRPCError({ code: "NOT_FOUND" });
      if (sheet.status !== "sent") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Kun innsendte dagssedler kan attesteres (status: ${sheet.status})`,
        });
      }

      // V19.5 (A-4): samme overlapp-blokk som attesterRader (denne er thin-wrapper,
      // men vakten speiles her så begge veiene er dekket — M13).
      await krevIngenUavklartOverlapp(ctx.prismaTimer, [input.id]);

      const [timer, tillegg, maskin] = await Promise.all([
        ctx.prismaTimer.sheetTimer.findMany({
          where: { sheetId: input.id, attestertStatus: "pending" },
          select: { id: true },
        }),
        ctx.prismaTimer.sheetTillegg.findMany({
          where: { sheetId: input.id, attestertStatus: "pending" },
          select: { id: true },
        }),
        ctx.prismaTimer.sheetMachine.findMany({
          where: { sheetId: input.id, attestertStatus: "pending" },
          select: { id: true },
        }),
      ]);

      // Delegér til ny mutation-logikk via direkte funksjonskall ville krevd
      // ekstrahert helper; for å holde diff'en mindre, gjentar vi minimal
      // valideringslogikk her — autorisering og snapshot gjøres samme måte
      // som attesterRader.
      const timerRader = await ctx.prismaTimer.sheetTimer.findMany({
        where: { id: { in: timer.map((r) => r.id) } },
        include: { lonnsart: true, aktivitet: true },
      });
      const tilleggRader = await ctx.prismaTimer.sheetTillegg.findMany({
        where: { id: { in: tillegg.map((r) => r.id) } },
        include: { tillegg: true },
      });
      const maskinRader = await ctx.prismaTimer.sheetMachine.findMany({
        where: { id: { in: maskin.map((r) => r.id) } },
      });

      const alle = [...timerRader, ...tilleggRader, ...maskinRader];
      if (alle.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Ingen rader å attestere på sedelen",
        });
      }

      const uniqueProjectIds = Array.from(new Set(alle.map((r) => r.projectId)));
      await Promise.all(uniqueProjectIds.map((pid) => krevProsjektLeder(ctx.userId, pid)));

      const naa = new Date();

      // ORDRE 2 STEG 1: uke-nivå overtidsgrunnlag for etterprøvbart snapshot.
      // Enkelt-sedel → én beregning. null hvis org mangler (defensivt).
      const ukeGrunnlag: Overtidsgrunnlag | null = sheet.organizationId
        ? await byggUkeOvertidsgrunnlag(
            ctx.prismaTimer,
            sheet.organizationId,
            sheet.userId,
            sheet.dato,
          )
        : null;

      await ctx.prismaTimer.$transaction([
        ...timerRader.map((rad) =>
          ctx.prismaTimer.sheetTimer.update({
            where: { id: rad.id },
            data: {
              attestertStatus: "attestert",
              attestertAvUserId: ctx.userId,
              attestertVed: naa,
              attestertSnapshot: {
                lonnsartId: rad.lonnsart.id,
                kode: rad.lonnsart.kode,
                navn: rad.lonnsart.navn,
                type: rad.lonnsart.type,
                prisMotKunde: rad.lonnsart.prisMotKunde?.toString() ?? null,
                internkostnad: rad.lonnsart.internkostnad?.toString() ?? null,
                sats: rad.lonnsart.sats?.toString() ?? null,
                satsEnhet: rad.lonnsart.satsEnhet,
                aktivitetId: rad.aktivitet.id,
                aktivitetKode: rad.aktivitet.kode,
                aktivitetNavn: rad.aktivitet.navn,
                // ORDRE 2 STEG 1: etterprøvbart overtidsgrunnlag (uke-nivå).
                overtidsgrunnlag: ukeGrunnlag as unknown as Prisma.InputJsonValue,
                attestertVed: naa.toISOString(),
              },
            },
          }),
        ),
        ...tilleggRader.map((rad) =>
          ctx.prismaTimer.sheetTillegg.update({
            where: { id: rad.id },
            data: {
              attestertStatus: "attestert",
              attestertAvUserId: ctx.userId,
              attestertVed: naa,
              attestertSnapshot: {
                tilleggId: rad.tillegg.id,
                kode: rad.tillegg.kode,
                navn: rad.tillegg.navn,
                type: rad.tillegg.type,
                prisMotKunde: rad.tillegg.prisMotKunde?.toString() ?? null,
                internkostnad: rad.tillegg.internkostnad?.toString() ?? null,
                attestertVed: naa.toISOString(),
              },
            },
          }),
        ),
        ...maskinRader.map((rad) =>
          ctx.prismaTimer.sheetMachine.update({
            where: { id: rad.id },
            data: {
              attestertStatus: "attestert",
              attestertAvUserId: ctx.userId,
              attestertVed: naa,
              attestertSnapshot: {
                vehicleId: rad.vehicleId,
                timer: rad.timer.toString(),
                mengde: rad.mengde !== null ? rad.mengde.toString() : null,
                enhet: rad.enhet,
                attestertVed: naa.toISOString(),
              },
            },
          }),
        ),
        ctx.prismaTimer.dailySheet.update({
          where: { id: input.id },
          data: {
            status: "accepted",
            attestertAvUserId: ctx.userId,
            attestertVed: naa,
          },
        }),
      ]);

      return ctx.prismaTimer.dailySheet.findUniqueOrThrow({
        where: { id: input.id },
      });
    }),

  // @deprecated Thin wrapper — kaller returnerRader for alle pending-rader.
  // Fjernes 1 uke etter klient-migrering.
  returner: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        kommentar: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sheet = await ctx.prismaTimer.dailySheet.findUnique({
        where: { id: input.id },
        include: { timer: { take: 1, select: { projectId: true } } },
      });
      if (!sheet) throw new TRPCError({ code: "NOT_FOUND" });
      if (sheet.status !== "sent") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Kun innsendte dagssedler kan returneres (status: ${sheet.status})`,
        });
      }
      const projectId = sheet.timer[0]?.projectId;
      if (!projectId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Dagsseddel har ingen rader — kan ikke autorisere",
        });
      }
      await krevProsjektLeder(ctx.userId, projectId);

      return ctx.prismaTimer.dailySheet.update({
        where: { id: input.id },
        data: {
          status: "returned",
          lederKommentar: input.kommentar.trim(),
        },
      });
    }),

  // ============================================================================
  //  Mobil offline-sync (Runde 2)
  // ============================================================================

  /**
   * Pull: hent alle dagssedler for innlogget bruker som er endret etter
   * gitt timestamp. Brukes ved app-oppstart, ved nett-gjenkomst og ved
   * pull-to-refresh på mobil.
   *
   * Returnerer fulle sedler med rader (timer + tillegg) — mobil overskriver
   * lokal kopi så lenge lokal har syncStatus="synced". Hvis lokal har
   * "pending"-endringer, markeres lokal "conflict" (server-wins-regel).
   */
  hentEndringerSiden: protectedProcedure
    .input(
      z.object({
        sistSynkronisert: z.string().optional(), // ISO timestamp eller undefined for full pull
        // Begrens til siste N dager hvis full pull, for å unngå å laste hele historikken
        maksDagerTilbake: z.number().int().min(1).max(365).default(90),
        // Valgt/innlogget firma (Kenneth-vedtak 2026-10-09). Utelatt → egen org.
        organizationId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = await resolverOrgFraInput(ctx.userId, input.organizationId);
      await krevTimerAktivert(orgId);

      const sistSynk = input.sistSynkronisert
        ? new Date(input.sistSynkronisert)
        : null;

      // Full pull (ingen sistSynk): hent kun nyere enn maksDagerTilbake
      const minDato = new Date();
      minDato.setDate(minDato.getDate() - input.maksDagerTilbake);

      const where: Prisma.DailySheetWhereInput = {
        organizationId: orgId,
        userId: ctx.userId,
        ...(sistSynk
          ? { updatedAt: { gt: sistSynk } }
          : { dato: { gte: minDato } }),
      };

      // ORDRE 1a: autoritativt id-sett for delete-propagering server→mobil.
      // Serveren enumererer ALLE levende sedler i et EKSPLISITT intervall
      // (dato >= minDato, uavhengig av updatedAt-cursoren) og sender intervallet
      // med i svaret. Klienten sletter kun lokale sedler INNENFOR intervallet som
      // mangler her (vakt 1), aldri pending/avvist (vakt 2). `where`-grenene over
      // (inkrementell updatedAt vs. full dato) gjør at klienten IKKE trygt kan
      // utlede vinduet selv — derfor er `slettevindu` autoritativt fra serveren.
      const slettevindu = {
        fraDato: minDato.toISOString().slice(0, 10),
        tilDato: null as string | null,
      };
      const levendeSedler = await ctx.prismaTimer.dailySheet.findMany({
        where: { organizationId: orgId, userId: ctx.userId, dato: { gte: minDato } },
        select: { id: true, clientUuid: true },
      });

      const sedler = await ctx.prismaTimer.dailySheet.findMany({
        where,
        include: {
          // T7-2b-oppfølger (2026-07-13): rulleringsvern — filtrer bort
          // "erstattet"-rader (samme filter som aktiv-helper 394/403 + web-
          // attestering 1835-1837). No-op etter migreringen som FLYTTER dem til
          // historikk, men hindrer at gamle rader lekker ×N til mobil-pull.
          timer: { where: { attestertStatus: { not: "erstattet" } } },
          tillegg: { where: { attestertStatus: { not: "erstattet" } } },
          maskiner: { where: { attestertStatus: { not: "erstattet" } } },
          // U4: utlegg har ikke attestertStatus (U1-modell) → intet filter.
          utlegg: true,
        },
        orderBy: { updatedAt: "desc" },
      });

      // Funn #2: vedlegg har svak FK (ingen @relation) → kan ikke include-es.
      // Hent metadata separat for alle tillegg-rader og grupper per rad-id.
      const alleTilleggIder = sedler.flatMap((s) => s.tillegg.map((tl) => tl.id));
      const alleVedlegg = alleTilleggIder.length
        ? await ctx.prismaTimer.sheetTilleggVedlegg.findMany({
            where: { sheetTilleggId: { in: alleTilleggIder } },
            orderBy: { createdAt: "asc" },
          })
        : [];
      const vedleggPerRad = new Map<string, typeof alleVedlegg>();
      for (const v of alleVedlegg) {
        const liste = vedleggPerRad.get(v.sheetTilleggId) ?? [];
        liste.push(v);
        vedleggPerRad.set(v.sheetTilleggId, liste);
      }

      // U4: samme mønster for utlegg-kvitteringer (svak FK, hentes separat).
      const alleUtleggIder = sedler.flatMap((s) => s.utlegg.map((u) => u.id));
      const alleUtleggVedlegg = alleUtleggIder.length
        ? await ctx.prismaTimer.sheetUtleggVedlegg.findMany({
            where: { sheetUtleggId: { in: alleUtleggIder } },
            orderBy: { createdAt: "asc" },
          })
        : [];
      const utleggVedleggPerRad = new Map<string, typeof alleUtleggVedlegg>();
      for (const v of alleUtleggVedlegg) {
        const liste = utleggVedleggPerRad.get(v.sheetUtleggId) ?? [];
        liste.push(v);
        utleggVedleggPerRad.set(v.sheetUtleggId, liste);
      }

      // V19 (A-7, V19.7b): KUN antall forslag pr. sedel — ALDRI forslags-radene i
      // pull-responsen (M15: ingen lønnsleser ser forslaget). Sammen med
      // konfliktVentendeSiden på hodet lar dette mobilens pull-vakt (B-3b) skille
      // «valget tatt på PC» (felt=null ∧ antall=0) fra en ventende overlapp.
      const forslagPerSedel = new Map<string, number>();
      if (sedler.length > 0) {
        const forslagTellinger = await ctx.prismaTimer.sheetTimerForslag.groupBy({
          by: ["sheetId"],
          where: { sheetId: { in: sedler.map((s) => s.id) } },
          _count: { _all: true },
        });
        for (const t of forslagTellinger) {
          forslagPerSedel.set(t.sheetId, t._count._all);
        }
      }

      return {
        serverTid: new Date().toISOString(),
        // ORDRE 1a: intervallet id-settet gjelder for + de levende sedlene i det.
        slettevindu,
        levendeSedler,
        sedler: sedler.map((s) => ({
          id: s.id,
          clientUuid: s.clientUuid,
          userId: s.userId,
          organizationId: s.organizationId,
          // T.1 (2026-05-11): projectId på rad-nivå — proxy via første rad.
          projectId: s.timer[0]?.projectId ?? s.maskiner[0]?.projectId ?? null,
          aktivitetId: s.aktivitetId,
          avdelingId: s.avdelingId,
          byggeplassId: s.byggeplassId,
          dato: s.dato.toISOString().slice(0, 10),
          startAt: s.startAt?.toISOString() ?? null,
          endAt: s.endAt?.toISOString() ?? null,
          pauseMin: s.pauseMin,
          sluttTidKilde: s.sluttTidKilde,
          status: s.status,
          beskrivelse: s.beskrivelse,
          lederKommentar: s.lederKommentar,
          attestertVed: s.attestertVed?.toISOString() ?? null,
          // V19 (A-7, V19.7b): overlapp-tilstand på HODET (aldri radene). Mobilen
          // slipper lokal conflict KUN når konfliktVentendeSiden=null ∧
          // antallForslag=0 (valget tatt på PC); ellers består M8.
          konfliktVentendeSiden: s.konfliktVentendeSiden?.toISOString() ?? null,
          antallForslag: forslagPerSedel.get(s.id) ?? 0,
          // LAG 2 (L2-B TILLEGG 1): norm-sporet følger sedelen tilbake til mobil,
          // så en pull ikke sletter normStatus/normSnapshot telefonen skrev.
          normStatus: s.normStatus,
          normSnapshot: s.normSnapshot,
          updatedAt: s.updatedAt.toISOString(),
          // T7-3b1 (2026-05-14): expose projectId per rad så mobil kan lagre
          // per-rad-attribusjon offline. Tidligere proxyet vi via første rad
          // til sedel-nivå (sedelProjectId over) — den feltet beholdes for
          // bakoverkompatibilitet med pre-T7-3b1-klienter.
          // T4-d (2026-05-16): expose fraTid/tilTid per timer/maskin-rad.
          timer: s.timer.map((t) => ({
            id: t.id,
            projectId: t.projectId,
            // V19.9.1 (A'-6): radversjonen (ISO-ms) så mobilen lagrer server_versjon
            // og sender den tilbake i syncBatch. Forslagsrader tas ALDRI med (M15).
            updatedAt: t.updatedAt.toISOString(),
            // F3: per-rad byggeplass i pull-respons så mobil kan speile override.
            byggeplassId: t.byggeplassId,
            lonnsartId: t.lonnsartId,
            aktivitetId: t.aktivitetId,
            externalCostObjectId: t.externalCostObjectId,
            vehicleId: t.vehicleId,
            timer: Number(t.timer),
            fraTid: t.fraTid,
            tilTid: t.tilTid,
            beskrivelse: t.beskrivelse,
            // F5: per-rad matpause-bærer i pull-respons så mobil kan speile den.
            pauseMin: t.pauseMin,
            // LAG 2 (L2-B TILLEGG 1): reise-sporet MÅ returneres i pull, ellers
            // nuller mobilens rad-erstatning (delete+reinsert) K5-sporet som
            // telefonen skrev og serveren lagret — samme feilklasse som :4734.
            // Mobilen skiller «felt mangler» (gammel klient/server) fra null.
            erReise: t.erReise,
            reiseRetning: t.reiseRetning,
            reiseOppmotestedId: t.reiseOppmotestedId,
            reiseKjoretidMin: t.reiseKjoretidMin,
            reiseAvstandM: t.reiseAvstandM,
            reiseKilde: t.reiseKilde,
            reiseRegel: t.reiseRegel,
            tidKilde: t.tidKilde,
            reiseAvvik: t.reiseAvvik,
          })),
          tillegg: s.tillegg.map((tl) => ({
            id: tl.id,
            projectId: tl.projectId,
            tilleggId: tl.tilleggId,
            antall: Number(tl.antall),
            kommentar: tl.kommentar,
            // Funn #2: kvittering-vedlegg per tillegg-rad (metadata).
            vedlegg: (vedleggPerRad.get(tl.id) ?? []).map((v) => ({
              id: v.id,
              fileUrl: v.fileUrl,
              fileName: v.fileName,
              mimeType: v.mimeType,
              fileSize: v.fileSize,
            })),
          })),
          maskiner: s.maskiner.map((m) => ({
            id: m.id,
            projectId: m.projectId,
            externalCostObjectId: m.externalCostObjectId,
            // Del B pkt 1: returner koblingen så mobil beholder den ved pull.
            sheetTimerId: m.sheetTimerId,
            vehicleId: m.vehicleId,
            timer: Number(m.timer),
            mengde: m.mengde !== null ? Number(m.mengde) : null,
            enhet: m.enhet,
            fraTid: m.fraTid,
            tilTid: m.tilTid,
          })),
          // U4: utlegg-rader + kvittering-vedlegg. `foertVed` = createdAt (radens
          // føringstidspunkt, ikke synk-tid) så mobil beholder det reviderbare
          // stempelet. ordningVedFoering er immutabelt — mobil viser, endrer ikke.
          utlegg: s.utlegg.map((u) => ({
            id: u.id,
            projectId: u.projectId,
            expenseCategoryId: u.expenseCategoryId,
            belop: u.belop !== null ? Number(u.belop) : null,
            kommentar: u.kommentar,
            ordningVedFoering: u.ordningVedFoering,
            foertVed: u.createdAt.toISOString(),
            vedlegg: (utleggVedleggPerRad.get(u.id) ?? []).map((v) => ({
              id: v.id,
              fileUrl: v.fileUrl,
              fileName: v.fileName,
              mimeType: v.mimeType,
              fileSize: v.fileSize,
            })),
          })),
        })),
      };
    }),

  /**
   * Push: batch-upsert fra mobil. Tar en array av lokale dagssedler med
   * tilhørende rader. Hver seddel kjøres i sin egen $transaction —
   * resultater er uavhengige per seddel.
   *
   * Returnerer Array<{clientUuid, resultat, serverData?, feilmelding?}>:
   *   - "ok"       — opprettet eller oppdatert OK
   *   - "conflict" — server-versjonen er låst (accepted) eller nyere — server-wins
   *   - "feilet"   — andre feil (validering, FK-brudd, transient)
   *
   * Ingen rollback på tvers av sedler — én korrupt seddel blokkerer ikke
   * de andre. Mobil håndterer hver seddel separat basert på resultat.
   */
  syncBatch: protectedProcedure
    .input(
      z.object({
        sedler: z.array(
          z.object({
            clientUuid: z.string().uuid(),
            // F4-4 (2026-07-11): sedel-nivå projectId er en fallback-shim (T.1:
            // rad-nivå er kanon). Var påkrevd `.uuid()` → en tom/plassholder-
            // sedel som sendte "" (pull-plassholder `serverSedel.projectId ?? ""`)
            // fikk Zod til å avvise HELE batchen (poison) før prosedyren kjørte.
            // Tåler "" (#37-klient), null (#38) og undefined → normaliser til
            // null. Ekte ugyldig ikke-uuid-streng avvises fortsatt.
            projectId: z
              .union([z.string().uuid(), z.literal("")])
              .nullable()
              .optional()
              .transform((v) => v || null),
            aktivitetId: z.string().uuid(),
            avdelingId: z.string().uuid().nullable().optional(),
            byggeplassId: z.string().uuid().nullable().optional(),
            dato: z.string(), // ISO YYYY-MM-DD
            startAt: z.string().nullable().optional(),
            endAt: z.string().nullable().optional(),
            pauseMin: z.number().int().min(0).default(0),
            status: z.enum(STATUS_VERDIER),
            sluttTidKilde: z
              .enum(["bruker", "midnatt", "system"])
              .default("bruker"),
            // LAG 2 (C1 / B5): lønnsnormens kilde følger sedelen fra mobilen.
            // Optional → eldre klienter uten feltet lar dem stå null.
            normStatus: z
              .enum(["server", "cachet", "ukjent"])
              .nullable()
              .optional(),
            normSnapshot: z.unknown().optional(),
            beskrivelse: z.string().nullable().optional(),
            // T7-3b1: projectId per rad (optional). Bruk rad-nivå hvis satt,
            // ellers fall tilbake til lokal.projectId (sedel-nivå, kompat-shim
            // for pre-T7-3b1-klienter).
            timer: z.array(
              z.object({
                id: z.string().uuid(),
                projectId: z.string().uuid().optional(),
                lonnsartId: z.string().uuid(),
                aktivitetId: z.string().uuid(),
                externalCostObjectId: z.string().uuid().nullable().optional(),
                // LAG 0a (H5): tak settes lønnsart-bevisst i handleren (rad-tak.ts).
                timer: z.number().min(0),
                // SYNC-2 (2026-07-10): fra/til per rad — MÅ deklareres her ellers
                // stripper Zod dem (T4-d koblet kun lese-/online-siden, aldri
                // sync-skrivesiden → tider ført på web ble slettet ved mobilsynk).
                fraTid: z.string().nullable().optional(),
                tilTid: z.string().nullable().optional(),
                // T.12: fritekst per rad («hva jeg gjorde»).
                beskrivelse: z.string().nullable().optional(),
                // F3 (2026-07-14): per-rad byggeplass (override av sedel-nivå).
                // Optional → eldre klienter uten feltet → arv fra sedel-nivå.
                byggeplassId: z.string().uuid().nullable().optional(),
                // F5 (2026-07-14): per-rad matpause-bærer (min). Optional →
                // eldre klienter uten feltet → 0. Ingen sedel-arv (per-rad-eid).
                pauseMin: z.number().int().min(0).optional(),
                // T.10: kostnadsbærer for maskinvedlikehold (svak FK → Equipment).
                vehicleId: z.string().uuid().nullable().optional(),
                // LAG 2 (C1): reise-sporet. MÅ deklareres her ellers stripper Zod
                // det (M6) — da kastes klassifiseringen stille. Alle optional:
                // sendes erReise eksplisitt brukes verdien (C2 validerer), ellers
                // utledes flagget i handleren (presisering 2, overgangsperioden).
                erReise: z.boolean().optional(),
                reiseRetning: z.enum(["ut", "retur"]).nullable().optional(),
                reiseOppmotestedId: z.string().uuid().nullable().optional(),
                reiseKjoretidMin: z.number().int().nullable().optional(),
                reiseAvstandM: z.number().int().nullable().optional(),
                reiseKilde: z.enum(["matrise", "manuell"]).nullable().optional(),
                // Json-snapshot av regelen. z.unknown() → vilkårlig Json; C2 krever
                // at den finnes for matrise-rader.
                reiseRegel: z.unknown().optional(),
                tidKilde: z
                  .enum(["stempel", "utledet", "manuell"])
                  .nullable()
                  .optional(),
                // V19.9.1/2 (A'-2): radversjonen telefonen fikk ved pull/push-`ok`
                // (`SheetTimer.updatedAt`, ISO-ms) + om telefonen selv har rørt raden.
                // Begge optional/nullable → eldre app uten feltene → «ukjent versjon»
                // (R9–R11/S4, innhold avgjør). ALDRI stille overskriving.
                serverVersjon: z.string().datetime().nullable().optional(),
                endretLokalt: z.boolean().optional(),
              }),
            ),
            tillegg: z.array(
              z.object({
                id: z.string().uuid(),
                projectId: z.string().uuid().optional(),
                tilleggId: z.string().uuid(),
                antall: z.number().min(0),
                kommentar: z.string().nullable().optional(),
              }),
            ),
            maskiner: z
              .array(
                z.object({
                  id: z.string().uuid(),
                  projectId: z.string().uuid().optional(),
                  externalCostObjectId: z.string().uuid().nullable().optional(),
                  // Del B pkt 1: svak FK → timer-raden maskinen ble ført sammen med.
                  // Optional/nullable → eldre klienter uten feltet lar det stå null.
                  sheetTimerId: z.string().uuid().nullable().optional(),
                  vehicleId: z.string().uuid(),
                  timer: z.number().min(0).max(24),
                  mengde: z.number().min(0).nullable().optional(),
                  enhet: z.string().max(20).nullable().optional(),
                  // SYNC-2: fra/til per maskin-rad (datatap-fiks, samme som timer).
                  fraTid: z.string().nullable().optional(),
                  tilTid: z.string().nullable().optional(),
                }),
              )
              .default([]),
            // U4 (2026-08-11): utlegg-rader (SheetUtlegg). Speiler tillegg, men
            // bærer klientens `ordningVedFoering`-STEMPEL (utledet ved føring på
            // enheten) + `foertVed` (føringstidspunktet). Serveren stoler på
            // stempelet — re-utleder ALDRI (offline-raden skal bære ordningen som
            // gjaldt da arbeideren førte, ikke en admin-endring som kom etter).
            // Optional/default [] → eldre klienter uten feltet uendret.
            utlegg: z
              .array(
                z.object({
                  id: z.string().uuid(),
                  projectId: z.string().uuid().optional(),
                  expenseCategoryId: z.string().uuid(),
                  // null KUN for 'fakturert' (håndheves av CHECK + app-speil under).
                  belop: z.number().min(0).nullable().optional(),
                  kommentar: z.string().nullable().optional(),
                  ordningVedFoering: SYNC_ORDNING_ENUM,
                  // Klientens føringstidspunkt (ISO). Skrives til createdAt så
                  // stempelet er reviderbart: «ført 3. aug, ordningen var X da» —
                  // ikke synk-dagen. Uten dette ville en rad som lå offline i tre
                  // uker se ut som ført på synk-dagen (tillegg-hullet — se timer.md).
                  foertVed: z.string(),
                }),
              )
              .default([]),
            // S-A (2026-07-13): rad-id-er arbeideren har slettet lokalt. Server
            // kjører deleteMany({ sheetId, id: { in } }) per type I TILLEGG til
            // payload-replace, så slettinger propagerer (S3-payload-policy sletter
            // ellers kun sendte rader). Optional → #37-klienter uten feltet
            // beholder dagens ikke-propagering (legacy, bakoverkompat).
            slettedeIder: z
              .object({
                timer: z.array(z.string().uuid()).default([]),
                tillegg: z.array(z.string().uuid()).default([]),
                maskiner: z.array(z.string().uuid()).default([]),
                // U4: utlegg-slettinger propagerer som de andre typene. Optional
                // → eldre slettedeIder-objekt uten feltet defaulter til [].
                utlegg: z.array(z.string().uuid()).default([]),
                // V19.9.1 (A'-2): timer-tombstones MED versjonen kopiert fra raden da
                // den ble slettet lokalt → S1–S4-klassifisering (slett vs. avvik). Den
                // gamle `timer: string[]` beholdes (eldre app → S4, trygg retning).
                // Rader i `timerVersjoner` har forrang; `timer` dekker kun id-er som
                // IKKE finnes der (ingen dobbeltbehandling).
                timerVersjoner: z
                  .array(
                    z.object({
                      id: z.string().uuid(),
                      serverVersjon: z.string().datetime().nullable(),
                    }),
                  )
                  .optional(),
              })
              .optional(),
          }),
        ).max(100), // Begrens batch-størrelse for å unngå tidsavbrudd
        // Valgt/innlogget firma (Kenneth-vedtak 2026-10-09). Utelatt → egen org.
        organizationId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Kenneth-vedtak 2026-10-09 (2): egen timeføring (mobil-synk) krever aktivt
      // ansettelsesforhold i firmaet — ingen admin-bypass.
      const orgId = await resolverOrgForEgenTimeføring(ctx.userId, input.organizationId);
      await krevTimerAktivert(orgId);

      // LAG 2 (C1/C2): batch-nivå kontekst for reise-behandlingen — hentes ÉN gang
      // for hele synken, ikke per sedel. erReiseKontekst speiler backfillen; navne-
      // kartet brukes til utledning (overgangsperioden); oppmøtested-settet til
      // C2-firmagrensen.
      const erReiseKtx: ErReiseKontekst = await hentErReiseKontekst(orgId);
      const [lonnsarterForReise, firmaOppmotesteder] = await Promise.all([
        ctx.prismaTimer.lonnsart.findMany({
          where: { organizationId: orgId },
          select: { id: true, navn: true },
        }),
        ctx.prisma.oppmotested.findMany({
          where: { organizationId: orgId },
          select: { id: true },
        }),
      ]);
      const lonnsartNavnMap = new Map(
        lonnsarterForReise.map((l) => [l.id, l.navn]),
      );
      const gyldigeOppmotesteder = new Set(firmaOppmotesteder.map((o) => o.id));

      // SYNC-1 (2026-07-10): `avvist` = permanent avvisning klienten ikke kan
      // rette via retry (P2002-duplikat, katalog-mismatch, maskin>arbeid,
      // FORBIDDEN — og fra SYNC-2 overlapp/`fra<til`). Mobil gjør `avvist`
      // terminal (forlater pending, rødt banner). `feilet` = transient (behold
      // pending, retry neste tick). Bakoverkompat: eldre klient (#37) faller til
      // else på ukjent `avvist` og beholder pending — samme som dagens oppførsel.
      type ResultatRad = {
        clientUuid: string;
        resultat: "ok" | "conflict" | "avvist" | "feilet";
        // A-2 (V19): eksplisitt årsak på conflict — mobilen skal aldri igjen
        // gjette fra identitet (M3). "overlapp" → forslag lagret, velg; "laast"/
        // "nyere" → server-wins; "dato_kollisjon" → re-nøkle + additiv push (V19.4).
        // Valgfritt → eldre klient ignorerer feltet (A-2, § 8.4).
        aarsak?: "laast" | "nyere" | "dato_kollisjon" | "overlapp";
        serverData?: {
          id: string;
          // Synk-identitet (2026-07-11): server-sedelens clientUuid. Kun satt på
          // kollisjon-conflict (S2) så mobil kan re-nøkle lokal sedel til den
          // identiteten push treffer. Valgfritt → #37-klient ignorerer feltet.
          clientUuid?: string;
          status: DagsseddelStatus;
          lederKommentar: string | null;
          attestertVed: string | null;
          updatedAt: string;
          // V19.9.8 (A'-5): versjonene for radene som FAKTISK ble skrevet (lest
          // tilbake etter skriving) + rad-id-er som ble hoppet over (serverraden
          // står, telefonen henter den ved neste pull). Begge `ok` og
          // `conflict/overlapp`. Valgfritt → eldre klient ignorerer dem.
          rader?: { id: string; updatedAt: string }[];
          hoppetOver?: string[];
        };
        feilmelding?: string;
      };

      const resultater: ResultatRad[] = [];

      for (const lokal of input.sedler) {
        try {
          // Sjekk eksisterende — verifiser eierskap + om låst
          const eksisterende = await ctx.prismaTimer.dailySheet.findUnique({
            where: { clientUuid: lokal.clientUuid },
          });

          if (eksisterende) {
            if (eksisterende.userId !== ctx.userId) {
              resultater.push({
                clientUuid: lokal.clientUuid,
                resultat: "avvist",
                feilmelding: "Dagsseddel eies av annen bruker",
              });
              continue;
            }
            if (eksisterende.organizationId !== orgId) {
              resultater.push({
                clientUuid: lokal.clientUuid,
                resultat: "avvist",
                feilmelding: "Dagsseddel tilhører annet firma",
              });
              continue;
            }
            // Server-wins: hvis server har accepted, klient kan ikke endre
            if (eksisterende.status === "accepted") {
              resultater.push({
                clientUuid: lokal.clientUuid,
                resultat: "conflict",
                serverData: {
                  id: eksisterende.id,
                  status: eksisterende.status as DagsseddelStatus,
                  lederKommentar: eksisterende.lederKommentar,
                  attestertVed: eksisterende.attestertVed?.toISOString() ?? null,
                  updatedAt: eksisterende.updatedAt.toISOString(),
                },
                feilmelding: "Sedlen er attestert og kan ikke endres",
              });
              continue;
            }
            // Server-wins: hvis server-status er sent og klient prøver å redigere innhold,
            // er det konflikt (kun "send"-overgang draft→sent eller returned→sent er OK)
            if (
              eksisterende.status === "sent" &&
              lokal.status !== "sent"
            ) {
              resultater.push({
                clientUuid: lokal.clientUuid,
                resultat: "conflict",
                serverData: {
                  id: eksisterende.id,
                  status: eksisterende.status as DagsseddelStatus,
                  lederKommentar: eksisterende.lederKommentar,
                  attestertVed: eksisterende.attestertVed?.toISOString() ?? null,
                  updatedAt: eksisterende.updatedAt.toISOString(),
                },
                feilmelding: "Sedlen er sendt til attestering og venter på leder",
              });
              continue;
            }
          } else if (lokal.projectId) {
            // Ny seddel — verifiser prosjekttilgang. F4-4: sedel-nivå projectId
            // kan nå være null (tom/plassholder-sedel). Rad-nivå-medlemskap
            // sjekkes uansett under (radProjectIder); org-tilgang er allerede
            // sikret (resolverOrgFraInput + krevTimerAktivert). Konsistent med web
            // `opprett` (T.1: dato-only, org-tilgang tilstrekkelig).
            await verifiserProsjektmedlem(ctx.userId, lokal.projectId);
          }

          // Verifiser aktivitet tilhører firmaet
          const aktivitet = await ctx.prismaTimer.aktivitet.findFirst({
            where: { id: lokal.aktivitetId, organizationId: orgId },
          });
          if (!aktivitet) {
            resultater.push({
              clientUuid: lokal.clientUuid,
              resultat: "avvist",
              feilmelding: "Aktivitet finnes ikke i firmaets katalog",
            });
            continue;
          }

          // Verifiser alle lønnsarter, aktiviteter (per rad) og tillegg tilhører firmaet
          const lonnsartIder = Array.from(
            new Set(lokal.timer.map((t) => t.lonnsartId)),
          );
          const aktivitetIderIRader = Array.from(
            new Set(lokal.timer.map((t) => t.aktivitetId)),
          );
          const tilleggIder = Array.from(
            new Set(lokal.tillegg.map((tl) => tl.tilleggId)),
          );
          const [lonnsartTreff, aktivitetIRaderTreff, tilleggTreff] = await Promise.all([
            lonnsartIder.length === 0
              ? Promise.resolve([])
              : ctx.prismaTimer.lonnsart.findMany({
                  where: { id: { in: lonnsartIder }, organizationId: orgId },
                  // LAG 0a (H5): satsEnhet for det lønnsart-bevisste taket.
                  select: { id: true, satsEnhet: true },
                }),
            aktivitetIderIRader.length === 0
              ? Promise.resolve([])
              : ctx.prismaTimer.aktivitet.findMany({
                  where: { id: { in: aktivitetIderIRader }, organizationId: orgId },
                  select: { id: true },
                }),
            tilleggIder.length === 0
              ? Promise.resolve([])
              : ctx.prismaTimer.tillegg.findMany({
                  where: { id: { in: tilleggIder }, organizationId: orgId },
                  select: { id: true },
                }),
          ]);
          if (lonnsartTreff.length !== lonnsartIder.length) {
            resultater.push({
              clientUuid: lokal.clientUuid,
              resultat: "avvist",
              feilmelding: "En eller flere lønnsarter finnes ikke i firmaets katalog",
            });
            continue;
          }
          // LAG 0a (H5): lønnsart-bevisst tak pr. timer-rad fra det delte opplaget
          // over. syncBatch kaster ikke — den avviser pr. sedel (push + continue),
          // så vi bruker maksForSatsEnhet/takFeilmelding direkte i stedet for
          // krevRadInnenforTak. Ukjent satsEnhet → 24-tak (konservativt).
          const syncSatsEnhet = new Map(
            lonnsartTreff.map((l) => [l.id, l.satsEnhet]),
          );
          const overskridendeTimerRad = lokal.timer.find(
            (t) => t.timer > maksForSatsEnhet(syncSatsEnhet.get(t.lonnsartId)),
          );
          if (overskridendeTimerRad) {
            resultater.push({
              clientUuid: lokal.clientUuid,
              resultat: "avvist",
              feilmelding: takFeilmelding(
                overskridendeTimerRad.timer,
                syncSatsEnhet.get(overskridendeTimerRad.lonnsartId),
              ),
            });
            continue;
          }
          if (aktivitetIRaderTreff.length !== aktivitetIderIRader.length) {
            resultater.push({
              clientUuid: lokal.clientUuid,
              resultat: "avvist",
              feilmelding: "En eller flere aktiviteter finnes ikke i firmaets katalog",
            });
            continue;
          }
          if (tilleggTreff.length !== tilleggIder.length) {
            resultater.push({
              clientUuid: lokal.clientUuid,
              resultat: "avvist",
              feilmelding: "Et eller flere tillegg finnes ikke i firmaets katalog",
            });
            continue;
          }

          // U4: utleggskategorier tilhører firmaet (mirror av tillegg-sjekken).
          const utleggKatIder = Array.from(
            new Set(lokal.utlegg.map((u) => u.expenseCategoryId)),
          );
          const utleggKatTreff =
            utleggKatIder.length === 0
              ? []
              : await ctx.prismaTimer.expenseCategory.findMany({
                  where: { id: { in: utleggKatIder }, organizationId: orgId },
                  select: { id: true },
                });
          if (utleggKatTreff.length !== utleggKatIder.length) {
            resultater.push({
              clientUuid: lokal.clientUuid,
              resultat: "avvist",
              feilmelding:
                "En eller flere utleggskategorier finnes ikke i firmaets katalog",
            });
            continue;
          }

          // U4: valider hver utlegg-rads STEMPEL uten å re-utlede. sats bæres av
          // SheetTillegg (lønnsart), ikke SheetUtlegg → avvis (klient-bug, velgeren
          // skjuler sats). Beløps-regel = app-speil av CHECK: 'fakturert' → belop
          // NULL, ellers belop > 0. Feil er permanent (klienten må rette) → avvist.
          const utleggStempelFeil = lokal.utlegg.find((u) => {
            const ordning = u.ordningVedFoering as UtleggOrdning;
            if (!baeresAvSheetUtlegg(ordning)) return true; // sats
            if (krevesBelop(ordning)) {
              return u.belop === null || u.belop === undefined || u.belop <= 0;
            }
            return u.belop !== null && u.belop !== undefined; // fakturert m/ beløp
          });
          if (utleggStempelFeil) {
            const ordning = utleggStempelFeil.ordningVedFoering as UtleggOrdning;
            resultater.push({
              clientUuid: lokal.clientUuid,
              resultat: "avvist",
              feilmelding: !baeresAvSheetUtlegg(ordning)
                ? "Utlegg med ordning «lønnstillegg» føres som lønnstillegg, ikke utlegg."
                : "Utlegg-rad bryter beløps-regelen for sin ordning.",
            });
            continue;
          }

          // T7-3b1: verifiser medlemskap på alle unike per-rad-projectId.
          // Sedel-nivå er allerede sjekket (linje 1970); rad-nivå-IDer som
          // avviker fra sedel-nivå må sjekkes separat. Hopper over rad-IDer
          // identisk med sedel-nivå for å unngå dobbelt-DB-spørring.
          const radProjectIder = Array.from(
            new Set(
              [
                ...lokal.timer.map((t) => t.projectId),
                ...lokal.tillegg.map((t) => t.projectId),
                ...lokal.maskiner.map((m) => m.projectId),
                ...lokal.utlegg.map((u) => u.projectId),
              ].filter((p): p is string => !!p && p !== lokal.projectId),
            ),
          );
          for (const pid of radProjectIder) {
            await verifiserProsjektmedlem(ctx.userId, pid);
          }

          // F4-4 (2026-07-11): resolver rad-nivå projectId (kanon per T.1) med
          // sedel-nivå fallback (nå nullbar). DB-feltet er NOT NULL — en rad
          // uten noe prosjekt avvises synlig (SYNC-1) i stedet for en rå DB-feil
          // + evig retry. En tom sedel (0 rader) passerer (ingen rad å resolvere)
          // og lagres som bart sedelhode.
          const radProsjekt = (radId: string | undefined): string | null =>
            radId ?? lokal.projectId ?? null;
          const alleRadProsjekt = [
            ...lokal.timer.map((t) => radProsjekt(t.projectId)),
            ...lokal.tillegg.map((tl) => radProsjekt(tl.projectId)),
            ...lokal.maskiner.map((m) => radProsjekt(m.projectId)),
            ...lokal.utlegg.map((u) => radProsjekt(u.projectId)),
          ];
          if (alleRadProsjekt.some((p) => !p)) {
            resultater.push({
              clientUuid: lokal.clientUuid,
              resultat: "avvist",
              feilmelding:
                "En rad mangler prosjekt — velg prosjekt på hver rad før innsending",
            });
            continue;
          }

          // Fase 1b: firma-grense på alle RESOLVERTE rad-projectIds (med
          // sedel-nivå fallback). Medlemskaps-løkka over filtrerer bort rad-IDer
          // == lokal.projectId og hopper sedel-nivå for eksisterende sedler —
          // firma-grensen dekker den luken (foreign projectId via re-sync av
          // egen eksisterende sedel). Delt helper, samme grense som de andre
          // skrive-stiene. Beholder medlemskaps-løkka (G1-policy utenfor 1b).
          // F4-4: `.filter` narrower til string[] (guarden over garanterer
          // ingen null; tom sedel gir tomt array → helper er no-op).
          await verifiserProsjekterTilhørerFirma(
            alleRadProsjekt.filter((p): p is string => !!p),
            orgId,
          );

          // §2.D: valider alle rad-vehicleId (maskin-kostnadsbærer) mot firmaets
          // maskinregister — timer-rad (nullable) + maskin-rad (påkrevd). Samlet
          // pr. unik ID for å unngå N oppslag.
          const alleVehicleIder = Array.from(
            new Set(
              [
                ...lokal.timer.map((t) => t.vehicleId),
                ...lokal.maskiner.map((m) => m.vehicleId),
              ].filter((v): v is string => !!v),
            ),
          );
          for (const vid of alleVehicleIder) {
            await verifiserKjoretoyTilhørerFirma(vid, orgId);
          }

          const dato = new Date(lokal.dato);

          // V20/PK4b — normaliser radenes pause (ALDRI avvis — eldre app må kunne
          // synke). Pausevinduet (PK5) følger firmaets pauseReferanse; bæreren
          // tildeles kun-én pr. dag. Payloadens hode-pause (lokal.pauseMin)
          // ignoreres — hodet utledes server-side (PK6, synkroniserHodePause).
          const { pauseVindu: syncPauseVindu, standardPauseMin: syncStdPause } =
            await hentPauseVinduForSedel(orgId, dato, lokal.timer);
          let syncBaererTatt = false;
          let syncAvvikAntall = 0;
          const syncPauseEtterId = new Map<string, number>();
          for (const t of lokal.timer) {
            const v = vurderRadTimer({
              modus: "sync",
              satsEnhet: syncSatsEnhet.get(t.lonnsartId),
              fraTid: t.fraTid,
              tilTid: t.tilTid,
              timer: t.timer,
              pauseMinAngitt: t.pauseMin ?? undefined,
              pauseVindu: syncPauseVindu,
              standardPauseMin: syncStdPause,
              finnesAlleredeBaerer: syncBaererTatt,
            });
            if (v.pauseMin > 0) syncBaererTatt = true;
            if (v.teller === "avvik" || v.teller === "to_baerere") {
              syncAvvikAntall++;
            }
            syncPauseEtterId.set(t.id, v.pauseMin);
          }
          if (syncAvvikAntall > 0) {
            // PK4b-3: stemmer med ingen / kun-én-vern → skrevet uendret, telt.
            console.warn(
              `[timer_avvik_sync] sedel=${lokal.clientUuid} rader=${syncAvvikAntall}: timetall uten bevist pause skrevet uendret (V20/PK4b-3)`,
            );
          }
          const syncSumPause = Array.from(syncPauseEtterId.values()).reduce(
            (s, p) => s + p,
            0,
          );

          // Klient kan ikke sette accepted — lederen attesterer på server
          // Klient kan sette draft, sent (etter "send"-knapp), eller behold returned
          const innkommendeStatus =
            lokal.status === "accepted" ? "sent" : lokal.status;

          // SYNC-2 (2026-07-10): fra<til + overlapp-vakt på timer-radene FØR
          // createMany. Web-mutasjonene (tilfoyTimerRad/oppdaterTimerRad) hadde
          // vakten; synkveien omgikk den. Overlapp sjekkes INNAD i settet —
          // syncBatch erstatter alle rader (deleteMany+createMany), så
          // post-state = eksakt lokal.timer og ingen rad finnes i basen ennå.
          // Avvisning er permanent (arbeideren må rette) → "avvist" (SYNC-1).
          const tidsromKonflikt = finnTidsromKonflikt(lokal.timer);
          if (tidsromKonflikt) {
            resultater.push({
              clientUuid: lokal.clientUuid,
              resultat: "avvist",
              feilmelding:
                tidsromKonflikt.type === "fra_etter_til"
                  ? `Til-tid må være etter fra-tid (${tidsromKonflikt.rad.fraTid}–${tidsromKonflikt.rad.tilTid}).`
                  : `Tidsrommet ${tidsromKonflikt.rad.fraTid}–${tidsromKonflikt.rad.tilTid} overlapper ${tidsromKonflikt.annen.fraTid}–${tidsromKonflikt.annen.tilTid} på samme dagsseddel. Én arbeider kan ikke være to steder samtidig.`,
            });
            continue;
          }

          // M5 (2026-07-10): fra<til-vakt på MASKIN-radene FØR createMany. Web-
          // mutasjonene (maskin.tilfoy/oppdater) har `refineFraForTil`; synkveien
          // omgikk den (SYNC-2 dekket kun timer-rader). Delt regel (tilErEtterFra,
          // @sitedoc/shared). Kun fra<til — maskin-vs-maskin-overlapp er egen
          // BACKLOG-utredning (maskin-rader hører til en timer-rad, overlapp-
          // sjekkes ikke). Permanent (arbeideren må rette) → "avvist" (SYNC-1).
          const maskinFraTilFeil = lokal.maskiner.find(
            (m) => !tilErEtterFra(m.fraTid, m.tilTid),
          );
          if (maskinFraTilFeil) {
            resultater.push({
              clientUuid: lokal.clientUuid,
              resultat: "avvist",
              feilmelding: `Maskin: til-tid må være etter fra-tid (${maskinFraTilFeil.fraTid}–${maskinFraTilFeil.tilTid}).`,
            });
            continue;
          }

          // T7-4b: valider sum(maskin) ≤ sum(timer) per (projectId, ECO).
          // syncBatch erstatter alle rader på sedelen — post-state = exakt
          // det som er i lokal.timer + lokal.maskiner. Feil per sedel
          // resulterer i "feilet" for KUN den sedelen, ikke batchen.
          const syncPostTimer: ValiderRad[] = lokal.timer.map((t) => ({
            projectId: radProsjekt(t.projectId)!,
            externalCostObjectId: t.externalCostObjectId ?? null,
            timer: t.timer,
          }));
          const syncPostMaskin: ValiderRad[] = lokal.maskiner.map((m) => ({
            projectId: radProsjekt(m.projectId)!,
            externalCostObjectId: m.externalCostObjectId ?? null,
            timer: m.timer,
          }));
          const syncBrytt = validerMaskinUnderArbeid(
            syncPostTimer,
            syncPostMaskin,
            // V20/PK6: buffer = Σ vurdert rad-pause (hodet er derivert). Men
            // ALDRI mindre enn payloadens claimede hode-pause — maskin-regelen
            // er en buffer (maskin ≤ arbeid + pause/60), så en eldre app skal
            // aldri avvises STRENGERE enn før (ufravikelig: eldre app må synke).
            Math.max(syncSumPause, lokal.pauseMin),
          );
          if (syncBrytt.length > 0) {
            resultater.push({
              clientUuid: lokal.clientUuid,
              resultat: "avvist",
              feilmelding: await feilMeldingMaskinOverstiger(syncBrytt),
            });
            continue;
          }

          // LAG 2 (C1/C2/C3): bygg reise-sporet for sedelens rader. Eksplisitt
          // erReise valideres (C2) + matrise-rader kontrolleres (C3); ellers
          // utledes flagget (overgangsperioden). C2-brudd avviser HELE sedelen med
          // navngitt feil (SYNC-1) — resten av batchen går gjennom. Utenfor tx:
          // rene oppslag, ingen skriving.
          const reiseResultat = await byggReiseFelterForSynk(
            lokal.timer,
            lokal.byggeplassId ?? null,
            erReiseKtx,
            lonnsartNavnMap,
            gyldigeOppmotesteder,
          );
          if (!reiseResultat.ok) {
            resultater.push({
              clientUuid: lokal.clientUuid,
              resultat: "avvist",
              feilmelding: reiseResultat.feilmelding,
            });
            continue;
          }
          const reiseFelterMap = reiseResultat.felter;

          // Per-seddel transaksjon: upsert sedel + erstatt rader atomisk
          // T.1 (2026-05-11): projectId/byggeplassId lagres på rad-nivå.
          // Mobil sender fortsatt lokal.projectId på sedel-nivå inntil mobil-PR
          // er ute — vi propagerer den til alle rader her.
          // Tx-resultatet er enten den skrevne sedelen (`ok`) eller — ved V19-
          // overlapp — en markør (`overlapp`) om at forslaget ble lagret og
          // header/rader IKKE skrevet. A-1b håndteres HER inni tx-en (ikke som
          // en egen tx), så statusvakten i lagreOverlappForslag ligger innenfor
          // samme grense som rad-skrivingen (v4.1-rettelsen).
          type SyncTxResultat =
            | {
                slag: "ok";
                sedel: Awaited<ReturnType<typeof ctx.prismaTimer.dailySheet.findUniqueOrThrow>>;
                skrevneRader: { id: string; updatedAt: string }[];
                hoppetOver: string[];
              }
            | {
                slag: "overlapp";
                aarsak: "overlapp" | "laast";
                skrevneRader: { id: string; updatedAt: string }[];
                hoppetOver: string[];
              };
          const txResultat: SyncTxResultat = await ctx.prismaTimer.$transaction(async (tx) => {
            // 2b (2026-07-16, TOCTOU-fiks): accepted-vakten (over) leser
            // `eksisterende` 277 linjer / 8+ await FØR denne tx. En leder som
            // attesterer i det vinduet ble ellers stille overskrevet
            // (accepted→sent + av-attesterte rader) fordi upsert matchet KUN på
            // clientUuid uten status-betingelse. Her: create for ny sedel, ellers
            // betinget updateMany(status notIn accepted). updateMany er atomisk
            // selv om attesteringen committer mellom lesning og skriving — WHERE
            // matcher da ikke → count 0 → conflict (rull tilbake, meld server).
            const eksisterendeITx = await tx.dailySheet.findUnique({
              where: { clientUuid: lokal.clientUuid },
              select: { id: true },
            });

            // V19.9 (A-1b) — klassifiser payload-radene og tombstones mot
            // serverradene FØR noe skrives (spec § 9.3, inni tx-en). Resultatet
            // styrer hva som faktisk skrives:
            //   skrivTimerIder  = payload-rad-id-er som skal til sheet_timer
            //   slettTimerIder  = tombstones serveren er enig i (S1)
            //   avvikForslag    = rader til forslag (m/ grunn; R4/R7/R10/S2'/S4)
            //   hoppetOverIder  = serverraden står (R3/R5/R8)
            // Ny sedel: ingen serverrader → alt er «skriv» (R6/R11), ingen avvik.
            let skrivTimerIder = new Set<string>(lokal.timer.map((t) => t.id));
            let slettTimerIder: string[] = lokal.slettedeIder?.timer ?? [];
            let avvikForslag: (OverlappPayloadRad & { grunn: string })[] = [];
            let hoppetOverIder: string[] = [];

            if (eksisterendeITx) {
              // Les HELE serverradene (innhold + updatedAt + reise-sporet trengs for
              // slettet_telefon-kopien) via tx — TOCTOU-lukket.
              const serverTimerFull = await tx.sheetTimer.findMany({
                where: { sheetId: eksisterendeITx.id },
              });
              const serverById = new Map(serverTimerFull.map((s) => [s.id, s]));

              // Payload resolved likt som ved skriving (projectId/byggeplass) så
              // innholds-sammenligningen (radInnholdLikt) treffer post-state.
              const payloadVersjon: VersjonPayloadRad[] = lokal.timer.map((t) => ({
                id: t.id,
                serverVersjon: t.serverVersjon ?? null,
                endretLokalt: t.endretLokalt,
                projectId: radProsjekt(t.projectId),
                byggeplassId: t.byggeplassId ?? lokal.byggeplassId ?? null,
                lonnsartId: t.lonnsartId,
                aktivitetId: t.aktivitetId,
                externalCostObjectId: t.externalCostObjectId ?? null,
                vehicleId: t.vehicleId ?? null,
                timer: t.timer,
                fraTid: t.fraTid ?? null,
                tilTid: t.tilTid ?? null,
                beskrivelse: t.beskrivelse ?? null,
                pauseMin: t.pauseMin ?? 0,
              }));

              // Tombstones: `timerVersjoner` (m/ versjon) har forrang; eldre
              // `timer: string[]` → ukjent versjon (S4, trygg retning). Ingen id
              // behandles to ganger.
              const versjonerIder = new Set(
                (lokal.slettedeIder?.timerVersjoner ?? []).map((d) => d.id),
              );
              const tombstones: VersjonTombstone[] = [
                ...(lokal.slettedeIder?.timerVersjoner ?? []).map((d) => ({
                  id: d.id,
                  serverVersjon: d.serverVersjon,
                })),
                ...(lokal.slettedeIder?.timer ?? [])
                  .filter((id) => !versjonerIder.has(id))
                  .map((id) => ({ id, serverVersjon: undefined })),
              ];

              const klass = klassifiserSyncRader(
                serverTimerFull as unknown as VersjonServerRad[],
                payloadVersjon,
                tombstones,
              );
              skrivTimerIder = new Set(klass.skriv);
              slettTimerIder = klass.slett;
              hoppetOverIder = klass.hoppOver;

              // Bygg forslags-radene: payload-kilde = telefonens rad; server-kilde
              // (slettet_telefon) = KOPI av serverraden (samme id, V19.9.6).
              const payloadById = new Map(lokal.timer.map((t) => [t.id, t]));
              avvikForslag = klass.avvik.map((a) => {
                if (a.kilde === "payload") {
                  return { ...payloadById.get(a.id)!, grunn: a.grunn };
                }
                const s = serverById.get(a.id)!;
                return {
                  id: s.id,
                  projectId: s.projectId,
                  byggeplassId: s.byggeplassId,
                  lonnsartId: s.lonnsartId,
                  aktivitetId: s.aktivitetId,
                  fraTid: s.fraTid,
                  tilTid: s.tilTid,
                  timer: Number(s.timer),
                  pauseMin: s.pauseMin,
                  beskrivelse: s.beskrivelse,
                  externalCostObjectId: s.externalCostObjectId,
                  vehicleId: s.vehicleId,
                  erReise: s.erReise,
                  reiseRetning: s.reiseRetning,
                  reiseOppmotestedId: s.reiseOppmotestedId,
                  reiseKjoretidMin: s.reiseKjoretidMin,
                  reiseAvstandM: s.reiseAvstandM,
                  reiseKilde: s.reiseKilde,
                  reiseRegel: s.reiseRegel,
                  tidKilde: s.tidKilde,
                  grunn: a.grunn,
                } as OverlappPayloadRad & { grunn: string };
              });

              // V19.1 har FORRANG (V19.9.5): post-state-unionen = overlevende
              // serverrader (hoppede/avvikende/uberørte) ∪ «skriv»-rader. Overlapp
              // i TID der → HELE payloaden blir forslag som i V19-A (grunn pr. rad:
              // avvik beholder sin, resten "overlapp"), ingen skriving.
              const skrivServerIder = new Set(
                [...skrivTimerIder].filter((id) => serverById.has(id)),
              );
              const slettSet = new Set(slettTimerIder);
              const overlevendeServerRader = serverTimerFull.filter(
                (s) => !skrivServerIder.has(s.id) && !slettSet.has(s.id),
              );
              const skrivRader = lokal.timer.filter((t) => skrivTimerIder.has(t.id));
              if (finnOverlappMotServer(overlevendeServerRader, skrivRader)) {
                const grunnById = new Map(
                  klass.avvik
                    .filter((a) => a.kilde === "payload")
                    .map((a) => [a.id, a.grunn]),
                );
                // V19.9 (fabel-vilkår a): hoppOver-radene er telefonens STALE kopi av
                // rader PC-en har endret og telefonen ikke rørte (R3). I ren V19-A gikk
                // de med i forslaget og ble valgbare på tid — «appen for hele dagen»
                // rullet da PC-endringen tilbake. V19.9 VET hvilke det er → hold dem
                // UTE av forslaget (PC-versjonen står urørt på serveren).
                const hoppetOverSet = new Set(hoppetOverIder);
                const payloadMedGrunn = lokal.timer
                  .filter((t) => !hoppetOverSet.has(t.id))
                  .map((t) => ({
                    ...t,
                    grunn: grunnById.get(t.id) ?? "overlapp",
                  }));
                // V19.9-A2 (d): tombstone-avvik (slettet_telefon, S2'/S4) er IKKE i
                // lokal.timer — det er en KOPI av serverraden. I ikke-overlapp-grenen
                // går det med i forslaget; her må det også med, ellers forsvinner
                // telefonens sletting stille. (Payload-kilde-avvik ligger alt i
                // payloadMedGrunn via lokal.timer; server-kilde er kun slettet_telefon.)
                const tombstoneForslag = avvikForslag.filter(
                  (a) => a.grunn === "slettet_telefon",
                );
                const aarsak = await lagreOverlappForslag(
                  tx,
                  eksisterendeITx.id,
                  [...payloadMedGrunn, ...tombstoneForslag],
                  lokal.projectId ?? null,
                );
                return { slag: "overlapp", aarsak, skrevneRader: [], hoppetOver: hoppetOverIder };
              }
            }

            let sedel;
            if (!eksisterendeITx) {
              sedel = await tx.dailySheet.create({
                data: {
                  // Synk-identitet (2026-07-11): id == clientUuid ved create —
                  // se opprett-blokken over. Gjør server-id lik mobil-lokal-id
                  // (= clientUuid) så push/pull nøkler på samme identitet.
                  id: lokal.clientUuid,
                  clientUuid: lokal.clientUuid,
                  organizationId: orgId,
                  userId: ctx.userId,
                  registrertAvUserId: ctx.userId,
                  aktivitetId: lokal.aktivitetId,
                  avdelingId: lokal.avdelingId ?? null,
                  byggeplassId: lokal.byggeplassId ?? null,
                  dato,
                  startAt: lokal.startAt ? new Date(lokal.startAt) : null,
                  endAt: lokal.endAt ? new Date(lokal.endAt) : null,
                  pauseMin: lokal.pauseMin,
                  sluttTidKilde: lokal.sluttTidKilde,
                  // LAG 2 (C1/B5): normens kilde + snapshot følger sedelen.
                  normStatus: lokal.normStatus ?? null,
                  normSnapshot: jsonEllerNull(lokal.normSnapshot),
                  status: innkommendeStatus,
                  beskrivelse: lokal.beskrivelse ?? null,
                  syncStatus: "synced",
                  syncedAt: new Date(),
                },
              });
            } else {
              const oppdatertAntall = await tx.dailySheet.updateMany({
                where: {
                  clientUuid: lokal.clientUuid,
                  status: { notIn: ["accepted"] },
                },
                data: {
                  aktivitetId: lokal.aktivitetId,
                  avdelingId: lokal.avdelingId ?? null,
                  byggeplassId: lokal.byggeplassId ?? null,
                  dato,
                  startAt: lokal.startAt ? new Date(lokal.startAt) : null,
                  endAt: lokal.endAt ? new Date(lokal.endAt) : null,
                  pauseMin: lokal.pauseMin,
                  sluttTidKilde: lokal.sluttTidKilde,
                  // LAG 2 (C1/B5): normens kilde + snapshot følger sedelen.
                  normStatus: lokal.normStatus ?? null,
                  normSnapshot: jsonEllerNull(lokal.normSnapshot),
                  status: innkommendeStatus,
                  beskrivelse: lokal.beskrivelse ?? null,
                  syncStatus: "synced",
                  syncedAt: new Date(),
                },
              });
              if (oppdatertAntall.count === 0) {
                // Sedelen ble attestert i vinduet → konflikt. Kastes → tx rulles
                // tilbake, ingenting skrevet; fanges i loop-catchen under.
                throw new SedelAttestertConflict();
              }
              sedel = await tx.dailySheet.findUniqueOrThrow({
                where: { clientUuid: lokal.clientUuid },
              });
            }

            // S3 (2026-07-11): IKKE slett-og-gjenopprett hele sedelen. Slett kun
            // radene mobil faktisk sender (som den gjenoppretter autoritativt
            // under) og la server-rader som IKKE er i payloaden stå. Dette
            // bevarer web-førte rader mobil aldri pullet — ved en dato-kollisjon
            // (S2/M1) pushes mobilens rader additivt inn på server-sedelen uten
            // å stryke web-radene. Konsekvens (akseptert beslutning): mobil rad-
            // SLETTING propagerer ikke automatisk — «aldri mist data» prioriteres
            // over sletting-propagering. Delte rad-id (samme rad på web og mobil)
            // gjenoppbygges fra mobil-versjonen (mobil eier egne rader).
            // V19.9: KUN «skriv»-radene erstattes (deleteMany deres id + createMany
            // under). Hoppede/avvikende serverrader står urørt. tillegg/maskin/utlegg
            // er IKKE versjonert → full payload-replace som før.
            const skrivTimerListe = lokal.timer.filter((t) => skrivTimerIder.has(t.id));
            const tilleggIder = lokal.tillegg.map((tl) => tl.id);
            const maskinIder = lokal.maskiner.map((m) => m.id);
            const utleggIderPayload = lokal.utlegg.map((u) => u.id);
            if (skrivTimerListe.length > 0) {
              await tx.sheetTimer.deleteMany({
                where: { sheetId: sedel.id, id: { in: skrivTimerListe.map((t) => t.id) } },
              });
            }
            if (tilleggIder.length > 0) {
              await tx.sheetTillegg.deleteMany({
                where: { sheetId: sedel.id, id: { in: tilleggIder } },
              });
            }
            if (maskinIder.length > 0) {
              await tx.sheetMachine.deleteMany({
                where: { sheetId: sedel.id, id: { in: maskinIder } },
              });
            }
            if (utleggIderPayload.length > 0) {
              // U4: payload-replace, samme S3-policy. Vedlegg (SheetUtleggVedlegg)
              // har svak FK og bevares — samme id gjenopprettes under, vedlegget
              // re-kobles (som tillegg-vedlegg). Vedlegg-opplasting går egen kø.
              await tx.sheetUtlegg.deleteMany({
                where: { sheetId: sedel.id, id: { in: utleggIderPayload } },
              });
            }

            // S-A KRAV 2 (2026-07-13): propagér arbeiderens rad-slettinger. I
            // TILLEGG til payload-replace over — ellers ville en slettet rad som
            // IKKE er i payloaden overleve på server (S3-policy) og re-pull'es.
            // Scopet på sheetId: sedel.id (arbeider kan aldri slette rader på en
            // annen sedel). Ligger i SAMME transaksjon + etter samme inline-vakt
            // (eierskap ctx.userId + status draft/returnert/sent-overgang) som
            // payload-replace — hviler ikke på klient-låsen. Idempotent (trygt
            // ved re-send etter partiell batch-feil).
            if (lokal.slettedeIder) {
              // V19.9: timer-slettinger er KLASSIFISERT (slettTimerIder) — en
              // tombstone mot en PC-endret rad ble avvik (slettet_telefon), ikke en
              // stille sletting. tillegg/maskin/utlegg er uendret (ikke versjonert).
              const slettTimer = slettTimerIder;
              const slettTillegg = lokal.slettedeIder.tillegg;
              const slettMaskin = lokal.slettedeIder.maskiner;
              if (slettTimer.length > 0) {
                await tx.sheetTimer.deleteMany({
                  where: { sheetId: sedel.id, id: { in: slettTimer } },
                });
              }
              if (slettTillegg.length > 0) {
                await tx.sheetTillegg.deleteMany({
                  where: { sheetId: sedel.id, id: { in: slettTillegg } },
                });
              }
              if (slettMaskin.length > 0) {
                await tx.sheetMachine.deleteMany({
                  where: { sheetId: sedel.id, id: { in: slettMaskin } },
                });
              }
              // U4: propagér utlegg-slettinger (default [] for eldre klienter).
              const slettUtlegg = lokal.slettedeIder.utlegg;
              if (slettUtlegg.length > 0) {
                await tx.sheetUtlegg.deleteMany({
                  where: { sheetId: sedel.id, id: { in: slettUtlegg } },
                });
              }
            }

            // T7-3b1: rad-nivå projectId overstyrer sedel-nivå hvis satt.
            // Faller tilbake til lokal.projectId (sedel-nivå) for pre-T7-3b1
            // klienter som ikke sender per-rad projectId.
            if (skrivTimerListe.length > 0) {
              // LEGACY-VERN (2026-07-13): fra/til-obligatorisk-regelen fra de
              // interaktive mutasjonene (tilfoyTimerRad/oppdaterTimerRad/splitt)
              // håndheves BEVISST IKKE her. Eksisterende prod-rader OG GPS-auto-
              // genererte rader kan mangle tider og round-trip'er via syncBatch —
              // å avvise dem ville låst mobil-synk. Kun fra<til + overlapp
              // (SYNC-2, over) håndheves på synkveien.
              await tx.sheetTimer.createMany({
                data: skrivTimerListe.map((t) => {
                  // LAG 2 (C1): reise-sporet bygget over (C2/C3 alt kjørt). Hver rad
                  // har en oppføring; utledet erReise for rader uten eksplisitt flagg.
                  const rf = reiseFelterMap.get(t.id)!;
                  return {
                    id: t.id,
                    sheetId: sedel.id,
                    projectId: radProsjekt(t.projectId)!,
                    // F3: per-rad byggeplass overstyrer sedel-nivå; null → arv
                    // fra dagskortet (sedel-verdien). Bakoverkompat: eldre klient
                    // sender ikke feltet → t.byggeplassId undefined → sedel-nivå.
                    byggeplassId: t.byggeplassId ?? lokal.byggeplassId ?? null,
                    lonnsartId: t.lonnsartId,
                    aktivitetId: t.aktivitetId,
                    externalCostObjectId: t.externalCostObjectId ?? null,
                    vehicleId: t.vehicleId ?? null,
                    timer: t.timer,
                    // SYNC-2: persister fra/til (før: strippet + utelatt → datatap).
                    fraTid: t.fraTid ?? null,
                    tilTid: t.tilTid ?? null,
                    beskrivelse: t.beskrivelse ?? null,
                    // V20/PK4b: radens vurderte matpause (normalisert — bæreren
                    // tildeles der timetallet beviser fradraget, aldri avvist).
                    pauseMin: syncPauseEtterId.get(t.id) ?? 0,
                    // LAG 2 (C1): reise-sporet persisteres (M6 — før stripte Zod det).
                    erReise: rf.erReise,
                    reiseRetning: rf.reiseRetning,
                    reiseOppmotestedId: rf.reiseOppmotestedId,
                    reiseKjoretidMin: rf.reiseKjoretidMin,
                    reiseAvstandM: rf.reiseAvstandM,
                    reiseKilde: rf.reiseKilde,
                    reiseRegel: jsonEllerNull(rf.reiseRegel),
                    tidKilde: rf.tidKilde,
                    reiseAvvik: rf.reiseAvvik,
                  };
                }),
              });
            }
            // V20/PK6: hodet = Σ rad.pauseMin etter delete+create av timer-rader.
            // Ignorerer payloadens lokal.pauseMin (satt på sedelen over) — hodet
            // er utledet, ikke klient-skrevet.
            await synkroniserHodePause(tx, sedel.id);
            if (lokal.tillegg.length > 0) {
              await tx.sheetTillegg.createMany({
                data: lokal.tillegg.map((tl) => ({
                  id: tl.id,
                  sheetId: sedel.id,
                  projectId: radProsjekt(tl.projectId)!,
                  tilleggId: tl.tilleggId,
                  antall: tl.antall,
                  kommentar: tl.kommentar ?? null,
                })),
              });
            }
            if (lokal.maskiner.length > 0) {
              await tx.sheetMachine.createMany({
                data: lokal.maskiner.map((m) => ({
                  id: m.id,
                  sheetId: sedel.id,
                  // Del B pkt 1: bevar koblingen til timer-raden gjennom sync.
                  sheetTimerId: m.sheetTimerId ?? null,
                  projectId: radProsjekt(m.projectId)!,
                  externalCostObjectId: m.externalCostObjectId ?? null,
                  byggeplassId: lokal.byggeplassId ?? null,
                  vehicleId: m.vehicleId,
                  timer: m.timer,
                  mengde: m.mengde ?? null,
                  enhet: m.enhet ?? null,
                  // SYNC-2: persister fra/til (datatap-fiks, samme som timer).
                  fraTid: m.fraTid ?? null,
                  tilTid: m.tilTid ?? null,
                })),
              });
            }
            if (lokal.utlegg.length > 0) {
              // U4: skriv utlegg-radene med klientens STEMPEL, uten re-utledning.
              // `ordningVedFoering` = det klienten utledet ved føring; CHECK-
              // constrainten i db-timer håndhever beløps-regelen mot stempelet.
              // `createdAt` settes eksplisitt til klientens føringstidspunkt
              // (overstyrer @default(now())) så stempelet er reviderbart i tid —
              // IKKE synk-tidspunktet (tillegg-hullet, flagget i timer.md).
              await tx.sheetUtlegg.createMany({
                data: lokal.utlegg.map((u) => ({
                  id: u.id,
                  sheetId: sedel.id,
                  projectId: radProsjekt(u.projectId)!,
                  expenseCategoryId: u.expenseCategoryId,
                  belop: u.belop ?? null,
                  kommentar: u.kommentar ?? null,
                  ordningVedFoering: u.ordningVedFoering,
                  createdAt: new Date(u.foertVed),
                })),
              });
            }

            // V19.9.8 (A'-5): les tilbake versjonene for radene som FAKTISK ble
            // skrevet (etter createMany → updatedAt er satt). Mobilen skriver dem
            // som server_versjon; hoppede rader røres ALDRI (stale innhold, hentes
            // ved neste pull — sedel-hodets updatedAt er bumpet).
            const skrevneRader = skrivTimerListe.length
              ? (
                  await tx.sheetTimer.findMany({
                    where: {
                      sheetId: sedel.id,
                      id: { in: skrivTimerListe.map((t) => t.id) },
                    },
                    select: { id: true, updatedAt: true },
                  })
                ).map((r) => ({ id: r.id, updatedAt: r.updatedAt.toISOString() }))
              : [];

            // V19.9.5 (A-1b steg 5): uomstridte rader og hodet ER skrevet (over);
            // hvis avvik-settet ikke er tomt, lagres forslaget i SAMME tx (grunn pr.
            // rad) og konfliktVentendeSiden settes → svar conflict/overlapp. Ellers ok.
            if (avvikForslag.length > 0) {
              const aarsak = await lagreOverlappForslag(
                tx,
                sedel.id,
                avvikForslag,
                lokal.projectId ?? null,
              );
              return { slag: "overlapp", aarsak, skrevneRader, hoppetOver: hoppetOverIder };
            }

            return { slag: "ok", sedel, skrevneRader, hoppetOver: hoppetOverIder };
          });

          // A-1b overlapp: forslaget er lagret (eller sedelen var låst → "laast").
          // V19-A/laast: sheet_timer URØRT. V19.9 versjonsavvik: de uomstridte radene
          // ER skrevet (`skrevneRader`), avvikende gikk til forslag. Svar conflict med
          // eksplisitt årsak + sedelens identitet + versjonene (V19.9.8) så mobilen
          // setter syncStatus = "conflict", skriver server_versjon for skrevne rader
          // og lar de hoppede være (B-1/B'-4).
          if (txResultat.slag === "overlapp") {
            const serverSedel = await ctx.prismaTimer.dailySheet.findUnique({
              where: { clientUuid: lokal.clientUuid },
            });
            if (serverSedel) {
              resultater.push({
                clientUuid: lokal.clientUuid,
                resultat: "conflict",
                aarsak: txResultat.aarsak,
                serverData: {
                  id: serverSedel.id,
                  clientUuid: serverSedel.clientUuid,
                  status: serverSedel.status as DagsseddelStatus,
                  lederKommentar: serverSedel.lederKommentar,
                  attestertVed: serverSedel.attestertVed?.toISOString() ?? null,
                  updatedAt: serverSedel.updatedAt.toISOString(),
                  rader: txResultat.skrevneRader,
                  hoppetOver: txResultat.hoppetOver,
                },
              });
            } else {
              // Falt bort mellom tx og re-lesning (svært sjelden) → la klient retry.
              resultater.push({
                clientUuid: lokal.clientUuid,
                resultat: "feilet",
                feilmelding: "Sedelen endret tilstand under synk",
              });
            }
            continue;
          }

          const oppdatert = txResultat.sedel;
          resultater.push({
            clientUuid: lokal.clientUuid,
            resultat: "ok",
            serverData: {
              id: oppdatert.id,
              status: oppdatert.status as DagsseddelStatus,
              lederKommentar: oppdatert.lederKommentar,
              attestertVed: oppdatert.attestertVed?.toISOString() ?? null,
              updatedAt: oppdatert.updatedAt.toISOString(),
              // V19.9.8 (A'-5): versjonene for skrevne rader + hoppede rad-id-er.
              rader: txResultat.skrevneRader,
              hoppetOver: txResultat.hoppetOver,
            },
          });
        } catch (e) {
          if (e instanceof SedelAttestertConflict) {
            // 2b: sedelen ble attestert av leder i skrive-vinduet. Returner
            // server-tilstanden som `conflict` (samme form som accepted-vakten
            // over). Klienten overskriver lokal med serverData og setter
            // syncStatus="conflict" (timerSync.ts) — den skal PULLE server-
            // tilstand, ikke retry blindt (en retry ville få samme conflict).
            const attestert = await ctx.prismaTimer.dailySheet.findUnique({
              where: { clientUuid: lokal.clientUuid },
            });
            if (attestert) {
              resultater.push({
                clientUuid: lokal.clientUuid,
                resultat: "conflict",
                serverData: {
                  id: attestert.id,
                  status: attestert.status as DagsseddelStatus,
                  lederKommentar: attestert.lederKommentar,
                  attestertVed: attestert.attestertVed?.toISOString() ?? null,
                  updatedAt: attestert.updatedAt.toISOString(),
                },
                feilmelding: "Sedlen ble attestert av leder og kan ikke endres",
              });
              continue;
            }
            // Falt bort mellom tx-rollback og re-lesning (svært sjelden) → la
            // klient retry (transient).
            resultater.push({
              clientUuid: lokal.clientUuid,
              resultat: "feilet",
              feilmelding: "Sedelen endret tilstand under synk",
            });
            continue;
          }
          if (e instanceof TRPCError) {
            // Tilgangsfeil (FORBIDDEN fra verifiserProsjektmedlem) er permanent
            // — klienten kan ikke fikse dette med retry → `avvist` (SYNC-1).
            resultater.push({
              clientUuid: lokal.clientUuid,
              resultat: "avvist",
              feilmelding: e.message,
            });
            continue;
          }
          if (e instanceof Prisma.PrismaClientKnownRequestError) {
            // S2 (2026-07-11): P2002 på @@unique([userId, dato]) er en
            // identitetskollisjon — server har allerede en sedel for denne
            // datoen under en ANNEN clientUuid (registrert på web/annen enhet).
            // Speil `opprett` (findUnique userId_dato) og returner `conflict`
            // med server-sedelens identitet i stedet for `avvist`, så mobil kan
            // forsone (re-nøkle + additiv push) i stedet for å miste arbeiderens
            // offline-rader. `dato` er ikke i scope her (block-scoped i try) —
            // recompute fra lokal.
            if (e.code === "P2002") {
              const kollisjonDato = new Date(lokal.dato);
              const eksisterende = await ctx.prismaTimer.dailySheet.findUnique({
                where: {
                  userId_dato: { userId: ctx.userId, dato: kollisjonDato },
                },
              });
              // Kun ekte dato-kollisjon (annen clientUuid) blir conflict. Annen
              // P2002 (f.eks. rad-id-PK) → behold `avvist` (permanent, klienten
              // kan ikke rette via retry).
              if (
                eksisterende &&
                eksisterende.clientUuid !== lokal.clientUuid
              ) {
                // A-1a (V19.7, M11) — den VANLIGSTE saken: dagen er ført på PC
                // først, telefonen pusher etterpå og får P2002. Her, FØR mobilen
                // nøkler om, sjekkes overlapp mot server-sedelens rader. Alle
                // server-rader overlever (mobilens rader finnes ikke på serveren
                // ennå — create-en traff P2002), så unionen = serverRader ∪ payload.
                // Treff → forslag lagret i egen tx (lesning + skriving på SAMME tx,
                // test 1c TOCTOU) → "overlapp"/"laast". Ikke treff → "dato_kollisjon"
                // (dagens re-nøkle + additiv push, V19.4). sheet_timer URØRT uansett.
                const aarsak = await ctx.prismaTimer.$transaction(async (tx) => {
                  const serverRader = await tx.sheetTimer.findMany({
                    where: { sheetId: eksisterende.id },
                    select: { fraTid: true, tilTid: true },
                  });
                  if (!finnOverlappMotServer(serverRader, lokal.timer)) {
                    return "dato_kollisjon" as const;
                  }
                  return await lagreOverlappForslag(
                    tx,
                    eksisterende.id,
                    lokal.timer,
                    lokal.projectId ?? null,
                  );
                });
                resultater.push({
                  clientUuid: lokal.clientUuid,
                  resultat: "conflict",
                  // A-2: eksplisitt årsak. "dato_kollisjon" speiler dagens oppførsel
                  // (re-nøkle + additiv push); "overlapp" → forslag lagret, velg;
                  // "laast" → server-sedelen er sent/accepted, server-wins.
                  aarsak,
                  serverData: {
                    id: eksisterende.id,
                    clientUuid: eksisterende.clientUuid,
                    status: eksisterende.status as DagsseddelStatus,
                    lederKommentar: eksisterende.lederKommentar,
                    attestertVed:
                      eksisterende.attestertVed?.toISOString() ?? null,
                    updatedAt: eksisterende.updatedAt.toISOString(),
                  },
                  // Ingen feilmelding: dette er et MASKINSIGNAL til mobilen om å
                  // forsone identiteten (re-nøkle + additiv re-push, timerSync M1),
                  // ikke en handling arbeideren skal gjøre. Brukerteksten eies av
                  // klienten (i18n `timer.sync.slattSammen`) — serveren har ingen
                  // i18n, og den gamle strengen «dine timer slås sammen med den»
                  // beskrev en manuell fremtidig handling som ikke lenger finnes.
                });
                continue;
              }
              resultater.push({
                clientUuid: lokal.clientUuid,
                resultat: "avvist",
                feilmelding: "Duplisert dagsseddel for samme dato",
              });
              continue;
            }
            // Andre Prisma-koder kan være transiente (DB-blip, deadlock) →
            // `feilet` så de retries.
            resultater.push({
              clientUuid: lokal.clientUuid,
              resultat: "feilet",
              feilmelding: `DB-feil: ${e.code}`,
            });
            continue;
          }
          // Ukjent feil — la klient retry
          const melding = e instanceof Error ? e.message : "Ukjent feil";
          resultater.push({
            clientUuid: lokal.clientUuid,
            resultat: "feilet",
            feilmelding: melding,
          });
        }
      }

      return { serverTid: new Date().toISOString(), resultater };
    }),

  // ============================================================================
  //  Maskin-rader (C9 2026-05-02) — sheet_machines lever i db-timer fordi
  //  Timer eier dagsseddelen. Equipment-katalog leveres av Maskin-modul via
  //  service-lag (cross-modul-konvensjon per arkitektur-syntese § 6.1.1).
  //  Equipment er svak FK (ingen @relation) → org-isolasjon MÅ håndheves i
  //  app-lag: §2.D validerer vehicleId mot firmaets register på alle
  //  SheetMachine-skrive-stier (verifiserKjoretoyTilhørerFirma).
  // ============================================================================

  maskin: router({
    tilfoy: protectedProcedure
      .input(
        z.object({
          sheetId: z.string().uuid(),
          projectId: z.string().uuid(),
          externalCostObjectId: z.string().uuid().nullable().optional(),
          byggeplassId: z.string().uuid().nullable().optional(),
          vehicleId: z.string().uuid(),
          timer: z.number().min(0).max(24),
          mengde: z.number().min(0).nullable().optional(),
          enhet: z.string().max(20).nullable().optional(),
          fraTid: z.string().nullable().optional(),
          tilTid: z.string().nullable().optional(),
        }).superRefine(refineFraForTil),
      )
      .mutation(async ({ ctx, input }) => {
        const sheet = await hentEgenDagsseddel(
          ctx.prismaTimer,
          ctx.userId,
          input.sheetId,
        );
        if (!erRedigerbar(sheet.status)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Dagsseddel er låst (status: ${sheet.status})`,
          });
        }
        await sjekkAldersgrense(sheet.organizationId, sheet.status, sheet.dato);

        // §2.D: vehicleId (maskin-kostnadsbærer) må tilhøre firmaet. Svak FK
        // mot Equipment (db-maskin) → org-isolasjon håndheves i app-lag.
        await verifiserKjoretoyTilhørerFirma(input.vehicleId, sheet.organizationId);

        // T7-4b: valider post-state.
        const naa = await hentRaderForValidering(
          ctx.prismaTimer,
          input.sheetId,
        );
        const postMaskin: ValiderRad[] = [
          ...naa.maskin,
          {
            projectId: input.projectId,
            externalCostObjectId: input.externalCostObjectId ?? null,
            timer: input.timer,
          },
        ];
        const brytt = validerMaskinUnderArbeid(naa.timer, postMaskin, sheet.pauseMin);
        if (brytt.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: await feilMeldingMaskinOverstiger(brytt),
          });
        }

        // F4-1d: rad-write + touchSedel atomisk.
        const [rad] = await ctx.prismaTimer.$transaction([
          ctx.prismaTimer.sheetMachine.create({
            data: {
              sheetId: input.sheetId,
              projectId: input.projectId,
              externalCostObjectId: input.externalCostObjectId ?? null,
              byggeplassId: input.byggeplassId ?? null,
              vehicleId: input.vehicleId,
              timer: input.timer,
              mengde: input.mengde ?? null,
              enhet: input.enhet ?? null,
              fraTid: input.fraTid ?? null,
              tilTid: input.tilTid ?? null,
            },
          }),
          touchSedel(ctx.prismaTimer, input.sheetId),
        ]);
        return rad;
      }),

    oppdater: protectedProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          vehicleId: z.string().uuid().optional(),
          externalCostObjectId: z.string().uuid().nullable().optional(),
          timer: z.number().min(0).max(24).optional(),
          mengde: z.number().min(0).nullable().optional(),
          enhet: z.string().max(20).nullable().optional(),
          // Maskin-fra-til (2026-05-17): la rediger-modus oppdatere
          // fra/til-tid. tilfoy-routen aksepterte allerede disse — oppdater
          // var glemt. Symmetri med SheetTimer.oppdater (T.4 PR 2).
          fraTid: z.string().nullable().optional(),
          tilTid: z.string().nullable().optional(),
        }).superRefine(refineFraForTil),
      )
      .mutation(async ({ ctx, input }) => {
        const rad = await ctx.prismaTimer.sheetMachine.findUnique({
          where: { id: input.id },
        });
        if (!rad) throw new TRPCError({ code: "NOT_FOUND" });

        const sheet = await hentEgenDagsseddel(
          ctx.prismaTimer,
          ctx.userId,
          rad.sheetId,
        );
        if (!erRedigerbar(sheet.status)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Dagsseddel er låst (status: ${sheet.status})`,
          });
        }
        await sjekkAldersgrense(sheet.organizationId, sheet.status, sheet.dato);

        // §2.D: valider ny vehicleId mot firmaets maskinregister når en ID
        // settes. vehicleId er optional (ikke nullable) → if dekker undefined.
        if (input.vehicleId) {
          await verifiserKjoretoyTilhørerFirma(input.vehicleId, sheet.organizationId);
        }

        const data: Prisma.SheetMachineUpdateInput = {};
        if (input.vehicleId !== undefined) data.vehicleId = input.vehicleId;
        if (input.timer !== undefined) data.timer = input.timer;
        if (input.mengde !== undefined) data.mengde = input.mengde;
        if (input.enhet !== undefined) data.enhet = input.enhet;
        if (input.externalCostObjectId !== undefined) {
          data.externalCostObjectId = input.externalCostObjectId;
        }
        if (input.fraTid !== undefined) data.fraTid = input.fraTid;
        if (input.tilTid !== undefined) data.tilTid = input.tilTid;

        // T7-4b: valider post-state. Endring av timer eller ECO på maskin
        // kan bryte sum(maskin) ≤ sum(timer)-invariant.
        const naa = await hentRaderForValidering(ctx.prismaTimer, rad.sheetId);
        const postMaskin: ValiderRad[] = naa.maskin.map((r) =>
          r.id === input.id
            ? {
                projectId: r.projectId, // projectId endres ikke i maskin.oppdater
                externalCostObjectId:
                  input.externalCostObjectId !== undefined
                    ? input.externalCostObjectId
                    : r.externalCostObjectId,
                timer: input.timer !== undefined ? input.timer : r.timer,
              }
            : r,
        );
        const brytt = validerMaskinUnderArbeid(naa.timer, postMaskin, sheet.pauseMin);
        if (brytt.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: await feilMeldingMaskinOverstiger(brytt),
          });
        }

        // F4-1d: rad-write + touchSedel atomisk.
        const [oppdatert] = await ctx.prismaTimer.$transaction([
          ctx.prismaTimer.sheetMachine.update({
            where: { id: input.id },
            data,
          }),
          touchSedel(ctx.prismaTimer, rad.sheetId),
        ]);
        return oppdatert;
      }),

    fjern: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const rad = await ctx.prismaTimer.sheetMachine.findUnique({
          where: { id: input.id },
        });
        if (!rad) throw new TRPCError({ code: "NOT_FOUND" });

        const sheet = await hentEgenDagsseddel(
          ctx.prismaTimer,
          ctx.userId,
          rad.sheetId,
        );
        if (!erRedigerbar(sheet.status)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Dagsseddel er låst (status: ${sheet.status})`,
          });
        }

        // F4-1d: rad-write + touchSedel atomisk.
        const [slettet] = await ctx.prismaTimer.$transaction([
          ctx.prismaTimer.sheetMachine.delete({ where: { id: input.id } }),
          touchSedel(ctx.prismaTimer, rad.sheetId),
        ]);
        return slettet;
      }),
  }),

  // ============================================================================
  //  hentDagstotal (C9 2026-05-02) — sum timer på tvers av prosjekter for én
  //  bruker × én dato. Brukstilfelle: mobil viser «Du har ført Xt i dag på N
  //  prosjekter» øverst i ny-dagsseddel-flyten. Multi-sedel per dag er gyldig
  //  per unique-constraint (userId, projectId, dato).
  // ============================================================================

  hentDagstotal: protectedProcedure
    .input(
      z.object({
        userId: z.string().uuid().optional(), // default = innlogget bruker
        dato: z.string(), // ISO YYYY-MM-DD
        // Valgt/innlogget firma (Kenneth-vedtak 2026-10-09). Utelatt → egen org.
        organizationId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = await resolverOrgFraInput(ctx.userId, input.organizationId);
      const userId = input.userId ?? ctx.userId;

      // Hvis bruker ber om noen andres dagstotal: krev admin
      if (userId !== ctx.userId) {
        const bruker = await prisma.user.findUniqueOrThrow({
          where: { id: ctx.userId },
          select: { role: true },
        });
        let tillatt = bruker.role === "sitedoc_admin";
        if (!tillatt) {
          const member = await prisma.organizationMember.findUnique({
            where: { userId_organizationId: { userId: ctx.userId, organizationId: orgId } },
            select: { firmaRoller: true },
          });
          tillatt = member?.firmaRoller.includes("firma_admin") ?? false;
        }
        if (!tillatt) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Krever admin for å se andres dagstotal",
          });
        }
      }

      const dato = new Date(input.dato);

      const sedler = await ctx.prismaTimer.dailySheet.findMany({
        where: {
          organizationId: orgId,
          userId,
          dato,
        },
        include: { timer: true },
      });

      // T.1 (2026-05-11): projectId ligger på rad. Aggregér per (sheetId, projectId)
      // for å beholde dagens UI-kontrakt («Du har ført Xt på N prosjekter»).
      type SheetProsjektRad = {
        sheetId: string;
        projectId: string;
        status: string;
        timer: number;
      };
      const radPerProsjekt = new Map<string, SheetProsjektRad>();
      for (const s of sedler) {
        for (const t of s.timer) {
          const noekkel = `${s.id}|${t.projectId}`;
          const eksisterende = radPerProsjekt.get(noekkel);
          if (eksisterende) {
            eksisterende.timer += Number(t.timer);
          } else {
            radPerProsjekt.set(noekkel, {
              sheetId: s.id,
              projectId: t.projectId,
              status: s.status,
              timer: Number(t.timer),
            });
          }
        }
      }
      const projektIder = Array.from(
        new Set(Array.from(radPerProsjekt.values()).map((r) => r.projectId)),
      );
      const prosjekter =
        projektIder.length === 0
          ? []
          : await prisma.project.findMany({
              where: { id: { in: projektIder } },
              select: { id: true, name: true, projectNumber: true },
            });
      const prosjektMap = new Map(prosjekter.map((p) => [p.id, p]));

      const perProsjekt = Array.from(radPerProsjekt.values()).map((r) => ({
        sheetId: r.sheetId,
        projectId: r.projectId,
        projectNavn: prosjektMap.get(r.projectId)?.name ?? null,
        projectNummer: prosjektMap.get(r.projectId)?.projectNumber ?? null,
        status: r.status,
        timer: r.timer,
      }));

      const totalTimer = perProsjekt.reduce((acc, p) => acc + p.timer, 0);

      return {
        dato: input.dato,
        userId,
        totalTimer,
        antallSedler: sedler.length,
        perProsjekt,
      };
    }),
});

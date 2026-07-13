import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@sitedoc/db-timer";
import { prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../../trpc/trpc";
import {
  autoriserAdminForFirma,
  verifiserProsjektmedlem,
  verifiserProsjekterTilhørerFirma,
  hentBrukersOrg,
  krevBrukersOrg,
} from "../../trpc/tilgangskontroll";
import { krevTimerAktivert, hentEffektivArbeidstid } from "../../services/timer";
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
} from "@sitedoc/shared";

const STATUS_VERDIER = ["draft", "sent", "returned", "accepted"] as const;
type DagsseddelStatus = (typeof STATUS_VERDIER)[number];

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
function erRedigerbar(status: string): boolean {
  return status === "draft" || status === "returned";
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
) {
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
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const orgId = await krevBrukersOrg(ctx.userId);

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

      const sedler = await ctx.prismaTimer.dailySheet.findMany({
        where,
        include: {
          aktivitet: { select: { id: true, navn: true, kode: true } },
          timer: true,
          tillegg: true,
          maskiner: true,
        },
        orderBy: [{ dato: "desc" }, { createdAt: "desc" }],
        take: 200,
      });

      // Berik med totaltimer (sum av alle SheetTimer-rader) for liste-visning.
      // T.1: prosjekt(er) utledes fra radene (DailySheet har ikke projectId) —
      // distinct projectId på tvers av timer-/maskin-/tillegg-rader.
      return sedler.map((s) => {
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
    }),

  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, input.id);
      const [aktivitet, timer, tillegg, maskiner] = await Promise.all([
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
      ]);
      // T.1 (2026-05-11): DailySheet har ikke projectId. Bruk første rad som proxy.
      const projectId =
        timer[0]?.projectId ?? maskiner[0]?.projectId ?? tillegg[0]?.projectId ?? null;
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
      const tilleggMedVedlegg = tillegg.map((t) => ({
        ...t,
        vedlegg: vedlegg.filter((v) => v.sheetTilleggId === t.id),
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
        prosjekt,
        manglerMaskinforerbevis,
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
        dato: z.string(), // ISO-dato (YYYY-MM-DD)
        startAt: z.string().nullable().optional(), // ISO timestamp
        endAt: z.string().nullable().optional(),
        pauseMin: z.number().int().min(0).default(0),
        sluttTidKilde: z.enum(["bruker", "midnatt", "system"]).default("bruker"),
        beskrivelse: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await krevBrukersOrg(ctx.userId);
      await krevTimerAktivert(orgId);

      // T.1: Web-opprett er dato-only — sedelen eies av arbeider/firma og har
      // ingen prosjekttilhørighet. Org-tilgang (krevBrukersOrg + krevTimerAktivert)
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
        timer: z.number().min(0).max(24),
        fraTid: z.string().nullable().optional(),
        tilTid: z.string().nullable().optional(),
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

      // F4-1d: rad-write + touchSedel atomisk så mobil pull ser den nye raden.
      const [rad] = await ctx.prismaTimer.$transaction([
        ctx.prismaTimer.sheetTimer.create({
          data: {
            sheetId: input.sheetId,
            projectId: input.projectId,
            byggeplassId: input.byggeplassId ?? null,
            lonnsartId: input.lonnsartId,
            aktivitetId: input.aktivitetId,
            timer: input.timer,
            fraTid: input.fraTid ?? null,
            tilTid: input.tilTid ?? null,
            beskrivelse: input.beskrivelse ?? null,
            externalCostObjectId: input.externalCostObjectId ?? null,
            vehicleId: input.vehicleId ?? null,
          },
        }),
        touchSedel(ctx.prismaTimer, input.sheetId),
      ]);
      return rad;
    }),

  oppdaterTimerRad: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        lonnsartId: z.string().uuid().optional(),
        aktivitetId: z.string().uuid().optional(),
        timer: z.number().min(0).max(24).optional(),
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

      const data: Prisma.SheetTimerUpdateInput = {};
      if (input.lonnsartId !== undefined) {
        data.lonnsart = { connect: { id: input.lonnsartId } };
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

      // F4-1d: rad-write + touchSedel atomisk.
      const [oppdatert] = await ctx.prismaTimer.$transaction([
        ctx.prismaTimer.sheetTimer.update({
          where: { id: input.id },
          data,
        }),
        touchSedel(ctx.prismaTimer, rad.sheetId),
      ]);
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

      // F4-1d: rad-write + touchSedel atomisk.
      const [slettet] = await ctx.prismaTimer.$transaction([
        ctx.prismaTimer.sheetTimer.delete({ where: { id: input.id } }),
        touchSedel(ctx.prismaTimer, rad.sheetId),
      ]);
      return slettet;
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
      await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, rad.sheetId);
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
      await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, input.sheetId);
      const rader = await ctx.prismaTimer.sheetTillegg.findMany({
        where: { sheetId: input.sheetId },
        select: { id: true },
      });
      if (rader.length === 0) return [];
      return ctx.prismaTimer.sheetTilleggVedlegg.findMany({
        where: { sheetTilleggId: { in: rader.map((r) => r.id) } },
        orderBy: { createdAt: "asc" },
      });
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
      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, rad.sheetId);
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

  // ----- Status-overgang -------------------------------------------------
  // draft → sent. Krever minst én timer-rad. Leder-attestering (sent → returned/accepted)
  // implementeres i Runde 1C.
  send: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, input.id);

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
      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, input.id);

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

  // Slett egen dagsseddel — kun draft-status tillatt
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, input.id);
      if (sheet.status !== "draft") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Kun utkast (draft) kan slettes",
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
          timer: true,
          tillegg: true,
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

  // @deprecated alias for hentTilAttestering — beholdes 1 uke per CLAUDE.md
  // API-bakoverkompatibilitet-regel. Fjernes etter 2026-05-09.
  hentTilGodkjenning: protectedProcedure
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
          timer: true,
          tillegg: true,
        },
        orderBy: [{ dato: "asc" }, { createdAt: "asc" }],
      });

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

  // @deprecated alias for kanAttestere — beholdes 1 uke per CLAUDE.md
  // API-bakoverkompatibilitet-regel. Fjernes etter 2026-05-09.
  kanGodkjenne: protectedProcedure
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
        status: z.enum(["sent", "accepted"]).optional().default("sent"),
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
        select: { id: true, name: true, projectNumber: true },
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
      const sedler = await ctx.prismaTimer.dailySheet.findMany({
        where: {
          status: input.status,
          timer: { some: { projectId: { in: prosjektIder } } },
          ...(datoFilter ? { dato: datoFilter } : {}),
        },
        include: {
          aktivitet: { select: { id: true, navn: true, kode: true } },
          // Filtrer ut "erstattet"-rader (audit-spor fra rediger-mutasjoner).
          // Uten dette vises gamle rader sammen med erstatningene i listen.
          timer: { where: { attestertStatus: { not: "erstattet" } } },
          tillegg: { where: { attestertStatus: { not: "erstattet" } } },
          maskiner: { where: { attestertStatus: { not: "erstattet" } } },
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
              select: { id: true, name: true, projectNumber: true },
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
        { id: string; name: string; projectNumber: string | null }
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

      return sedler.map((s) => {
        const projectId = s.timer[0]?.projectId ?? null;
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
          antallRader: s.timer.length + s.tillegg.length,
          tilleggHarKrav: s.tillegg.length > 0,
          dagsnorm,
          redigerTillatt,
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
      const [timer, tillegg, maskiner] = await Promise.all([
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
            select: { id: true, name: true, projectNumber: true },
          }),
          // T7-2d: per-rad prosjekt-lookup
          alleProjectIds.length > 0
            ? ctx.prisma.project.findMany({
                where: { id: { in: alleProjectIds } },
                select: { id: true, name: true, projectNumber: true },
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
      const paussFeltGitt =
        input.pauseFra !== undefined || input.pauseTil !== undefined;
      let pauseUpdate: {
        pauseFra: string | null;
        pauseTil: string | null;
        pauseMin: number;
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
          pauseUpdate = {
            pauseFra: input.pauseFra,
            pauseTil: input.pauseTil,
            pauseMin: Math.round(diff),
          };
        } else {
          pauseUpdate = { pauseFra: null, pauseTil: null, pauseMin: 0 };
        }
      }

      // Pause-aware maskin-validering: bruk ny pauseMin hvis vi endrer den,
      // ellers eksisterende sheet.pauseMin.
      const effektivPauseMin = pauseUpdate?.pauseMin ?? sheet.pauseMin;
      const brytt = validerMaskinUnderArbeid(postTimer, postMaskin, effektivPauseMin);
      if (brytt.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: await feilMeldingMaskinOverstiger(brytt),
        });
      }

      // Transaksjon: marker alle eksisterende pending som "erstattet" + opprett nye
      await ctx.prismaTimer.$transaction([
        // F4-1d: oppdater sedelen ALLTID (ikke bare ved pause-endring) — ellers
        // bumpes ikke updatedAt når leder kun redigerer rader, og de nye radene
        // blir usynlige for mobil inkrementell pull (updatedAt > sistSynk).
        ctx.prismaTimer.dailySheet.update({
          where: { id: sheet.id },
          data: { ...(pauseUpdate ?? {}), updatedAt: new Date() },
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
        ...input.nyeRader.timer.map((rad) =>
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
              vehicleId: rad.vehicleId ?? null,
              attestertStatus: "pending",
              parentRadId: rad.originalId,
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
        await ctx.prismaTimer.$transaction([
          // T7-2b-oppfølger (2026-07-13): MOVE originalen til historikk (INSERT
          // snapshot) + slett fra hovedtabellen i SAMME tx — ikke status="erstattet".
          ctx.prismaTimer.sheetRadHistorikk.createMany({
            data: [byggHistorikkPost("timer", original, ctx.userId, naa)],
          }),
          ctx.prismaTimer.sheetTimer.delete({ where: { id: original.id } }),
          ...input.nyeRader.map((rad) =>
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
                // T.10: split = samme arbeid → arv original-radens kostnadsbærer.
                // Allerede org-validert da originalen ble opprettet — ingen ny sjekk.
                vehicleId: (original as { vehicleId: string | null }).vehicleId ?? null,
                attestertStatus: "pending",
                parentRadId: original.id,
              },
            }),
          ),
        ]);
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
        await ctx.prismaTimer.$transaction([
          ctx.prismaTimer.sheetTimer.delete({ where: { id: original.id } }),
          ...input.nyeRader.map((rad) =>
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
                // Split = samme arbeid → arv original-radens kostnadsbærer.
                vehicleId:
                  (original as { vehicleId: string | null }).vehicleId ?? null,
              },
            }),
          ),
        ]);
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
        select: { status: true },
      });
      if (!sheet) throw new TRPCError({ code: "NOT_FOUND" });
      if (sheet.status !== "sent") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Kun innsendte dagssedler kan attesteres (status: ${sheet.status})`,
        });
      }

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
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = await krevBrukersOrg(ctx.userId);
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

      return {
        serverTid: new Date().toISOString(),
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
          updatedAt: s.updatedAt.toISOString(),
          // T7-3b1 (2026-05-14): expose projectId per rad så mobil kan lagre
          // per-rad-attribusjon offline. Tidligere proxyet vi via første rad
          // til sedel-nivå (sedelProjectId over) — den feltet beholdes for
          // bakoverkompatibilitet med pre-T7-3b1-klienter.
          // T4-d (2026-05-16): expose fraTid/tilTid per timer/maskin-rad.
          timer: s.timer.map((t) => ({
            id: t.id,
            projectId: t.projectId,
            lonnsartId: t.lonnsartId,
            aktivitetId: t.aktivitetId,
            externalCostObjectId: t.externalCostObjectId,
            vehicleId: t.vehicleId,
            timer: Number(t.timer),
            fraTid: t.fraTid,
            tilTid: t.tilTid,
            beskrivelse: t.beskrivelse,
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
            vehicleId: m.vehicleId,
            timer: Number(m.timer),
            mengde: m.mengde !== null ? Number(m.mengde) : null,
            enhet: m.enhet,
            fraTid: m.fraTid,
            tilTid: m.tilTid,
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
                timer: z.number().min(0).max(24),
                // SYNC-2 (2026-07-10): fra/til per rad — MÅ deklareres her ellers
                // stripper Zod dem (T4-d koblet kun lese-/online-siden, aldri
                // sync-skrivesiden → tider ført på web ble slettet ved mobilsynk).
                fraTid: z.string().nullable().optional(),
                tilTid: z.string().nullable().optional(),
                // T.12: fritekst per rad («hva jeg gjorde»).
                beskrivelse: z.string().nullable().optional(),
                // T.10: kostnadsbærer for maskinvedlikehold (svak FK → Equipment).
                vehicleId: z.string().uuid().nullable().optional(),
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
          }),
        ).max(100), // Begrens batch-størrelse for å unngå tidsavbrudd
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await krevBrukersOrg(ctx.userId);
      await krevTimerAktivert(orgId);

      // SYNC-1 (2026-07-10): `avvist` = permanent avvisning klienten ikke kan
      // rette via retry (P2002-duplikat, katalog-mismatch, maskin>arbeid,
      // FORBIDDEN — og fra SYNC-2 overlapp/`fra<til`). Mobil gjør `avvist`
      // terminal (forlater pending, rødt banner). `feilet` = transient (behold
      // pending, retry neste tick). Bakoverkompat: eldre klient (#37) faller til
      // else på ukjent `avvist` og beholder pending — samme som dagens oppførsel.
      type ResultatRad = {
        clientUuid: string;
        resultat: "ok" | "conflict" | "avvist" | "feilet";
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
            // sikret (krevBrukersOrg + krevTimerAktivert). Konsistent med web
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
                  select: { id: true },
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
            lokal.pauseMin,
          );
          if (syncBrytt.length > 0) {
            resultater.push({
              clientUuid: lokal.clientUuid,
              resultat: "avvist",
              feilmelding: await feilMeldingMaskinOverstiger(syncBrytt),
            });
            continue;
          }

          // Per-seddel transaksjon: upsert sedel + erstatt rader atomisk
          // T.1 (2026-05-11): projectId/byggeplassId lagres på rad-nivå.
          // Mobil sender fortsatt lokal.projectId på sedel-nivå inntil mobil-PR
          // er ute — vi propagerer den til alle rader her.
          const oppdatert = await ctx.prismaTimer.$transaction(async (tx) => {
            const sedel = await tx.dailySheet.upsert({
              where: { clientUuid: lokal.clientUuid },
              create: {
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
                status: innkommendeStatus,
                beskrivelse: lokal.beskrivelse ?? null,
                syncStatus: "synced",
                syncedAt: new Date(),
              },
              update: {
                aktivitetId: lokal.aktivitetId,
                avdelingId: lokal.avdelingId ?? null,
                byggeplassId: lokal.byggeplassId ?? null,
                dato,
                startAt: lokal.startAt ? new Date(lokal.startAt) : null,
                endAt: lokal.endAt ? new Date(lokal.endAt) : null,
                pauseMin: lokal.pauseMin,
                sluttTidKilde: lokal.sluttTidKilde,
                status: innkommendeStatus,
                beskrivelse: lokal.beskrivelse ?? null,
                syncStatus: "synced",
                syncedAt: new Date(),
              },
            });

            // S3 (2026-07-11): IKKE slett-og-gjenopprett hele sedelen. Slett kun
            // radene mobil faktisk sender (som den gjenoppretter autoritativt
            // under) og la server-rader som IKKE er i payloaden stå. Dette
            // bevarer web-førte rader mobil aldri pullet — ved en dato-kollisjon
            // (S2/M1) pushes mobilens rader additivt inn på server-sedelen uten
            // å stryke web-radene. Konsekvens (akseptert beslutning): mobil rad-
            // SLETTING propagerer ikke automatisk — «aldri mist data» prioriteres
            // over sletting-propagering. Delte rad-id (samme rad på web og mobil)
            // gjenoppbygges fra mobil-versjonen (mobil eier egne rader).
            const timerIder = lokal.timer.map((t) => t.id);
            const tilleggIder = lokal.tillegg.map((tl) => tl.id);
            const maskinIder = lokal.maskiner.map((m) => m.id);
            if (timerIder.length > 0) {
              await tx.sheetTimer.deleteMany({
                where: { sheetId: sedel.id, id: { in: timerIder } },
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

            // T7-3b1: rad-nivå projectId overstyrer sedel-nivå hvis satt.
            // Faller tilbake til lokal.projectId (sedel-nivå) for pre-T7-3b1
            // klienter som ikke sender per-rad projectId.
            if (lokal.timer.length > 0) {
              // LEGACY-VERN (2026-07-13): fra/til-obligatorisk-regelen fra de
              // interaktive mutasjonene (tilfoyTimerRad/oppdaterTimerRad/splitt)
              // håndheves BEVISST IKKE her. Eksisterende prod-rader OG GPS-auto-
              // genererte rader kan mangle tider og round-trip'er via syncBatch —
              // å avvise dem ville låst mobil-synk. Kun fra<til + overlapp
              // (SYNC-2, over) håndheves på synkveien.
              await tx.sheetTimer.createMany({
                data: lokal.timer.map((t) => ({
                  id: t.id,
                  sheetId: sedel.id,
                  projectId: radProsjekt(t.projectId)!,
                  byggeplassId: lokal.byggeplassId ?? null,
                  lonnsartId: t.lonnsartId,
                  aktivitetId: t.aktivitetId,
                  externalCostObjectId: t.externalCostObjectId ?? null,
                  vehicleId: t.vehicleId ?? null,
                  timer: t.timer,
                  // SYNC-2: persister fra/til (før: strippet + utelatt → datatap).
                  fraTid: t.fraTid ?? null,
                  tilTid: t.tilTid ?? null,
                  beskrivelse: t.beskrivelse ?? null,
                })),
              });
            }
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

            return sedel;
          });

          resultater.push({
            clientUuid: lokal.clientUuid,
            resultat: "ok",
            serverData: {
              id: oppdatert.id,
              status: oppdatert.status as DagsseddelStatus,
              lederKommentar: oppdatert.lederKommentar,
              attestertVed: oppdatert.attestertVed?.toISOString() ?? null,
              updatedAt: oppdatert.updatedAt.toISOString(),
            },
          });
        } catch (e) {
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
                resultater.push({
                  clientUuid: lokal.clientUuid,
                  resultat: "conflict",
                  serverData: {
                    id: eksisterende.id,
                    clientUuid: eksisterende.clientUuid,
                    status: eksisterende.status as DagsseddelStatus,
                    lederKommentar: eksisterende.lederKommentar,
                    attestertVed:
                      eksisterende.attestertVed?.toISOString() ?? null,
                    updatedAt: eksisterende.updatedAt.toISOString(),
                  },
                  feilmelding:
                    "Det finnes allerede en dagsseddel for denne datoen — dine timer slås sammen med den.",
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
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = await krevBrukersOrg(ctx.userId);
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

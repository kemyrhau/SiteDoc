import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";
import { sikreKortId, vareKortIdForSkriving } from "../services/timer/kortId";
import { lesVarerForSpor, skrivSlettespor } from "../services/timer/slettespor";
import type { Context } from "../trpc/context";
import {
  verifiserProsjektmedlem,
  aktivtProsjektmedlemWhere,
  aktivtMedlemWhere,
  verifiserOrganisasjonTilgang,
  erFirmaAdmin,
  erAnsattIFirma,
  aktivAnsattIEierfirma,
  verifiserProsjektIkkeFrosset,
  verifiserProsjekterTilhørerFirma,
} from "../trpc/tilgangskontroll";
import { verifiserByggeplassIProsjekt } from "../services/tegningVakt";
import {
  krevVarelagerAktivert,
  erVarelagerAktivert,
  VarelagerModulIkkeAktivertError,
} from "../services/varelager/moduleGate";

/** Statuser der sedelens eier selv kan endre vareforbruket på den. */
const SEDEL_AAPEN_FOR_EIER = ["draft", "returned"];

/**
 * ORDRE 33: vareforbruk på en dagsseddel følger sedelen. Eieren kan endre mens
 * sedelen er åpen (utkast/returnert); ellers kreves sitedoc_admin, prosjektadmin
 * eller firma_admin i SEDELENS firma (ikke prosjektets — UE-sedler på HE-prosjekt).
 * Meldingen er en i18n-nøkkel som klienten oversetter.
 */
async function krevVareforbrukPaaSedel(
  userId: string,
  sheet: { userId: string; status: string; organizationId: string },
  projectId: string,
): Promise<void> {
  if (sheet.userId === userId && SEDEL_AAPEN_FOR_EIER.includes(sheet.status)) return;
  const bruker = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (bruker?.role === "sitedoc_admin") return;
  const medlem = await prisma.projectMember.findFirst({
    where: aktivtProsjektmedlemWhere(userId, projectId),
    select: { role: true },
  });
  if (medlem?.role === "admin") return;
  if (await erFirmaAdmin(userId, sheet.organizationId)) return;
  throw new TRPCError({
    code: "FORBIDDEN",
    message: sheet.userId === userId ? "vareforbruk.feil.sedelSendt" : "vareforbruk.feil.annensSedel",
  });
}

/** Sedel-vakten for en eksisterende linje. Linje uten (eller med forsvunnet) sedel er uberørt. */
async function krevVareforbrukLinjeAapen(
  prismaTimer: Context["prismaTimer"],
  userId: string,
  dagsseddelId: string | null,
  projectId: string,
): Promise<void> {
  if (!dagsseddelId) return;
  const sheet = await prismaTimer.dailySheet.findUnique({
    where: { id: dagsseddelId },
    select: { userId: true, status: true, organizationId: true },
  });
  if (sheet) await krevVareforbrukPaaSedel(userId, sheet, projectId);
}

/**
 * Radform (2026-11-12): en vare kan kobles til timerraden den er ført fra — men bare
 * når raden ligger på samme sedel og samme prosjekt. Ugyldig kobling (ingen sedel,
 * rad på annen sedel/prosjekt, rad ikke synket ennå) gir `null`: linjen lagres
 * likevel og vises under «Uten rad». En vareregistrering avvises aldri for koblingens
 * skyld — tapt vareforbruk er verre enn en manglende plassering.
 */
export async function gyldigVareRad(
  prismaTimer: Pick<Context["prismaTimer"], "sheetTimer">,
  sheetTimerId: string | null | undefined,
  dagsseddelId: string | null,
  projectId: string,
): Promise<string | null> {
  if (!sheetTimerId || !dagsseddelId) return null;
  const rad = await prismaTimer.sheetTimer.findUnique({
    where: { id: sheetTimerId },
    select: { sheetId: true, projectId: true },
  });
  return rad && rad.sheetId === dagsseddelId && rad.projectId === projectId ? sheetTimerId : null;
}

/**
 * Runde 5 (Kenneth 2026-11-27, vedtak A): varen kobles til maskinraden den er ført fra i
 * maskinvinduet — men bare når maskinen ligger på samme sedel, samme (allerede validerte)
 * timerad, samme prosjekt og samme underprosjekt. Ellers `null` (myk, som `gyldigVareRad`):
 * linjen lagres likevel og vises i Varer-blokka. Firma er dekket av sedel- og prosjektsjekken.
 */
export async function gyldigVareMaskin(
  prismaTimer: Pick<Context["prismaTimer"], "sheetMachine">,
  sheetMachineId: string | null | undefined,
  args: {
    dagsseddelId: string | null;
    sheetTimerId: string | null;
    projectId: string;
    externalCostObjectId: string | null;
  },
): Promise<string | null> {
  if (!sheetMachineId || !args.dagsseddelId || !args.sheetTimerId) return null;
  const m = await prismaTimer.sheetMachine.findUnique({
    where: { id: sheetMachineId },
    select: { sheetId: true, sheetTimerId: true, projectId: true, externalCostObjectId: true },
  });
  return m &&
    m.sheetId === args.dagsseddelId &&
    m.sheetTimerId === args.sheetTimerId &&
    m.projectId === args.projectId &&
    (m.externalCostObjectId ?? null) === args.externalCostObjectId
    ? sheetMachineId
    : null;
}

/**
 * Prosjektets eier-firma (varelager-eieren). Kaster når eier-firma mangler.
 *
 * O11 (§ 8.22, Kenneth 2026-11-22): brukes alene for en vare som alt står på prosjektet —
 * f.eks. fulgt med en jobb som ble flyttet til et prosjekt uten varelager. Den kan leses,
 * endres og slettes der. Bare modulsjekken faller bort; prosjekttilgangen, sedelvakten og
 * tilgang-policyen sjekkes som før. Ny vare og flytting TIL et prosjekt bruker
 * `krevVarelagerForProsjekt`.
 */
async function eierFirmaForProsjekt(projectId: string): Promise<string> {
  const prosjekt = await prisma.project.findUnique({
    where: { id: projectId },
    select: { primaryOrganizationId: true },
  });
  if (!prosjekt || !prosjekt.primaryOrganizationId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Prosjektet har ikke et eier-firma satt",
    });
  }
  return prosjekt.primaryOrganizationId;
}

/**
 * Hent prosjektets eier-firma + sjekk at modulen er aktiv på prosjekt-nivå.
 * Returnerer organizationId for videre validering.
 */
async function krevVarelagerForProsjekt(projectId: string): Promise<string> {
  const organizationId = await eierFirmaForProsjekt(projectId);
  try {
    await krevVarelagerAktivert(organizationId, projectId);
  } catch (e) {
    if (e instanceof VarelagerModulIkkeAktivertError) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Varelager-modulen er ikke aktivert for dette prosjektet",
      });
    }
    throw e;
  }
  return organizationId;
}

/**
 * Tilgang-policy: håndhev OrganizationSetting.vareforbrukTilgangDefault.
 *
 *   - alle-ansatte         → aktiv ansatt i eierfirmaet eller prosjektmedlem
 *                            (krevVareProsjektTilgang, FIRMAADMIN-TILGANG D).
 *   - kun-prosjektmedlemmer → krever ekte ProjectMember-rad (ikke kun
 *                              company_admin-bypass).
 *   - sertifiserte         → fallback til kun-prosjektmedlemmer (Kompetanse-
 *                              sjekk utsettes til Kompetansetype får
 *                              «kreves for vareregistrering»-flagg).
 */
/** Firmaets vare-policy (`OrganizationSetting.vareforbrukTilgangDefault`), default «alle-ansatte». */
async function hentVarePolicy(organizationId: string): Promise<string> {
  const setting = await prisma.organizationSetting.findUnique({
    where: { organizationId },
    select: { vareforbrukTilgangDefault: true },
  });
  return setting?.vareforbrukTilgangDefault ?? "alle-ansatte";
}

/**
 * FIRMAADMIN-TILGANG D (Kenneth 2026-11-25: «finn ut hva som skal til for at silje og
 * medlemmer kan registrere varer i kortet sitt»). Prosjekttilgangen for en vare-linje.
 *
 * Med policy «alle-ansatte» gjelder samme prosjektsett som timer (`prosjekt.hentForTimer`):
 * en aktiv ansatt i prosjektets EIERFIRMA slipper inn uten ProjectMember-rad. Varelageret
 * eies av eierfirmaet (`krevVarelagerForProsjekt`), så et prosjekt firmaet bare deltar i
 * (annen eier, annen varekatalog) gir ikke denne veien — der gjelder `verifiserProsjektmedlem`
 * som før. Frysevakten gjelder som for medlemmer. Andre policy-verdier: uendret.
 */
async function krevVareProsjektTilgang(userId: string, projectId: string): Promise<void> {
  const eierOrg = await aktivAnsattIEierfirma(userId, projectId);
  if (eierOrg && (await hentVarePolicy(eierOrg)) === "alle-ansatte") {
    await verifiserProsjektIkkeFrosset(userId, projectId);
    return;
  }
  await verifiserProsjektmedlem(userId, projectId);
}

async function krevTilgangPolicy(
  userId: string,
  organizationId: string,
  projectId: string,
): Promise<void> {
  const policy = await hentVarePolicy(organizationId);

  if (policy === "alle-ansatte") {
    await krevVareProsjektTilgang(userId, projectId);
    return;
  }

  // kun-prosjektmedlemmer eller sertifiserte (sertifiserte = fallback til
  // kun-prosjektmedlemmer i Sesjon 2). Bruker må ha ekte ProjectMember-rad.
  const bruker = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (bruker?.role === "sitedoc_admin") return;

  const medlem = await prisma.projectMember.findFirst({
    where: aktivtProsjektmedlemWhere(userId, projectId),
    select: { id: true },
  });
  if (!medlem) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Bare prosjektmedlemmer kan registrere vareforbruk",
    });
  }
}

async function validerEco(
  externalCostObjectId: string,
  organizationId: string,
  projectId: string,
): Promise<void> {
  const eco = await prisma.externalCostObject.findUnique({
    where: { id: externalCostObjectId },
  });
  if (!eco || eco.slettetVed !== null) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Underprosjektet finnes ikke",
    });
  }
  if (eco.organizationId !== organizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Underprosjektet tilhører ikke firmaet",
    });
  }
  if (eco.projectId !== projectId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Underprosjektet tilhører ikke samme prosjekt",
    });
  }
  if (eco.status !== "aktiv" || !eco.timerregistreringApen) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Underprosjektet er ikke åpent for registrering",
    });
  }
}

async function validerVareTilhoererFirma(
  vareId: string,
  organizationId: string,
  prismaVarelager: typeof import("@sitedoc/db-varelager").prismaVarelager,
): Promise<void> {
  const vare = await prismaVarelager.vare.findUnique({
    where: { id: vareId },
    select: { organizationId: true, aktiv: true },
  });
  if (!vare || vare.organizationId !== organizationId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Varen tilhører ikke dette firmaet",
    });
  }
  if (!vare.aktiv) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Varen er deaktivert",
    });
  }
}

export const vareforbrukRouter = router({
  // Prosjektkort L3 (2026-11-06, Kenneth godkjente forslag A): vare-velgeren på
  // prosjektkortet (web + mobil-cache). `vare.list` krever firmaadmin, så en
  // arbeider trenger en egen, smal lese-rute. KUN fire felt pr. vare — ingen
  // priser eller admin-felt. `prosjektIderMedVarelager` = brukerens aktive
  // prosjekter i firmaet der modulen er på (samme resolver som API-porten),
  // så mobil kan skjule «+ Vareforbruk» offline.
  katalogForFirma: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await verifiserOrganisasjonTilgang(ctx.userId, input.organizationId);
      if (!(await erVarelagerAktivert(input.organizationId))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Varelager-modulen er ikke aktivert for dette firmaet",
        });
      }

      // FIRMAADMIN-TILGANG D (2026-11-25): med «alle-ansatte» tilbys alle prosjekter firmaet
      // EIER, som timer — aktiv ansatt trenger ingen medlemsrad (samme regel som
      // `krevVareProsjektTilgang` i opprett). Ellers: bare egne aktive medlemskap, som før.
      const alleAnsatte =
        (await hentVarePolicy(input.organizationId)) === "alle-ansatte" &&
        (await erAnsattIFirma(ctx.userId, input.organizationId));
      const prosjektWhere = alleAnsatte
        ? { primaryOrganizationId: input.organizationId }
        : {
            primaryOrganizationId: input.organizationId,
            members: { some: { userId: ctx.userId, ...aktivtMedlemWhere } },
          };

      const [varer, prosjekter] = await Promise.all([
        ctx.prismaVarelager.vare.findMany({
          where: { organizationId: input.organizationId, aktiv: true },
          select: { id: true, navn: true, enhet: true, varenummer: true },
          orderBy: [{ navn: "asc" }],
        }),
        prisma.project.findMany({
          where: prosjektWhere,
          select: { id: true },
        }),
      ]);

      const aktive = await Promise.all(
        prosjekter.map(async (p) =>
          (await erVarelagerAktivert(input.organizationId, p.id)) ? p.id : null,
        ),
      );

      return {
        varer: varer.map((v) => ({
          id: v.id,
          navn: v.navn,
          enhet: v.enhet,
          varenummer: v.varenummer,
        })),
        prosjektIderMedVarelager: aktive.filter((id): id is string => id !== null),
      };
    }),

  // Prosjektkort L1 (2026-11-05): innlogget brukers eget vareforbruk for én
  // dato på tvers av firmaets prosjekter — Varer-kolonnen på prosjektkortet.
  // Firma-isolert (kun prosjekter med primaryOrganizationId = firmaet) og
  // bruker-isolert (registrertAvUserId = ctx.userId). Kun lesing.
  hentMineForDato: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        dato: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Forventet YYYY-MM-DD"),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await verifiserOrganisasjonTilgang(ctx.userId, input.organizationId);

      const prosjekter = await prisma.project.findMany({
        where: { primaryOrganizationId: input.organizationId },
        select: { id: true },
      });
      if (prosjekter.length === 0) return [];

      const rader = await ctx.prismaVarelager.vareforbruk.findMany({
        where: {
          registrertAvUserId: ctx.userId,
          dato: new Date(input.dato),
          projectId: { in: prosjekter.map((p) => p.id) },
        },
        select: {
          id: true,
          projectId: true,
          byggeplassId: true,
          // ORDRE 36b: dagsoversikten trenger underprosjektet for å vise/flytte raden.
          externalCostObjectId: true,
          dagsseddelId: true,
          // Radform (2026-11-12): dagsoversikten viser varen under sin timerrad.
          sheetTimerId: true,
          // Runde 5: dagskortet viser varen under maskinraden den er ført fra.
          sheetMachineId: true,
          // w3a: dagssiden legger varen i jobbens kort (kort-id) og sorterer som de andre linjene.
          kortId: true,
          createdAt: true,
          antall: true,
          // Punkt 7 (2026-11-13): vare-arket skjuler «Endre mengde»/«Slett» for attesterte
          // linjer. Bare flagget sendes — snapshotet (pris o.l.) blir på serveren.
          attestertSnapshot: true,
          vare: { select: { id: true, navn: true, enhet: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      return rader.map(({ attestertSnapshot, ...r }) => ({
        ...r,
        antall: Number(r.antall),
        attestert: attestertSnapshot !== null,
      }));
    }),

  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        fra: z.string().optional(),
        til: z.string().optional(),
        byggeplassId: z.string().uuid().nullable().optional(),
        dagsseddelId: z.string().uuid().nullable().optional(),
        vareId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      await krevVarelagerForProsjekt(input.projectId);

      const where: {
        projectId: string;
        dato?: { gte?: Date; lte?: Date };
        byggeplassId?: string | null;
        dagsseddelId?: string | null;
        vareId?: string;
      } = { projectId: input.projectId };

      if (input.fra || input.til) {
        where.dato = {};
        if (input.fra) where.dato.gte = new Date(input.fra);
        if (input.til) where.dato.lte = new Date(input.til);
      }
      if (input.byggeplassId !== undefined) where.byggeplassId = input.byggeplassId;
      if (input.dagsseddelId !== undefined) where.dagsseddelId = input.dagsseddelId;
      if (input.vareId) where.vareId = input.vareId;

      const rader = await ctx.prismaVarelager.vareforbruk.findMany({
        where,
        include: {
          vare: {
            select: { id: true, navn: true, varenummer: true, enhet: true, kategoriId: true },
          },
        },
        orderBy: [{ dato: "desc" }, { createdAt: "desc" }],
      });

      // Berik med registrert-av brukernavn (svak FK, ikke Prisma-relasjon)
      const userIds = Array.from(new Set(rader.map((r) => r.registrertAvUserId)));
      const brukere = userIds.length
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
      const brukerMap = new Map(brukere.map((b) => [b.id, b]));

      return rader.map((r) => ({
        ...r,
        registrertAv: brukerMap.get(r.registrertAvUserId) ?? null,
        erLast: r.attestertSnapshot !== null,
      }));
    }),

  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const rad = await ctx.prismaVarelager.vareforbruk.findUnique({
        where: { id: input.id },
        include: { vare: true },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });

      await verifiserProsjektmedlem(ctx.userId, rad.projectId);
      // O11: eksisterende vare leses også på prosjekt uten varelager.
      await eierFirmaForProsjekt(rad.projectId);

      const bruker = await prisma.user.findUnique({
        where: { id: rad.registrertAvUserId },
        select: { id: true, name: true, email: true },
      });

      return { ...rad, registrertAv: bruker, erLast: rad.attestertSnapshot !== null };
    }),

  opprett: protectedProcedure
    .input(
      z.object({
        // Prosjektkort L3: valgfri klient-generert id for idempotent mobil-synk.
        // Samme id sendt på nytt → den eksisterende raden returneres, ingen ny.
        id: z.string().uuid().optional(),
        projectId: z.string().uuid(),
        dato: z.string(),
        vareId: z.string().uuid(),
        antall: z.number().positive(),
        byggeplassId: z.string().uuid().nullable().optional(),
        externalCostObjectId: z.string().uuid().nullable().optional(),
        kommentar: z.string().max(2000).nullable().optional(),
        dagsseddelId: z.string().uuid().nullable().optional(),
        // Radform (2026-11-12): timerraden varen er ført fra. Krever dagsseddelId,
        // og raden må ligge på den sedelen og ha samme prosjekt.
        sheetTimerId: z.string().uuid().nullable().optional(),
        // Runde 5: maskinraden varen er ført fra (maskinvinduet). Må ligge på samme sedel,
        // timerad, prosjekt og underprosjekt — ellers lagres varen uten maskin.
        sheetMachineId: z.string().uuid().nullable().optional(),
        // Kort-id (prosjektkort-kortid-spec § 4.3): valgfri. Koblet vare får radens id;
        // uten sedel → NULL; ellers regel 3.
        kortId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const userId = ctx.userId;

      // Idempotens (L3): en mobil-synk som sender samme id to ganger (svar tapt
      // på nett) skal gi én linje. Kun egen rad returneres; en fremmed rad med
      // samme id avvises.
      const hentEksisterende = async () => {
        if (!input.id) return null;
        const rad = await ctx.prismaVarelager.vareforbruk.findUnique({
          where: { id: input.id },
        });
        if (rad && rad.registrertAvUserId !== userId) {
          throw new TRPCError({ code: "CONFLICT", message: "Id-en er i bruk" });
        }
        return rad;
      };
      const eksisterende = await hentEksisterende();
      if (eksisterende) return eksisterende;

      await krevVareProsjektTilgang(ctx.userId, input.projectId);
      // ORDRE 29 #14: byggeplassen (hoved-DB) MÅ tilhøre prosjektet.
      if (input.byggeplassId) {
        await verifiserByggeplassIProsjekt(ctx.prisma, input.byggeplassId, input.projectId);
      }
      const organizationId = await krevVarelagerForProsjekt(input.projectId);
      await krevTilgangPolicy(ctx.userId, organizationId, input.projectId);

      await validerVareTilhoererFirma(input.vareId, organizationId, ctx.prismaVarelager);

      if (input.externalCostObjectId) {
        await validerEco(input.externalCostObjectId, organizationId, input.projectId);
      }

      if (input.dagsseddelId) {
        // T.1 (2026-05-11): DailySheet har ikke lenger projectId. Sjekk i stedet
        // at sedelen tilhører eier-bruker og at minst én rad på sedelen er for
        // samme prosjekt (eller at sedel finnes — Vareforbruk har egen projectId
        // som primær prosjekt-referanse).
        const sheet = await ctx.prismaTimer.dailySheet.findUnique({
          where: { id: input.dagsseddelId },
          select: {
            userId: true,
            status: true,
            organizationId: true,
            timer: { where: { projectId: input.projectId }, select: { id: true }, take: 1 },
          },
        });
        if (!sheet) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Dagsseddelen finnes ikke",
          });
        }
        if (sheet.timer.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Dagsseddelen har ingen timer-rader for dette prosjektet",
          });
        }
        await krevVareforbrukPaaSedel(userId, sheet, input.projectId);
      }

      const sheetTimerId = await gyldigVareRad(
        ctx.prismaTimer,
        input.sheetTimerId,
        input.dagsseddelId ?? null,
        input.projectId,
      );

      const sheetMachineId = await gyldigVareMaskin(ctx.prismaTimer, input.sheetMachineId, {
        dagsseddelId: input.dagsseddelId ?? null,
        sheetTimerId,
        projectId: input.projectId,
        externalCostObjectId: input.externalCostObjectId ?? null,
      });

      const kortId = await vareKortIdForSkriving(ctx.prismaTimer, {
        dagsseddelId: input.dagsseddelId ?? null,
        sheetTimerId,
        oppgittKortId: input.kortId,
        ny: {
          projectId: input.projectId,
          byggeplassId: input.byggeplassId ?? null,
          externalCostObjectId: input.externalCostObjectId ?? null,
        },
      });

      let opprettet;
      try {
        opprettet = await ctx.prismaVarelager.vareforbruk.create({
          data: {
            ...(input.id ? { id: input.id } : {}),
            projectId: input.projectId,
            dato: new Date(input.dato),
            vareId: input.vareId,
            antall: input.antall,
            byggeplassId: input.byggeplassId ?? null,
            externalCostObjectId: input.externalCostObjectId ?? null,
            kommentar: input.kommentar?.trim() || null,
            dagsseddelId: input.dagsseddelId ?? null,
            sheetTimerId,
            sheetMachineId,
            kortId,
            registrertAvUserId: ctx.userId,
          },
        });
      } catch (e) {
        // To samtidige sendinger med samme id: den andre treffer PK-en (P2002)
        // → returner raden den første skrev.
        const rad = (e as { code?: string }).code === "P2002" ? await hentEksisterende() : null;
        if (!rad) throw e;
        return rad;
      }

      // Kort-id: regel 3 for vare uten id (fylles i samme løp som sedelens øvrige rader).
      if (opprettet?.dagsseddelId && !opprettet.kortId) {
        await sikreKortId(ctx.prismaTimer, opprettet.dagsseddelId);
        opprettet =
          (await ctx.prismaVarelager.vareforbruk.findUnique({ where: { id: opprettet.id } })) ?? opprettet;
      }

      // Activity-log (best-effort)
      try {
        await prisma.activity.create({
          data: {
            actorUserId: ctx.userId,
            organizationId,
            projectId: input.projectId,
            targetType: "vareforbruk",
            targetId: opprettet.id,
            action: "vare.registrert",
            payload: {
              vareId: input.vareId,
              antall: input.antall,
              dagsseddelId: input.dagsseddelId ?? null,
            },
          },
        });
      } catch {
        // Ikke-blokkerende
      }

      return opprettet;
    }),

  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        // ORDRE 36b «Flytt raden»: bytt prosjekt innen samme firma (varelager-eier).
        projectId: z.string().uuid().optional(),
        dato: z.string().optional(),
        antall: z.number().positive().optional(),
        byggeplassId: z.string().uuid().nullable().optional(),
        externalCostObjectId: z.string().uuid().nullable().optional(),
        kommentar: z.string().max(2000).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const rad = await ctx.prismaVarelager.vareforbruk.findUnique({
        where: { id: input.id },
        select: {
          projectId: true,
          attestertSnapshot: true,
          dagsseddelId: true,
          // Kort-id (spec § 4.3): regel 2 trenger lagret id og nøkkel.
          kortId: true,
          byggeplassId: true,
          externalCostObjectId: true,
          sheetTimerId: true,
          // Ordre d2a: loggen bærer antallet før rettingen.
          antall: true,
        },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });
      if (rad.attestertSnapshot !== null) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Vareforbruket er attestert og kan ikke endres",
        });
      }
      // Ordre d2a: varen står på en timerad som er attestert — den er låst med raden.
      if (rad.sheetTimerId) {
        const timerad = await ctx.prismaTimer.sheetTimer.findUnique({
          where: { id: rad.sheetTimerId },
          select: { attestertStatus: true },
        });
        if (timerad?.attestertStatus === "attestert") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Timeraden varen står på er attestert. Gjenåpne raden for å rette varen.",
          });
        }
      }

      // ORDRE 36b «Flytt raden»: prosjektbytte krever samme tilgang til målprosjektet
      // som `opprett` (medlem → byggeplass → modul aktiv → tilgang-policy) + firma-
      // grense: målet må tilhøre firmaet som eier linjens varelager. Varelager-eieren
      // er prosjektets primaryOrganizationId (krevVarelagerForProsjekt), så et prosjekt
      // firmaet bare er koblet til (annen eier → annen varekatalog) avvises også.
      // Samme eier-firma ⇒ samme varekatalog, så vareId trenger ingen ny katalog-sjekk.
      const maalProsjekt = input.projectId ?? rad.projectId;
      const byttProsjekt = maalProsjekt !== rad.projectId;

      // Tilgang til linjens NÅVÆRENDE prosjekt (uendret når projectId ikke byttes).
      await krevVareProsjektTilgang(ctx.userId, rad.projectId);
      await krevVareforbrukLinjeAapen(ctx.prismaTimer, ctx.userId, rad.dagsseddelId, rad.projectId);
      if (byttProsjekt) await krevVareProsjektTilgang(ctx.userId, maalProsjekt);
      // ORDRE 29 #14: ny byggeplass MÅ tilhøre (mål)prosjektet. `null` = fjern, ingen sjekk.
      if (input.byggeplassId) {
        await verifiserByggeplassIProsjekt(ctx.prisma, input.byggeplassId, maalProsjekt);
      }
      // O11: linjens nåværende prosjekt kan mangle varelager (jobben flyttet dit).
      const organizationId = await eierFirmaForProsjekt(rad.projectId);
      await krevTilgangPolicy(ctx.userId, organizationId, rad.projectId);
      if (byttProsjekt) {
        await verifiserProsjekterTilhørerFirma([maalProsjekt], organizationId);
        const maalOrg = await krevVarelagerForProsjekt(maalProsjekt);
        if (maalOrg !== organizationId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Prosjektet hører til et annet firmas varelager",
          });
        }
        await krevTilgangPolicy(ctx.userId, organizationId, maalProsjekt);
        // RETUR 4: linja beholder dagsseddelId — da må sedelen ha arbeid på
        // målprosjektet, ellers ville vareforbruket peke på en sedel uten
        // timer der (og attestering/rapport koble feil). Uten sedel: ingen sjekk.
        if (rad.dagsseddelId) {
          const timerPaaMaal = await ctx.prismaTimer.sheetTimer.findFirst({
            where: { sheetId: rad.dagsseddelId, projectId: maalProsjekt },
            select: { id: true },
          });
          if (!timerPaaMaal) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Dagsseddelen har ingen timer-rad på prosjektet varen flyttes til",
            });
          }
        }
      }

      if (input.externalCostObjectId) {
        await validerEco(input.externalCostObjectId, organizationId, maalProsjekt);
      }

      const { id, dato, antall, kommentar } = input;
      // Ved prosjektbytte er gammelt prosjekts byggeplass/underprosjekt ugyldig i det
      // nye — uten eksplisitt verdi i input nullstilles de i stedet for å bli stående.
      const byggeplassId =
        input.byggeplassId !== undefined ? input.byggeplassId : byttProsjekt ? null : undefined;
      const externalCostObjectId =
        input.externalCostObjectId !== undefined
          ? input.externalCostObjectId
          : byttProsjekt
            ? null
            : undefined;
      // Kort-id (§ 4.3): uendret nøkkel → står; ellers koblet rad / regel 3.
      const kortId = await vareKortIdForSkriving(ctx.prismaTimer, {
        dagsseddelId: rad.dagsseddelId,
        sheetTimerId: rad.sheetTimerId ?? null,
        lagret: {
          kortId: rad.kortId ?? null,
          projectId: rad.projectId,
          byggeplassId: rad.byggeplassId ?? null,
          externalCostObjectId: rad.externalCostObjectId ?? null,
        },
        ny: {
          projectId: maalProsjekt,
          byggeplassId: byggeplassId !== undefined ? byggeplassId : (rad.byggeplassId ?? null),
          externalCostObjectId:
            externalCostObjectId !== undefined ? externalCostObjectId : (rad.externalCostObjectId ?? null),
        },
      });
      const oppdatert = await ctx.prismaVarelager.vareforbruk.update({
        where: { id },
        data: {
          // Kort-id skrives bare når den endres.
          ...((rad.kortId ?? null) !== kortId ? { kortId } : {}),
          ...(byttProsjekt ? { projectId: maalProsjekt } : {}),
          ...(dato !== undefined ? { dato: new Date(dato) } : {}),
          ...(antall !== undefined ? { antall } : {}),
          ...(byggeplassId !== undefined ? { byggeplassId } : {}),
          ...(externalCostObjectId !== undefined ? { externalCostObjectId } : {}),
          ...(kommentar !== undefined ? { kommentar: kommentar?.trim() || null } : {}),
        },
      });

      let resultat = oppdatert;
      if (resultat?.dagsseddelId && !resultat.kortId) {
        await sikreKortId(ctx.prismaTimer, resultat.dagsseddelId);
        resultat =
          (await ctx.prismaVarelager.vareforbruk.findUnique({ where: { id } })) ?? resultat;
      }

      // Activity-log (best-effort)
      try {
        await prisma.activity.create({
          data: {
            actorUserId: ctx.userId,
            organizationId,
            projectId: maalProsjekt,
            targetType: "vareforbruk",
            targetId: id,
            action: "vare.endret",
            payload: {
              antall: oppdatert.antall.toString(),
              antallFoer: rad.antall.toString(),
              ...(byttProsjekt ? { fraProsjektId: rad.projectId } : {}),
            },
          },
        });
      } catch {
        // Ikke-blokkerende
      }

      return resultat;
    }),

  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const rad = await ctx.prismaVarelager.vareforbruk.findUnique({
        where: { id: input.id },
        select: {
          projectId: true,
          vareId: true,
          attestertSnapshot: true,
          dagsseddelId: true,
        },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });
      if (rad.attestertSnapshot !== null) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Vareforbruket er attestert og kan ikke slettes",
        });
      }

      await krevVareProsjektTilgang(ctx.userId, rad.projectId);
      await krevVareforbrukLinjeAapen(ctx.prismaTimer, ctx.userId, rad.dagsseddelId, rad.projectId);
      // O11: eksisterende vare slettes også på prosjekt uten varelager.
      const organizationId = await eierFirmaForProsjekt(rad.projectId);
      await krevTilgangPolicy(ctx.userId, organizationId, rad.projectId);

      // SL1 (plan § 4.18, S2 ja): på en returnert dag lagres linja med innholdet i
      // `sheet_rad_historikk` (radtype `vare`). Varene og historikken er to klienter mot samme
      // database, så sporet og slettingen går i ÉN transaksjon på timer-klienten, med rå SQL mot
      // varelager-skjemaet (mønsteret fra `slettKortMedAlt`). Det finnes ikke noe «andre steg»
      // som kan feile alene: enten står både linja og sporet urørt, eller linja er borte og
      // sporet skrevet. Andre dager slettes som før.
      const retur =
        rad.dagsseddelId !== null &&
        (await ctx.prismaTimer.dailySheet.findUnique({
          where: { id: rad.dagsseddelId },
          select: { status: true },
        }))?.status === "returned";
      if (retur) {
        const aktor = ctx.userId;
        await ctx.prismaTimer.$transaction(async (tx) => {
          const [vare] = await lesVarerForSpor(tx, [input.id]);
          if (!vare) throw new TRPCError({ code: "NOT_FOUND" });
          await skrivSlettespor(tx, [{ radType: "vare", rad: vare }], aktor);
          await tx.$executeRaw`DELETE FROM "varelager"."vareforbruk" WHERE "id" = ${input.id}`;
        });
      } else {
        await ctx.prismaVarelager.vareforbruk.delete({ where: { id: input.id } });
      }

      // Activity-log (best-effort)
      try {
        await prisma.activity.create({
          data: {
            actorUserId: ctx.userId,
            organizationId,
            projectId: rad.projectId,
            targetType: "vareforbruk",
            targetId: input.id,
            action: "vare.slettet",
            payload: { vareId: rad.vareId },
          },
        });
      } catch {
        // Ikke-blokkerende
      }

      return { ok: true };
    }),
});

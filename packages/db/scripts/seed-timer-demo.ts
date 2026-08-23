/**
 * Demo-seed for Timer-attestering (AM ORDRE 2 — D3 gate-grunnlag).
 *
 * Bakgrunn: test-DB har INGEN timer-data (kun prod har det), så skjermbildene
 * fabel krever for D3-gaten (per-prosjekt-pivot, per-ansatt-pivot m/ norm-
 * kolonne, ekspandert rad, celle-klikk) kan ikke tas. Denne seeden legger inn
 * nok ekte-formet data til at BEGGE pivotene og norm-kolonnen viser noe.
 *
 * Kjøres i en engangs-container mot test-stacken (postgres-containeren har
 * ingen host-port → ikke nåbar fra Mac; samme mønster som migreringer,
 * DOCKER-NOTES punkt 5). Containeren har allerede DATABASE_URL for sitedoc_test,
 * så DB-navn-gaten under passerer av seg selv:
 *
 *   sudo docker compose -f docker/docker-compose.test.yml run --rm --no-deps \
 *     --entrypoint sh sitedoc-test-api -c \
 *     'pnpm --filter @sitedoc/db exec tsx scripts/seed-timer-demo.ts'
 *
 * 🔴 `-c`, ALDRI `-lc`: login-shell tømmer $DATABASE_URL → gaten ser tom URL og
 * aborterer med falsk «ikke sitedoc_test» (skjedde 2026-06-21).
 *
 * 🔴 DB-NAVN-GATE: scriptet nekter å kjøre hvis DATABASE_URL ikke peker på
 * databasen «sitedoc_test» — samme prinsipp som migrerings-gaten (gate i
 * scriptet, ikke på at den som kjører husker det). Aldri prod.
 *
 * Idempotent: kjernedata upsertes (org/bruker/prosjekt/medlem/modul/setting),
 * timer-katalog findFirst-sjekkes, og dagsedler upsertes på deterministisk
 * clientUuid (rad-settet slettes + gjenskapes per sedel). Re-kjøring gir samme
 * tilstand, ingen duplikater.
 *
 * PII: alle navn er oppdiktet (@demo-timer.test-domenet er ikke-rutbart). Ingen
 * kopi fra prod.
 *
 * Datadesign (norm = 5 × 7,5 t = 37,5 t/uke — fra OrganizationSetting-default):
 *   · Ola Nordmann  — 42 t, alt normaltid            → +4,5 t OVER norm
 *                     (mandag: 2 rader, 2 prosjekter → ekspandert rad)
 *   · Kari Hansen   — 32 t, 4 t på «Overtid 50%»      → overtid FØRT UNDER norm
 *   · Per Berg      — 37,5 t, alt normaltid           → intet avvik (ren norm)
 *   Alle sedler status «sent» → havner i «Venter på attestering»-fanen.
 *
 * I tillegg: Turid Lie (firma_admin i demo-orgen, ingen dagsedler). Kenneth
 * impersonerer henne og tar D3-bildene som VANLIG firmabruker — ikke
 * sitedoc_admin, som er cross-org-veien bf2bf475 nettopp rettet.
 *
 * @sitedoc/db-timer importeres relativt (db avhenger ikke av db-timer i
 * package.json — bevisst, jf. «modul-tabeller aldri i packages/db»). Scriptet
 * er dev/test-verktøy, ikke runtime, så relativ import er akseptabelt her.
 */

import { prisma } from "../src/index";
import { prismaTimer } from "../../db-timer/src";

/* ------------------------------------------------------------------ */
/*  🔴 DB-navn-gate — kjør KUN mot sitedoc_test                        */
/* ------------------------------------------------------------------ */

const PAAKREVD_DB = "sitedoc_test";

function hentDbNavn(url: string | undefined): string | null {
  if (!url) return null;
  try {
    // pathname = "/sitedoc_test"; query (?schema=...) er ikke med.
    const navn = new URL(url).pathname.replace(/^\//, "");
    return navn || null;
  } catch {
    return null;
  }
}

function gateDbNavn(): void {
  const dbNavn = hentDbNavn(process.env.DATABASE_URL);
  if (dbNavn !== PAAKREVD_DB) {
    console.error(
      `🔴 AVBRUTT: DATABASE_URL peker på «${dbNavn ?? "(ukjent/uparsebar)"}», ` +
        `men denne seeden kjører KUN mot «${PAAKREVD_DB}».`,
    );
    console.error(
      `   Sett DATABASE_URL til sitedoc_test og prøv igjen. Aldri prod.`,
    );
    process.exit(1);
  }
  console.log(`✓ DB-gate OK: DATABASE_URL → «${dbNavn}»`);
}

/* ------------------------------------------------------------------ */
/*  Konstanter — oppdiktede navn (PII-fri)                            */
/* ------------------------------------------------------------------ */

const ORG_NAVN = "Demo Bygg AS (timer-demo)";

const PROSJEKTER = [
  {
    key: "P1",
    projectNumber: "DEMO-TIMER-1001",
    name: "Fjordgata 12 – Rehabilitering",
    internalProjectNumber: "1001",
  },
  {
    key: "P2",
    projectNumber: "DEMO-TIMER-1002",
    name: "Sentrumsparken – Nybygg",
    internalProjectNumber: "1002",
  },
] as const;

const ANSATTE = [
  { key: "OLA", navn: "Ola Nordmann", email: "ola.nordmann@demo-timer.test", ansattnummer: "101" },
  { key: "KARI", navn: "Kari Hansen", email: "kari.hansen@demo-timer.test", ansattnummer: "102" },
  { key: "PER", navn: "Per Berg", email: "per.berg@demo-timer.test", ansattnummer: "103" },
] as const;

// Attestant: firma-admin i demo-orgen — IKKE en ansatt med dagsedler. Kenneth
// impersonerer henne for D3-skjermbildene (fabel: bilder skal tas som VANLIG
// firmabruker, ikke sitedoc_admin). firmaRoller ["firma_admin"] er nøyaktig det
// kanAttestereFirma → autoriserAdminForFirma slipper gjennom (utenom sitedoc_admin).
const ATTESTANT = {
  navn: "Turid Lie",
  email: "turid.lie@demo-timer.test",
  ansattnummer: "200",
} as const;

const LONNSARTER = [
  { key: "NORM", navn: "Normaltid", kode: "100", overtidsnivaa: null as number | null, erStandardvalg: true },
  { key: "OT50", navn: "Overtid 50%", kode: "150", overtidsnivaa: 50 as number | null, erStandardvalg: false },
] as const;

const AKTIVITET = { navn: "Grunnarbeid", kode: "GA" } as const;

// Rader per ansatt per ukedag (0 = mandag ... 4 = fredag).
// { p: prosjekt-key, l: lønnsart-key, t: timer }
type Rad = { p: "P1" | "P2"; l: "NORM" | "OT50"; t: number };
const DAGSEDLER: Record<string, Rad[][]> = {
  // Ola: 42 t, alt normaltid → +4,5 t over norm. Mandag = 2 rader (ekspandert).
  OLA: [
    [{ p: "P1", l: "NORM", t: 6 }, { p: "P2", l: "NORM", t: 3 }],
    [{ p: "P1", l: "NORM", t: 8 }],
    [{ p: "P1", l: "NORM", t: 8 }],
    [{ p: "P1", l: "NORM", t: 8.5 }],
    [{ p: "P1", l: "NORM", t: 8.5 }],
  ],
  // Kari: 32 t, 4 t overtid ført → «overtid ført under norm».
  KARI: [
    [{ p: "P2", l: "NORM", t: 7 }],
    [{ p: "P2", l: "NORM", t: 7 }],
    [{ p: "P2", l: "NORM", t: 7 }],
    [{ p: "P2", l: "NORM", t: 7 }],
    [{ p: "P2", l: "OT50", t: 4 }],
  ],
  // Per: 37,5 t, alt normaltid → intet avvik (ren norm i kolonnen).
  PER: [
    [{ p: "P1", l: "NORM", t: 7.5 }],
    [{ p: "P1", l: "NORM", t: 7.5 }],
    [{ p: "P2", l: "NORM", t: 7.5 }],
    [{ p: "P2", l: "NORM", t: 7.5 }],
    [{ p: "P1", l: "NORM", t: 7.5 }],
  ],
};

/* ------------------------------------------------------------------ */
/*  Hjelpere                                                          */
/* ------------------------------------------------------------------ */

/** Mandag i inneværende uke (UTC-midnatt). Sedlene lander da på attesterings-
 *  sidens default-visning (ukeOffset 0). */
function inneverendeMandag(): Date {
  const naa = new Date();
  const d = new Date(Date.UTC(naa.getUTCFullYear(), naa.getUTCMonth(), naa.getUTCDate()));
  const dag = d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1; // man=0 ... søn=6
  d.setUTCDate(d.getUTCDate() - dag);
  return d;
}

function leggTilDager(base: Date, n: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function isoDato(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/*  Kjerne-scaffolding (packages/db)                                  */
/* ------------------------------------------------------------------ */

async function seedKjerne(): Promise<{
  orgId: string;
  prosjektIder: Map<string, string>;
  ansattIder: Map<string, string>;
}> {
  // Org (name ikke unik → findFirst + create).
  let org = await prisma.organization.findFirst({ where: { name: ORG_NAVN } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: ORG_NAVN, erKunde: true },
    });
  } else if (!org.erKunde) {
    org = await prisma.organization.update({
      where: { id: org.id },
      data: { erKunde: true },
    });
  }
  const orgId = org.id;

  // OrganizationSetting (dagsnorm 7,5 → ukenorm 37,5; standardtider gir samme).
  await prisma.organizationSetting.upsert({
    where: { organizationId: orgId },
    update: {},
    create: {
      organizationId: orgId,
      dagsnorm: 7.5,
      standardStartTid: "07:00",
      standardSluttTid: "15:00",
      standardPauseMin: 30,
    },
  });

  // Timer-firmamodul aktiv (så flaten er synlig i firma-nav).
  await prisma.organizationModule.upsert({
    where: { organizationId_moduleSlug: { organizationId: orgId, moduleSlug: "timer" } },
    update: { status: "aktiv" },
    create: { organizationId: orgId, moduleSlug: "timer", status: "aktiv" },
  });

  // Prosjekter + ProjectOrganization (firma-eierskap → pivot-spørringen ser dem).
  const prosjektIder = new Map<string, string>();
  for (const p of PROSJEKTER) {
    const prosjekt = await prisma.project.upsert({
      where: { projectNumber: p.projectNumber },
      update: { name: p.name, internalProjectNumber: p.internalProjectNumber, primaryOrganizationId: orgId },
      create: {
        projectNumber: p.projectNumber,
        name: p.name,
        internalProjectNumber: p.internalProjectNumber,
        primaryOrganizationId: orgId,
      },
    });
    prosjektIder.set(p.key, prosjekt.id);
    await prisma.projectOrganization.upsert({
      where: { projectId_organizationId: { projectId: prosjekt.id, organizationId: orgId } },
      update: {},
      create: { projectId: prosjekt.id, organizationId: orgId, rolle: "hovedeier" },
    });
  }

  // Ansatte (User) + OrganizationMember (ansattnummer → pivot-kolonner).
  const ansattIder = new Map<string, string>();
  for (const a of ANSATTE) {
    const bruker = await prisma.user.upsert({
      where: { email: a.email },
      update: { name: a.navn },
      create: { email: a.email, name: a.navn, role: "user" },
    });
    ansattIder.set(a.key, bruker.id);
    await prisma.organizationMember.upsert({
      where: { userId_organizationId: { userId: bruker.id, organizationId: orgId } },
      update: { ansattnummer: a.ansattnummer },
      create: { userId: bruker.id, organizationId: orgId, ansattnummer: a.ansattnummer },
    });
  }

  // Attestant (firma_admin) — egen bruker uten dagsedler. firmaRoller settes i
  // BÅDE create og update, så en tidligere kjøring uten rollen rettes ved re-run.
  const attestant = await prisma.user.upsert({
    where: { email: ATTESTANT.email },
    update: { name: ATTESTANT.navn },
    create: { email: ATTESTANT.email, name: ATTESTANT.navn, role: "user" },
  });
  const attestantMedlem = await prisma.organizationMember.upsert({
    where: { userId_organizationId: { userId: attestant.id, organizationId: orgId } },
    update: { ansattnummer: ATTESTANT.ansattnummer, firmaRoller: ["firma_admin"] },
    create: {
      userId: attestant.id,
      organizationId: orgId,
      ansattnummer: ATTESTANT.ansattnummer,
      firmaRoller: ["firma_admin"],
    },
  });

  // Selv-verifikasjon av gaten: attestanten MÅ ha firma_admin i demo-orgen,
  // ellers ser hun tom side. Speiler autoriserAdminForFirma → erFirmaAdmin
  // (firmaRoller.includes("firma_admin")). Avbryt høylytt hvis premisset brister.
  const harFirmaAdmin = attestantMedlem.firmaRoller.includes("firma_admin");
  console.log(
    `Attestant: ${ATTESTANT.navn} <${ATTESTANT.email}> — firma_admin=${harFirmaAdmin} ` +
      `⇒ kanAttestere(${ORG_NAVN})=${harFirmaAdmin}.`,
  );
  if (!harFirmaAdmin) {
    throw new Error(
      `Attestant mangler firma_admin i demo-orgen — kanAttestere ville blitt false.`,
    );
  }

  console.log(
    `Kjerne: org «${ORG_NAVN}» (${orgId}), ${PROSJEKTER.length} prosjekter, ` +
      `${ANSATTE.length} ansatte + 1 attestant.`,
  );
  return { orgId, prosjektIder, ansattIder };
}

/* ------------------------------------------------------------------ */
/*  Timer-katalog (packages/db-timer)                                 */
/* ------------------------------------------------------------------ */

async function seedKatalog(orgId: string): Promise<{
  lonnsartIder: Map<string, string>;
  aktivitetId: string;
}> {
  const lonnsartIder = new Map<string, string>();
  for (const l of LONNSARTER) {
    let art = await prismaTimer.lonnsart.findFirst({
      where: { organizationId: orgId, navn: l.navn },
    });
    if (!art) {
      art = await prismaTimer.lonnsart.create({
        data: {
          organizationId: orgId,
          type: "ordinaer",
          navn: l.navn,
          kode: l.kode,
          overtidsnivaa: l.overtidsnivaa,
          erStandardvalg: l.erStandardvalg,
        },
      });
    }
    lonnsartIder.set(l.key, art.id);
  }

  let aktivitet = await prismaTimer.aktivitet.findFirst({
    where: { organizationId: orgId, navn: AKTIVITET.navn },
  });
  if (!aktivitet) {
    aktivitet = await prismaTimer.aktivitet.create({
      data: { organizationId: orgId, navn: AKTIVITET.navn, kode: AKTIVITET.kode },
    });
  }

  console.log(`Katalog: ${LONNSARTER.length} lønnsarter, 1 aktivitet.`);
  return { lonnsartIder, aktivitetId: aktivitet.id };
}

/* ------------------------------------------------------------------ */
/*  Dagsedler + timer-rader                                           */
/* ------------------------------------------------------------------ */

async function seedDagsedler(
  orgId: string,
  prosjektIder: Map<string, string>,
  ansattIder: Map<string, string>,
  lonnsartIder: Map<string, string>,
  aktivitetId: string,
): Promise<void> {
  const mandag = inneverendeMandag();
  let sedler = 0;
  let rader = 0;

  for (const a of ANSATTE) {
    const userId = ansattIder.get(a.key)!;
    const uke = DAGSEDLER[a.key]!;
    for (let dagIdx = 0; dagIdx < uke.length; dagIdx++) {
      const radDef = uke[dagIdx]!;
      if (radDef.length === 0) continue;
      const dato = leggTilDager(mandag, dagIdx);
      const iso = isoDato(dato);
      const clientUuid = `demo-timer-${a.ansattnummer}-${iso}`;

      const sedel = await prismaTimer.dailySheet.upsert({
        where: { clientUuid },
        update: { status: "sent", organizationId: orgId, aktivitetId },
        create: {
          clientUuid,
          organizationId: orgId,
          userId,
          registrertAvUserId: userId,
          aktivitetId,
          dato,
          status: "sent",
        },
      });

      // Idempotent rad-sett: slett eksisterende, gjenskap.
      await prismaTimer.sheetTimer.deleteMany({ where: { sheetId: sedel.id } });
      for (const r of radDef) {
        await prismaTimer.sheetTimer.create({
          data: {
            sheetId: sedel.id,
            lonnsartId: lonnsartIder.get(r.l)!,
            aktivitetId,
            projectId: prosjektIder.get(r.p)!,
            timer: r.t,
            beskrivelse: `${AKTIVITET.navn} – ${r.p}`,
          },
        });
        rader += 1;
      }
      sedler += 1;
    }
  }

  console.log(`Dagsedler: ${sedler} sedler (status «sent»), ${rader} timer-rader. Uke fra ${isoDato(mandag)}.`);
}

/* ------------------------------------------------------------------ */
/*  Main                                                              */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  gateDbNavn();
  console.log("Seeder Timer-demo for attesterings-pivotene …\n");

  const { orgId, prosjektIder, ansattIder } = await seedKjerne();
  const { lonnsartIder, aktivitetId } = await seedKatalog(orgId);
  await seedDagsedler(orgId, prosjektIder, ansattIder, lonnsartIder, aktivitetId);

  console.log("\nFerdig.");
  console.log(`Firma: «${ORG_NAVN}» (erKunde=true → synlig i firma-velgeren).`);
  console.log(
    `📸 Ta D3-bildene som VANLIG firmabruker: impersoner «${ATTESTANT.navn}» ` +
      `<${ATTESTANT.email}> (firma_admin) — ikke sitedoc_admin.`,
  );
  console.log("Gå til: Firma → Timer → Attestering. Fanen «Venter på attestering».");
  console.log("  · Visningsvelger «Per prosjekt» + «Per ansatt» (norm-kolonne).");
  console.log("  · Ola Nordmann: +4,5 t over norm · Kari Hansen: overtid ført under norm · Per Berg: ingen avvik.");
  console.log("  · Ola mandag = 2 rader (ekspander) · celle-klikk åpner sedel-detalj.");
}

main()
  .catch((e) => {
    console.error("Seed feilet:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await prismaTimer.$disconnect();
  });

/**
 * Seed for to merget mobil-flater som simulatoren ikke kan verifisere uten
 * testdata (ikke kodefeil — manglende seed). På AGENT-TEST-0001 («Agent-
 * testprosjekt»), der mobil-brukeren kemyrhau står:
 *
 *   1. En OPPGAVEMAL + én OPPGAVE — så oppgave-detaljen (arkiv-PDF: Share2 +
 *      CloudOff + manglendeVedlegg) blir nåbar. I dag: «Ingen oppgavemaler».
 *   2. En SJEKKLISTEMAL med et TegningPosisjon-felt I EN REPEATER + en
 *      SJEKKLISTE fra den. Den eneste eksisterende malen mangler feltet, så
 *      H8-markøren rendres aldri. Per-rad-plasseringen er poenget → repeater.
 *
 * Kjøres i engangs-container mot test-stacken (samme mønster som seed-timer-demo
 * + migreringer, DOCKER-NOTES pkt 5). Containeren har DATABASE_URL for
 * sitedoc_test → DB-navn-gaten under passerer av seg selv:
 *
 *   sudo docker compose -f docker/docker-compose.test.yml run --rm --no-deps \
 *     --entrypoint sh sitedoc-test-api -c \
 *     'pnpm --filter @sitedoc/db exec tsx scripts/seed-agent-mobil-test.ts'
 *
 * 🔴 `-c`, ALDRI `-lc`: login-shell tømmer $DATABASE_URL → gaten aborterer falskt.
 * 🔴 DB-NAVN-GATE: nekter å kjøre hvis DATABASE_URL ikke peker på «sitedoc_test».
 *
 * Idempotent: kjernedata upsertes, maler findFirst→create, mal-strukturen
 * (ReportObject) bygges rent på nytt (deleteMany + create), oppgave/sjekkliste
 * findFirst→create. Re-kjøring gir samme tilstand, ingen duplikater.
 *
 * kemyrhau settes som prosjekt-admin (ser ALT via tilgangsfilteret) OG som
 * recipient på begge dokumentene (ball-hos-ham i lista) → garantert synlig på
 * mobil uansett faggruppe/flyt. Malene er domain="bygg" (ikke-HMS) → unngår
 * HMS-synlighets-AND-filteret.
 */

import { prisma } from "../src/index";

/* ------------------------------------------------------------------ */
/*  🔴 DB-navn-gate — kjør KUN mot sitedoc_test                        */
/* ------------------------------------------------------------------ */

const PAAKREVD_DB = "sitedoc_test";

function hentDbNavn(url: string | undefined): string | null {
  if (!url) return null;
  try {
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
    process.exit(1);
  }
  console.log(`✓ DB-gate OK: DATABASE_URL → «${dbNavn}»`);
}

/* ------------------------------------------------------------------ */
/*  Konstanter                                                        */
/* ------------------------------------------------------------------ */

const PROSJEKT_NUMMER = "AGENT-TEST-0001";
const PROSJEKT_NAVN = "Agent-testprosjekt";
const BRUKER_EMAIL = "kemyrhau@gmail.com"; // dev-login-bruker (mobil)

const OPPGAVEMAL_NAVN = "Agent oppgavemal (mobil-test)";
const OPPGAVE_TITTEL = "Agent testoppgave";
const SJEKKLISTEMAL_NAVN = "Agent sjekklistemal m/ tegningsposisjon (mobil-test)";
const SJEKKLISTE_TITTEL = "Agent testsjekkliste";

/* ------------------------------------------------------------------ */
/*  Kjerne: prosjekt + bruker + medlemskap                            */
/* ------------------------------------------------------------------ */

async function seedKjerne(): Promise<{ prosjektId: string; brukerId: string }> {
  // Prosjektet finnes normalt (seed-testbrukere). Upsert på unik projectNumber
  // gjør seeden selv-tilstrekkelig uten å overskrive eksisterende felt.
  const prosjekt = await prisma.project.upsert({
    where: { projectNumber: PROSJEKT_NUMMER },
    update: {},
    create: { projectNumber: PROSJEKT_NUMMER, name: PROSJEKT_NAVN },
  });

  const bruker = await prisma.user.upsert({
    where: { email: BRUKER_EMAIL },
    update: { canLogin: true },
    create: {
      email: BRUKER_EMAIL,
      name: "Kenneth Myrhaug",
      role: "user",
      canLogin: true,
    },
  });

  // ProjectMember (ingen unik-nøkkel-upsert → findFirst + create). Admin = ser
  // ALT på prosjektet (tilgangskontroll.ts byggTilgangsFilter admin-grenen).
  const eks = await prisma.projectMember.findFirst({
    where: { projectId: prosjekt.id, userId: bruker.id },
  });
  if (!eks) {
    await prisma.projectMember.create({
      data: { projectId: prosjekt.id, userId: bruker.id, role: "admin" },
    });
  } else if (eks.role !== "admin") {
    await prisma.projectMember.update({ where: { id: eks.id }, data: { role: "admin" } });
  }

  console.log(
    `Kjerne: prosjekt «${PROSJEKT_NAVN}» (${PROSJEKT_NUMMER}), bruker ${BRUKER_EMAIL} = prosjekt-admin.`,
  );
  return { prosjektId: prosjekt.id, brukerId: bruker.id };
}

/** Finn eksisterende mal på (projectId, name) eller opprett. */
async function hentEllerLagMal(
  projectId: string,
  name: string,
  category: "oppgave" | "sjekkliste",
  prefix: string,
): Promise<string> {
  const eks = await prisma.reportTemplate.findFirst({ where: { projectId, name } });
  if (eks) return eks.id;
  const ny = await prisma.reportTemplate.create({
    data: { projectId, name, domain: "bygg", category, prefix },
  });
  return ny.id;
}

/* ------------------------------------------------------------------ */
/*  1. Oppgavemal + oppgave                                           */
/* ------------------------------------------------------------------ */

async function seedOppgave(prosjektId: string, brukerId: string): Promise<void> {
  const malId = await hentEllerLagMal(prosjektId, OPPGAVEMAL_NAVN, "oppgave", "OPPG");

  // Struktur bygges rent på nytt (idempotent). Enkelt oppgave-innhold: en
  // beskrivelse + et vedlegg-felt (så manglendeVedlegg-tilfellet er testbart).
  await prisma.reportObject.deleteMany({ where: { templateId: malId } });
  await prisma.reportObject.create({
    data: { templateId: malId, type: "heading", label: "Utførelse", sortOrder: 0 },
  });
  await prisma.reportObject.create({
    data: { templateId: malId, type: "text_field", label: "Beskrivelse", sortOrder: 1 },
  });
  await prisma.reportObject.create({
    data: { templateId: malId, type: "attachments", label: "Dokumentasjon", sortOrder: 2 },
  });

  // Oppgave (findFirst→create). kemyrhau er bestiller + eier + recipient →
  // synlig uansett. Status faller til default "draft" (som appens egen opprett).
  const eks = await prisma.task.findFirst({
    where: { templateId: malId, title: OPPGAVE_TITTEL },
  });
  if (!eks) {
    await prisma.task.create({
      data: {
        templateId: malId,
        bestillerUserId: brukerId,
        eierUserId: brukerId,
        recipientUserId: brukerId,
        title: OPPGAVE_TITTEL,
        aktivPosisjon: 1,
      },
    });
  }
  console.log(`1) Oppgavemal «${OPPGAVEMAL_NAVN}» + oppgave «${OPPGAVE_TITTEL}».`);
}

/* ------------------------------------------------------------------ */
/*  2. Sjekklistemal m/ tegningsposisjon i repeater + sjekkliste       */
/* ------------------------------------------------------------------ */

async function seedSjekkliste(prosjektId: string, brukerId: string): Promise<void> {
  const malId = await hentEllerLagMal(
    prosjektId,
    SJEKKLISTEMAL_NAVN,
    "sjekkliste",
    "SJEKK",
  );

  // Struktur: en REPEATER med et drawing_position-barn (+ en beskrivelse), så
  // tegningsposisjonen plasseres PER RAD — det er der H8-markøren skal rendres.
  await prisma.reportObject.deleteMany({ where: { templateId: malId } });
  const repeater = await prisma.reportObject.create({
    data: { templateId: malId, type: "repeater", label: "Kontrollpunkter", sortOrder: 0 },
  });
  await prisma.reportObject.create({
    data: {
      templateId: malId,
      parentId: repeater.id,
      type: "text_field",
      label: "Beskrivelse",
      sortOrder: 0,
    },
  });
  await prisma.reportObject.create({
    data: {
      templateId: malId,
      parentId: repeater.id,
      type: "drawing_position",
      label: "Posisjon i tegning",
      sortOrder: 1,
      config: { buildingFilter: null, disciplineFilter: null },
    },
  });

  const eks = await prisma.checklist.findFirst({
    where: { templateId: malId, title: SJEKKLISTE_TITTEL },
  });
  if (!eks) {
    await prisma.checklist.create({
      data: {
        templateId: malId,
        bestillerUserId: brukerId,
        eierUserId: brukerId,
        recipientUserId: brukerId,
        title: SJEKKLISTE_TITTEL,
        aktivPosisjon: 1,
      },
    });
  }
  console.log(
    `2) Sjekklistemal «${SJEKKLISTEMAL_NAVN}» (drawing_position i repeater) + sjekkliste «${SJEKKLISTE_TITTEL}».`,
  );
}

/* ------------------------------------------------------------------ */
/*  Selvverifikasjon                                                  */
/* ------------------------------------------------------------------ */

async function verifiser(prosjektId: string, brukerId: string): Promise<void> {
  // Premiss 1: kemyrhau MÅ være prosjektmedlem — ellers ser han ingenting
  // (byggTilgangsFilter kaster FORBIDDEN uten medlemskap).
  const medlem = await prisma.projectMember.findFirst({
    where: { projectId: prosjektId, userId: brukerId },
  });
  if (!medlem) throw new Error("kemyrhau er ikke prosjektmedlem — mobil ville sett tomt.");

  // Premiss 2: sjekklistemalen MÅ ha et drawing_position-felt MED parentId
  // (dvs. inne i en repeater) — ellers rendres H8-markøren aldri.
  const dp = await prisma.reportObject.findFirst({
    where: {
      type: "drawing_position",
      parentId: { not: null },
      template: { projectId: prosjektId, name: SJEKKLISTEMAL_NAVN },
    },
  });
  if (!dp) {
    throw new Error("drawing_position-felt mangler i repeater — H8-markøren ville aldri rendres.");
  }
  console.log(
    `✓ Verifisert: kemyrhau er ${medlem.role} · drawing_position ligger i repeater (parentId=${dp.parentId}).`,
  );
}

/* ------------------------------------------------------------------ */
/*  Main                                                              */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  gateDbNavn();
  console.log("Seeder Agent-mobil-testdata …\n");

  const { prosjektId, brukerId } = await seedKjerne();
  await seedOppgave(prosjektId, brukerId);
  await seedSjekkliste(prosjektId, brukerId);
  await verifiser(prosjektId, brukerId);

  console.log("\nFerdig.");
  console.log(`Logg inn på mobil som ${BRUKER_EMAIL} (dev-login) → ${PROSJEKT_NAVN}.`);
  console.log("  · Oppgaver: «Agent testoppgave» → detalj → arkiv-PDF (Share2/CloudOff/manglendeVedlegg).");
  console.log("  · Sjekklister: «Agent testsjekkliste» → legg til repeater-rad → sett tegningsposisjon → H8-markør.");
  console.log(
    "  ⚠ Tegningsposisjon krever en tegning på prosjektet å plassere på — sikre at AGENT-TEST-0001 har minst én tegning (egen seed/opplasting hvis ikke).",
  );
}

main()
  .catch((e) => {
    console.error("Seed feilet:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

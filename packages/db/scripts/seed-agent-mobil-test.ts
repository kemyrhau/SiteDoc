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

const HMS_MAL_NAVN = "Agent SJA (mobil-test)";
const HMS_SJA_TITTEL = "Agent HMS-avvik til behandling";

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
  // De tre feltene prosjektId-prop-fiksen (2026-08-24) gjaldt — MÅ ligge INNE i repeateren
  // (parentId satt), for det var repeater-barn rendereren aldri threadet prosjektId til. Én rad
  // viser da alle fire velgerne, og hele prop-fiksen verifiseres i ett blikk.
  await prisma.reportObject.create({
    data: { templateId: malId, parentId: repeater.id, type: "room_property", label: "Rom", sortOrder: 2 },
  });
  await prisma.reportObject.create({
    data: { templateId: malId, parentId: repeater.id, type: "zone_property", label: "Sone", sortOrder: 3 },
  });
  await prisma.reportObject.create({
    data: { templateId: malId, parentId: repeater.id, type: "location", label: "Lokasjon", sortOrder: 4 },
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
/*  3. HMS-grunnlag: SJA-mal + HMS-gruppe + flyt + SJA i "received"    */
/* ------------------------------------------------------------------ */
//
// 🔴 RESPEKTERER HMS-ruten (omgår den IKKE): SJA (subdomain="sja") → Checklist, auto-rutet til
// HMS-gruppen (ProjectGroup domains=["hms"]) + bundet til HMS-flyten. Speiler modul.ts sin
// `seedHmsModulOmradet` — kan IKKE importeres (apps/api avhenger av @sitedoc/db, ikke omvendt),
// så den er replikert her, minimalt (kun SJA, ikke RUH/avvik). SJA-en seedes i "received"
// (mimicker hmsSendInn: melder→HMS-gruppe, aktivPosisjon=2 flyt-bundet), så Besvar/Lukk er
// meningsfulle for behandler. kemyrhau er prosjekt-admin → erHmsAdmin=true.

async function seedHms(prosjektId: string, brukerId: string): Promise<void> {
  // 1) HMS-gruppe (idempotent).
  let hmsGruppe = await prisma.projectGroup.findFirst({
    where: { projectId: prosjektId, domains: { array_contains: ["hms"] } },
    select: { id: true },
  });
  if (!hmsGruppe) {
    hmsGruppe = await prisma.projectGroup.create({
      data: {
        projectId: prosjektId,
        name: "HMS-ansvarlige",
        slug: "hms-ansvarlige",
        category: "field",
        domains: ["hms"],
        permissions: ["create_tasks", "create_checklists", "checklist_edit"],
      },
      select: { id: true },
    });
  }

  // 2) HMS-flyt (Dokumentflyt "HMS") + bestiller-boks (åpen) + utforer-boks (HMS-gruppe).
  let hmsFlyt = await prisma.dokumentflyt.findFirst({
    where: { projectId: prosjektId, name: "HMS" },
    select: { id: true },
  });
  if (!hmsFlyt) {
    hmsFlyt = await prisma.dokumentflyt.create({
      data: { projectId: prosjektId, name: "HMS" },
      select: { id: true },
    });
    await prisma.dokumentflytMedlem.create({
      data: { dokumentflytId: hmsFlyt.id, rolle: "bestiller", steg: 1 },
    });
    await prisma.dokumentflytMedlem.create({
      data: { dokumentflytId: hmsFlyt.id, rolle: "utforer", steg: 2, groupId: hmsGruppe.id },
    });
  }

  // 3) SJA-mal (category="hms" ⇒ domain="hms"; subdomain="sja" → Checklist-rutet).
  let sjaMal = await prisma.reportTemplate.findFirst({
    where: { projectId: prosjektId, domain: "hms", subdomain: "sja" },
    select: { id: true },
  });
  if (!sjaMal) {
    sjaMal = await prisma.reportTemplate.create({
      data: {
        projectId: prosjektId,
        name: HMS_MAL_NAVN,
        category: "hms",
        domain: "hms",
        subdomain: "sja",
        prefix: "SJA",
        hmsSynlighet: "apen",
      },
      select: { id: true },
    });
    await prisma.reportObject.create({
      data: { templateId: sjaMal.id, type: "text_field", label: "Beskrivelse av avvik", sortOrder: 0 },
    });
  }

  // 4) Knytt SJA-malen til HMS-flyten (samme kobling som modul.ts).
  await prisma.dokumentflytMal.upsert({
    where: { dokumentflytId_templateId: { dokumentflytId: hmsFlyt.id, templateId: sjaMal.id } },
    update: {},
    create: { dokumentflytId: hmsFlyt.id, templateId: sjaMal.id },
  });

  // 5) SJA-dokument i "received" (mimicker hmsSendInn end-state).
  const eks = await prisma.checklist.findFirst({
    where: { templateId: sjaMal.id, title: HMS_SJA_TITTEL },
    select: { id: true },
  });
  if (!eks) {
    const sja = await prisma.checklist.create({
      data: {
        templateId: sjaMal.id,
        bestillerUserId: brukerId,
        eierUserId: brukerId,
        recipientGroupId: hmsGruppe.id,
        dokumentflytId: hmsFlyt.id,
        title: HMS_SJA_TITTEL,
        status: "received",
        aktivPosisjon: 2,
      },
    });
    await prisma.documentTransfer.create({
      data: {
        checklistId: sja.id,
        senderId: brukerId,
        recipientGroupId: hmsGruppe.id,
        fromStatus: "draft",
        toStatus: "received",
      },
    });
  }
  console.log(
    `3) HMS: SJA-mal «${HMS_MAL_NAVN}» + SJA «${HMS_SJA_TITTEL}» i "received" → behandler ser Besvar/Lukk.`,
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

  // Premiss 3: rom/sone/lokasjon MÅ også ligge INNE i repeateren (parentId satt) — prop-fiksen
  // gjaldt nettopp repeater-barn. Et felt utenfor repeateren tester ikke det som var galt.
  for (const type of ["room_property", "zone_property", "location"] as const) {
    const felt = await prisma.reportObject.findFirst({
      where: {
        type,
        parentId: { not: null },
        template: { projectId: prosjektId, name: SJEKKLISTEMAL_NAVN },
      },
    });
    if (!felt) {
      throw new Error(`${type} mangler i repeater — prop-fiksen ville vært utestbar for det feltet.`);
    }
  }

  // Premiss 4: HMS SJA MÅ finnes i "received" (behandler ser Besvar/Lukk; H1 utestbart ellers).
  const sja = await prisma.checklist.findFirst({
    where: {
      title: HMS_SJA_TITTEL,
      template: { projectId: prosjektId, domain: "hms", subdomain: "sja" },
    },
    select: { status: true, recipientGroupId: true, dokumentflytId: true },
  });
  if (!sja) throw new Error("HMS SJA-dokument mangler — H1 Besvar/Lukk/Gjenåpne er utestbart.");
  if (sja.status !== "received") {
    throw new Error(`HMS SJA er "${sja.status}", ikke "received" — Besvar/Lukk er ikke meningsfulle.`);
  }
  if (!sja.recipientGroupId || !sja.dokumentflytId) {
    throw new Error("HMS SJA er ikke rutet til HMS-gruppen/flyten — ruten ble omgått, ikke respektert.");
  }

  console.log(
    `✓ Verifisert: kemyrhau er ${medlem.role} · drawing_position + rom/sone/lokasjon ligger i repeater ` +
      `· HMS SJA i "received" rutet til HMS-gruppe+flyt.`,
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
  await seedHms(prosjektId, brukerId);
  await verifiser(prosjektId, brukerId);

  console.log("\nFerdig.");
  console.log(`Logg inn på mobil som ${BRUKER_EMAIL} (dev-login) → ${PROSJEKT_NAVN}.`);
  console.log("  · Oppgaver: «Agent testoppgave» → detalj → arkiv-PDF (Share2/CloudOff/manglendeVedlegg).");
  console.log(
    `  · Sjekklister: «${SJEKKLISTE_TITTEL}» → legg til repeater-rad → én rad viser ALLE FIRE velgerne ` +
      "(tegningsposisjon H8 + Rom + Sone + Lokasjon) → prosjektId-prop-fiksen verifiseres i ett blikk.",
  );
  console.log(
    `  · HMS: «${HMS_SJA_TITTEL}» (SJA, i "received") → åpne på mobil → HMS-behandler-flate: Besvar/Lukk (H1). Lukk → Gjenåpne.`,
  );
  console.log(
    "  ⚠ Tegningsposisjon krever en tegning på prosjektet å plassere på — sikre at AGENT-TEST-0001 har minst én tegning (egen seed/opplasting hvis ikke).",
  );
  // Rydding av tomme BLD14/BLD15-utkast: BEVISST UTELATT. Den eneste trygge filteren («tomt
  // draft») ville også truffet seedens egne draft-dokumenter (oppgave/sjekkliste opprettes uten
  // status → default "draft"), og å slette brukerdokumenter fra en seed er nettopp den
  // destruktive klassen ordren ba meg la ligge hvis risikabelt. De er harmløse.
}

main()
  .catch((e) => {
    console.error("Seed feilet:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

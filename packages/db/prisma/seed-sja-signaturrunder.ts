import { PrismaClient } from "@prisma/client";

/**
 * Skjermbilde-seed for SJA-signaturrunder (fabel-ordre 2026-09-06).
 *
 * Bygger ETT komplett scenario Kenneth kan kjøre i ett steg, slik at fabel kan
 * gate flatene mot mockupen:
 *   - Ett demo-prosjekt + SJA-mal med ett `signature_list`-objekt.
 *   - Én SJA («Løft mobilkran — Akse 4») med levende deltakerliste (3 medlemmer + 1 gjest).
 *   - Runde 1 AVSLUTTET (alle signert, antallDeltakere frosset) — viser låst tilstand.
 *   - Runde 2 ÅPEN (2 av 4 signert) — viser manko FØRST, «Signer», forrige-runde amber.
 *
 * Idempotent: kjør så mange ganger du vil. Runder + deltakere for demo-SJA-en
 * nullstilles og bygges på nytt hver kjøring; prosjekt/mal/brukere gjenbrukes.
 *
 * Miljø-guard: speiler seed-bibliotek.ts — nekter mot prod (fjernvert + /sitedoc)
 * uten eksplisitt SEED_CONFIRM_DB=<dbnavn>. Kjør mot LOKAL eller test.
 *
 * Kjør:  pnpm --filter @sitedoc/db seed:sja
 */

const prisma = new PrismaClient();

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
    console.error("⛔ DATABASE_URL peker mot prod-databasen. Skjermbilde-seed avbrutt.");
    console.error("   Bygg demo-data på test/lokal — aldri prod.");
    process.exit(1);
  }
  console.warn(`⚠️  Seeder mot prod «${dbNavn}» (bekreftet via SEED_CONFIRM_DB).`);
}

/** Lokal ISO-8601 med offset for et gitt tidspunkt — speiler shared signaturTidspunktNaa(). */
function lokalIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const offMin = -d.getTimezoneOffset();
  const fortegn = offMin >= 0 ? "+" : "-";
  const abs = Math.abs(offMin);
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` +
    `${fortegn}${p(Math.floor(abs / 60))}:${p(abs % 60)}`
  );
}

async function finnEllerLagBruker(email: string, name: string, role = "user") {
  return prisma.user.upsert({ where: { email }, update: { name }, create: { email, name, role } });
}

async function seed() {
  avbrytHvisProdUtenBekreftelse();
  console.log("Seeder SJA-signaturrunder demo…");

  // 1) Brukere (deltakere). Ansvarlig = SJA-oppretter (bestiller) = «ansvarlig».
  const ansvarlig = await finnEllerLagBruker("sja.ansvarlig@demo.sitedoc.no", "Kari Ansvarlig");
  const ola = await finnEllerLagBruker("ola.tomrer@demo.sitedoc.no", "Ola Tømrer");
  const nina = await finnEllerLagBruker("nina.elektro@demo.sitedoc.no", "Nina Elektriker");
  const jonas = await finnEllerLagBruker("jonas.rigg@demo.sitedoc.no", "Jonas Riggmann");

  // 2) Demo-prosjekt (dedikert — kolliderer aldri med ekte data).
  const projectNumber = "SD-DEMO-SJA-0001";
  let prosjekt = await prisma.project.findFirst({ where: { projectNumber } });
  if (!prosjekt) {
    prosjekt = await prisma.project.create({
      data: {
        projectNumber,
        name: "SJA-signaturrunder demo",
        description: "Demo for fabel-skjermbildegate — SJA-signaturrunder",
        address: "Kranveien 4, 0150 Oslo",
        status: "active",
      },
    });
  }

  // 3) Prosjektmedlemmer (ansvarlig = admin → har redigeringsrett/«ansvarlig»).
  for (const [bruker, rolle] of [
    [ansvarlig, "admin"],
    [ola, "member"],
    [nina, "member"],
    [jonas, "member"],
  ] as const) {
    await prisma.projectMember.upsert({
      where: { userId_projectId: { userId: bruker.id, projectId: prosjekt.id } },
      update: { role: rolle },
      create: { userId: bruker.id, projectId: prosjekt.id, role: rolle },
    });
  }

  // 4) SJA-mal med signaturliste-objekt (config.zone påkrevd — MALBYGGER-regel).
  const malNavn = "SJA — Løft med mobilkran";
  let mal = await prisma.reportTemplate.findFirst({ where: { projectId: prosjekt.id, name: malNavn } });
  if (!mal) {
    mal = await prisma.reportTemplate.create({
      data: {
        projectId: prosjekt.id,
        name: malNavn,
        prefix: "SJA",
        category: "hms",
        domain: "hms",
        subdomain: "sja",
        hmsSynlighet: "apen",
      },
    });
  }
  const harObjekter = await prisma.reportObject.count({ where: { templateId: mal.id } });
  if (harObjekter === 0) {
    await prisma.reportObject.createMany({
      data: [
        { templateId: mal.id, type: "heading", label: "Arbeidsoperasjon", sortOrder: 0, config: { zone: "topptekst" } },
        { templateId: mal.id, type: "text_field", label: "Beskrivelse av løft", sortOrder: 1, config: { zone: "datafelter" } },
        { templateId: mal.id, type: "signature_list", label: "Signaturer — deltakere på løftet", sortOrder: 2, required: true, config: { zone: "datafelter" } },
      ],
    });
  }

  // 5) SJA-dokument (Checklist).
  const tittel = "SJA Løft mobilkran — Akse 4";
  let sja = await prisma.checklist.findFirst({ where: { templateId: mal.id, title: tittel } });
  if (!sja) {
    sja = await prisma.checklist.create({
      data: {
        templateId: mal.id,
        bestillerUserId: ansvarlig.id,
        title: tittel,
        number: 1,
        status: "sent",
        sendt: true,
        data: { [`beskrivelse`]: {} },
      },
    });
  }

  // 6) Nullstill runder + deltakere for demo-SJA-en (idempotent re-seed).
  await prisma.signaturRunde.deleteMany({ where: { checklistId: sja.id } }); // cascade → signaturer
  await prisma.dokumentDeltaker.deleteMany({ where: { checklistId: sja.id } });

  // 7) Deltakere — 3 medlemmer + 1 gjest (levende liste).
  const dKari = await prisma.dokumentDeltaker.create({
    data: { checklistId: sja.id, userId: ansvarlig.id, lagtTilAv: ansvarlig.id },
  });
  const dOla = await prisma.dokumentDeltaker.create({
    data: { checklistId: sja.id, userId: ola.id, lagtTilAv: ansvarlig.id },
  });
  const dNina = await prisma.dokumentDeltaker.create({
    data: { checklistId: sja.id, userId: nina.id, lagtTilAv: ansvarlig.id },
  });
  const dGjest = await prisma.dokumentDeltaker.create({
    data: {
      checklistId: sja.id,
      guestName: "Truls Kranfører",
      guestCompany: "Kranutleie Øst AS",
      guestPhone: "90011223",
      lagtTilAv: ansvarlig.id,
    },
  });

  // 8) Runde 1 — AVSLUTTET, alle 4 signert, antallDeltakere frosset til 4.
  const r1start = new Date("2026-09-05T07:15:00+02:00");
  const r1slutt = new Date("2026-09-05T15:40:00+02:00");
  const r1 = await prisma.signaturRunde.create({
    data: {
      checklistId: sja.id,
      rundeNr: 1,
      startetAt: r1start,
      startetAv: ansvarlig.id,
      avsluttetAt: r1slutt,
      avsluttetAv: ansvarlig.id,
      antallDeltakere: 4,
    },
  });
  await prisma.dokumentSignatur.createMany({
    data: [
      { rundeId: r1.id, deltakerId: dKari.id, hmsKortNr: "1234567", signertTidspunkt: lokalIso(new Date("2026-09-05T07:20:00+02:00")) },
      { rundeId: r1.id, deltakerId: dOla.id, hmsKortNr: "2345678", signertTidspunkt: lokalIso(new Date("2026-09-05T07:22:00+02:00")) },
      { rundeId: r1.id, deltakerId: dNina.id, hmsKortNr: "3456789", signertTidspunkt: lokalIso(new Date("2026-09-05T07:25:00+02:00")) },
      { rundeId: r1.id, deltakerId: dGjest.id, harIkkeHmsKort: true, signertTidspunkt: lokalIso(new Date("2026-09-05T07:31:00+02:00")) },
    ],
  });

  // 9) Runde 2 — ÅPEN, tilsvarende løft ny dag. 2 av 4 signert (Kari + Ola);
  //    Nina + gjest står som manko. Nina signerte forrige runde → amber forrige-rad.
  const r2 = await prisma.signaturRunde.create({
    data: {
      checklistId: sja.id,
      rundeNr: 2,
      startetAt: new Date("2026-09-06T08:05:00+02:00"),
      startetAv: ansvarlig.id,
      aarsak: "Tilsvarende løft 06.09",
    },
  });
  await prisma.dokumentSignatur.createMany({
    data: [
      { rundeId: r2.id, deltakerId: dKari.id, hmsKortNr: "1234567", signertTidspunkt: lokalIso(new Date("2026-09-06T08:07:00+02:00")) },
      { rundeId: r2.id, deltakerId: dOla.id, hmsKortNr: "2345678", signertTidspunkt: lokalIso(new Date("2026-09-06T08:09:00+02:00")) },
    ],
  });

  console.log("✓ Ferdig. Åpne SJA-en i appen:");
  console.log(`   Prosjekt: ${prosjekt.name} (${prosjekt.projectNumber})  id=${prosjekt.id}`);
  console.log(`   HMS → SJA → «${tittel}»  checklistId=${sja.id}`);
  console.log(`   Logg inn som: ${ansvarlig.email} (ansvarlig/admin) — ser «Start ny runde», «Legg til deltaker».`);
  console.log(`   Runde 2 (åpen): 2 av 4 signert. Manko: Nina Elektriker (forrige-runde amber) + Truls Kranfører (gjest).`);
  console.log(`   Logg inn som ${nina.email} for å se «Signer» på egen manko-rad.`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

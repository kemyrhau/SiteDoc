import { PrismaClient } from "@prisma/client";

/**
 * Skjermbilde-seed for SJA-signaturrunder (fabel-ordre 2026-09-06).
 *
 * Bygger ETT komplett scenario Kenneth kan kjøre i ett steg, slik at fabel kan
 * gate flatene mot mockupen:
 *   - Demo-prosjekt FESTET TIL ET EKSISTERENDE FIRMA (den innloggende brukerens
 *     Organization) — ellers er prosjektet orphan og usynlig i firmakontekst
 *     (CLAUDE.md-regelen fra 2026-05-20; hensikten gjelder også en seed).
 *   - SJA-mal med ett `signature_list`-objekt.
 *   - SJA med levende deltakerliste. 🔴 DEN INNLOGGENDE BRUKEREN er deltaker med
 *     USIGNERT rad i den åpne runden — det eneste som gjør «Signer»-flaten testbar
 *     (han logger inn som seg selv via OAuth og ser «Signer» på sin egen rad).
 *   - Demo-brukerne er de ANDRE deltakerne (fyller manko/signert) — de trenger
 *     ikke kunne logge inn (innlogging i SiteDoc er OAuth; upsertede demo-brukere
 *     har ingen OAuth-konto og skal ikke ha det).
 *   - Runde 1 AVSLUTTET (alle signert, antallDeltakere frosset) + runde 2 ÅPEN.
 *
 * Idempotent: kjør så mange ganger du vil. Prosjekt/mal/brukere gjenbrukes;
 * en tidligere ORPHAN demo-prosjekt-rad REPARERES (primaryOrganizationId settes).
 * Runder + deltakere bygges på nytt hver kjøring.
 *
 * 🔴 SEED_SJA_BRUKER=<epost> er PÅKREVD: e-posten til brukeren som skal logge inn
 * (må finnes som ekte OAuth-bruker i mål-DB-en og være medlem av et firma). Mål
 * hvilken e-post du har i den aktuelle databasen — ikke gjett.
 *
 * Miljø-guard: speiler seed-bibliotek.ts — nekter mot prod uten SEED_CONFIRM_DB.
 *
 * Kjør:  SEED_SJA_BRUKER=<din-epost> pnpm --filter @sitedoc/db seed:sja
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

/** Demo-deltaker (ikke innloggingsbruker) — upsertes for navn i deltakerlista. */
async function finnEllerLagDemoBruker(email: string, name: string) {
  return prisma.user.upsert({ where: { email }, update: { name }, create: { email, name, role: "user" } });
}

async function seed() {
  avbrytHvisProdUtenBekreftelse();

  // 0) Innloggingsbrukeren — PÅKREVD, må finnes som ekte (OAuth-)bruker + firmamedlem.
  const brukerEpost = process.env.SEED_SJA_BRUKER;
  if (!brukerEpost) {
    console.error("⛔ SEED_SJA_BRUKER mangler.");
    console.error("   Sett e-posten til brukeren som skal logge inn og teste «Signer»:");
    console.error("   SEED_SJA_BRUKER=<din-epost> pnpm --filter @sitedoc/db seed:sja");
    process.exit(1);
  }
  const bruker = await prisma.user.findUnique({ where: { email: brukerEpost } });
  if (!bruker) {
    console.error(`⛔ Fant ingen bruker med e-post «${brukerEpost}» i denne databasen.`);
    console.error("   Innlogging er OAuth — brukeren må ha logget inn minst én gang. Mål e-posten, ikke gjett.");
    process.exit(1);
  }
  const medlemskap = await prisma.organizationMember.findFirst({
    where: { userId: bruker.id, status: "aktiv" },
    include: { organization: { select: { id: true, name: true } } },
  });
  if (!medlemskap) {
    console.error(`⛔ «${brukerEpost}» er ikke aktivt medlem av noe firma.`);
    console.error("   Demo-prosjektet må festes til et firma for å være synlig i firmakontekst.");
    console.error("   Legg brukeren inn i et firma på test først, eller velg en bruker som har firma.");
    process.exit(1);
  }
  const orgId = medlemskap.organizationId;
  console.log(`Seeder SJA-signaturrunder demo i firma «${medlemskap.organization.name}»…`);

  // 1) Demo-deltakere (andre enn innloggingsbrukeren) — trenger ikke OAuth.
  const ola = await finnEllerLagDemoBruker("ola.tomrer@demo.sitedoc.no", "Ola Tømrer");
  const nina = await finnEllerLagDemoBruker("nina.elektro@demo.sitedoc.no", "Nina Elektriker");

  // 2) Demo-prosjekt festet til firmaet. Idempotent: reparerer en tidligere orphan.
  const projectNumber = "SD-DEMO-SJA-0001";
  const eksisterende = await prisma.project.findFirst({ where: { projectNumber } });
  const prosjekt = eksisterende
    ? await prisma.project.update({
        where: { id: eksisterende.id },
        data: { primaryOrganizationId: orgId }, // repareres om den var orphan
      })
    : await prisma.project.create({
        data: {
          projectNumber,
          name: "SJA-signaturrunder demo",
          description: "Demo for fabel-skjermbildegate — SJA-signaturrunder",
          address: "Kranveien 4, 0150 Oslo",
          status: "active",
          primaryOrganizationId: orgId,
        },
      });

  // 3) Prosjektmedlemmer. Innloggingsbrukeren = admin (ser ansvarlig-handlinger +
  //    egen «Signer»). Demo-brukerne = member.
  await prisma.projectMember.upsert({
    where: { userId_projectId: { userId: bruker.id, projectId: prosjekt.id } },
    update: { role: "admin" },
    create: { userId: bruker.id, projectId: prosjekt.id, role: "admin" },
  });
  for (const demo of [ola, nina]) {
    await prisma.projectMember.upsert({
      where: { userId_projectId: { userId: demo.id, projectId: prosjekt.id } },
      update: { role: "member" },
      create: { userId: demo.id, projectId: prosjekt.id, role: "member" },
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
  if ((await prisma.reportObject.count({ where: { templateId: mal.id } })) === 0) {
    await prisma.reportObject.createMany({
      data: [
        { templateId: mal.id, type: "heading", label: "Arbeidsoperasjon", sortOrder: 0, config: { zone: "topptekst" } },
        { templateId: mal.id, type: "text_field", label: "Beskrivelse av løft", sortOrder: 1, config: { zone: "datafelter" } },
        { templateId: mal.id, type: "signature_list", label: "Signaturer — deltakere på løftet", sortOrder: 2, required: true, config: { zone: "datafelter" } },
      ],
    });
  }

  // 5) SJA-dokument. Innloggingsbrukeren er bestiller/ansvarlig.
  const tittel = "SJA Løft mobilkran — Akse 4";
  let sja = await prisma.checklist.findFirst({ where: { templateId: mal.id, title: tittel } });
  if (!sja) {
    sja = await prisma.checklist.create({
      data: { templateId: mal.id, bestillerUserId: bruker.id, title: tittel, number: 1, status: "sent", sendt: true },
    });
  } else {
    sja = await prisma.checklist.update({ where: { id: sja.id }, data: { bestillerUserId: bruker.id } });
  }

  // 6) Nullstill runder + deltakere for demo-SJA-en (idempotent re-seed).
  await prisma.signaturRunde.deleteMany({ where: { checklistId: sja.id } }); // cascade → signaturer
  await prisma.dokumentDeltaker.deleteMany({ where: { checklistId: sja.id } });

  // 7) Deltakere: innloggingsbrukeren + 2 demo-medlemmer + 1 gjest.
  const dBruker = await prisma.dokumentDeltaker.create({
    data: { checklistId: sja.id, userId: bruker.id, lagtTilAv: bruker.id },
  });
  const dOla = await prisma.dokumentDeltaker.create({
    data: { checklistId: sja.id, userId: ola.id, lagtTilAv: bruker.id },
  });
  const dNina = await prisma.dokumentDeltaker.create({
    data: { checklistId: sja.id, userId: nina.id, lagtTilAv: bruker.id },
  });
  const dGjest = await prisma.dokumentDeltaker.create({
    data: {
      checklistId: sja.id,
      guestName: "Truls Kranfører",
      guestCompany: "Kranutleie Øst AS",
      guestPhone: "90011223",
      lagtTilAv: bruker.id,
    },
  });

  // 8) Runde 1 — AVSLUTTET, alle 4 signert (inkl. innloggingsbrukeren), frosset til 4.
  const r1 = await prisma.signaturRunde.create({
    data: {
      checklistId: sja.id,
      rundeNr: 1,
      startetAt: new Date("2026-09-05T07:15:00+02:00"),
      startetAv: bruker.id,
      avsluttetAt: new Date("2026-09-05T15:40:00+02:00"),
      avsluttetAv: bruker.id,
      antallDeltakere: 4,
    },
  });
  await prisma.dokumentSignatur.createMany({
    data: [
      { rundeId: r1.id, deltakerId: dBruker.id, hmsKortNr: "1234567", signertTidspunkt: lokalIso(new Date("2026-09-05T07:20:00+02:00")) },
      { rundeId: r1.id, deltakerId: dOla.id, hmsKortNr: "2345678", signertTidspunkt: lokalIso(new Date("2026-09-05T07:22:00+02:00")) },
      { rundeId: r1.id, deltakerId: dNina.id, hmsKortNr: "3456789", signertTidspunkt: lokalIso(new Date("2026-09-05T07:25:00+02:00")) },
      { rundeId: r1.id, deltakerId: dGjest.id, harIkkeHmsKort: true, signertTidspunkt: lokalIso(new Date("2026-09-05T07:31:00+02:00")) },
    ],
  });

  // 9) Runde 2 — ÅPEN. Kun Ola har signert. 🔴 Innloggingsbrukeren står USIGNERT
  //    → ser «Signer» på egen rad. Nina signerte forrige runde → amber forrige-rad.
  //    Gjest usignert → manko (signeres på ansvarliges enhet).
  const r2 = await prisma.signaturRunde.create({
    data: {
      checklistId: sja.id,
      rundeNr: 2,
      startetAt: new Date("2026-09-06T08:05:00+02:00"),
      startetAv: bruker.id,
      aarsak: "Tilsvarende løft 06.09",
    },
  });
  await prisma.dokumentSignatur.create({
    data: { rundeId: r2.id, deltakerId: dOla.id, hmsKortNr: "2345678", signertTidspunkt: lokalIso(new Date("2026-09-06T08:09:00+02:00")) },
  });

  console.log("✓ Ferdig.");
  console.log(`   Firma:    ${medlemskap.organization.name}`);
  console.log(`   Prosjekt: ${prosjekt.name} (${prosjekt.projectNumber})  — synlig i firmakontekst`);
  console.log(`   HMS → SJA → «${tittel}»`);
  console.log(`   🔴 Logg inn som DEG SELV (${brukerEpost}) via OAuth.`);
  console.log(`      Runde 2 er åpen (1 av 4 signert). Din egen rad står USIGNERT → «Signer».`);
  console.log(`      Andre manko: Nina Elektriker (amber forrige-runde) + Truls Kranfører (gjest).`);
  console.log(`      Som admin/ansvarlig ser du også «Legg til deltaker», «Avslutt runde».`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

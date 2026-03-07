/**
 * Seed-skript: Oppretter "Godkjenning"-mal (oppgavetype) for endringsmeldinger,
 * varsel om krav og lignende økonomiske krav.
 *
 * Bruk: pnpm --filter @sitedoc/db exec tsx prisma/seed-godkjenning.ts
 *
 * Malen opprettes i det første aktive prosjektet.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedGodkjenning() {
  // Finn første aktive prosjekt
  const prosjekt = await prisma.project.findFirst({
    where: { status: "active" },
    orderBy: { createdAt: "asc" },
  });

  if (!prosjekt) {
    console.error("Ingen aktive prosjekter funnet. Opprett et prosjekt først.");
    process.exit(1);
  }

  console.log(`Oppretter Godkjenning-mal i prosjekt: ${prosjekt.name} (${prosjekt.projectNumber})`);

  // Sjekk om malen allerede eksisterer
  const eksisterende = await prisma.reportTemplate.findFirst({
    where: { projectId: prosjekt.id, prefix: "GM" },
  });

  if (eksisterende) {
    console.log("Godkjenning-mal (GM) finnes allerede. Avbryter.");
    return;
  }

  // Opprett malen
  const mal = await prisma.reportTemplate.create({
    data: {
      projectId: prosjekt.id,
      name: "Godkjenning",
      description: "Endringsmelding, varsel om krav og økonomiske godkjenninger",
      prefix: "GM",
      category: "oppgave",
      domain: "bygg",
      subjects: [
        "Endringsmelding",
        "Varsel om krav",
        "Tilleggsarbeid",
        "Fradrag",
        "Regulering",
      ],
    },
  });

  console.log(`  Mal opprettet: ${mal.name} (${mal.id})`);

  // Opprett rapportobjekter for malen
  await prisma.reportObject.createMany({
    data: [
      // === TOPPTEKST ===
      {
        templateId: mal.id,
        type: "location",
        label: "Lokasjon",
        sortOrder: 0,
        config: { zone: "topptekst" },
      },
      {
        templateId: mal.id,
        type: "date",
        label: "Dato",
        sortOrder: 1,
        required: true,
        config: { zone: "topptekst" },
      },
      {
        templateId: mal.id,
        type: "person",
        label: "Ansvarlig",
        sortOrder: 2,
        required: true,
        config: { zone: "topptekst" },
      },
      {
        templateId: mal.id,
        type: "company",
        label: "Oppretter-entreprise",
        sortOrder: 3,
        required: true,
        config: { role: "creator", zone: "topptekst" },
      },

      // === DATAFELTER ===
      {
        templateId: mal.id,
        type: "heading",
        label: "Beskrivelse",
        sortOrder: 10,
        config: { zone: "datafelter" },
      },
      {
        templateId: mal.id,
        type: "text_field",
        label: "Beskrivelse av endring/krav",
        sortOrder: 11,
        required: true,
        config: { multiline: true, zone: "datafelter" },
      },
      {
        templateId: mal.id,
        type: "text_field",
        label: "Begrunnelse",
        sortOrder: 12,
        required: false,
        config: { multiline: true, zone: "datafelter" },
      },
      {
        templateId: mal.id,
        type: "text_field",
        label: "Referanse (kontrakt/avtale)",
        sortOrder: 13,
        required: false,
        config: { zone: "datafelter" },
      },

      // Økonomi
      {
        templateId: mal.id,
        type: "heading",
        label: "Økonomi",
        sortOrder: 20,
        config: { zone: "datafelter" },
      },
      {
        templateId: mal.id,
        type: "decimal",
        label: "Beløp eks. mva (NOK)",
        sortOrder: 21,
        required: false,
        config: { unit: "NOK", zone: "datafelter" },
      },
      {
        templateId: mal.id,
        type: "list_single",
        label: "Type",
        sortOrder: 22,
        required: true,
        config: {
          options: ["Tillegg", "Fradrag", "Regulering", "Annet"],
          zone: "datafelter",
        },
      },
      {
        templateId: mal.id,
        type: "date",
        label: "Frist for svar",
        sortOrder: 23,
        required: false,
        config: { zone: "datafelter" },
      },

      // Vedlegg og vurdering
      {
        templateId: mal.id,
        type: "heading",
        label: "Dokumentasjon og vurdering",
        sortOrder: 30,
        config: { zone: "datafelter" },
      },
      {
        templateId: mal.id,
        type: "attachments",
        label: "Vedlegg",
        sortOrder: 31,
        required: false,
        config: { zone: "datafelter" },
      },
      {
        templateId: mal.id,
        type: "traffic_light",
        label: "Beslutning",
        sortOrder: 32,
        required: true,
        config: {
          options: [
            { value: "green", label: "Godkjent" },
            { value: "yellow", label: "Delvis godkjent" },
            { value: "red", label: "Avvist" },
            { value: "gray", label: "Ikke behandlet" },
          ],
          zone: "datafelter",
        },
      },
      {
        templateId: mal.id,
        type: "text_field",
        label: "Kommentar til beslutning",
        sortOrder: 33,
        required: false,
        config: { multiline: true, zone: "datafelter" },
      },
      {
        templateId: mal.id,
        type: "signature",
        label: "Signatur",
        sortOrder: 34,
        required: false,
        config: { zone: "datafelter" },
      },
    ],
  });

  console.log("  17 rapportobjekter opprettet");
  console.log("\nGodkjenning-mal ferdig!");
}

seedGodkjenning()
  .catch((e) => {
    console.error("Feil:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

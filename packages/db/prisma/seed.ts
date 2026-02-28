import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seed() {
  console.log("Seeder databasen...");

  // Opprett testbrukere
  const bruker1 = await prisma.user.create({
    data: {
      clerkId: "test_bruker_1",
      email: "ole.nordmann@siteflow.no",
      firstName: "Ole",
      lastName: "Nordmann",
      role: "admin",
    },
  });

  const bruker2 = await prisma.user.create({
    data: {
      clerkId: "test_bruker_2",
      email: "kari.hansen@siteflow.no",
      firstName: "Kari",
      lastName: "Hansen",
      role: "user",
    },
  });

  const bruker3 = await prisma.user.create({
    data: {
      clerkId: "test_bruker_3",
      email: "per.johansen@uebygg.no",
      firstName: "Per",
      lastName: "Johansen",
      role: "user",
    },
  });

  console.log("  Brukere opprettet");

  // Opprett testprosjekt
  const prosjekt = await prisma.project.create({
    data: {
      projectNumber: "SF-20260228-0001",
      name: "Bjørvika Kontorbygg",
      description: "Nybygg kontorbygg med 12 etasjer, Bjørvika Oslo",
      address: "Dronning Eufemias gate 30, 0191 Oslo",
      status: "active",
    },
  });

  const prosjekt2 = await prisma.project.create({
    data: {
      projectNumber: "SF-20260228-0002",
      name: "Nydalen Boligblokk",
      description: "Rehabilitering av boligblokk med 48 leiligheter",
      address: "Nydalsveien 15, 0484 Oslo",
      status: "active",
    },
  });

  console.log("  Prosjekter opprettet");

  // Opprett entrepriser
  const hovedentreprise = await prisma.enterprise.create({
    data: {
      projectId: prosjekt.id,
      name: "Hovedentreprise - Bygg AS",
      organizationNumber: "912345678",
    },
  });

  const elEntreprise = await prisma.enterprise.create({
    data: {
      projectId: prosjekt.id,
      name: "UE Elektro - Strøm & Lys AS",
      organizationNumber: "923456789",
    },
  });

  const rørEntreprise = await prisma.enterprise.create({
    data: {
      projectId: prosjekt.id,
      name: "UE Rør - VVS Partner AS",
      organizationNumber: "934567890",
    },
  });

  console.log("  Entrepriser opprettet");

  // Koble brukere til prosjektet
  await prisma.projectMember.createMany({
    data: [
      {
        userId: bruker1.id,
        projectId: prosjekt.id,
        enterpriseId: hovedentreprise.id,
        role: "admin",
      },
      {
        userId: bruker2.id,
        projectId: prosjekt.id,
        enterpriseId: hovedentreprise.id,
        role: "member",
      },
      {
        userId: bruker3.id,
        projectId: prosjekt.id,
        enterpriseId: elEntreprise.id,
        role: "member",
      },
    ],
  });

  console.log("  Prosjektmedlemmer koblet");

  // Opprett rapportmal
  const mal = await prisma.reportTemplate.create({
    data: {
      projectId: prosjekt.id,
      name: "Kontrollsjekkliste - Elektro",
      description: "Standard sjekkliste for kontroll av elektrisk installasjon",
    },
  });

  // Opprett rapportobjekter for malen
  await prisma.reportObject.createMany({
    data: [
      {
        templateId: mal.id,
        type: "section_divider",
        label: "Generell informasjon",
        sortOrder: 1,
        config: {},
      },
      {
        templateId: mal.id,
        type: "enterprise_picker",
        label: "Utførende entreprise",
        sortOrder: 2,
        required: true,
        config: { role: "responder" },
      },
      {
        templateId: mal.id,
        type: "date_time",
        label: "Kontrolldato",
        sortOrder: 3,
        required: true,
        config: { includeTime: false },
      },
      {
        templateId: mal.id,
        type: "location_picker",
        label: "Lokasjon",
        sortOrder: 4,
        required: false,
        config: { gpsEnabled: true },
      },
      {
        templateId: mal.id,
        type: "section_divider",
        label: "Kontrollpunkter",
        sortOrder: 5,
        config: {},
      },
      {
        templateId: mal.id,
        type: "checkbox",
        label: "Kabelføring i henhold til tegning",
        sortOrder: 6,
        required: true,
        config: {},
      },
      {
        templateId: mal.id,
        type: "checkbox",
        label: "Jordingssystem kontrollert",
        sortOrder: 7,
        required: true,
        config: {},
      },
      {
        templateId: mal.id,
        type: "status_picker",
        label: "Totalvurdering",
        sortOrder: 8,
        required: true,
        config: {
          options: ["Godkjent", "Godkjent med anmerkning", "Ikke godkjent"],
        },
      },
      {
        templateId: mal.id,
        type: "camera_field",
        label: "Dokumentasjonsfoto",
        sortOrder: 9,
        required: false,
        config: { maxImages: 5, gpsEnabled: true },
      },
      {
        templateId: mal.id,
        type: "comment_field",
        label: "Kommentarer",
        sortOrder: 10,
        required: false,
        config: {},
      },
      {
        templateId: mal.id,
        type: "signature",
        label: "Signatur kontrollør",
        sortOrder: 11,
        required: true,
        config: {},
      },
    ],
  });

  console.log("  Rapportmal med 11 objekter opprettet");

  // Opprett en sjekkliste basert på malen
  const sjekkliste = await prisma.checklist.create({
    data: {
      templateId: mal.id,
      creatorUserId: bruker1.id,
      creatorEnterpriseId: hovedentreprise.id,
      responderEnterpriseId: elEntreprise.id,
      status: "sent",
      title: "Kontroll elektro - 3. etasje",
      dueDate: new Date("2026-03-15"),
    },
  });

  // Logg overgang
  await prisma.documentTransfer.create({
    data: {
      checklistId: sjekkliste.id,
      senderId: bruker1.id,
      fromStatus: "draft",
      toStatus: "sent",
      comment: "Vennligst gjennomfør kontroll innen fristen",
    },
  });

  console.log("  Sjekkliste med overgang opprettet");

  // Opprett en oppgave
  await prisma.task.create({
    data: {
      creatorUserId: bruker1.id,
      creatorEnterpriseId: hovedentreprise.id,
      responderEnterpriseId: rørEntreprise.id,
      status: "draft",
      title: "Monter brannventiler i 5. etasje",
      description: "Monter brannventiler i henhold til tegning VVS-501. Frist: 20. mars.",
      priority: "high",
      dueDate: new Date("2026-03-20"),
    },
  });

  console.log("  Oppgave opprettet");

  // Opprett mappestruktur
  const rotmappe = await prisma.folder.create({
    data: {
      projectId: prosjekt.id,
      name: "Prosjektdokumenter",
    },
  });

  await prisma.folder.createMany({
    data: [
      { projectId: prosjekt.id, parentId: rotmappe.id, name: "Tegninger" },
      { projectId: prosjekt.id, parentId: rotmappe.id, name: "Rapporter" },
      { projectId: prosjekt.id, parentId: rotmappe.id, name: "Kontrakter" },
    ],
  });

  console.log("  Mappestruktur opprettet");
  console.log("\nSeeding fullført!");
}

seed()
  .catch((e) => {
    console.error("Feil under seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

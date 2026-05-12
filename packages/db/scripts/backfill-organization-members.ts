// Backfill OrganizationMember-rader fra eksisterende User.organizationId.
//
// O-1 (additivt) — opprettes for hver User med organizationId != null.
// Idempotent via upsert på (userId, organizationId)-unique.
//
// Kjør på test: pnpm --filter @sitedoc/db exec tsx scripts/backfill-organization-members.ts
//
// Kjør på prod: samme kommando på prod-server etter migrate deploy.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { organizationId: { not: null } },
    select: {
      id: true,
      organizationId: true,
      role: true,
      ansattnummer: true,
    },
  });

  console.log(`Backfiller ${users.length} brukere...`);

  let opprettet = 0;
  let eksisterende = 0;

  for (const user of users) {
    const result = await prisma.organizationMember.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: user.organizationId!,
        },
      },
      create: {
        userId: user.id,
        organizationId: user.organizationId!,
        ansattRolle: "ansatt",
        firmaRoller: user.role === "company_admin" ? ["firma_admin"] : [],
        ansattnummer: user.ansattnummer ?? null,
      },
      update: {}, // idempotent — oppdater ingenting hvis raden finnes
    });

    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      opprettet += 1;
    } else {
      eksisterende += 1;
    }
  }

  const total = await prisma.organizationMember.count();
  console.log(`Backfill ferdig. Opprettet: ${opprettet}, eksisterende uendret: ${eksisterende}, totalt i tabellen: ${total}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

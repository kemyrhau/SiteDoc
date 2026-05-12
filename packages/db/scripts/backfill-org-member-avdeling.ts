// Backfill OrganizationMember.avdelingId fra eksisterende User.avdelingId.
//
// O-4a — kjøres etter at migrasjonen 20260512200000_o4a_add_member_avdeling er
// applied. Idempotent: leser kun User-rader med organizationId og avdelingId
// satt, og oppdaterer matchende OrganizationMember-rad.
//
// Kjør på test: pnpm --filter @sitedoc/db exec tsx scripts/backfill-org-member-avdeling.ts
//
// Kjør på prod: samme kommando på prod-server etter migrate deploy.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { organizationId: { not: null }, avdelingId: { not: null } },
    select: { id: true, organizationId: true, avdelingId: true },
  });

  console.log(`Backfiller avdelingId for ${users.length} brukere...`);

  let oppdatert = 0;
  for (const user of users) {
    const res = await prisma.organizationMember.updateMany({
      where: { userId: user.id, organizationId: user.organizationId! },
      data: { avdelingId: user.avdelingId },
    });
    oppdatert += res.count;
  }

  console.log(`Ferdig. Oppdaterte rader: ${oppdatert}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// Backfill OrganizationMember.firmaRoller med ["firma_admin"] for medlemmer
// der tilhørende User.role === "company_admin".
//
// Bakgrunn: O-5c-fallbacken fra User.role er fjernet. Endringer fra dagens
// endreRolle-UI har skrevet til User.role uten å speile til firmaRoller, så
// 25/26 OrganizationMember-rader på test har firmaRoller = []. Etter denne
// PR-en eies firma_admin-status av OrganizationMember.firmaRoller alene.
//
// Idempotent: hopper over rader som allerede har "firma_admin" i firmaRoller.
//
// Kjør på test: pnpm --filter @sitedoc/db exec tsx scripts/backfill-firma-admin-roller.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const members = await prisma.organizationMember.findMany({
    where: { user: { role: "company_admin" } },
    select: {
      id: true,
      userId: true,
      organizationId: true,
      firmaRoller: true,
      user: { select: { email: true } },
    },
  });

  console.log(
    `Fant ${members.length} OrganizationMember-rader med User.role = "company_admin".`,
  );

  let oppdatert = 0;
  let hoppetOver = 0;
  for (const m of members) {
    if (m.firmaRoller.includes("firma_admin")) {
      hoppetOver += 1;
      continue;
    }
    await prisma.organizationMember.update({
      where: { id: m.id },
      data: { firmaRoller: [...m.firmaRoller, "firma_admin"] },
    });
    oppdatert += 1;
    console.log(`  + ${m.user.email} (org ${m.organizationId})`);
  }

  console.log(
    `Ferdig. Oppdaterte: ${oppdatert}. Hoppet over (allerede satt): ${hoppetOver}.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

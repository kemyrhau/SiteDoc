/**
 * Flytmodell Fase 2 — backfill av NON-TERMINAL aktivPosisjon + retning (Q4).
 *
 * Utsatt fra Fase 1a (AVKLARING 1): aktive dokumenters posisjon speiler runtime-rutingen
 * (eier/recipient → medlem-steg), som først finnes som DELT utledning i Fase 2. Dette
 * scriptet kaller den delte `finnPosisjon` fra @sitedoc/shared — SAMME funksjon runtime
 * skal bruke — så backfillen aldri kan divergere fra en hånd-rullet approksimasjon.
 *
 * Scope: dokumenter med dokumentflyt, IKKE terminale, som ennå mangler aktivPosisjon.
 *   (1a backfilte terminal-posisjon; 1b backfilte HMS-dok. Dette er resten: aktive
 *    standardflyt-dok.) Idempotent — kun aktivPosisjon IS NULL.
 *
 * retning: responded → "tilbake" (via besvar), ellers "frem". paatvers settes aldri
 * av backfill (kun ny videresend fremover).
 *
 * Bruk (mot ønsket DB — verifiser DATABASE_URL FØRST):
 *   pnpm --filter @sitedoc/api exec tsx scripts/backfill-flytmodell-fase2-posisjon.ts
 */

import { prisma } from "@sitedoc/db";
import { finnPosisjon, byggPosisjonsLedd, type RaFlytMedlem } from "@sitedoc/shared";

interface RaMedlem {
  steg: number;
  klassifisering: string | null;
  kanTerminereUtenBall: boolean;
  faggruppeId: string | null;
  groupId: string | null;
  projectMember: { userId: string | null } | null;
}

/** Normaliser Prisma-medlem → delt RaFlytMedlem (brukerId = projectMember-brukeren). */
const normaliser = (m: RaMedlem): RaFlytMedlem => ({
  steg: m.steg,
  klassifisering: m.klassifisering,
  kanTerminereUtenBall: m.kanTerminereUtenBall,
  brukerId: m.projectMember?.userId ?? null,
  gruppeId: m.groupId,
  faggruppeId: m.faggruppeId,
});

const medlemSelect = {
  steg: true,
  klassifisering: true,
  kanTerminereUtenBall: true,
  faggruppeId: true,
  groupId: true,
  projectMember: { select: { userId: true } },
} as const;

const utledRetning = (status: string): string => (status === "responded" ? "tilbake" : "frem");

async function backfillChecklists(): Promise<{ oppdatert: number; uendret: number }> {
  const rader = await prisma.checklist.findMany({
    where: { terminal: null, aktivPosisjon: null, dokumentflytId: { not: null } },
    select: {
      id: true,
      status: true,
      sendt: true,
      recipientUserId: true,
      recipientGroupId: true,
      bestillerUserId: true,
      dokumentflyt: { select: { medlemmer: { select: medlemSelect } } },
    },
  });
  let oppdatert = 0;
  let uendret = 0;
  for (const c of rader) {
    const ledd = byggPosisjonsLedd((c.dokumentflyt?.medlemmer ?? []).map(normaliser));
    const posisjon = finnPosisjon({
      ledd,
      status: c.status,
      sendt: c.sendt,
      recipientUserId: c.recipientUserId,
      recipientGroupId: c.recipientGroupId,
      bestillerUserId: c.bestillerUserId,
    });
    if (posisjon === null) {
      uendret++;
      continue;
    }
    await prisma.checklist.update({
      where: { id: c.id },
      data: { aktivPosisjon: posisjon, retning: utledRetning(c.status) },
    });
    oppdatert++;
  }
  return { oppdatert, uendret };
}

async function backfillTasks(): Promise<{ oppdatert: number; uendret: number }> {
  const rader = await prisma.task.findMany({
    where: { terminal: null, aktivPosisjon: null, dokumentflytId: { not: null } },
    select: {
      id: true,
      status: true,
      sendt: true,
      recipientUserId: true,
      recipientGroupId: true,
      bestillerUserId: true,
      dokumentflyt: { select: { medlemmer: { select: medlemSelect } } },
    },
  });
  let oppdatert = 0;
  let uendret = 0;
  for (const t of rader) {
    const ledd = byggPosisjonsLedd((t.dokumentflyt?.medlemmer ?? []).map(normaliser));
    const posisjon = finnPosisjon({
      ledd,
      status: t.status,
      sendt: t.sendt,
      recipientUserId: t.recipientUserId,
      recipientGroupId: t.recipientGroupId,
      bestillerUserId: t.bestillerUserId,
    });
    if (posisjon === null) {
      uendret++;
      continue;
    }
    await prisma.task.update({
      where: { id: t.id },
      data: { aktivPosisjon: posisjon, retning: utledRetning(t.status) },
    });
    oppdatert++;
  }
  return { oppdatert, uendret };
}

async function main() {
  console.log("Flytmodell Fase 2 — backfill non-terminal aktivPosisjon + retning\n");
  const cl = await backfillChecklists();
  console.log(`Sjekklister: ${cl.oppdatert} oppdatert, ${cl.uendret} uendret (ubestembar posisjon)`);
  const tk = await backfillTasks();
  console.log(`Oppgaver:    ${tk.oppdatert} oppdatert, ${tk.uendret} uendret (ubestembar posisjon)`);
  console.log("\nFerdig.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

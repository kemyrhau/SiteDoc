/**
 * Papirkurv-sweep — 90-dagers auto-hardslett (F0 soft-delete).
 *
 * Mønster: setTimeout-poll-løkke (kanon per arkitektur-syntese § 6.2, som
 * startVegvesenWorker/startOversettelsesløkke). Kjøres én gang kort etter
 * oppstart, deretter daglig. Sletter (ekte delete()) alle sjekklister/oppgaver
 * der `deletedAt < nå − 90 dager` — rydder transfers/bilder først.
 *
 * «Slett endelig» (papirkurv-routeren) gjør det samme manuelt før fristen.
 */
import type { PrismaClient } from "@sitedoc/db";
import { PAPIRKURV_DAGER } from "../utils/softDelete";

const SWEEP_INTERVALL_MS = 24 * 60 * 60 * 1000; // 24 timer
const OPPSTART_FORSINKELSE_MS = 60_000; // 1 min etter oppstart

export function startPapirkurvSweep(prisma: PrismaClient): void {
  console.log("Papirkurv-sweep startet");

  async function sweep() {
    try {
      const frist = new Date(Date.now() - PAPIRKURV_DAGER * 24 * 60 * 60 * 1000);

      const utlopteSjekklister = await prisma.checklist.findMany({
        where: { deletedAt: { lt: frist } },
        select: { id: true },
      });
      const utlopteOppgaver = await prisma.task.findMany({
        where: { deletedAt: { lt: frist } },
        select: { id: true },
      });

      let antall = 0;
      for (const { id } of utlopteSjekklister) {
        await prisma.$transaction(async (tx) => {
          await tx.documentTransfer.deleteMany({ where: { checklistId: id } });
          await tx.image.deleteMany({ where: { checklistId: id } });
          await tx.checklist.delete({ where: { id } });
        });
        antall++;
      }
      for (const { id } of utlopteOppgaver) {
        await prisma.$transaction(async (tx) => {
          await tx.documentTransfer.deleteMany({ where: { taskId: id } });
          await tx.image.deleteMany({ where: { taskId: id } });
          await tx.task.delete({ where: { id } });
        });
        antall++;
      }

      if (antall > 0) {
        console.log(`Papirkurv-sweep: hardslettet ${antall} utløpte dokumenter (> ${PAPIRKURV_DAGER} dager)`);
      }
    } catch (err) {
      console.error("Papirkurv-sweep feil:", err);
    }
    setTimeout(sweep, SWEEP_INTERVALL_MS);
  }

  setTimeout(sweep, OPPSTART_FORSINKELSE_MS);
}

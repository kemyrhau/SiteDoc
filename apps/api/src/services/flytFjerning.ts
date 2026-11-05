import type { Prisma } from "@sitedoc/db";
import { TERMINALE_DOKUMENTSTATUSER } from "@sitedoc/shared";
import { IKKE_SLETTET } from "../utils/softDelete";

/**
 * Myk fjerning fra dokumentflyt (ordre 2026-11-05 (3), L1 — spec-fjerning-deaktivering.md § 2).
 *
 * «Åpent» dokument = ikke i papirkurv og ikke i terminal status (closed/approved/cancelled).
 * `dismissed` (Avvist) kan gå tilbake til kladd og regnes derfor som åpent.
 */
export const APENT_DOKUMENT_WHERE = {
  status: { notIn: [...TERMINALE_DOKUMENTSTATUSER] },
  ...IKKE_SLETTET,
};

type Db = Prisma.TransactionClient;

/** Hvem et flytmedlem peker på i dokumentenes mottakerfelt. Faggruppe-/åpne ledd bærer ingen peker. */
export interface MedlemPeker {
  dokumentflytId: string;
  userId: string | null;
  groupId: string | null;
  /** Når personen står i flere ledd i samme flyt: begrens til dokumenter på dette steget. */
  kunSteg: number | null;
}

function pekerWhere(peker: MedlemPeker) {
  const mottaker = peker.userId
    ? { recipientUserId: peker.userId }
    : peker.groupId
      ? { recipientGroupId: peker.groupId }
      : null;
  if (!mottaker) return null;
  return {
    dokumentflytId: peker.dokumentflytId,
    ...mottaker,
    ...(peker.kunSteg !== null ? { aktivPosisjon: peker.kunSteg } : {}),
    ...APENT_DOKUMENT_WHERE,
  };
}

/** Åpne sjekklister + oppgaver som har ballen hos medlemmet. */
export async function finnApneDokumenterHosMedlem(
  db: Db,
  peker: MedlemPeker,
): Promise<{ sjekklister: string[]; oppgaver: string[] }> {
  const where = pekerWhere(peker);
  if (!where) return { sjekklister: [], oppgaver: [] };
  const [sjekklister, oppgaver] = await Promise.all([
    db.checklist.findMany({ where, select: { id: true } }),
    db.task.findMany({ where, select: { id: true } }),
  ]);
  return { sjekklister: sjekklister.map((d) => d.id), oppgaver: oppgaver.map((d) => d.id) };
}

/**
 * B7: flytter ballen fra medlemmet til leddets nye hovedansvarlig (`nyUserId`), eller til
 * leddet selv (`null`) når det står tomt. Ingen DocumentTransfer — dokumentet har ikke byttet
 * steg. En gruppe-peker erstattes av personen (gruppen er ute av leddet). Returnerer id-ene.
 */
export async function flyttBallFraMedlem(
  db: Db,
  peker: MedlemPeker,
  nyUserId: string | null,
): Promise<string[]> {
  const { sjekklister, oppgaver } = await finnApneDokumenterHosMedlem(db, peker);
  const data = peker.groupId && !peker.userId
    ? { recipientUserId: nyUserId, recipientGroupId: null }
    : { recipientUserId: nyUserId };
  if (sjekklister.length > 0) {
    await db.checklist.updateMany({ where: { id: { in: sjekklister } }, data });
  }
  if (oppgaver.length > 0) {
    await db.task.updateMany({ where: { id: { in: oppgaver } }, data });
  }
  return [...sjekklister, ...oppgaver];
}

/**
 * B2: åpne dokumenter som står på et ledd som forsvinner. Teller `aktivPosisjon` på stegene,
 * og for eldre dokumenter uten posisjon: ballen hos et av leddenes medlemmer.
 */
export async function tellApneDokumenterPaaSteg(
  db: Db,
  args: { dokumentflytId: string; steg: number[]; userIder: string[]; groupIder: string[] },
): Promise<number> {
  const legacy: Prisma.ChecklistWhereInput[] = [];
  if (args.userIder.length > 0) legacy.push({ aktivPosisjon: null, recipientUserId: { in: args.userIder } });
  if (args.groupIder.length > 0) legacy.push({ aktivPosisjon: null, recipientGroupId: { in: args.groupIder } });
  const where = {
    dokumentflytId: args.dokumentflytId,
    ...APENT_DOKUMENT_WHERE,
    OR: [{ aktivPosisjon: { in: args.steg } }, ...legacy],
  };
  const [sjekklister, oppgaver] = await Promise.all([
    db.checklist.count({ where }),
    db.task.count({ where: where as Prisma.TaskWhereInput }),
  ]);
  return sjekklister + oppgaver;
}

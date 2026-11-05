import type { Prisma } from "@sitedoc/db";
import { TERMINALE_DOKUMENTSTATUSER } from "@sitedoc/shared";
import { IKKE_SLETTET } from "../utils/softDelete";
import { aktivtMedlemWhere } from "../trpc/tilgangskontroll";

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

/** Feltene fjerningslogikken trenger fra et flytmedlem. */
export const FLYTMEDLEM_SELECT = {
  id: true,
  dokumentflytId: true,
  rolle: true,
  steg: true,
  groupId: true,
  projectMemberId: true,
  erHovedansvarlig: true,
  projectMember: { select: { userId: true } },
} as const;

export type AktivtFlytmedlem = Prisma.DokumentflytMedlemGetPayload<{ select: typeof FLYTMEDLEM_SELECT }>;

/** Står personen i flere ledd i samme flyt, gjelder ballflyttingen bare dokumenter på dette steget. */
export async function pekerFor(db: Db, medlem: AktivtFlytmedlem): Promise<MedlemPeker> {
  const userId = medlem.projectMember?.userId ?? null;
  let kunSteg: number | null = null;
  if (medlem.projectMemberId) {
    const andreLedd = await db.dokumentflytMedlem.count({
      where: {
        dokumentflytId: medlem.dokumentflytId,
        projectMemberId: medlem.projectMemberId,
        id: { not: medlem.id },
        ...aktivtMedlemWhere,
      },
    });
    if (andreLedd > 0) kunSteg = medlem.steg;
  }
  return { dokumentflytId: medlem.dokumentflytId, userId, groupId: medlem.groupId, kunSteg };
}

/**
 * Andre aktive personer i samme ledd (flyt + rolle + steg), hovedansvarlig først. Personen
 * som fjernes regnes aldri med, heller ikke via en annen rad i samme ledd.
 */
export async function hentGjenvarendeILeddet(db: Db, medlem: AktivtFlytmedlem) {
  const rader = await db.dokumentflytMedlem.findMany({
    where: {
      dokumentflytId: medlem.dokumentflytId,
      rolle: medlem.rolle,
      steg: medlem.steg,
      id: { not: medlem.id },
      projectMemberId: medlem.projectMemberId
        ? { not: null, notIn: [medlem.projectMemberId] }
        : { not: null },
      ...aktivtMedlemWhere,
    },
    select: {
      projectMemberId: true,
      erHovedansvarlig: true,
      projectMember: { select: { user: { select: { name: true, email: true } } } },
    },
    orderBy: [{ erHovedansvarlig: "desc" }, { createdAt: "asc" }],
  });
  return rader.flatMap((r) =>
    r.projectMemberId
      ? [{
          projectMemberId: r.projectMemberId,
          navn: r.projectMember?.user?.name ?? r.projectMember?.user?.email ?? "",
          erHovedansvarlig: r.erHovedansvarlig,
        }]
      : [],
  );
}

/** Gruppe-/faggruppe-bindinger som blir stående i leddet (leddet er da ikke tomt). */
export function tellAndreBindingerILeddet(db: Db, medlem: AktivtFlytmedlem): Promise<number> {
  return db.dokumentflytMedlem.count({
    where: {
      dokumentflytId: medlem.dokumentflytId,
      rolle: medlem.rolle,
      steg: medlem.steg,
      id: { not: medlem.id },
      projectMemberId: null,
      ...aktivtMedlemWhere,
    },
  });
}

/**
 * Avslutter ett flytmedlem (L1 § 2): raden får periodeSlutt, ev. ny hovedansvarlig settes i
 * leddet (gjenåpnes om personen har en avsluttet rad der), og ballen flyttes (B7).
 */
export async function avsluttFlytmedlem(
  tx: Db,
  medlem: AktivtFlytmedlem,
  peker: MedlemPeker,
  ny: { pmId: string; userId: string } | null,
  naa: Date = new Date(),
) {
  const fjernet = await tx.dokumentflytMedlem.update({
    where: { id: medlem.id },
    data: { periodeSlutt: naa, erHovedansvarlig: false, hovedansvarligPersonId: null },
  });

  if (ny) {
    const ledd = { dokumentflytId: medlem.dokumentflytId, rolle: medlem.rolle, steg: medlem.steg };
    await tx.dokumentflytMedlem.updateMany({
      where: { ...ledd, ...aktivtMedlemWhere },
      data: { erHovedansvarlig: false, hovedansvarligPersonId: null },
    });
    const finnes = await tx.dokumentflytMedlem.findFirst({
      where: { ...ledd, projectMemberId: ny.pmId },
      select: { id: true },
    });
    if (finnes) {
      await tx.dokumentflytMedlem.update({
        where: { id: finnes.id },
        data: { periodeSlutt: null, erHovedansvarlig: true },
      });
    } else {
      await tx.dokumentflytMedlem.create({
        data: { ...ledd, projectMemberId: ny.pmId, erHovedansvarlig: true },
      });
    }
  }

  const dokumentIder = await flyttBallFraMedlem(tx, peker, ny?.userId ?? null);
  return { fjernet, dokumentIder };
}

/**
 * L2b punkt 5: personen fjernes fra prosjektet → alle aktive flytmedlemskap avsluttes etter
 * samme regel som enkeltfjerning (B7). Ny hovedansvarlig velges automatisk bare når personen
 * var hovedansvarlig eller har åpne dokumenter — første gjenværende person i leddet; finnes
 * ingen, går ballen til leddet. Gruppe-ledd der personen var utpekt hovedansvarlig mister
 * pekeren, og ballen hos personen på det steget går til leddet.
 */
export async function avsluttFlytmedlemskapForPerson(
  tx: Db,
  projectMemberId: string,
  userId: string | null,
  naa: Date = new Date(),
) {
  const rader = await tx.dokumentflytMedlem.findMany({
    where: { projectMemberId, ...aktivtMedlemWhere },
    select: FLYTMEDLEM_SELECT,
  });
  // Pekerne beregnes før noe avsluttes — ellers mister de neste radene `kunSteg`.
  const pekere = await Promise.all(rader.map((r) => pekerFor(tx, r)));

  const avsluttet: Array<{ medlemId: string; dokumentflytId: string; nyHovedansvarligPmId: string | null; dokumentIder: string[] }> = [];
  for (const [i, medlem] of rader.entries()) {
    const peker = pekere[i]!;
    const apne = await finnApneDokumenterHosMedlem(tx, peker);
    const trengerNy = medlem.erHovedansvarlig || apne.sjekklister.length + apne.oppgaver.length > 0;
    let ny: { pmId: string; userId: string } | null = null;
    if (trengerNy) {
      for (const kandidat of await hentGjenvarendeILeddet(tx, medlem)) {
        const pm = await tx.projectMember.findFirst({
          where: { id: kandidat.projectMemberId, ...aktivtMedlemWhere },
          select: { userId: true },
        });
        if (pm?.userId) {
          ny = { pmId: kandidat.projectMemberId, userId: pm.userId };
          break;
        }
      }
    }
    const { dokumentIder } = await avsluttFlytmedlem(tx, medlem, peker, ny, naa);
    avsluttet.push({ medlemId: medlem.id, dokumentflytId: medlem.dokumentflytId, nyHovedansvarligPmId: ny?.pmId ?? null, dokumentIder });
  }

  const gruppeLedd = await tx.dokumentflytMedlem.findMany({
    where: { hovedansvarligPersonId: projectMemberId, ...aktivtMedlemWhere },
    select: { id: true, dokumentflytId: true, steg: true },
  });
  for (const ledd of gruppeLedd) {
    await tx.dokumentflytMedlem.update({ where: { id: ledd.id }, data: { hovedansvarligPersonId: null } });
    const dokumentIder = await flyttBallFraMedlem(
      tx,
      { dokumentflytId: ledd.dokumentflytId, userId, groupId: null, kunSteg: ledd.steg },
      null,
    );
    avsluttet.push({ medlemId: ledd.id, dokumentflytId: ledd.dokumentflytId, nyHovedansvarligPmId: null, dokumentIder });
  }

  return avsluttet;
}

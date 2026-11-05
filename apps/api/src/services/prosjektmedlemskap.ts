import type { Prisma } from "@sitedoc/db";
import { aktivtMedlemWhere } from "../trpc/tilgangskontroll";
import { avsluttFlytmedlemskapForPerson } from "./flytFjerning";

/**
 * Myk medlemsfjerning (ordre 2026-11-05 (5), L2b B8). Et prosjektmedlem slettes aldri:
 * raden får `periodeSlutt`, og en ny innmelding gjenåpner den samme raden. Underradene
 * (faggruppe-, gruppe- og flytkoblinger) avsluttes sammen med medlemmet og gjenåpnes bare
 * når de bes om på nytt.
 */

type Db = Prisma.TransactionClient;

/**
 * Finn aktivt medlem, gjenåpne et avsluttet, eller opprett nytt. `@@unique([userId, projectId])`
 * gjør at det aldri finnes mer enn én rad per person og prosjekt.
 */
export async function gjenapneEllerOpprettProsjektmedlem(
  tx: Db,
  args: { userId: string; projectId: string; role: string },
): Promise<{ id: string; status: "aktiv" | "gjenapnet" | "ny" }> {
  const rad = await tx.projectMember.findUnique({
    where: { userId_projectId: { userId: args.userId, projectId: args.projectId } },
    select: { id: true, periodeSlutt: true },
  });
  if (rad && rad.periodeSlutt === null) return { id: rad.id, status: "aktiv" };
  if (rad) {
    await tx.projectMember.update({
      where: { id: rad.id },
      data: { periodeSlutt: null, role: args.role },
    });
    return { id: rad.id, status: "gjenapnet" };
  }
  const ny = await tx.projectMember.create({
    data: { userId: args.userId, projectId: args.projectId, role: args.role },
    select: { id: true },
  });
  return { id: ny.id, status: "ny" };
}

/** Flytrolle for en person: gjenåpner en avsluttet rad i samme ledd, ellers opprettes den. */
export async function gjenapneEllerOpprettFlytbinding(
  tx: Db,
  b: { dokumentflytId: string; projectMemberId: string; rolle: string; steg: number },
): Promise<void> {
  const rad = await tx.dokumentflytMedlem.findFirst({
    where: { dokumentflytId: b.dokumentflytId, projectMemberId: b.projectMemberId, rolle: b.rolle, steg: b.steg },
    select: { id: true, periodeSlutt: true },
  });
  if (rad?.periodeSlutt === null) return;
  if (rad) {
    await tx.dokumentflytMedlem.update({ where: { id: rad.id }, data: { periodeSlutt: null } });
    return;
  }
  await tx.dokumentflytMedlem.create({ data: b });
}

/**
 * B8 + punkt 5: avslutter prosjektmedlemmet og alt som henger på det. Flytmedlemskapene
 * avsluttes etter B7 (ballen flyttes), deretter faggruppe- og gruppekoblingene.
 */
export async function avsluttProsjektmedlem(
  tx: Db,
  medlem: { id: string; userId: string | null },
  naa: Date = new Date(),
) {
  const flyt = await avsluttFlytmedlemskapForPerson(tx, medlem.id, medlem.userId, naa);
  await tx.faggruppeKobling.updateMany({
    where: { projectMemberId: medlem.id, ...aktivtMedlemWhere },
    data: { periodeSlutt: naa },
  });
  await tx.projectGroupMember.updateMany({
    where: { projectMemberId: medlem.id, ...aktivtMedlemWhere },
    data: { periodeSlutt: naa },
  });
  const avsluttet = await tx.projectMember.update({
    where: { id: medlem.id },
    data: { periodeSlutt: naa },
  });
  return { avsluttet, flyt };
}

/** Activity-rad for en medlemsendring (samme mønster som L1 `flytmedlem_avsluttet`). */
export async function loggMedlemsendring(
  tx: Db,
  ctx: { userId: string; ipAddress: string | null; userAgent: string | null },
  rad: { projectId: string; targetType: string; targetId: string; action: string; payload: Prisma.InputJsonValue },
): Promise<void> {
  const aktor = await tx.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
  await tx.activity.create({
    data: {
      actorUserId: ctx.userId,
      actorNavnSnapshot: aktor?.name ?? null,
      ...rad,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    },
  });
}

import type { Prisma } from "@sitedoc/db";
import { TRPCError } from "@trpc/server";
import { aktivtMedlemWhere } from "../trpc/tilgangskontroll";
import { APENT_DOKUMENT_WHERE, avsluttFlytmedlemskapForPerson } from "./flytFjerning";

/**
 * Myk medlemsfjerning (ordre 2026-11-05 (5), L2b B8). Et prosjektmedlem slettes aldri:
 * raden får `periodeSlutt`, og en ny innmelding gjenåpner den samme raden. Underradene
 * (faggruppe-, gruppe- og flytkoblinger) avsluttes sammen med medlemmet og gjenåpnes bare
 * når de bes om på nytt.
 */

type Db = Prisma.TransactionClient;

/**
 * M6 (ordre 2026-11-05 (7)): et prosjektmedlem-id fra klienten treffer bare en rad i
 * prosjektet admin-sjekken ble gjort mot. En id fra et annet prosjekt gir NOT_FOUND —
 * samme stil som `medlem.fjern`.
 */
export async function hentMedlemIProsjekt(
  db: Db,
  id: string,
  projectId: string,
): Promise<{ id: string; userId: string | null }> {
  const medlem = await db.projectMember.findFirst({
    where: { id, projectId },
    select: { id: true, userId: true },
  });
  if (!medlem) throw new TRPCError({ code: "NOT_FOUND", message: "Medlemmet finnes ikke i prosjektet" });
  return medlem;
}

/** M6: faggruppe-, gruppe- og flyt-id-er fra klienten må alle høre til prosjektet. */
export async function verifiserIderIProsjekt(
  db: Db,
  projectId: string,
  ider: { faggruppeIder?: string[]; gruppeIder?: string[]; dokumentflytIder?: string[] },
): Promise<void> {
  const unike = (liste: string[] | undefined) => [...new Set(liste ?? [])];
  const faggrupper = unike(ider.faggruppeIder);
  const grupper = unike(ider.gruppeIder);
  const flyter = unike(ider.dokumentflytIder);
  const [antFaggrupper, antGrupper, antFlyter] = await Promise.all([
    faggrupper.length > 0 ? db.faggruppe.count({ where: { id: { in: faggrupper }, projectId } }) : 0,
    grupper.length > 0 ? db.projectGroup.count({ where: { id: { in: grupper }, projectId } }) : 0,
    flyter.length > 0 ? db.dokumentflyt.count({ where: { id: { in: flyter }, projectId } }) : 0,
  ]);
  if (antFaggrupper !== faggrupper.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Faggruppen finnes ikke i prosjektet" });
  }
  if (antGrupper !== grupper.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Gruppen finnes ikke i prosjektet" });
  }
  if (antFlyter !== flyter.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Dokumentflyten finnes ikke i prosjektet" });
  }
}

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

/** Prosjektets åpne dokumenter (sjekkliste/oppgave har ingen egen projectId — mal eller bestillerfaggruppe). */
function apneDokumenterIProsjekt(projectId: string, recipientUserId: string, utenomFlyter: string[] = []) {
  return {
    recipientUserId,
    ...APENT_DOKUMENT_WHERE,
    AND: [
      { OR: [{ template: { projectId } }, { bestillerFaggruppe: { projectId } }] },
      ...(utenomFlyter.length > 0
        ? [{ OR: [{ dokumentflytId: null }, { dokumentflytId: { notIn: utenomFlyter } }] }]
        : []),
    ],
  };
}

/** M3: dokumenter som har ballen hos personen i prosjektet etter B7, med innsender. */
async function finnRestdokumenterHosPerson(tx: Db, projectId: string, userId: string) {
  const where = apneDokumenterIProsjekt(projectId, userId);
  const [sjekklister, oppgaver] = await Promise.all([
    tx.checklist.findMany({ where, select: { id: true, bestillerUserId: true } }),
    tx.task.findMany({ where: where as Prisma.TaskWhereInput, select: { id: true, bestillerUserId: true } }),
  ]);
  return { sjekklister, oppgaver };
}

/**
 * M3 forhåndsvisning (før B7 har kjørt): åpne dokumenter hos personen i prosjektet utenom
 * flytene der personen står med personpeker — de B7 ikke flytter, og som går til innsender.
 */
export async function tellRestdokumenterHosPerson(
  db: Db,
  args: { projectId: string; userId: string; flyterMedPeker: string[] },
): Promise<number> {
  const where = apneDokumenterIProsjekt(args.projectId, args.userId, args.flyterMedPeker);
  const [sjekklister, oppgaver] = await Promise.all([
    db.checklist.count({ where }),
    db.task.count({ where: where as Prisma.TaskWhereInput }),
  ]);
  return sjekklister + oppgaver;
}

/**
 * M3 (ordre 2026-11-05 (7), Kenneth «flytt til insender»): åpne dokumenter som fortsatt har
 * ballen hos personen etter B7 — dokumenter uten flyt, eller på et faggruppe-ledd uten
 * personpeker (E5) — går tilbake til innsender. Er innsender personen selv eller ikke lenger
 * aktivt medlem i prosjektet, står dokumentet uten personmottaker (`null`). Ingen
 * DocumentTransfer, som B7. Kjøres etter B7, så flytdokumentene er alt flyttet.
 */
export async function flyttMottakerTilInnsender(
  tx: Db,
  args: { projectId: string; userId: string },
): Promise<{ tilInnsender: string[]; utenMottaker: string[] }> {
  const { sjekklister, oppgaver } = await finnRestdokumenterHosPerson(tx, args.projectId, args.userId);
  const innsendere = [...new Set([...sjekklister, ...oppgaver].map((d) => d.bestillerUserId))]
    .filter((id) => id !== args.userId);
  const aktive = innsendere.length > 0
    ? await tx.projectMember.findMany({
        where: { projectId: args.projectId, userId: { in: innsendere }, ...aktivtMedlemWhere },
        select: { userId: true },
      })
    : [];
  const aktiveIder = new Set(aktive.map((m) => m.userId));
  const nyMottaker = (bestillerUserId: string) =>
    bestillerUserId !== args.userId && aktiveIder.has(bestillerUserId) ? bestillerUserId : null;

  const tilInnsender: string[] = [];
  const utenMottaker: string[] = [];
  const grupper = new Map<string | null, { sjekklister: string[]; oppgaver: string[] }>();
  for (const [liste, dokumenter] of [["sjekklister", sjekklister], ["oppgaver", oppgaver]] as const) {
    for (const d of dokumenter) {
      const ny = nyMottaker(d.bestillerUserId);
      (ny ? tilInnsender : utenMottaker).push(d.id);
      const gruppe = grupper.get(ny) ?? { sjekklister: [], oppgaver: [] };
      gruppe[liste].push(d.id);
      grupper.set(ny, gruppe);
    }
  }
  for (const [ny, gruppe] of grupper) {
    if (gruppe.sjekklister.length > 0) {
      await tx.checklist.updateMany({ where: { id: { in: gruppe.sjekklister } }, data: { recipientUserId: ny } });
    }
    if (gruppe.oppgaver.length > 0) {
      await tx.task.updateMany({ where: { id: { in: gruppe.oppgaver } }, data: { recipientUserId: ny } });
    }
  }
  return { tilInnsender, utenMottaker };
}

/** Hvorfor mottakeren ble byttet: til innsender, eller ingen person (ballen står på leddet/faggruppen). */
export type MottakerOmdirigering = "innsender" | "ingen";

/**
 * Ordre (7a): en personmottaker må være aktivt prosjektmedlem. Mobilens offline-kø kan sende
 * en mottaker fra en gammel medlemsliste — da avvises ikke kallet, men M3-regelen brukes:
 * innsender tar ballen, eller ingen person hvis innsender er den samme eller selv avsluttet.
 */
export async function sikreAktivMottaker(
  db: Db,
  args: { projectId: string; recipientUserId: string | null | undefined; bestillerUserId: string },
): Promise<{ recipientUserId: string | null; omdirigert: MottakerOmdirigering | null }> {
  const mottaker = args.recipientUserId ?? null;
  if (!mottaker) return { recipientUserId: null, omdirigert: null };
  const aktive = await db.projectMember.findMany({
    where: { projectId: args.projectId, userId: { in: [mottaker, args.bestillerUserId] }, ...aktivtMedlemWhere },
    select: { userId: true },
  });
  const aktiveIder = new Set(aktive.map((m) => m.userId));
  if (aktiveIder.has(mottaker)) return { recipientUserId: mottaker, omdirigert: null };
  if (args.bestillerUserId !== mottaker && aktiveIder.has(args.bestillerUserId)) {
    return { recipientUserId: args.bestillerUserId, omdirigert: "innsender" };
  }
  return { recipientUserId: null, omdirigert: "ingen" };
}

/** Linjen som legges i dokumenthistorikken (DocumentTransfer.comment) når mottakeren ble byttet. */
export function omdirigeringsNotat(omdirigert: MottakerOmdirigering | null): string | null {
  if (omdirigert === "innsender") return "Mottakeren er ikke lenger med i prosjektet — sendt til innsender";
  if (omdirigert === "ingen") return "Mottakeren er ikke lenger med i prosjektet — dokumentet står uten personmottaker";
  return null;
}

/** Brukerens kommentar med omdirigeringsnotatet etter, hvis det finnes. */
export function medOmdirigeringsNotat(kommentar: string | null | undefined, omdirigert: MottakerOmdirigering | null) {
  const notat = omdirigeringsNotat(omdirigert);
  if (!notat) return kommentar ?? undefined;
  return kommentar ? `${kommentar}\n${notat}` : notat;
}

/**
 * B8 + punkt 5: avslutter prosjektmedlemmet og alt som henger på det. Flytmedlemskapene
 * avsluttes etter B7 (ballen flyttes), deretter går restdokumentene hos personen til
 * innsender (M3), og til slutt avsluttes faggruppe- og gruppekoblingene.
 */
export async function avsluttProsjektmedlem(
  tx: Db,
  medlem: { id: string; userId: string | null; projectId: string },
  naa: Date = new Date(),
) {
  const flyt = await avsluttFlytmedlemskapForPerson(tx, medlem.id, medlem.userId, naa);
  const mottaker = medlem.userId
    ? await flyttMottakerTilInnsender(tx, { projectId: medlem.projectId, userId: medlem.userId })
    : { tilInnsender: [], utenMottaker: [] };
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
  return { avsluttet, flyt, mottaker };
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

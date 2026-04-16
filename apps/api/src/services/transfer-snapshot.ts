import { prisma } from "@sitedoc/db";

/**
 * Utled senderRolle basert på dokumentstatus og brukerens tillatelser.
 * draft/sent → bestiller, received/in_progress → utforer,
 * responded (godkjenning) → godkjenner, registrator-rettighet → registrator
 */
function utledSenderRolle(
  status: string,
  erRegistrator: boolean,
): string {
  if (erRegistrator) return "registrator";
  if (status === "draft" || status === "sent") return "bestiller";
  if (status === "received" || status === "in_progress") return "utforer";
  if (status === "responded") return "godkjenner";
  return "bestiller"; // fallback
}

interface SnapshotInput {
  senderId: string;
  projektId: string;
  dokumentStatus: string;
  bestillerFaggruppeId: string | null;
  utforerFaggruppeId: string | null;
  dokumentflytId: string | null;
}

export interface TransferSnapshot {
  /** Mappes til DB-kolonne senderEnterpriseName (historisk snapshot) */
  senderFaggruppeNavn: string | null;
  /** Mappes til DB-kolonne recipientEnterpriseName (historisk snapshot) */
  mottakerFaggruppeNavn: string | null;
  dokumentflytName: string | null;
  senderRolle: string;
}

/**
 * Bygg snapshot-data for DocumentTransfer.
 * Henter faggruppe-navn og dokumentflyt-navn fra DB.
 */
export async function byggTransferSnapshot(input: SnapshotInput): Promise<TransferSnapshot> {
  // Sjekk om sender er registrator
  const tillatelser = await prisma.projectGroup.findMany({
    where: {
      projectId: input.projektId,
      members: { some: { projectMember: { userId: input.senderId } } },
    },
    select: { permissions: true },
  });
  const alleTillatelser = tillatelser.flatMap((g) => g.permissions as string[]);
  const erRegistrator = alleTillatelser.includes("create_checklists") || alleTillatelser.includes("create_tasks");

  // Sjekk om sender er admin
  const medlem = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: input.senderId, projectId: input.projektId } },
  });
  const bruker = await prisma.user.findUnique({ where: { id: input.senderId }, select: { role: true } });
  const erAdmin = bruker?.role === "sitedoc_admin" || medlem?.role === "admin";

  const senderRolle = utledSenderRolle(input.dokumentStatus, erRegistrator && !erAdmin);

  // Hent faggruppe-navn
  const [bestillerFaggruppe, utforerFaggruppe] = await Promise.all([
    input.bestillerFaggruppeId ? prisma.faggruppe.findUnique({ where: { id: input.bestillerFaggruppeId }, select: { name: true } }) : null,
    input.utforerFaggruppeId ? prisma.faggruppe.findUnique({ where: { id: input.utforerFaggruppeId }, select: { name: true } }) : null,
  ]);

  // Senderens faggruppe basert på rolle
  const senderFaggruppeNavn = (senderRolle === "bestiller" || senderRolle === "godkjenner" || senderRolle === "registrator")
    ? bestillerFaggruppe?.name ?? null
    : utforerFaggruppe?.name ?? null;

  // Mottaker-faggruppe = dokumentets utfører-faggruppe
  const mottakerFaggruppeNavn = utforerFaggruppe?.name ?? null;

  // Dokumentflyt-navn
  let dokumentflytName: string | null = null;
  if (input.dokumentflytId) {
    const df = await prisma.dokumentflyt.findUnique({
      where: { id: input.dokumentflytId },
      select: { name: true },
    });
    dokumentflytName = df?.name ?? null;
  }

  return {
    senderFaggruppeNavn,
    mottakerFaggruppeNavn,
    dokumentflytName,
    senderRolle,
  };
}

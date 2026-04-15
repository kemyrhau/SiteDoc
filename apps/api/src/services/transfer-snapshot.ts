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
  bestillerEnterpriseId: string | null;
  utforerEnterpriseId: string | null;
  dokumentflytId: string | null;
}

export interface TransferSnapshot {
  senderEnterpriseName: string | null;
  recipientEnterpriseName: string | null;
  dokumentflytName: string | null;
  senderRolle: string;
}

/**
 * Bygg snapshot-data for DocumentTransfer.
 * Henter entreprise-navn og dokumentflyt-navn fra DB.
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

  // Hent entreprise-navn
  const [bestillerEnt, utforerEnt] = await Promise.all([
    input.bestillerEnterpriseId ? prisma.dokumentflytPart.findUnique({ where: { id: input.bestillerEnterpriseId }, select: { name: true } }) : null,
    input.utforerEnterpriseId ? prisma.dokumentflytPart.findUnique({ where: { id: input.utforerEnterpriseId }, select: { name: true } }) : null,
  ]);

  // Senderens entreprise basert på rolle
  const senderEnterpriseName = (senderRolle === "bestiller" || senderRolle === "godkjenner" || senderRolle === "registrator")
    ? bestillerEnt?.name ?? null
    : utforerEnt?.name ?? null;

  // Mottaker-entreprise = dokumentets utfører-entreprise
  const recipientEnterpriseName = utforerEnt?.name ?? null;

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
    senderEnterpriseName,
    recipientEnterpriseName,
    dokumentflytName,
    senderRolle,
  };
}

/**
 * Ansatt-kandidatregelen — ÉN kilde (2026-08-28, ansattvelger-runden).
 *
 * «Brukbar person i firma X» var håndskrevet på flere steder med sin egen
 * where-setning, og en av dem (hentLedigeFirmaBrukere) husket bare halve regelen
 * (`canLogin`, glemte `status`). Regelen bor nå her, så neste picker ikke kan
 * gjenskape den halvt.
 *
 * NIVÅSKILLE (ufravikelig — samme skille står i schema.prisma ved begge feltene):
 *   - `User.canLogin`            = kan personen AUTENTISERE overhodet (portvakt,
 *     håndheves i apps/web/src/auth.ts:24). Global for User-raden.
 *   - `OrganizationMember.status`= er personen ANSATT i DETTE firmaet nå
 *     (registreringsmodell fase 1, ea6a9d8d).
 * En kandidat å velge blant krever BEGGE. Konsolideres de to, ryker multi-firma
 * (en som slutter hos A men jobber hos B beholder canLogin=true).
 *
 * MERK: e-post-oppslag ved invitasjon (`user.findFirst({ email, canLogin })` i
 * medlem.leggTil / gruppe.leggTilMedlem / organisasjon.inviterBruker) er et ANNET
 * spørsmål — «finnes en autentiserbar bruker med denne e-posten» — og bruker
 * bevisst IKKE denne. Org/status håndteres der separat (hentBrukersOrg + porten).
 */
import { type Prisma } from "@sitedoc/db";

type TxClient = Prisma.TransactionClient;

/**
 * Prisma-where for «aktiv, brukbar ansatt i dette firmaet» — kandidatfilteret
 * alle pickere som lister folk å velge blant skal bruke. Legg til egne vilkår
 * (f.eks. `userId: { notIn: ... }`) ved å spre dette inn i where-en.
 */
export function aktivAnsattIFirmaWhere(
  organizationId: string,
): Prisma.OrganizationMemberWhereInput {
  return {
    organizationId,
    status: "aktiv",
    user: { canLogin: true },
  };
}

export interface SikreMedlemmerResultat {
  /** userId → projectMemberId for hver GYLDIG bruker (opprettet eller allerede medlem). */
  projectMemberIdByUserId: Map<string, string>;
  /** Antall nye ProjectMember-rader opprettet, eller avsluttede gjenåpnet. */
  lagtTil: number;
  /** Antall som allerede var medlem (uendret). */
  alleredeMedlem: number;
  /** userId-er avvist fordi de ikke er aktiv brukbar ansatt i eier-firmaet. */
  ugyldige: string[];
}

/**
 * Sikre at hver oppgitt bruker er ProjectMember i prosjektet — delt av begge
 * batch-tilleggene (medlem.leggTilEksisterendeMange + dokumentflyt.leggTilAnsatteIRolle).
 *
 * Validerer HVER userId mot `aktivAnsattIFirmaWhere(organizationId)` — en deaktivert
 * eller ikke-brukbar person (eller fra annet firma) legges ALDRI til, uansett hva
 * klienten sendte. Idempotent: aktive medlemmer røres ikke, avsluttede gjenåpnes (L2b B8),
 * faggruppe-koblinger upsertes (og gjenåpnes). Returnerer projectMemberId for hver gyldig bruker + tellinger til kvittering.
 */
export async function sikreProsjektmedlemmer(
  tx: TxClient,
  params: {
    projectId: string;
    organizationId: string;
    userIds: string[];
    role?: "member" | "admin";
    faggruppeIder?: string[];
  },
): Promise<SikreMedlemmerResultat> {
  const unikeUserIds = [...new Set(params.userIds)];
  const role = params.role ?? "member";
  const faggruppeIder = params.faggruppeIder ?? [];

  const result: SikreMedlemmerResultat = {
    projectMemberIdByUserId: new Map(),
    lagtTil: 0,
    alleredeMedlem: 0,
    ugyldige: [],
  };
  if (unikeUserIds.length === 0) return result;

  // Kun aktive, brukbare ansatte i eier-firmaet er gyldige kandidater.
  const gyldige = await tx.organizationMember.findMany({
    where: {
      ...aktivAnsattIFirmaWhere(params.organizationId),
      userId: { in: unikeUserIds },
    },
    select: { userId: true },
  });
  const gyldigeIder = new Set(gyldige.map((m) => m.userId));
  result.ugyldige = unikeUserIds.filter((id) => !gyldigeIder.has(id));

  // Eksisterende medlemskap slås opp samlet (ingen N+1) — også avsluttede: én rad per
  // person og prosjekt, så et tidligere medlem gjenåpnes på samme rad (L2b B8).
  const eksisterende = await tx.projectMember.findMany({
    where: { projectId: params.projectId, userId: { in: [...gyldigeIder] } },
    select: { id: true, userId: true, periodeSlutt: true },
  });
  const medlemByUser = new Map(
    eksisterende.flatMap((m) => (m.userId !== null ? [[m.userId, m] as const] : [])),
  );

  for (const userId of gyldigeIder) {
    const rad = medlemByUser.get(userId);
    if (rad) {
      const eksisterendeId = rad.id;
      if (rad.periodeSlutt) {
        await tx.projectMember.update({
          where: { id: rad.id },
          data: { periodeSlutt: null, role },
        });
        result.lagtTil += 1;
      } else {
        result.alleredeMedlem += 1;
      }
      result.projectMemberIdByUserId.set(userId, eksisterendeId);
      // Legg til evt. nye faggruppe-koblinger på det eksisterende medlemmet.
      for (const fid of faggruppeIder) {
        await tx.faggruppeKobling.upsert({
          where: {
            projectMemberId_faggruppeId: { projectMemberId: eksisterendeId, faggruppeId: fid },
          },
          create: { projectMemberId: eksisterendeId, faggruppeId: fid },
          update: { periodeSlutt: null },
        });
      }
      continue;
    }
    const ny = await tx.projectMember.create({
      data: {
        userId,
        projectId: params.projectId,
        role,
        faggruppeKoblinger: { create: faggruppeIder.map((fid) => ({ faggruppeId: fid })) },
      },
      select: { id: true },
    });
    result.lagtTil += 1;
    result.projectMemberIdByUserId.set(userId, ny.id);
  }

  return result;
}

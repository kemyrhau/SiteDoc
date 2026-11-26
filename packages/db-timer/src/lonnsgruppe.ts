import { Prisma, type PrismaClient } from ".prisma/timer-client";

/**
 * L1 LØNNSGRUPPER (spec-lonnsgrupper.md § 2, Kenneth 2026-11-26):
 * «Ved registrering av ansatt må den enkelte som standard få ordinær gruppe.»
 *
 * Én kilde for «en ansatt er aldri uten gruppe». Brukes av API-et (V1–V3 + vernet ved oppslag)
 * og av testdata-skriptene. Ligger her fordi tabellene er db-timers; firmamedlemmet ligger i
 * packages/db, så skrivingen kan ikke dele transaksjon med det — derfor idempotent og kalt
 * RETT etter at firmamedlemmet er lagret.
 */

/** Navnet standardgruppa lages med. Firmaets data (kan gis nytt navn), oversettes ikke. */
export const STANDARD_LONNSGRUPPE_NAVN = "Ordinær";

type TimerKlient = Pick<PrismaClient, "lonnsgruppe" | "ansattLonnsgruppe">;

function erUnikBrudd(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/**
 * Firmaets standardgruppe. Lager «Ordinær» hvis firmaet mangler en (firma opprettet etter
 * migreringen, testdata). Finnes en ikke-standard gruppe med navnet «Ordinær» fra før, gjøres
 * den til standard i stedet for å lage en ny (unik navn pr. firma).
 */
export async function sikreStandardLonnsgruppe(
  prismaTimer: TimerKlient,
  organizationId: string,
): Promise<{ id: string }> {
  const finnes = await prismaTimer.lonnsgruppe.findFirst({
    where: { organizationId, erStandard: true },
    select: { id: true },
  });
  if (finnes) return finnes;
  try {
    const sammeNavn = await prismaTimer.lonnsgruppe.findUnique({
      where: { uq_lonnsgruppe_navn_per_org: { organizationId, navn: STANDARD_LONNSGRUPPE_NAVN } },
      select: { id: true },
    });
    if (sammeNavn) {
      return await prismaTimer.lonnsgruppe.update({
        where: { id: sammeNavn.id },
        data: { erStandard: true, aktiv: true },
        select: { id: true },
      });
    }
    return await prismaTimer.lonnsgruppe.create({
      data: { organizationId, navn: STANDARD_LONNSGRUPPE_NAVN, erStandard: true, aktiv: true, rekkefolge: 0 },
      select: { id: true },
    });
  } catch (e) {
    // Samtidig kall rakk å lage den (delvis unik indeks / unikt navn) — les den som vant.
    if (!erUnikBrudd(e)) throw e;
    return prismaTimer.lonnsgruppe.findFirstOrThrow({
      where: { organizationId, erStandard: true },
      select: { id: true },
    });
  }
}

/**
 * Sikrer at (firma, ansatt) har en lønnsgruppe.
 * - Uten `lonnsgruppeId`: finnes raden, står den urørt; ellers settes firmaets standardgruppe.
 * - Med `lonnsgruppeId`: gruppa må være firmaets og aktiv (ellers feil), og settes på raden.
 * Returnerer gruppa den ansatte står i.
 */
export async function sikreAnsattLonnsgruppe(
  prismaTimer: TimerKlient,
  input: { organizationId: string; userId: string; lonnsgruppeId?: string | null; sattAvUserId?: string | null },
): Promise<{ lonnsgruppeId: string }> {
  const { organizationId, userId } = input;
  if (input.lonnsgruppeId) {
    const gruppe = await prismaTimer.lonnsgruppe.findFirst({
      where: { id: input.lonnsgruppeId, organizationId, aktiv: true },
      select: { id: true },
    });
    if (!gruppe) throw new Error("Lønnsgruppa finnes ikke i firmaet eller er slått av");
    await prismaTimer.ansattLonnsgruppe.upsert({
      where: { uq_ansatt_lonnsgruppe: { organizationId, userId } },
      create: { organizationId, userId, lonnsgruppeId: gruppe.id, sattAvUserId: input.sattAvUserId ?? null },
      update: { lonnsgruppeId: gruppe.id, sattAvUserId: input.sattAvUserId ?? null, sattVed: new Date() },
    });
    return { lonnsgruppeId: gruppe.id };
  }

  const eksisterende = await prismaTimer.ansattLonnsgruppe.findUnique({
    where: { uq_ansatt_lonnsgruppe: { organizationId, userId } },
    select: { lonnsgruppeId: true },
  });
  if (eksisterende) return eksisterende;

  const standard = await sikreStandardLonnsgruppe(prismaTimer, organizationId);
  try {
    await prismaTimer.ansattLonnsgruppe.create({
      data: { organizationId, userId, lonnsgruppeId: standard.id, sattAvUserId: input.sattAvUserId ?? null },
    });
    return { lonnsgruppeId: standard.id };
  } catch (e) {
    if (!erUnikBrudd(e)) throw e;
    // Samtidig kall satte raden først — den gjelder.
    return prismaTimer.ansattLonnsgruppe.findUniqueOrThrow({
      where: { uq_ansatt_lonnsgruppe: { organizationId, userId } },
      select: { lonnsgruppeId: true },
    });
  }
}

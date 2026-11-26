import { TRPCError } from "@trpc/server";
import { prismaTimer as standardKlient, sikreAnsattLonnsgruppe } from "@sitedoc/db-timer";

/**
 * L1 LØNNSGRUPPER — API-siden av «en ansatt er aldri uten gruppe» (spec-lonnsgrupper.md § 2).
 * Kjernen (`sikreAnsattLonnsgruppe`) bor i @sitedoc/db-timer, så testdata-skriptene bruker den samme.
 */

type TimerKlient = typeof standardKlient;

/**
 * Kalles RETT etter at et firmamedlem er lagret (V1 inviterBruker, V2 medlem.registrer,
 * V3 medlem.endreFirma). Uten `lonnsgruppeId` får den ansatte firmaets standardgruppe, med mindre
 * hen alt har en. En ugyldig gruppe gir BAD_REQUEST.
 */
export async function sikreAnsattLonnsgruppeApi(
  prismaTimer: TimerKlient,
  input: { organizationId: string; userId: string; lonnsgruppeId?: string | null; sattAvUserId?: string | null },
): Promise<{ lonnsgruppeId: string }> {
  try {
    return await sikreAnsattLonnsgruppe(prismaTimer, input);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Lønnsgruppa finnes ikke")) {
      throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
    }
    throw e;
  }
}

/**
 * Den ansattes gruppe i firmaet — med vern: mangler raden (hullet mellom de to Prisma-klientene,
 * eller et medlem lagt inn utenom API-et), settes standardgruppa der og da. Ingen kode skal
 * behandle «ingen gruppe» som en gyldig tilstand.
 */
export async function hentAnsattLonnsgruppeId(
  prismaTimer: TimerKlient,
  organizationId: string,
  userId: string,
): Promise<string> {
  const rad = await prismaTimer.ansattLonnsgruppe.findUnique({
    where: { uq_ansatt_lonnsgruppe: { organizationId, userId } },
    select: { lonnsgruppeId: true },
  });
  if (rad) return rad.lonnsgruppeId;
  return (await sikreAnsattLonnsgruppe(prismaTimer, { organizationId, userId })).lonnsgruppeId;
}

/** Katalograd med relasjonen `lonnsgrupper` → flat `lonnsgruppeIder` (tom = gjelder alle). */
export function medLonnsgruppeIder<T extends { lonnsgrupper: { lonnsgruppeId: string }[] }>(
  rad: T,
): Omit<T, "lonnsgrupper"> & { lonnsgruppeIder: string[] } {
  const { lonnsgrupper, ...rest } = rad;
  return { ...rest, lonnsgruppeIder: lonnsgrupper.map((g) => g.lonnsgruppeId) };
}

export const LONNSGRUPPE_INCLUDE = { lonnsgrupper: { select: { lonnsgruppeId: true } } } as const;

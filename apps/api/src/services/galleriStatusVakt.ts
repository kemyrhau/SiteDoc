import { TRPCError } from "@trpc/server";
import { TERMINALE_DOKUMENTSTATUSER } from "@sitedoc/shared";

/**
 * Godkjent-lås på galleri-bilder (Kenneth-vedtak 2026-10-21, funksjonsendring).
 *
 * Vedtaket «bare visning på godkjent» gjelder ALLE bilder og vedlegg på en rapport,
 * ikke bare feltvedlegget i `data`-JSON (det låses i `oppgave`/`sjekkliste.oppdaterData`
 * + `settVedleggUrl`). `Image`-radene (`bilde.ts`: galleri + GPS) henger på en oppgave
 * eller sjekkliste via `taskId`/`checklistId`, så de skal også fryses når dokumentet er
 * avsluttet (`TERMINALE_DOKUMENTSTATUSER` = approved/closed/cancelled): ingen ny opplasting,
 * ingen sletting. INGEN admin-bypass — endring krever Gjenåpne til en redigerbar status.
 *
 * Kaster `FORBIDDEN` hvis status er terminal; no-op for ikke-terminal status eller når
 * status er ukjent (`null`/`undefined` — f.eks. en `Image` uten dokument-tilknytning,
 * som ingen skrivevei lager i dag).
 */
export function krevRedigerbarDokumentstatus(
  status: string | null | undefined,
): void {
  if (status != null && TERMINALE_DOKUMENTSTATUSER.has(status)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Bilder på en godkjent rapport kan ikke endres — gjenåpne rapporten først",
    });
  }
}

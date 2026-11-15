import { TRPCError } from "@trpc/server";

/**
 * DoD 12 (steg 2b, 2026-09-23): `lokasjonOmfang = "omrade"` KREVER `omradeId`. Ett sted —
 * kalt fra både oppgave og sjekkliste, opprett OG oppdater. Uten dette er "omrade" et omfang
 * uten innhold, nøyaktig tilstanden fritekst-lokasjonen skulle erstatte.
 *
 * DB-garanti (CHECK) er bevisst WAIVED for omradeId (valgfri kobling, ikke identitet — se
 * ordre/migrering). Dette app-laget er DERFOR enekilden for regelen; feilmeldingen blir lesbar
 * og én kilde med klienten. Ren funksjon → enhetstestbar (omrade-lokasjonsomfang.test.ts).
 */
export function krevOmradeVedOmradeOmfang(
  lokasjonOmfang: string | null | undefined,
  omradeId: string | null | undefined,
): void {
  if (lokasjonOmfang === "omrade" && !omradeId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Velg et område når lokasjonsomfanget er «område».",
    });
  }
}

/**
 * ORDRE (20) punkt 2, alternativ A (2026-11-15): «prosjekt» = brukeren valgte selv «Hele
 * prosjektet». Skiller det bevisste valget fra null («ikke valgt ennå», også alle eldre
 * dokumenter). Kolonnen er String — ingen migrering.
 */
export const LOKASJON_OMFANG = ["punkt", "byggeplass", "omrade", "prosjekt"] as const;

/**
 * Omfanget som skal skrives når byggeplassen kan ha endret seg. «prosjekt» og en byggeplass
 * motsier hverandre: får dokumentet byggeplass, nullstilles «prosjekt». Ellers returneres
 * input uendret (`undefined` = ikke rør kolonnen).
 */
export function omfangMedByggeplass(args: {
  inputOmfang: string | null | undefined;
  naavaerendeOmfang: string | null | undefined;
  effektivByggeplassId: string | null | undefined;
}): string | null | undefined {
  const effektivt = args.inputOmfang !== undefined ? args.inputOmfang : args.naavaerendeOmfang;
  if (effektivt === "prosjekt" && args.effektivByggeplassId) return null;
  return args.inputOmfang;
}

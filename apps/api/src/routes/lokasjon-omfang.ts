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

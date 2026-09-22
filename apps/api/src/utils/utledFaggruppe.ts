/**
 * Server-utledning av bestiller-/utfører-faggruppe fra dokumentflyten.
 *
 * Bakgrunn (ordre opprett-uten-modal 2026-09-22): mobil-opprettelsen slutter å sende
 * `bestillerFaggruppeId`/`utforerFaggruppeId` når opprett-modalen fjernes — feltene
 * utledes i stedet fra flyten, slik web allerede gjør klient-side og slik
 * kontrollplan-start-veien (L1.5) alt gjør server-side (`sjekkliste.ts:353-354`).
 *
 * Kontrakten er identisk med L1.5: bestiller = flytens eier-faggruppe, utfører =
 * flytens utfører-medlem (fallback eier-faggruppe). Fordi web sender nøyaktig samme
 * verdi i dag, flytter utledningen INGEN rettighet — den erstatter et klientfelt med
 * en server-utledning av samme verdi.
 *
 * Ren funksjon uten Prisma-avhengighet slik at den kan enhetstestes uten DB.
 * Kalleren henter flyten (eier-faggruppe + utfører-medlemmer filtrert på
 * `rolle="utforer"`, `periodeSlutt=null`) og sender inn det pre-filtrerte settet.
 */
export interface FlytForUtledning {
  /** Flytens eier-/bestiller-faggruppe (`Dokumentflyt.faggruppeId`). */
  faggruppeId: string | null;
  /** Aktive utfører-medlemmer, pre-filtrert på `rolle="utforer"` + `periodeSlutt=null`. */
  utforerMedlemmer: Array<{ faggruppeId: string | null }>;
}

export function utledBestillerUtforer(flyt: FlytForUtledning | null): {
  bestiller: string | undefined;
  utforer: string | undefined;
} {
  const bestiller = flyt?.faggruppeId ?? undefined;
  const utforer = flyt?.utforerMedlemmer[0]?.faggruppeId ?? bestiller;
  return { bestiller, utforer };
}

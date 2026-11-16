/**
 * ORDRE 2026-11-15 (23): gjenåpning i prosjektkort-modus — ren logikk.
 *
 * Samlesiden (`timer/[id]/prosjektkort`) og kortskjermen
 * (`timer/[id]/kort/[projectId]`) deler denne. Dagskortet (`timer/[id].tsx`)
 * har sin egen kopi og røres ikke (dagskort-isolering).
 */
type Oversett = (nokkel: string) => string;

/**
 * Feilteksten etter et mislykket `gjenaapneDagsseddel`. Mapper på tRPC-koden:
 * CONFLICT og PRECONDITION_FAILED har egne tekster, en annen kode viser
 * serverens melding, og bare et kall uten kode (ingen svar) er nettfeil.
 * Aldri tom streng — en feil skal alltid synes.
 */
export function gjenaapneFeilmelding(e: unknown, t: Oversett): string {
  const code = (e as { data?: { code?: string } } | null)?.data?.code;
  const melding = e instanceof Error ? e.message : "";
  if (code === "CONFLICT") return t("timer.gjenaapne.feilGodkjent");
  if (code === "PRECONDITION_FAILED") return t("timer.gjenaapne.laastAttestert");
  if (code != null) return melding || t("timer.gjenaapne.feilNett");
  return t("timer.gjenaapne.feilNett");
}

/**
 * «Se hele dagen (N prosjekter)» vises når dagen har mer enn ett prosjekt.
 * Antallet er samlesidens (`kortProsjektIder(...).length`), så tallet er likt.
 */
export function visSeHeleDagen(antallProsjekter: number): boolean {
  return antallProsjekter > 1;
}

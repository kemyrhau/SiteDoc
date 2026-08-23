/**
 * 4b (dokumentflyten er nøkkelen): faggruppe-id-ene som er MEDLEM av et dokuments dokumentflyt.
 * `company`-feltet (FirmaObjekt) begrenser valgene til disse. null = flyt-løst dokument (gyldig).
 *
 * Bevisst modul-nivå med `unknown`-param: kalles fra oppgave-/sjekkliste-detaljsidene som allerede
 * er tunge på tRPC-typer — en inline-versjon tippet TS2589 (excessively deep). `unknown` bryter den
 * dype inferensen.
 */
export function flytFaggruppeIder(
  dokumentflytId: string | null | undefined,
  dokumentflyterRaa: unknown,
): string[] | null {
  if (!dokumentflytId) return null;
  const flyter = dokumentflyterRaa as
    | Array<{ id: string; medlemmer?: Array<{ faggruppeId?: string | null }> }>
    | undefined;
  const flyt = flyter?.find((f) => f.id === dokumentflytId);
  if (!flyt) return null;
  return (flyt.medlemmer ?? []).map((m) => m.faggruppeId).filter((x): x is string => !!x);
}

// Feltene `useOppgaveSkjema` gir videre til oppgaveskjermen (ordre 2026-11-03 (5)).
//
// Returobjektet var en håndskrevet feltliste. `subject` manglet, så `EmneFelt` fikk alltid
// `null` og viste «Legg til emne» selv om emnet var lagret. Lista bor her så den kan testes
// uten hooken; både serversvaret og offline-speilet (hele svaret) går gjennom den.

export const OPPGAVE_VISNINGSFELT = [
  "id",
  "title",
  "status",
  "priority",
  "description",
  "number",
  "subject",
  "template",
  "bestillerFaggruppe",
  "utforerFaggruppe",
  "drawing",
  "checklist",
] as const;

type VisningsFelt = (typeof OPPGAVE_VISNINGSFELT)[number];

export function tilOppgaveVisning<T extends { [K in VisningsFelt]?: unknown }>(
  oppgave: T,
): Pick<T, VisningsFelt & keyof T> {
  const ut: Record<string, unknown> = {};
  for (const felt of OPPGAVE_VISNINGSFELT) ut[felt] = oppgave[felt];
  return ut as Pick<T, VisningsFelt & keyof T>;
}

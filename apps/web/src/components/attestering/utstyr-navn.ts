/**
 * Utstyrets merke og modell som én tekst (w8). `merke` og `modell` er valgfrie i maskin-
 * skjemaet (`packages/db-maskin/prisma/schema.prisma`), så utstyr uten dem gir tom tekst —
 * ikke «null null» — og kalleren faller tilbake på internnavnet. Serveren gjør det samme
 * (`kortLeser.ts`).
 */
export interface UtstyrNavnKilde {
  merke: string | null;
  modell: string | null;
}

export function merkeModell(e: UtstyrNavnKilde): string {
  return `${e.merke ?? ""} ${e.modell ?? ""}`.trim();
}

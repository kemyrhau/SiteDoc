/**
 * POST 2026-11-14 (8) TILLEGG punkt 4 — gul «GPS foreslår»-linje under
 * Byggeplass i Nytt prosjektkort (Bekreft dag, manuell modus).
 *
 * Kilden er SAMME GPS-forslag som Hjem viser («GPS foreslår: …» i
 * ByggeplassChip): `gpsByggeplassId` fra ByggeplassKontekst (firma-bred
 * geofence). Ingen ny GPS-logikk her — kun når linja skal vises og hva den sier.
 * Ren informasjon: kortet endres aldri av forslaget.
 */
export interface GpsForslagByggeplass {
  id: string;
  projectId: string;
  navn: string | null;
}

export interface GpsForslagLinje {
  byggeplass: string;
  /** Satt kun når forslaget hører til et annet prosjekt enn kortets. */
  prosjekt: string | null;
}

export function gpsForslagLinje(input: {
  gpsByggeplassId: string | null;
  kortDato: string | null | undefined;
  iDag: string;
  prosjektId: string | null;
  byggeplassId: string | null | undefined;
  firmaByggeplasser: readonly GpsForslagByggeplass[];
  prosjektNavn: (id: string) => string | null;
}): GpsForslagLinje | null {
  const { gpsByggeplassId, kortDato, iDag, prosjektId, byggeplassId } = input;
  // GPS-posisjonen gjelder nå — en etterregistrert dag sammenlignes ikke.
  if (!gpsByggeplassId || kortDato !== iDag) return null;
  const bp = input.firmaByggeplasser.find((b) => b.id === gpsByggeplassId);
  if (!bp) return null;
  const annetProsjekt = bp.projectId !== prosjektId;
  if (!annetProsjekt && bp.id === (byggeplassId ?? null)) return null;
  return {
    byggeplass: bp.navn ?? "—",
    prosjekt: annetProsjekt ? (input.prosjektNavn(bp.projectId) ?? "—") : null,
  };
}

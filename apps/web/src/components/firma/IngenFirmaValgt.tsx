"use client";

import { AlertCircle } from "lucide-react";

/**
 * Delt «ingen firma valgt»-tilstand for firma-scopede flater.
 *
 * Bakgrunn: firma-sider gater ofte en spørring på `enabled: !!orgId`. Uten et
 * valgt firma er spørringen disablet, og i React Query v5 er `isLoading` da
 * `false` mens `data` forblir `undefined` — så gates som `if (!data)` /
 * `if (isLoading || !data)` gir enten evig spinner eller blank side, uten
 * feilmelding og uten vei videre. Denne komponenten er den ene, delte
 * meldingen (kilde til én ordlyd/stil, så fire call sites ikke drifter).
 *
 * Presentasjonell med vilje: selve guarden (`if (!orgId) return ...`) bor på
 * hver side, fordi sidestrukturene varierer (helside vs. eget sidehode). `tekst`
 * er kontekst-spesifikk — samme konvensjon som `firma.timer.attesteringIngenFirma`
 * / `firma.integrasjoner.velgFirma`: si hva firma-valget låser opp.
 */
export function IngenFirmaValgt({ tekst }: { tekst: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{tekst}</span>
    </div>
  );
}

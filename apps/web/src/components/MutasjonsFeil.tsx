"use client";

import { useState } from "react";

/**
 * Delt feilhåndtering for gatede mutasjoner (admin-gate på flyt-konfig 2026-08-22).
 *
 * Bakgrunn: fem stille avvisninger på tre dager. Etter at server-gaten (`verifiserAdmin`) avviser
 * en ikke-admin, MÅ klienten vise serverens melding — ellers ser handlingen bare ut til å «ikke
 * skje». Denne hooken standardiserer mønsteret: `onError` settes på mutasjonen, `nullstill` kalles
 * i `onSuccess`, og `<MutasjonsFeil>` rendrer meldingen.
 *
 * `onError` er typet `{ message?: string }` (ikke tRPC-feiltypen) for å unngå TS2589 (kodebase-
 * standard, jf. CLAUDE.md).
 */
export function useMutasjonsFeil() {
  const [feil, setFeil] = useState<string | null>(null);
  return {
    feil,
    nullstill: () => setFeil(null),
    onError: (e: { message?: string }) => setFeil(e.message ?? "Handlingen kunne ikke utføres."),
  };
}

/** Rødt feilbanner for en gatet mutasjon. Null/tom → ingenting. */
export function MutasjonsFeil({ melding }: { melding: string | null }) {
  if (!melding) return null;
  return (
    <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {melding}
    </p>
  );
}

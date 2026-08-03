"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Sist brukte mal per bruker + dokumentflyt — persistert i localStorage.
 *
 * ⚠️ KLIENT-LOKAL INTERIM (fabel-vedtak P4b, 2026-07-29): dette er en midlertidig
 * kilde til «sannsynligste mal» for auto-hopp i opprett-flyten. Det finnes ingen
 * server-query for sist-brukt-mal i dag, og P4b skal være server-fritt. Når/hvis
 * malbytte-server-saken bygger server-støtte, FLYTTES denne kilden server-side
 * (per-bruker/flyt-signal). Se `inbox-cowork.md` [2026-07-29] malbytte-flagg.
 *
 * Nøkkel: `sitedoc_sistbruktmal_${userId}` → JSON `Record<nøkkel, malId>`.
 * Nøkkel PER BRUKER + PROSJEKT + DOKUMENTTYPE (Funn C, 2026-08-03) — kalleren gir
 * `"sjekkliste:${prosjektId}"` / `"oppgave:${prosjektId}"`. ERSTATTER den gamle per-flyt-nøkkelen:
 * to ulike nøkkel-modeller (per-flyt sjekkliste vs per-prosjekt oppgave) var nettopp det som skapte
 * Funn C (auto-hopp-fella). Én nøkkel per flate = forutsigbart. Verdien er nå bare markørens startrad
 * i velgeren (aldri stille auto-opprett — fabel-spec § 0/§ 4).
 *
 * Miss (ingen lagret verdi) → velgeren setter markøren på første rad. Aldri gjett blindt.
 *
 * Feilfallback: tom (auto-hopp er nice-to-have, ikke kritisk).
 */
export function useSistBrukteMal(userId: string | undefined): {
  sistBrukt: (nøkkel: string) => string | null;
  settSistBrukt: (nøkkel: string, malId: string) => void;
} {
  const [kart, setKart] = useState<Record<string, string>>({});

  const nokkel = userId ? `sitedoc_sistbruktmal_${userId}` : null;

  useEffect(() => {
    if (!nokkel || typeof window === "undefined") return;
    try {
      const lagret = localStorage.getItem(nokkel);
      if (lagret) {
        const parsed = JSON.parse(lagret);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          setKart(parsed as Record<string, string>);
          return;
        }
      }
      setKart({});
    } catch {
      setKart({});
    }
  }, [nokkel]);

  const sistBrukt = useCallback(
    (nøkkel: string): string | null => kart[nøkkel] ?? null,
    [kart],
  );

  const settSistBrukt = useCallback(
    (nøkkel: string, malId: string) => {
      if (!nokkel || typeof window === "undefined") return;
      setKart((forrige) => {
        const ny = { ...forrige, [nøkkel]: malId };
        try {
          localStorage.setItem(nokkel, JSON.stringify(ny));
        } catch {
          // Stille fall — interim-signalet er nice-to-have.
        }
        return ny;
      });
    },
    [nokkel],
  );

  return { sistBrukt, settSistBrukt };
}

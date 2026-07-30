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
 * Nøkkel: `sitedoc_sistbruktmal_${userId}` → JSON `Record<flytNøkkel, malId>`.
 * Nøkkel PER BRUKER + FLYT (ikke global) — fabel-krav (a): feil mal på tvers av
 * flyter er verre enn ingen default. `flytNøkkel` = dokumentflyt-id der en flyt
 * finnes; ellers en kategori-scopet sentinel fra kalleren (aldri delt på tvers
 * av flyter/kategorier).
 *
 * Miss (ingen lagret verdi) → kalleren faller tilbake til fallback-stigen
 * (favoritt/eneste → mellomvalg). Aldri gjett blindt.
 *
 * Feilfallback: tom (auto-hopp er nice-to-have, ikke kritisk).
 */
export function useSistBrukteMal(userId: string | undefined): {
  sistBrukt: (flytNøkkel: string) => string | null;
  settSistBrukt: (flytNøkkel: string, malId: string) => void;
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
    (flytNøkkel: string): string | null => kart[flytNøkkel] ?? null,
    [kart],
  );

  const settSistBrukt = useCallback(
    (flytNøkkel: string, malId: string) => {
      if (!nokkel || typeof window === "undefined") return;
      setKart((forrige) => {
        const ny = { ...forrige, [flytNøkkel]: malId };
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

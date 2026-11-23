"use client";

// O17 (vedtak-timer-web.md § Reisevinduet pkt 21): en reise mellom to kontorer (tur 3) vises som
// «{fra-kontor} → {til-kontor}» i radteksten — kortlisten, hover-linja og attesteringen. Kjennetegnet
// er ruten i `reiseRegel.overforing` (`kontorReiseRute`, shared), som eksporten også bruker.
// Navnet vises slik det er lagret (beslutning 2). Ukjent navn → null, og kalleren beholder dagens
// tekst — ingenting fabrikkeres.

import { kontorReiseRute } from "@sitedoc/shared";
import { trpc } from "@/lib/trpc";

type Oversett = (key: string, opts?: Record<string, unknown>) => string;

/** Ren: radteksten for en kontorreise, eller null (ikke kontor ↔ kontor, eller navn ukjent). */
export function kontorReiseTekst(
  t: Oversett,
  reiseRegel: unknown,
  kontorNavn: (id: string) => string | null | undefined,
): string | null {
  const rute = kontorReiseRute(reiseRegel);
  if (!rute) return null;
  const fra = kontorNavn(rute.fraKontorId);
  const til = kontorNavn(rute.tilKontorId);
  if (!fra || !til) return null;
  return t("timer.prosjektkort.reiseRute", { fra, til });
}

/**
 * Firmaets oppmøtesteder som navneoppslag. Spørringen kjøres bare når en av radene har
 * kontor-rute (`reiseRegler`), og deler cache med reisevinduet og `ReiseRadMerke`.
 */
export function useKontorNavn(
  organizationId: string | null | undefined,
  reiseRegler: readonly unknown[],
): (id: string) => string | null {
  const trengs = !!organizationId && reiseRegler.some((r) => kontorReiseRute(r) != null);
  const { data: steder } = trpc.oppmotested.hentForFirma.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: trengs },
  );
  return (id: string) => steder?.find((s) => s.id === id)?.navn ?? null;
}

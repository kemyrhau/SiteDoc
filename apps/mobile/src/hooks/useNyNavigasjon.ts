import { useEffect, useState } from "react";
import { resolverNyNavigasjon } from "@sitedoc/shared";
import { hentVerdi, lagreVerdi } from "../services/auth";
import { trpc } from "../lib/trpc";
import { useAuth } from "../providers/AuthProvider";

// Feature-flagg for navigasjonsredesignet (redesign/navigasjon) — mobil.
//
// Bruker-lagret (Plan 2), parallell til web-hooken bak SAMME presedens
// (delt `resolverNyNavigasjon` i @sitedoc/shared): konto > lokal > env > av.
// Mobil har ingen redesign-stack → envDefault er alltid false.
//
// - `konto` = `User.nyNavigasjon` via `bruker.hentMin`. Autoritativ, følger brukeren.
// - Lokal cache i SecureStore, nøklet PER userId (`sitedoc-ny-navigasjon:<userId>`) →
//   en ny bruker på delt enhet ser ALDRI forrige brukers verdi (offline-fallback +
//   anti-blink). userId kommer fra AuthProvider (kjent også offline).
// - Modul-cache er guardet på userId og nullstilles ved inn/utlogging (fikser den
//   tidligere «stale toggle»-visningen i utloggingsvinduet).
// - Flagget gater KUN synlig navigasjon; alle gamle skjermer er nåbare via router.push.

const BASE_NOKKEL = "sitedoc-ny-navigasjon";

function nokkelFor(userId: string): string {
  return `${BASE_NOKKEL}:${userId}`;
}

// Modul-cache for synkron/anti-blink retur, GUARDET på userId.
let cache: { userId: string | null; lokal: boolean | null } = {
  userId: null,
  lokal: null,
};
const lyttere = new Set<() => void>();

function varsleLyttere(): void {
  for (const lytter of lyttere) lytter();
}

/**
 * Nullstiller modul-cachen — kalles ved inn/utlogging fra AuthProvider slik at
 * flagg-tilstanden ikke henger igjen fra forrige bruker (rotårsak, ikke plaster).
 */
export function nullstillNyNavCache(): void {
  cache = { userId: null, lokal: null };
  varsleLyttere();
}

async function lastLokal(userId: string | null): Promise<void> {
  let lokal: boolean | null = null;
  if (userId) {
    try {
      const v = await hentVerdi(nokkelFor(userId));
      lokal = v === "1" ? true : v === "0" ? false : null;
    } catch {
      lokal = null;
    }
  }
  cache = { userId, lokal };
  varsleLyttere();
}

export function useNyNavigasjon(): boolean {
  const { bruker } = useAuth();
  const userId = bruker?.id ?? null;

  const { data: minBruker } = trpc.bruker.hentMin.useQuery(undefined, {
    staleTime: 60_000,
    enabled: !!userId,
  });
  // Gate konto på userId → ved logout faller nav tilbake til gammel (konto=null).
  const konto: boolean | null = userId ? minBruker?.nyNavigasjon ?? null : null;

  const [, tving] = useState(0);

  useEffect(() => {
    const oppdater = () => tving((n) => n + 1);
    lyttere.add(oppdater);
    if (cache.userId !== userId) void lastLokal(userId);
    return () => {
      lyttere.delete(oppdater);
    };
  }, [userId]);

  // Speil konto → per-bruker SecureStore-cache (offline-fallback neste oppstart).
  useEffect(() => {
    if (!userId || konto === null) return;
    void lagreVerdi(nokkelFor(userId), konto ? "1" : "0");
  }, [userId, konto]);

  const lokal = cache.userId === userId ? cache.lokal : null;
  // Mobil har ingen URL-query og ingen redesign-stack → query/envDefault alltid av.
  return resolverNyNavigasjon({ query: null, konto, lokal, envDefault: false });
}

/**
 * Toggle-setter (Mer-tab). Skriver til konto (autoritativt) + per-bruker cache +
 * oppdaterer optimistisk hentMin-cachen (konto vinner umiddelbart i resolveren).
 */
export function useSettNyNavigasjon(): (paa: boolean) => void {
  const { bruker } = useAuth();
  const utils = trpc.useUtils();
  const mutation = trpc.bruker.settNyNavigasjon.useMutation({
    onSettled: () => {
      void utils.bruker.hentMin.invalidate();
    },
  });

  return (paa) => {
    const userId = bruker?.id ?? null;
    utils.bruker.hentMin.setData(undefined, (gammel) =>
      gammel ? { ...gammel, nyNavigasjon: paa } : gammel,
    );
    if (userId) {
      void lagreVerdi(nokkelFor(userId), paa ? "1" : "0");
      cache = { userId, lokal: paa };
      varsleLyttere();
    }
    mutation.mutate({ paa });
  };
}

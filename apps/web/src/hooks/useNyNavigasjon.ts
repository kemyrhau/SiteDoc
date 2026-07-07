"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resolverNyNavigasjon } from "@sitedoc/shared";
import { trpc } from "@/lib/trpc";

// Feature-flagg for navigasjonsredesignet (redesign/navigasjon) — web.
//
// Bruker-lagret (Plan 2): `User.nyNavigasjon` (konto) er autoritativ kilde. Lokal
// lagring degradert til blink-fri cache/anti-blink-boot. ENESTE kilde til flagget
// i web-koden; presedens beregnes i delt `resolverNyNavigasjon` (@sitedoc/shared)
// slik at web og mobil aldri driver fra hverandre.
//
// Presedens (valg B): aktiv ?nyNav-URL > konto > persistert lokal > env-default > av.
//
// - `?nyNav=1/0` = FLYKTIG demo/dev-override (kunderunde: vis gammel-vs-ny for enhver
//   bruker). Skrives ALDRI til lokal cache eller konto — fjern param → tilbake til konto.
// - `konto` (User.nyNavigasjon via bruker.hentMin) vinner når satt (≠ null) og ingen query.
//   Gjør delt enhet korrekt: en ny bruker på samme maskin får sin egen konto, ikke forrige
//   brukers cache.
// - Persistert lokal cache er nøklet PER userId (`sitedoc-ny-navigasjon:<userId>`) → bruker B
//   ser aldri bruker A sin verdi. En «siste bruker»-nøkkel gir kun blink-fri boot FØR
//   konto-svaret kommer — den kan aldri vinne over konto (resolverens rekkefølge).
// - Env-default (`NEXT_PUBLIC_NY_NAV_DEFAULT`) settes kun i redesign-stacken.
// - Flagget gater KUN synlig navigasjon; ruten `/dashbord/innstillinger` er alltid nåbar.

const BASE_NOKKEL = "sitedoc-ny-navigasjon";
const SISTE_BRUKER_NOKKEL = "sitedoc-ny-nav-siste-bruker";

// Bakes inn ved build-tid (NEXT_PUBLIC). Usatt i prod/test → "av".
const ENV_DEFAULT = process.env.NEXT_PUBLIC_NY_NAV_DEFAULT === "1";

function nokkelFor(userId: string): string {
  return `${BASE_NOKKEL}:${userId}`;
}

// Tre-tilstands lokal lesing: "1"/"0" = eksplisitt, null = usatt.
function lesLokalRaa(nokkel: string): boolean | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(nokkel);
  if (v === "1") return true;
  if (v === "0") return false;
  return null;
}

// Anti-blink boot: siste kjente bruker sin per-bruker-verdi (fallback legacy base-nøkkel).
// KUN lokal-verdi før konto-svaret kommer — konto vinner alltid i resolverNyNavigasjon.
function lesBootLokal(): boolean | null {
  if (typeof window === "undefined") return null;
  const siste = window.localStorage.getItem(SISTE_BRUKER_NOKKEL);
  if (siste) {
    const perBruker = lesLokalRaa(nokkelFor(siste));
    if (perBruker !== null) return perBruker;
  }
  return lesLokalRaa(BASE_NOKKEL);
}

/**
 * Skriver et eksplisitt lokalt valg + markerer siste bruker (blink-fri neste boot).
 * Brukes av toggle-setteren og av `?nyNav`-håndteringen.
 */
function skrivLokal(userId: string | null, verdi: boolean): void {
  if (typeof window === "undefined") return;
  const v = verdi ? "1" : "0";
  if (userId) {
    window.localStorage.setItem(nokkelFor(userId), v);
    window.localStorage.setItem(SISTE_BRUKER_NOKKEL, userId);
  } else {
    window.localStorage.setItem(BASE_NOKKEL, v);
  }
}

export function useNyNavigasjon(): boolean {
  const { data: minBruker } = trpc.bruker.hentMin.useQuery(undefined, {
    staleTime: 60_000,
  });
  const userId = minBruker?.id ?? null;
  const konto = minBruker?.nyNavigasjon ?? null;

  // Flyktig ?nyNav-URL (demo/dev-override) + persistert lokal cache — separate innganger.
  // null (SSR-trygt) til effekten kjører.
  const [query, setQuery] = useState<boolean | null>(null);
  const [lokal, setLokal] = useState<boolean | null>(null);
  const [montert, setMontert] = useState(false);

  // Boot: les flyktig ?nyNav (aldri persistert) + persistert per-bruker/anti-blink-cache.
  // Re-kjøres når userId blir kjent.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setMontert(true);
    const q = new URLSearchParams(window.location.search).get("nyNav");
    setQuery(q === "1" ? true : q === "0" ? false : null);
    setLokal(userId ? lesLokalRaa(nokkelFor(userId)) : lesBootLokal());
  }, [userId]);

  // Speil konto → per-bruker-cache + siste bruker (blink-fri neste boot; offline-fallback).
  useEffect(() => {
    if (typeof window === "undefined" || !userId || konto === null) return;
    window.localStorage.setItem(nokkelFor(userId), konto ? "1" : "0");
    window.localStorage.setItem(SISTE_BRUKER_NOKKEL, userId);
  }, [userId, konto]);

  // Før mount: false (SSR-paritet, unngår hydrerings-avvik). Deretter delt resolver.
  if (!montert) return false;
  return resolverNyNavigasjon({ query, konto, lokal, envDefault: ENV_DEFAULT });
}

/**
 * Toggle-setter (brukermeny). Skriver til konto (autoritativt, følger brukeren),
 * oppdaterer optimistisk hentMin-cachen (konto vinner umiddelbart i resolveren) +
 * per-bruker lokal cache, og navigerer valgfritt (huben/kontakter er kun i ny nav).
 */
export function useSettNyNavigasjon(): (paa: boolean, målsti?: string) => void {
  const utils = trpc.useUtils();
  const router = useRouter();
  const mutation = trpc.bruker.settNyNavigasjon.useMutation({
    onSettled: () => {
      void utils.bruker.hentMin.invalidate();
    },
  });

  return (paa, målsti) => {
    const bruker = utils.bruker.hentMin.getData();
    // Optimistisk: konto vinner umiddelbart i resolverNyNavigasjon.
    utils.bruker.hentMin.setData(undefined, (gammel) =>
      gammel ? { ...gammel, nyNavigasjon: paa } : gammel,
    );
    skrivLokal(bruker?.id ?? null, paa);
    mutation.mutate({ paa });
    if (målsti) router.push(målsti);
  };
}

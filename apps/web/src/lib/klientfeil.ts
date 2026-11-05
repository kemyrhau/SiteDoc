/**
 * Forståelig tekst for feil som ikke kommer fra serveren selv (ordre 2026-11-05).
 * Dialogene viser `error.message` rått; derfor oversettes feilen ett sted — i
 * tRPC-klienten — og alle eksisterende visninger får riktig tekst uendret.
 *
 * - Nettverk: nettleseren fikk aldri et tRPC-svar (fetch-TypeError, eller 502/503/504
 *   fra proxyen med HTML/tom kropp → JSON-parsing feiler).
 * - Sesjon utløpt: tRPC-kode `UNAUTHORIZED`.
 *
 * Alle andre feil (også serverens egne norske meldinger) slipper gjennom uendret.
 */

import i18next from "i18next";
import type { TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "@sitedoc/api/src/trpc/router";

export type KlientfeilNokkel = "feil.ingenKontaktServer" | "feil.loggetUt";

/** Fetch-meldingene i Chrome, Safari og Firefox når forespørselen aldri fikk svar. */
const NETTVERKSMELDINGER = [
  "Failed to fetch",
  "Load failed",
  "NetworkError when attempting to fetch resource",
];

function hentFelt(obj: unknown, felt: string): unknown {
  return obj && typeof obj === "object" ? (obj as Record<string, unknown>)[felt] : undefined;
}

/** i18n-nøkkel for feilen, eller `null` når serverens egen melding skal vises. */
export function klientfeilNokkel(err: unknown): KlientfeilNokkel | null {
  const data = hentFelt(err, "data");
  if (hentFelt(data, "code") === "UNAUTHORIZED") return "feil.loggetUt";
  // Har feilen en tRPC-form, svarte serveren — da er meldingen dens egen.
  if (data || hentFelt(err, "shape")) return null;

  const aarsak = hentFelt(err, "cause") ?? err;
  const navn = hentFelt(aarsak, "name");
  const melding = hentFelt(aarsak, "message");
  if (navn === "TypeError" && typeof melding === "string" &&
      NETTVERKSMELDINGER.some((m) => melding.startsWith(m))) {
    return "feil.ingenKontaktServer";
  }
  // Proxyen svarte 502/503/504 med HTML eller tom kropp: `res.json()` feiler.
  if (navn === "SyntaxError") return "feil.ingenKontaktServer";
  return null;
}

/** tRPC-link som bytter meldingen på feil `klientfeilNokkel` kjenner igjen. */
export const klientfeilLink: TRPCLink<AppRouter> = () => ({ op, next }) =>
  observable((observer) =>
    next(op).subscribe({
      next: (verdi) => observer.next(verdi),
      complete: () => observer.complete(),
      error: (err) => {
        const nokkel = klientfeilNokkel(err);
        if (nokkel) err.message = i18next.t(nokkel);
        observer.error(err);
      },
    }),
  );

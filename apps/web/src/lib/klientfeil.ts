/**
 * Forståelig tekst for feil som ikke kommer fra serveren selv (ordre 2026-11-05).
 * Dialogene viser `error.message` rått; derfor oversettes feilen ett sted — i
 * tRPC-klienten — og alle eksisterende visninger får riktig tekst uendret.
 *
 * - Nettverk: nettleseren fikk aldri et tRPC-svar (fetch-TypeError, eller 502/503/504
 *   fra proxyen med HTML/tom kropp → JSON-parsing feiler).
 * - Sesjon utløpt: tRPC-kode `UNAUTHORIZED`.
 *
 * - Serverfeil med `data.feilNokkel` (w9, S1): teksten vises på brukerens språk med
 *   `t(feilNokkel, feilParam)`. Serverens norske `message` står når nøkkelen ikke finnes.
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

/**
 * w9 (S1): serverens oversettbare feil — `data.feilNokkel` + `data.feilParam`. `null` når
 * feilen ikke har nøkkel, eller nøkkelen ikke finnes i språkfilene (da står `message`).
 */
export function serverfeilTekst(
  err: unknown,
  oversett: { exists: (n: string) => boolean; t: (n: string, p?: Record<string, unknown>) => string } = i18next,
): string | null {
  const data = hentFelt(err, "data");
  const nokkel = hentFelt(data, "feilNokkel");
  if (typeof nokkel !== "string" || !oversett.exists(nokkel)) return null;
  const param = hentFelt(data, "feilParam");
  return oversett.t(nokkel, param && typeof param === "object" ? (param as Record<string, unknown>) : undefined);
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
        else {
          const tekst = serverfeilTekst(err);
          if (tekst) err.message = tekst;
        }
        observer.error(err);
      },
    }),
  );

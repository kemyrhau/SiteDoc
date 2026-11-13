import { fangGps, formatIsoDato } from "../hooks/useArbeidsdag";
import { hentOgCacheArbeidstidSvar } from "../services/arbeidstidSvarKatalog";
import type { trpc } from "../lib/trpc";

type TrpcKlient = ReturnType<typeof trpc.useUtils>["client"];

/** Parametrene `/timer/bekreft-dag` åpnes med for en pågående GPS-dag. */
export type SluttDagParams = {
  arbeidsdagId: string;
  sluttIso: string;
  endLat: string;
  endLng: string;
  sisteSegmentKilde: "bruker" | "system";
};

/**
 * L3-A (G1) + RETUR avvik 12 (Kontrollør 2026-11-13): ÉN sti inn i Bekreft dag
 * for en pågående GPS-dag. Brukes av «Slutt dag» (`StartSluttDagKort`) og av
 * trykk på et GPS-utkast i Timer-lista (`DagsseddelListe`) — kopier aldri.
 *
 * - Slutt-GPS fanges (avreise-besøket får posisjon, `identifiserByggeplass` får
 *   et punkt). Ved overstyrt slutt (glemt dag) fanges IKKE GPS — arbeideren er
 *   ikke nødvendigvis på stedet nå.
 * - Fersk norm hentes for start- og sluttdato (midnatt gir to) FØR navigasjonen.
 *   Best-effort: offline beholder cachen, og markøren signaliserer.
 * Ingenting skrives her; forslaget blir lønnsgrunnlag først ved Bekreft.
 */
export async function forberedSluttDag(
  args: {
    arbeidsdag: { id: string; startAt: string };
    orgId: string;
    klient: TrpcKlient;
    overstyrtSluttIso?: string;
    sisteSegmentKilde?: "bruker" | "system";
  },
  deps: {
    fangGps: typeof fangGps;
    hentNorm: typeof hentOgCacheArbeidstidSvar;
    naa: () => Date;
  } = { fangGps, hentNorm: hentOgCacheArbeidstidSvar, naa: () => new Date() },
): Promise<SluttDagParams> {
  const { lat, lng } = args.overstyrtSluttIso
    ? { lat: null as number | null, lng: null as number | null }
    : await deps.fangGps();
  const sluttIso = args.overstyrtSluttIso ?? deps.naa().toISOString();
  const berorteDatoer = new Set<string>([
    formatIsoDato(new Date(args.arbeidsdag.startAt)),
    formatIsoDato(new Date(sluttIso)),
  ]);
  await Promise.all(
    Array.from(berorteDatoer).map((d) => deps.hentNorm(args.klient, args.orgId, d)),
  );
  return {
    arbeidsdagId: args.arbeidsdag.id,
    sluttIso,
    endLat: lat == null ? "" : String(lat),
    endLng: lng == null ? "" : String(lng),
    sisteSegmentKilde: args.sisteSegmentKilde ?? "bruker",
  };
}

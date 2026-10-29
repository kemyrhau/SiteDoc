// Annoteringsflatens bildetilstand (ORDRE 3, telefon 74d447fa 2026-10-29): et annotert bilde åpnet
// andre gang ble stående på «Laster bildet …» for alltid, eller ga «kunne ikke åpnes» uten at
// OTA-en sa hvilken gren som slo til. Rene regler her; BildeAnnotering holder timere og effekter.
import type { AnnoteringsbildeResultat, AnnoteringsKilde } from "./annoteringsKilde";

/** Bildets tilstand i flaten. Ferdig er bare aktiv når bildet faktisk er lastet. */
export type BildeStatus = "laster" | "fornyer" | "klar" | "feil";

/** Lengste tid flaten står i «laster» før den viser feil — aldri en evig spinner (F1c). */
export const ANNOTERING_LASTE_TIDSGRENSE_MS = 15_000;

/** Tilstanden når tidsgrensen går ut: bare «laster» blir feil; fornyeren har sin egen frist. */
export function statusEtterTidsgrense(status: BildeStatus): BildeStatus {
  return status === "laster" ? "feil" : status;
}

/**
 * Skal ventende autolagring sendes før fornyeren starter (F1b)? En rå `originalUrl` kan bare
 * signeres når serveren har den; uten lagring henter tre refetcher det samme. Krever IKKE
 * `harEndringer`: ved gjenåpning er den usann selv om feltet med originalen aldri nådde serveren
 * (docs/claude/mobil.md, «Offline»). `lagre` sender bare felt som avviker fra serveren og gjør
 * ingen serverrunde når ingenting avviker. Aldri på lest/låst dokument, og én gang pr. fornyelse.
 */
export function skalLagreForFornyelse(p: { kanRedigere: boolean; fornyerAktiv: boolean }): boolean {
  return p.kanRedigere && !p.fornyerAktiv;
}

/** Én kort linje om utfallet — grunn og kildetype, aldri URL-en (signaturen) eller dataen. */
export function annoteringsUtfallLogg(
  kilde: AnnoteringsKilde["type"],
  r: AnnoteringsbildeResultat,
): string {
  const utfall = r.ok ? "ok" : r.status ? `${r.grunn} ${r.status}` : r.grunn;
  return `[annotering] bilde: ${utfall} (kilde ${kilde})`;
}

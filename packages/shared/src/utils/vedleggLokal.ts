/**
 * Sammenstilling av server-data og lokal (SQLite) tilstand ved init av et
 * skjema (sjekkliste/oppgave) — slik at et vedlegg brukeren har lagt inn ALDRI
 * forsvinner fra visningen fordi det ennå ikke er lastet opp.
 *
 * Bakgrunn (funn 2026-09-04): `utelatFeltMedLokaleVedlegg` holder felt med
 * `file://`-vedlegg utenfor server-payloaden (funn C, `da4d3035`) — riktig, en
 * død lokal sti skal aldri overskrive en god server-URL. Men da mangler feltet
 * på server, og ved init overskrev serverens (tomme) svar det brukeren så. Denne
 * modulen fikser SAMMENSTILLINGEN ved init: server er base, men felt som fortsatt
 * bærer et lokalt vedlegg tas fra lokal tilstand. Utelatelsen ved lagring beholdes.
 */

/** En URL som ennå ikke er lastet opp = lokal fil på enheten (ikke en server-URL). */
export function erLokalVedleggUrl(u: unknown): boolean {
  return typeof u === "string" && (u.startsWith("file://") || u.startsWith("/var/"));
}

/** Har noden (felt-verdi-tre) minst ett vedlegg med lokal URL? Rekursiv — dekker
 *  topp-nivå-vedlegg OG vedlegg inne i repeater-rader. */
export function harLokaltVedlegg(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(harLokaltVedlegg);
  if (node !== null && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (erLokalVedleggUrl(o.url)) return true;
    return Object.values(o).some(harLokaltVedlegg);
  }
  return false;
}

/**
 * Server er base; felt som i `lokal` fortsatt har et lokalt (uleverte) vedlegg
 * overlagres fra `lokal`. Server vinner for alt annet. Returnerer SAMME referanse
 * hvis ingenting ble overlagret (unngår unødvendig state-churn).
 *
 * `lokal` er SQLite-tilstanden (full data, inkl. de lokale vedleggene). `base` er
 * bygget fra serverens svar (der de utelatte feltene mangler eller er tomme).
 */
export function sammenstillMedLokaleVedlegg<T extends Record<string, unknown>>(
  base: T,
  lokal: Record<string, unknown> | null | undefined,
): T {
  if (!lokal) return base;
  let endret = false;
  const ut: Record<string, unknown> = { ...base };
  for (const [feltId, feltVerdi] of Object.entries(lokal)) {
    if (harLokaltVedlegg(feltVerdi)) {
      ut[feltId] = feltVerdi;
      endret = true;
    }
  }
  return endret ? (ut as T) : base;
}

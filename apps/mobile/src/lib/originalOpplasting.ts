// Originalen til en redigerbar annotering i opplastingskøen (2026-10-28, RETUR M1 fra Kontrollør).
//
// Annoteres et bilde før originalen er lastet opp, peker vedleggets `originalUrl` på lokalfila, og
// feltet holdes unna serveren til originalen er oppe (`harLokaltVedlegg`). To ting må da aldri skje:
//   1. Lokalfila slettes før noen har tatt server-URL-en (SQLite eller en montert skjerm) — da peker
//      `originalUrl` på en død sti for alltid.
//   2. En original som aldri kommer opp (fil mangler, opplasting gitt opp, oppføring borte) holder
//      hele feltet — annotert bilde og kommentar — unna serveren for alltid.
// Begge reglene er rene funksjoner her; køen og hookene kaller dem.
import {
  erLokalVedleggUrl,
  flatUtOriginaler,
  settOriginalUrlIDokument,
  settVedleggUrlIDokument,
} from "@sitedoc/shared";

/** Hvilken opplasting som fullførte, eller hvilken original som er tapt. */
export interface FullfortOpplasting {
  lokalSti: string;
  /**
   * `fullfort`: vanlig opplasting — `url` byttes (og en lokal `originalUrl` som peker på samme fil).
   * `original`: en foreldet oppføring (originalen etter en annotering) — bare `originalUrl` byttes.
   * `originalTapt`: originalen kommer aldri opp — vedlegget flates ut.
   */
  hendelse: "fullfort" | "original" | "originalTapt";
}

/** Felles for SQLite-blobben og skjema-hookene: én regel for hva en opplastingshendelse gjør. */
export function anvendOpplasting<T extends Record<string, unknown>>(
  feltVerdier: T,
  vedleggId: string,
  serverUrl: string,
  opplasting?: FullfortOpplasting,
): T {
  if (!opplasting) return settVedleggUrlIDokument(feltVerdier, vedleggId, serverUrl);
  if (opplasting.hendelse === "originalTapt") {
    return flatUtOriginaler(feltVerdier, (u) => u === opplasting.lokalSti);
  }
  const medUrl =
    opplasting.hendelse === "original" ? feltVerdier : settVedleggUrlIDokument(feltVerdier, vedleggId, serverUrl);
  return settOriginalUrlIDokument(medUrl, vedleggId, opplasting.lokalSti, serverUrl);
}

/** Utfallet av å skrive til SQLite-blobben: endret, ingen treff, eller vet ikke (ingen rad/DB/feil). */
export type SqliteUtfall = "endret" | "uendret" | "ukjent";

/**
 * Kan lokalfila til en foreldet oppføring slettes? Ja når SQLite eller en montert skjerm tok
 * server-URL-en, eller når SQLite sikkert ikke refererer fila (vanlig foreldet kamera-original).
 * Nei når vi ikke vet — da beholdes fila, og oppryddingen flater ut vedlegget i stedet.
 */
export function kanSletteForeldetFil(sqlite: SqliteUtfall, skjermTok: boolean): boolean {
  return skjermTok || sqlite !== "ukjent";
}

/** Kan oppføringen fortsatt fullføre? (`feilet` under taket prøves igjen.) */
export function erLevendeOppforing(status: string | null, forsok: number, maksForsok: number): boolean {
  return status === "venter" || status === "laster_opp" || (status === "feilet" && forsok < maksForsok);
}

/**
 * Flat ut vedlegg hvis LOKALE `originalUrl` ikke har en levende oppføring i køen (fil manglet og
 * oppføringen ble forkastet, opplasting gitt opp, eller oppføringen er borte). Returnerer de nye
 * feltverdiene (samme referanse når ingenting endres) og stiene som ble flatet ut.
 */
export function flatUtForeldreloseOriginaler<T extends Record<string, unknown>>(
  feltVerdier: T,
  levendeStier: ReadonlySet<string>,
): { feltVerdier: T; tapte: string[] } {
  const tapte = new Set<string>();
  const ny = flatUtOriginaler(feltVerdier, (u) => {
    const tapt = erLokalVedleggUrl(u) && !levendeStier.has(u);
    if (tapt) tapte.add(u);
    return tapt;
  });
  return { feltVerdier: ny, tapte: [...tapte] };
}

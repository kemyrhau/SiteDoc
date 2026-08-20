/**
 * Logg-combiner (RENT LAG). Tar rå lister fra leserne (apps/api) og former
 * `ArkivLogg` — grupperer lag 2 per økt og fester kryssreferanse-halen på
 * lag 1. Utfalls-agnostisk mot fabels tabell-vs-seksjon-valg.
 */

import type { HendelseRad, RåEndring, EkspandertEndring, EndringsØkt, ArkivLogg, SistEndret } from "./typer";
import { ekspanderEndring, type KolonneDef } from "./endringsdiff";

/** YYYY-MM-DD fra ISO-tidsstempel (grupperingsnøkkel — dato, ikke tid). */
function datoDel(iso: string): string {
  return iso.slice(0, 10);
}

/** Teller bilde-objekter (url + type/filnavn) på tvers av nesting i repeater-rader. */
function tellBilderILogg(rader: unknown[]): number {
  let n = 0;
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) {
      for (const x of v) walk(x);
      return;
    }
    if (v != null && typeof v === "object") {
      const o = v as { url?: unknown; type?: unknown; filnavn?: unknown };
      const filnavn = typeof o.filnavn === "string" ? o.filnavn : "";
      if (typeof o.url === "string" && (o.type === "bilde" || /\.(png|jpe?g|gif|webp)$/i.test(filnavn))) {
        n++;
        return;
      }
      for (const x of Object.values(v)) walk(x);
    }
  };
  walk(rader);
  return n;
}

/**
 * Endringslogg-verdi → lesbar streng (funn 6). En repeater-verdi lagres som rå
 * JSON av rad-objektene i `oldValue`/`newValue`; rendret rått lekker det barn-
 * UUID-er og `/uploads`-stier til et byggherre-dokument. Samme prinsipp som
 * `cellVerdi`/persons-resolveren: vis referansen (antall rader + bilder), ikke
 * råstrukturen. Primitiver og andre strukturer passerer uendret; kun en JSON-
 * array av rad-OBJEKTER (repeater) oppsummeres. Tom array → null («Ikke utfylt»).
 */
export function oppsummerLoggverdi(verdi: string | null): string | null {
  if (verdi == null) return null;
  const t = verdi.trim();
  if (t === "") return null;
  if (t[0] !== "[") return verdi; // primitiv/annen struktur → uendret
  let parsed: unknown;
  try {
    parsed = JSON.parse(t);
  } catch {
    return verdi;
  }
  if (!Array.isArray(parsed)) return verdi;
  if (parsed.length === 0) return null;
  const erRader = parsed.every((r) => r != null && typeof r === "object" && !Array.isArray(r));
  if (!erRader) return verdi; // list_multi o.l. (array av primitiver) → uendret
  const antall = parsed.length;
  const bilder = tellBilderILogg(parsed);
  const rad = `${antall} rad${antall === 1 ? "" : "er"}`;
  return bilder > 0 ? `${rad} (${bilder} bilde${bilder === 1 ? "" : "r"})` : rad;
}

/**
 * Grupperer flate feltendringer i økter = (userId, dato). Rader sorteres
 * kronologisk innad; øktene sorteres etter sin første endring.
 */
export function grupperØkter(endringer: EkspandertEndring[]): EndringsØkt[] {
  const kart = new Map<string, EndringsØkt>();
  for (const e of endringer) {
    const dato = datoDel(e.tidspunkt);
    const nøkkel = `${e.userId}|${dato}`;
    let økt = kart.get(nøkkel);
    if (!økt) {
      økt = { userId: e.userId, aktor: e.aktor, dato, rader: [] };
      kart.set(nøkkel, økt);
    }
    økt.rader.push({ tidspunkt: e.tidspunkt, felt: e.felt, fraVerdi: e.fraVerdi, tilVerdi: e.tilVerdi });
  }
  const økter = [...kart.values()];
  for (const økt of økter) {
    økt.rader.sort((a, b) => a.tidspunkt.localeCompare(b.tidspunkt));
  }
  økter.sort((a, b) => (a.rader[0]?.tidspunkt ?? "").localeCompare(b.rader[0]?.tidspunkt ?? ""));
  return økter;
}

/**
 * Tilordner antall feltendringer til hver hendelse (kryssreferanse-hale).
 *
 * En endring hører til hendelsen i intervallet
 * `(forrigeHendelse.tidspunkt, denneHendelse.tidspunkt]` — nedre kant
 * EKSKLUSIV, øvre kant INKLUSIV. Begrunnelse: en feltendring stemplet i
 * samme øyeblikk som en sending er del av det som ble sendt. Første hendelse:
 * `(-∞, første]`. Endringer etter siste hendelse er foreldreløse — utelates
 * fra haler (men vises fortsatt i den fulle Endringsloggen).
 *
 * Muterer ikke input; returnerer nye `HendelseRad` med `antallFeltendringer`
 * satt, sortert kronologisk.
 */
export function tellFeltendringer(hendelser: HendelseRad[], endringer: Array<{ tidspunkt: string }>): HendelseRad[] {
  const sortert = [...hendelser].sort((a, b) => a.tidspunkt.localeCompare(b.tidspunkt));
  const antall = sortert.map(() => 0);
  for (const e of endringer) {
    // Første hendelse med tidspunkt >= endringens (øvre-inklusiv, og siden
    // det er den FØRSTE slike er nedre kant implisitt eksklusiv).
    const idx = sortert.findIndex((hend) => e.tidspunkt <= hend.tidspunkt);
    if (idx !== -1) antall[idx] = (antall[idx] ?? 0) + 1; // -1 = etter siste → foreldreløs
  }
  return sortert.map((h, i) => ({ ...h, antallFeltendringer: antall[i] ?? 0 }));
}

/** Seneste tidspunkt på tvers av kandidatene → statusblokkens femte felt. */
export function finnSistEndret(kandidater: Array<{ tidspunkt: string; aktor: string }>): SistEndret | null {
  if (kandidater.length === 0) return null;
  const siste = kandidater.reduce((a, b) => (a.tidspunkt >= b.tidspunkt ? a : b));
  return { navn: siste.aktor, dato: siste.tidspunkt };
}

/**
 * Bygger logg-konvolutten for sjekkliste/oppgave/HMS: lag 1 med
 * kryssreferanse-hale + lag 2 gruppert per økt (tom når endringslogg av).
 *
 * Hver rå feltendring ekspanderes til lesbare rader (`ekspanderEndring`):
 * repeater-endringer blir én rad per endret celle, primitiver ryddes for
 * JSON-anførselstegn, og kanoniske no-ops (lik verdi, ulik nøkkelrekkefølge)
 * faller bort. `kolonnerPerFelt[feltId]` gir repeaterens kolonne-labels.
 * Både haletelling og økter arver de ekspanderte radene.
 */
export function byggArkivLogg(input: {
  hendelser: HendelseRad[];
  endringer: RåEndring[];
  endringsloggAktivert: boolean;
  kolonnerPerFelt?: Record<string, KolonneDef[]>;
}): ArkivLogg {
  const kolonner = input.kolonnerPerFelt ?? {};
  const endringer: EkspandertEndring[] = (input.endringsloggAktivert ? input.endringer : []).flatMap((e) =>
    ekspanderEndring(e.felt, e.fraVerdi, e.tilVerdi, e.feltId ? kolonner[e.feltId] : undefined).map(
      (rad) => ({
        userId: e.userId,
        aktor: e.aktor,
        tidspunkt: e.tidspunkt,
        felt: rad.felt,
        fraVerdi: rad.fraVerdi,
        tilVerdi: rad.tilVerdi,
      }),
    ),
  );
  const hendelser = tellFeltendringer(input.hendelser, endringer);
  const økter = grupperØkter(endringer);
  const kandidater = [
    ...hendelser.map((h) => ({ tidspunkt: h.tidspunkt, aktor: h.aktor })),
    ...endringer.map((e) => ({ tidspunkt: e.tidspunkt, aktor: e.aktor })),
  ];
  return {
    hendelser,
    økter,
    endringsloggAktivert: input.endringsloggAktivert,
    sistEndret: finnSistEndret(kandidater),
  };
}

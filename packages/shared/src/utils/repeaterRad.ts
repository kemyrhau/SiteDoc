/**
 * KANONISK traversering av repeater-rader. BRUK DISSE — ikke iterer
 * `Object.keys(rad)` / `Object.values(rad)` for hånd.
 *
 * En repeater-rad lagres som `{ _radId, felter: { feltId: FeltVerdi } }`
 * (rad-id-vedtak 2026-08-22). Eldre/rå rader kan være flate `{ feltId: FeltVerdi }`.
 * Kode som itererer `Object.keys(rad)` og forventer den flate formen ser bare
 * `_radId` (en streng) + `felter` (en wrapper uten felt-innhold) → finner ingen
 * felt, og feiler stille på nettopp repeater-rader.
 *
 * 🔴 Denne ÉNE feilklassen traff oss TRE ganger på ett døgn (2026-09-03/04),
 * tre uavhengige symptomer:
 *   1. bildeNr uteble i rike repeatere (`d8e6b63f`)
 *   2. append-racet mistet bilder (`leggTilVedleggIRad`)
 *   3. opplastings-callbacken oppdaterte aldri repeater-vedleggets URL → «Kunne
 *      ikke laste» til man gikk ut og inn
 * Derfor: ÉN kanonisk traversering, her, med navn som er lette å finne. Nye
 * steder som rører repeater-rader SKAL gå gjennom `feltKartFraRad`.
 *
 * 🔴 PDF HAR EN KANONISK TVILLING: `packages/pdf/src/arkivmal/repeaterRad.ts`
 * (`feltKartFraRad`) fordi `@sitedoc/pdf` er null-runtime-avhengighet og ikke kan
 * importere shared (se den fila + packages/pdf/CLAUDE.md). To varianter avgrenset
 * av dep-regelen er tilsiktet — ikke to løsrevne kopier. Rører du den ene, hold
 * dem like (samme mønster som `tegningsmarkor.ts` ↔ pdf `tegningsfelt.ts`).
 */

/**
 * Felt-kartet i en repeater-rad: `felter`-objektet når raden har det (produksjons-
 * formen `{ _radId, felter }`), ellers raden selv (eldre/rå flat form). `_radId`
 * (streng) blir aldri behandlet som et felt, fordi vi kun leser `felter` når den finnes.
 */
export function feltKartFraRad(rad: unknown): Record<string, unknown> {
  const r = rad as Record<string, unknown> | null | undefined;
  const felter = r?.felter;
  return felter && typeof felter === "object"
    ? (felter as Record<string, unknown>)
    : ((r ?? {}) as Record<string, unknown>);
}

/** Skriv `felter`-kartet tilbake i radens form (bevar `_radId` + wrapper når den fantes). */
export function medFeltKart(rad: unknown, nyttKart: Record<string, unknown>): unknown {
  const r = rad as Record<string, unknown>;
  const harFelter = r?.felter != null && typeof r.felter === "object";
  return harFelter ? { ...r, felter: nyttKart } : nyttKart;
}

type VedleggListe = Array<{ id?: string; url?: unknown } & Record<string, unknown>>;

/** Endring av ett vedlegg: ny versjon, eller `null` = la vedlegget stå urørt. */
type VedleggEndring = (v: Record<string, unknown>) => Record<string, unknown> | null;

function endreIListe(
  liste: unknown,
  vedleggId: string | null,
  endre: VedleggEndring,
): { liste: unknown; endret: boolean } {
  if (!Array.isArray(liste)) return { liste, endret: false };
  let endret = false;
  const ny = (liste as VedleggListe).map((v) => {
    if (v && typeof v === "object" && (vedleggId === null || v.id === vedleggId)) {
      const nyV = endre(v);
      if (nyV === null) return v;
      endret = true;
      return nyV;
    }
    return v;
  });
  return { liste: endret ? ny : liste, endret };
}

/**
 * Sett `url` på vedlegget med `vedleggId`, immutabelt, OVERALT i dokumentet:
 * topp-nivå-felt OG repeater-rader (begge radformer). Returnerer SAMME referanse
 * hvis vedlegget ikke ble funnet (unngår unødvendig state-churn).
 *
 * Dette er kanalen opplastings-callbacken i alle skjema-hooks bruker når køen har
 * lastet opp et vedlegg og har en varig server-URL — slik at den åpne skjermen
 * bytter fra lokal/feilende URL til server-URL uten «gå ut og inn».
 */
export function settVedleggUrlIDokument<T extends Record<string, unknown>>(
  feltVerdier: T,
  vedleggId: string,
  nyUrl: string,
): T {
  return endreVedleggIDokument(feltVerdier, vedleggId, (v) => ({ ...v, url: nyUrl }));
}

/**
 * Bytt en LOKAL `originalUrl` til server-URL-en når originalen er lastet opp (redigerbar
 * annotering på mobil, 2026-10-28): ble bildet annotert før originalen var oppe, peker
 * `originalUrl` på lokalfila, og `url` er alt den annoterte. Byttes KUN når `originalUrl`
 * fortsatt er nettopp `lokalSti` — ellers står vedlegget urørt (samme referanse).
 */
export function settOriginalUrlIDokument<T extends Record<string, unknown>>(
  feltVerdier: T,
  vedleggId: string,
  lokalSti: string,
  serverUrl: string,
): T {
  return endreVedleggIDokument(feltVerdier, vedleggId, (v) =>
    v.originalUrl === lokalSti ? { ...v, originalUrl: serverUrl } : null,
  );
}

/**
 * Flat ut vedlegg hvis `originalUrl` ikke lenger kan bli en server-original (RETUR M1,
 * Kontrollør 2026-10-28): en LOKAL original hvis fil mangler eller hvis opplasting har gitt opp
 * eller er borte. `originalUrl` og `annotering` fjernes, så feltet (med det annoterte bildet og
 * kommentaren) ikke holdes unna serveren for alltid. Vedlegget blir flatt, som før laget fantes.
 * Gjelder alle vedlegg i dokumentet; samme referanse når ingenting ble flatet ut.
 */
export function flatUtOriginaler<T extends Record<string, unknown>>(
  feltVerdier: T,
  skalFlates: (originalUrl: string) => boolean,
): T {
  return endreVedleggIDokument(feltVerdier, null, (v) => {
    if (typeof v.originalUrl !== "string" || !skalFlates(v.originalUrl)) return null;
    const { originalUrl: _o, annotering: _a, ...flatt } = v;
    return flatt;
  });
}

/** Felles traversering (topp-nivå + repeater-rader, begge radformer) for vedlegg-endringer.
 *  `vedleggId` null = alle vedlegg. */
function endreVedleggIDokument<T extends Record<string, unknown>>(
  feltVerdier: T,
  vedleggId: string | null,
  endre: VedleggEndring,
): T {
  let endretNoe = false;
  const ut: Record<string, unknown> = { ...feltVerdier };

  for (const feltId of Object.keys(ut)) {
    const felt = ut[feltId] as { verdi?: unknown; vedlegg?: unknown } | undefined;
    if (!felt || typeof felt !== "object") continue;

    // 1. Topp-nivå-vedlegg på feltet.
    const topp = endreIListe(felt.vedlegg, vedleggId, endre);
    let feltEndret = topp.endret;
    let nyVerdi = felt.verdi;

    // 2. Repeater-rader (verdi = array av rader), begge radformer via feltKartFraRad.
    if (Array.isArray(felt.verdi)) {
      let raderEndret = false;
      const nyeRader = (felt.verdi as unknown[]).map((rad) => {
        const kart = feltKartFraRad(rad);
        let radEndret = false;
        const nyttKart: Record<string, unknown> = { ...kart };
        for (const barnId of Object.keys(nyttKart)) {
          const barn = nyttKart[barnId] as { vedlegg?: unknown } | undefined;
          if (!barn || typeof barn !== "object") continue;
          const r = endreIListe(barn.vedlegg, vedleggId, endre);
          if (r.endret) {
            nyttKart[barnId] = { ...barn, vedlegg: r.liste };
            radEndret = true;
          }
        }
        if (!radEndret) return rad;
        raderEndret = true;
        return medFeltKart(rad, nyttKart);
      });
      if (raderEndret) {
        nyVerdi = nyeRader;
        feltEndret = true;
      }
    }

    if (feltEndret) {
      ut[feltId] = { ...felt, vedlegg: topp.liste, verdi: nyVerdi };
      endretNoe = true;
    }
  }

  return endretNoe ? (ut as T) : feltVerdier;
}

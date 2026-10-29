// Hvilken URI viser miniatyren i skjemaets filmrull? (telefontest 2026-10-29, funn 1)
//
// Rett etter en opplasting bærer `url` den RÅ `/uploads/privat/…`-stien fram til neste refetch, og
// rå 401-er alltid (signatur-kun). Før viste miniatyren da `originalUrl` hvis den var en server-URL
// (funn d) — men for et ANNOTERT vedlegg er det det uannoterte bildet, og når bildet ble tatt og
// annotert i samme økt er `originalUrl` selv rå → 401 → «Kunne ikke laste». Et annotert vedlegg
// viser derfor aldri `originalUrl`: den rå `url` sendes til `AutentisertBilde`, som regner rå som
// fornybar og henter den signerte (refetch) selv.

export interface MiniatyrVedlegg {
  url: string;
  originalUrl?: string;
}

function erLokal(u: string): boolean {
  return u.startsWith("file://") || u.startsWith("/var/");
}

function erRaaPrivat(u: string): boolean {
  return u.startsWith("/uploads/privat/") && !u.includes("sig=");
}

/**
 * @param lokalReserve lokalfila til vedlegget (`lokalBildeSti(filnavn)`): samme sti som akkurat ble
 *   vist mens bildet var lokalt, så et nytatt bilde uten annotering står stille i rå-vinduet.
 */
export function miniatyrKilde(v: MiniatyrVedlegg, apiUrl: string, lokalReserve: string): string {
  const full = (u: string) => (u.startsWith("/") ? `${apiUrl}${u}` : u);
  if (erLokal(v.url)) return v.url;
  if (erRaaPrivat(v.url)) {
    // Annotert (har en original): vis det annoterte bildet, aldri originalen.
    if (v.originalUrl) return full(v.url);
    return lokalReserve;
  }
  return full(v.url);
}

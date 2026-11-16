/**
 * Telefontest A funn 2: hvilken kilde et kvitteringsvedlegg vises fra. Lokalfila brukes bare
 * så lenge serveren ikke har bekreftet vedlegget (`serverUrl` mangler). Etter bekreftelse er
 * lokalfila slettet av køen, så den signerte server-URL-en skal vinne over en død `lokalSti`.
 */
export function vedleggKilde(v: { lokalSti: string | null; serverUrl: string | null }): {
  lokal: string | null;
  signer: boolean;
} {
  if (v.serverUrl) return { lokal: null, signer: true };
  return { lokal: v.lokalSti ?? null, signer: false };
}

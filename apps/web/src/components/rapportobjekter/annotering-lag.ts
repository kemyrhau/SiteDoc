// Rene hjelpere for web-annoteringens tre-artefakt-modell, testbare uten React/iframe.
// Reglene for kilde/patch bor i `@sitedoc/shared` (`annotering/vedlegg.ts`) — mobil bruker de
// samme fra 2026-10-28, så et lag laget på den ene flaten åpnes likt på den andre.
export { annoteringsKilde, erAnnotert, byggAnnoteringsPatch } from "@sitedoc/shared";

/**
 * Konverter en data-URL (HTML-en eksporterer `data:image/jpeg;base64,...`) til Blob
 * for opplasting. Beholder MIME-typen fra data-URL-en — JPEG, aldri PNG.
 */
export function dataUrlTilBlob(dataUrl: string): Blob {
  const komma = dataUrl.indexOf(",");
  const hode = komma >= 0 ? dataUrl.slice(0, komma) : "";
  const base64 = komma >= 0 ? dataUrl.slice(komma + 1) : "";
  const mimeTreff = /data:([^;]+)/.exec(hode);
  const mime = mimeTreff?.[1] ?? "application/octet-stream";
  const binær = atob(base64);
  const bytes = new Uint8Array(binær.length);
  for (let i = 0; i < binær.length; i++) bytes[i] = binær.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

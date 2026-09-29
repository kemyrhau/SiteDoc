// Rene hjelpere for web-annoteringens tre-artefakt-modell. Skilt ut fra
// FeltDokumentasjon så korrektheten (original bevart, gjenåpne på original,
// bakoverkompat) er enhets-testbar uten å drive React/iframe.
import type { AnnoteringsLag } from "@sitedoc/shared";
import type { Vedlegg } from "./typer";

/**
 * Kilden en annotering skal ÅPNES mot: alltid originalen, aldri den utflatede
 * JPEG-en (ellers brennes annoteringene inn på nytt for hvert redigeringsledd).
 * Førstegangs annotering: `originalUrl` finnes ikke ennå → `url` ER originalen.
 */
export function annoteringsKilde(vedlegg: Pick<Vedlegg, "url" | "originalUrl">): string {
  return vedlegg.originalUrl ?? vedlegg.url;
}

/** Har vedlegget et redigerbart lag? Bakover: mobil-/historisk-annoterte mangler det. */
export function erAnnotert(vedlegg: Pick<Vedlegg, "annotering">): boolean {
  return vedlegg.annotering != null;
}

/**
 * Bygg patch-en som lagres etter en annotering. 🔴 `originalUrl` settes ÉN gang
 * (ved første annotering) og bevares deretter — re-annotering peker fortsatt på det
 * EKTE originalfotoet, ikke forrige utflatede versjon. `url` blir den nye JPEG-en.
 */
export function byggAnnoteringsPatch(
  eksisterende: Pick<Vedlegg, "url" | "originalUrl">,
  nyUrl: string,
  lag: AnnoteringsLag,
): Pick<Vedlegg, "url" | "originalUrl" | "annotering"> {
  return {
    url: nyUrl,
    originalUrl: eksisterende.originalUrl ?? eksisterende.url,
    annotering: lag,
  };
}

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

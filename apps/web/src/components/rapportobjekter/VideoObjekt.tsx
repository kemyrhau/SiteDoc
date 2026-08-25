import type { RapportObjektProps } from "./typer";

/** YouTube/Vimeo-URL → embed-URL for iframe; null hvis ikke gjenkjent. */
function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

/**
 * Video — for PSI og instruksjoner. Speiler mobil-varianten (som bruker WebView).
 * Web manglet denne i KOMPONENT_MAP → video falt til UkjentObjekt (F2-rest).
 * Ren visning (ingen «watched»-lagring på web): YouTube/Vimeo → iframe-embed,
 * ellers opplastet fil via HTML5 <video>. `config.url` (eller eldre `fileUrl`).
 */
export function VideoObjekt({ objekt }: RapportObjektProps) {
  const url = (objekt.config.url as string) ?? (objekt.config.fileUrl as string) ?? "";
  if (!url) return null;

  const embed = embedUrl(url);
  if (embed) {
    return (
      <div className="my-3 aspect-video w-full overflow-hidden rounded-lg border border-gray-200 bg-black">
        <iframe
          src={embed}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={objekt.label || "Video"}
        />
      </div>
    );
  }

  const filUrl = url.startsWith("http") ? url : `/api${url}`;
  return (
    <div className="my-3 overflow-hidden rounded-lg border border-gray-200 bg-black">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- instruksjonsvideo uten teksting */}
      <video src={filUrl} controls playsInline className="max-h-[500px] w-full" />
    </div>
  );
}

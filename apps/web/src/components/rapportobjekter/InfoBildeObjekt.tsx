import type { RapportObjektProps } from "./typer";

/** Web-URL for et opplastet bilde: absolutt URL slippes gjennom, ellers /api-prefiks. */
function fullBildeUrl(url: string): string {
  return url.startsWith("http") ? url : `/api${url}`;
}

/**
 * Bilde med bildetekst (ikke redigerbar) — for PSI og instruksjoner. Speiler
 * mobil-varianten. Web manglet denne i KOMPONENT_MAP → info_image falt til
 * UkjentObjekt (F2-rest). Ren visning: `config.imageUrl` + `config.caption`.
 */
export function InfoBildeObjekt({ objekt }: RapportObjektProps) {
  const bildeUrl = (objekt.config.imageUrl as string) ?? "";
  const caption = (objekt.config.caption as string) ?? "";
  if (!bildeUrl) return null;

  return (
    <figure className="my-3 flex flex-col items-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- brukeropplastet/ekstern URL, ikke bygg-tid-kjent */}
      <img
        src={fullBildeUrl(bildeUrl)}
        alt={caption || "Instruksjonsbilde"}
        className="max-h-[500px] max-w-full rounded-lg border border-gray-200 object-contain"
      />
      {caption ? (
        <figcaption className="mt-1.5 text-center text-xs italic text-gray-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

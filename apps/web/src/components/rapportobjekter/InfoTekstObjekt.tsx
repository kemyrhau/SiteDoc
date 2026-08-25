import type { RapportObjektProps } from "./typer";

/**
 * Ren lesetekst (ikke redigerbar) — for PSI og instruksjoner. Speiler mobil-
 * varianten. Web manglet denne i KOMPONENT_MAP → info_text falt til UkjentObjekt
 * (F2-rest). Ren visning: leser `config.content`, bevarer linjeskift.
 */
export function InfoTekstObjekt({ objekt }: RapportObjektProps) {
  const innhold = (objekt.config.content as string) ?? "";
  if (!innhold) return null;

  return (
    <p className="mb-3 whitespace-pre-wrap text-base leading-7 text-gray-800">{innhold}</p>
  );
}

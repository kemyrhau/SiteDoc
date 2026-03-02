import type { RapportObjektProps } from "./typer";

export function VedleggObjekt({ leseModus }: RapportObjektProps) {
  return (
    <p className="text-sm text-gray-400">
      {leseModus
        ? "Ingen vedlegg."
        : "Bruk knappene nedenfor for å legge til vedlegg."}
    </p>
  );
}

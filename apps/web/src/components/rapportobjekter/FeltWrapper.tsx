import type { ReactNode } from "react";
import type { Vedlegg } from "./typer";
import { FeltDokumentasjon } from "./FeltDokumentasjon";

interface FeltWrapperProps {
  objekt: {
    id: string;
    type: string;
    label: string;
    required: boolean;
    config: Record<string, unknown>;
  };
  kommentar: string;
  vedlegg: Vedlegg[];
  onEndreKommentar: (kommentar: string) => void;
  onLeggTilVedlegg: (vedlegg: Vedlegg) => void;
  onFjernVedlegg: (vedleggId: string) => void;
  leseModus?: boolean;
  nestingNivå?: number;
  valideringsfeil?: string;
  prosjektId?: string;
  children: ReactNode;
}

export function FeltWrapper({
  objekt,
  kommentar,
  vedlegg,
  onEndreKommentar,
  onLeggTilVedlegg,
  onFjernVedlegg,
  leseModus,
  nestingNivå = 0,
  valideringsfeil,
  prosjektId,
  children,
}: FeltWrapperProps) {
  // Gradert innrykk: ml-4 per nivå, maks ml-12
  const marginKlasse = nestingNivå > 0
    ? nestingNivå === 1 ? "ml-4" : nestingNivå === 2 ? "ml-8" : "ml-12"
    : "";
  const rammeKlasse = nestingNivå > 0 ? "border-l-2 border-l-blue-300 pl-4" : "";

  return (
    <div className={`rounded-lg bg-white p-4 shadow-sm ${marginKlasse} ${rammeKlasse}`}>
      {/* Label + påkrevd-badge */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-medium text-gray-900">{objekt.label}</span>
        {objekt.required && (
          <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
            Påkrevd
          </span>
        )}
      </div>

      {/* Typespesifikk input */}
      {children}

      {/* Valideringsfeil */}
      {valideringsfeil && (
        <p className="mt-1 text-xs text-red-500">{valideringsfeil}</p>
      )}

      {/* Dokumentasjon (kommentar + vedlegg) */}
      <FeltDokumentasjon
        kommentar={kommentar}
        vedlegg={vedlegg}
        onEndreKommentar={onEndreKommentar}
        onLeggTilVedlegg={onLeggTilVedlegg}
        onFjernVedlegg={onFjernVedlegg}
        leseModus={leseModus}
        skjulKommentar={objekt.type === "text_field"}
        prosjektId={prosjektId}
      />
    </div>
  );
}

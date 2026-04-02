import { useState, type ReactNode } from "react";
import { Plus, Info, Globe, Loader2 } from "lucide-react";
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
  bygningId?: string | null;
  standardTegningId?: string | null;
  oppgaveNummer?: string;
  oppgaveId?: string;
  onOpprettOppgave?: () => void;
  onNavigerTilOppgave?: (id: string) => void;
  /** Oversettelser for firmainnhold (on-demand) */
  oversettelser?: Record<string, string>;
  oversettelseLaster?: boolean;
  onOversett?: () => void;
  visOversettKnapp?: boolean;
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
  bygningId,
  standardTegningId,
  oppgaveNummer,
  oppgaveId,
  onOpprettOppgave,
  onNavigerTilOppgave,
  oversettelser,
  oversettelseLaster,
  onOversett,
  visOversettKnapp,
  children,
}: FeltWrapperProps) {
  const [visOversettelse, setVisOversettelse] = useState(false);
  const oversattLabel = oversettelser?.[objekt.label];
  const oversattHjelpetekst = typeof objekt.config.helpText === "string" ? oversettelser?.[objekt.config.helpText] : undefined;

  // Gradert innrykk: ml-4 per nivå, maks ml-12
  const marginKlasse = nestingNivå > 0
    ? nestingNivå === 1 ? "ml-4" : nestingNivå === 2 ? "ml-8" : "ml-12"
    : "";
  const rammeKlasse = "";

  return (
    <div className={`rounded-lg bg-white p-4 shadow-sm ${marginKlasse} ${rammeKlasse}`}>
      {/* Label + påkrevd-badge + hjelpetekst + oversettelse */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-medium text-gray-900">{objekt.label}</span>
        {objekt.required && (
          <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
            Påkrevd
          </span>
        )}
        {typeof objekt.config.helpText === "string" && objekt.config.helpText && (
          <span className="group relative">
            <Info size={14} className="text-blue-400" />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-56 -translate-x-1/2 rounded bg-gray-800 px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block">
              {objekt.config.helpText as string}
              {visOversettelse && oversattHjelpetekst && (
                <span className="mt-1 block border-t border-gray-600 pt-1 italic text-blue-300">{oversattHjelpetekst}</span>
              )}
            </span>
          </span>
        )}
        {visOversettKnapp && (
          <button
            type="button"
            onClick={() => {
              if (!oversattLabel && onOversett) onOversett();
              setVisOversettelse((v) => !v);
            }}
            className="rounded p-0.5 hover:bg-blue-50"
          >
            {oversettelseLaster ? (
              <Loader2 size={14} className="animate-spin text-blue-400" />
            ) : (
              <Globe size={14} className={visOversettelse && oversattLabel ? "text-sitedoc-primary" : "text-blue-300"} />
            )}
          </button>
        )}
      </div>
      {visOversettelse && oversattLabel && (
        <p className="mb-1 text-xs italic text-blue-600">{oversattLabel}</p>
      )}

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
        bygningId={bygningId}
        standardTegningId={standardTegningId}
      />

      {/* Oppgave-badge eller +Oppgave-knapp */}
      {oppgaveNummer && oppgaveId ? (
        <button
          type="button"
          onClick={() => onNavigerTilOppgave?.(oppgaveId)}
          className="mt-2 inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 print-skjul"
        >
          {oppgaveNummer}
        </button>
      ) : !leseModus && onOpprettOppgave && !oppgaveNummer ? (
        <button
          type="button"
          onClick={onOpprettOppgave}
          className="mt-2 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-200 print-skjul"
        >
          <Plus size={12} />
          Oppgave
        </button>
      ) : null}
    </div>
  );
}

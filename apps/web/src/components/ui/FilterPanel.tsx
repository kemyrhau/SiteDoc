"use client";

import { SearchInput } from "@sitedoc/ui";
import { MultiComboks, type MultiComboksOption } from "@/components/ui/MultiComboks";

/**
 * Delt filter-panel — fritekst-søk øverst + N multi-select-combobox-er i grid
 * + «Tøm filter»-knapp. Presentasjonell: caller eier all state (URL eller lokal)
 * og passer ferdig-oversatte (t()) strenger. Ingen i18n eller datakobling inni.
 *
 * Standardiserer filter-blokka på tvers av HMS-/kontrollplan-flatene.
 * Referanse-komposisjon: firma-HMS-dashboardet (som nå bruker denne).
 */
export type FilterDimensjon = {
  id: string;
  /** Ferdig-oversatt etikett, f.eks. t("firma.hms.filter.prosjekt"). */
  label: string;
  options: MultiComboksOption[];
  valgte: string[];
  onToggle: (id: string) => void;
  placeholderSok?: string;
};

export function FilterPanel({
  sok,
  dimensjoner,
  tomLabel,
  onTom,
  visTom,
  kolonner = 2,
}: {
  /** Fritekst-søk øverst. Utelates hvis flaten ikke har fritekst. */
  sok?: { verdi: string; onChange: (v: string) => void; placeholder?: string };
  dimensjoner: FilterDimensjon[];
  /** Ferdig-oversatt «Tøm filter»-tekst. */
  tomLabel: string;
  onTom: () => void;
  /** Vis «Tøm filter» kun når noe er valgt/søkt. */
  visTom: boolean;
  kolonner?: 1 | 2 | 3;
}) {
  const gridKol =
    kolonner === 1 ? "md:grid-cols-1" : kolonner === 3 ? "md:grid-cols-3" : "md:grid-cols-2";

  return (
    <div className="space-y-3">
      {sok && (
        <SearchInput
          verdi={sok.verdi}
          onChange={sok.onChange}
          placeholder={sok.placeholder}
        />
      )}

      {dimensjoner.length > 0 && (
        <div className={`grid grid-cols-1 gap-3 ${gridKol}`}>
          {dimensjoner.map((d) => (
            <MultiComboks
              key={d.id}
              label={d.label}
              options={d.options}
              valgte={d.valgte}
              onToggle={d.onToggle}
              placeholderSok={d.placeholderSok}
            />
          ))}
        </div>
      )}

      {visTom && (
        <button
          type="button"
          onClick={onTom}
          className="text-xs text-sitedoc-primary hover:underline"
        >
          {tomLabel}
        </button>
      )}
    </div>
  );
}

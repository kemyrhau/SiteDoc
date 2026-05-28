// Delte HMS-UI-komponenter for prosjekt- og firma-nivå.

import type { DokumentRad } from "./types";

export function formaterDato(dato: string | null | undefined): string {
  if (!dato) return "—";
  return new Date(dato).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formaterLopenummer(rad: DokumentRad): string {
  return rad.number ? String(rad.number).padStart(3, "0") : "—";
}

/**
 * Bygger felt-oppslag basert på template.objects og rad.data.
 * Returnerer første matchende objekts verdi (typisk én rad per objekt-label på HMS-malene).
 */
export function hentDataVerdi(
  rad: DokumentRad,
  labelMatch: (label: string) => boolean,
): string {
  if (!rad.data || !rad.template?.objects) return "—";
  for (const obj of rad.template.objects) {
    if (labelMatch(obj.label)) {
      const verdi = rad.data[obj.id];
      if (verdi == null || verdi === "") continue;
      if (obj.type === "date" || obj.type === "date_time") {
        if (typeof verdi === "string") {
          try {
            return new Date(verdi).toLocaleDateString("nb-NO", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
          } catch {
            return verdi;
          }
        }
      }
      if (typeof verdi === "string") return verdi;
      if (Array.isArray(verdi)) return verdi.map(String).join(", ");
      return String(verdi);
    }
  }
  return "—";
}

export function KpiKort({
  ikon,
  tittel,
  verdi,
  variant = "neutral",
}: {
  ikon: React.ReactNode;
  tittel: string;
  verdi: number | string;
  variant?: "neutral" | "warning" | "danger";
}) {
  const farger = {
    neutral: "border-gray-200 bg-white",
    warning: "border-amber-200 bg-amber-50",
    danger: "border-red-200 bg-red-50",
  }[variant];
  const ikonFarge = {
    neutral: "text-gray-400",
    warning: "text-amber-600",
    danger: "text-red-600",
  }[variant];

  return (
    <div className={`flex items-center gap-3 rounded-lg border p-4 ${farger}`}>
      <div className={ikonFarge}>{ikon}</div>
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-wide text-gray-500">{tittel}</span>
        <span className="text-2xl font-semibold text-gray-900">{verdi}</span>
      </div>
    </div>
  );
}

export function MånedSøyler({
  data,
  label,
}: {
  data: { maned: string; antall: number }[];
  label: string;
}) {
  const maks = Math.max(1, ...data.map((d) => d.antall));
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">{label}</h3>
      <div className="flex items-end gap-2 h-32">
        {data.map((d) => {
          const hoyde = (d.antall / maks) * 100;
          return (
            <div key={d.maned} className="flex flex-1 flex-col items-center gap-1">
              <div className="text-xs text-gray-600">{d.antall || ""}</div>
              <div
                className="w-full bg-sitedoc-primary rounded-t"
                style={{
                  height: `${hoyde}%`,
                  minHeight: d.antall > 0 ? "4px" : "0",
                }}
              />
              <div className="text-xs text-gray-500">{d.maned}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FaggruppeBars({
  data,
  label,
  maks: maksAntall = 5,
}: {
  data: { navn: string; antall: number }[];
  label: string;
  maks?: number;
}) {
  const maks = Math.max(1, ...data.map((d) => d.antall));
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">{label}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500">—</p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.slice(0, maksAntall).map((d) => (
            <div key={d.navn} className="flex items-center gap-2">
              <div className="w-24 truncate text-xs text-gray-700">{d.navn}</div>
              <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden">
                <div
                  className="bg-sitedoc-secondary h-full"
                  style={{ width: `${(d.antall / maks) * 100}%` }}
                />
              </div>
              <div className="w-8 text-right text-xs text-gray-600">{d.antall}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

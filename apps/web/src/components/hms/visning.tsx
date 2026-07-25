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

// Felt-verdier lagres nestet som { verdi, kommentar, vedlegg } (se
// useSjekklisteSkjema/useOppgaveSkjema + endringslogg i oppgave.oppdaterData).
// Pakk ut selve verdien; tåler også flat legacy-lagring (verdi direkte).
function pakkUtVerdi(raw: unknown): unknown {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && "verdi" in raw) {
    return (raw as { verdi: unknown }).verdi;
  }
  return raw;
}

// Trekk ut lesbar tekst fra et objekt-lagret felt (person/liste kan lagres som
// { navn/label/... }) — unngår at cellen rendrer «[object Object]».
function lesbarObjekt(o: Record<string, unknown>): string {
  for (const key of ["navn", "name", "label", "tittel", "title", "value"]) {
    const v = o[key];
    if (typeof v === "string" && v) return v;
  }
  return "—";
}

function lesbarVerdi(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "Ja" : "Nei";
  if (Array.isArray(v)) {
    const deler = v.map(lesbarVerdi).filter((s) => s !== "—");
    return deler.length ? deler.join(", ") : "—";
  }
  if (typeof v === "object") return lesbarObjekt(v as Record<string, unknown>);
  return String(v);
}

/**
 * Bygger felt-oppslag basert på template.objects og rad.data.
 * Returnerer første matchende objekts verdi (typisk én rad per objekt-label på HMS-malene).
 *
 * `navneLookup` (bruker-/faggruppe-ID → navn) speiler mønsteret i oppgave-/
 * sjekkliste-lista slik at person-/firma-felt viser navn i stedet for rå ID.
 */
export function hentDataVerdi(
  rad: DokumentRad,
  labelMatch: (label: string) => boolean,
  navneLookup?: Map<string, string>,
): string {
  if (!rad.data || !rad.template?.objects) return "—";
  for (const obj of rad.template.objects) {
    if (!labelMatch(obj.label)) continue;
    const verdi = pakkUtVerdi(rad.data[obj.id]);
    if (verdi == null || verdi === "") continue;

    if ((obj.type === "date" || obj.type === "date_time") && typeof verdi === "string") {
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

    // Person/firma lagres som ID → slå opp navn når lookup er tilgjengelig.
    if ((obj.type === "person" || obj.type === "company") && typeof verdi === "string") {
      return navneLookup?.get(verdi) ?? lesbarVerdi(verdi);
    }
    if (obj.type === "persons" && Array.isArray(verdi)) {
      const navn = verdi
        .map((v) => navneLookup?.get(String(v)) ?? lesbarVerdi(v))
        .filter((s) => s !== "—");
      return navn.length ? navn.join(", ") : "—";
    }

    return lesbarVerdi(verdi);
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

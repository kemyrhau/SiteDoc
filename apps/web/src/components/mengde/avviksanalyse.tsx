"use client";

import { trpc } from "@/lib/trpc";

interface AvviksanalyseProps {
  projectId: string;
}

const STATUS_FARGE: Record<string, string> = {
  Match: "text-green-600",
  Endret: "text-amber-600",
  Ny: "text-blue-600",
  Fjernet: "text-red-600",
};

export function Avviksanalyse({ projectId }: AvviksanalyseProps) {
  const { data, isLoading } = trpc.mengde.hentAvviksanalyse.useQuery(
    { projectId },
    { enabled: !!projectId },
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-gray-400">
        Laster avviksanalyse...
      </div>
    );
  }

  if (!data || data.rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-gray-400">
        Ingen data for avviksanalyse. Importer anbudsgrunnlag og A-nota først.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.summary && (
        <div className="grid grid-cols-4 gap-3">
          <OppsummeringKort
            label="Total anbud"
            verdi={data.summary.totalAnbud}
          />
          <OppsummeringKort
            label="Total kontrakt"
            verdi={data.summary.totalKontrakt}
          />
          <OppsummeringKort
            label="Avvik"
            verdi={data.summary.totalDiff}
            farge={
              data.summary.totalDiff > 0
                ? "text-red-600"
                : data.summary.totalDiff < 0
                  ? "text-green-600"
                  : ""
            }
          />
          <div className="rounded border bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Status</div>
            <div className="mt-1 flex gap-3 text-xs">
              <span className="text-green-600">
                {data.summary.antallMatch} match
              </span>
              <span className="text-amber-600">
                {data.summary.antallEndret} endret
              </span>
              <span className="text-blue-600">
                {data.summary.antallNy} ny
              </span>
              <span className="text-red-600">
                {data.summary.antallFjernet} fjernet
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs font-medium uppercase text-gray-500">
              <th className="px-3 py-2">Nr</th>
              <th className="px-3 py-2">Beskrivelse</th>
              <th className="px-3 py-2">Enhet</th>
              <th className="px-3 py-2 text-right">Mengde anbud</th>
              <th className="px-3 py-2 text-right">Mengde kontrakt</th>
              <th className="px-3 py-2 text-right">Sum anbud</th>
              <th className="px-3 py-2 text-right">Sum kontrakt</th>
              <th className="px-3 py-2 text-right">Avvik</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((rad, i) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">
                  {rad.postnr ?? "—"}
                </td>
                <td className="max-w-xs truncate px-3 py-2">
                  {rad.beskrivelse ?? "—"}
                </td>
                <td className="px-3 py-2">{rad.enhet ?? "—"}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {fmt(rad.mengdeAnbud)}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {fmt(rad.mengdeKontrakt)}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {fmt(rad.sumAnbud)}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {fmt(rad.sumKontrakt)}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono ${
                    rad.sumDiff > 0
                      ? "text-red-600"
                      : rad.sumDiff < 0
                        ? "text-green-600"
                        : ""
                  }`}
                >
                  {fmt(rad.sumDiff)}
                </td>
                <td
                  className={`px-3 py-2 text-xs font-medium ${
                    STATUS_FARGE[rad.status] ?? ""
                  }`}
                >
                  {rad.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OppsummeringKort({
  label,
  verdi,
  farge,
}: {
  label: string;
  verdi: number;
  farge?: string;
}) {
  return (
    <div className="rounded border bg-gray-50 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${farge ?? ""}`}>
        {verdi.toLocaleString("nb-NO", { maximumFractionDigits: 0 })} kr
      </div>
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString("nb-NO", { maximumFractionDigits: 2 });
}

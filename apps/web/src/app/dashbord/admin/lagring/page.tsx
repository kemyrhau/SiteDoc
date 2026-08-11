"use client";

import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { formaterBytes, LAGRING_MODELLER, type LagringModell } from "@sitedoc/shared";

/**
 * Lagringsstatistikk — sitedoc-admin-flate (2026-08-11). Per firma × prosjekt ×
 * modell + standalone («uten firma») + foreldreløse. To totaler bevisst
 * forskjellige: fakturerbart (firma-eide prosjekter) vs faktisk diskbruk (alt).
 * Admin-området bruker plain strenger (internt verktøy) — ikke i18n.
 */

const MODELL_NAVN: Record<LagringModell, string> = {
  images: "Bilder",
  drawings: "Tegninger",
  drawing_revisions: "Tegn.rev.",
  point_clouds: "Punktsky",
  ftd_documents: "Dokumenter",
};

type PerModell = Record<LagringModell, { bytes: number; antall: number }>;

function ModellCeller({ perModell }: { perModell: PerModell }) {
  return (
    <>
      {LAGRING_MODELLER.map((m) => (
        <td key={m} className="px-2 py-1 text-right text-xs text-gray-600 tabular-nums">
          {perModell[m].antall > 0 ? formaterBytes(perModell[m].bytes) : "—"}
        </td>
      ))}
    </>
  );
}

export default function AdminLagringSide() {
  const { data, isLoading } = trpc.lagring.oversikt.useQuery();

  if (isLoading) {
    return (
      <div className="flex justify-center p-10">
        <Spinner />
      </div>
    );
  }
  if (!data) return <p className="p-6 text-sm text-gray-500">Ingen data.</p>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900">Lagringsstatistikk</h1>
      <p className="mt-1 text-sm text-gray-500">
        Aggregert ved forespørsel, cachet 1 time. Generert {new Date(data.generertVed).toLocaleString("nb-NO")}.
      </p>

      {/* Totaler — fakturerbart ≠ faktisk diskbruk (bevisst) */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-xs font-medium text-emerald-700">Fakturerbart volum</div>
          <div className="text-lg font-semibold text-emerald-900">{formaterBytes(data.fakturerbartBytes)}</div>
          <div className="text-[11px] text-emerald-700">Kun firma-eide prosjekter</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="text-xs font-medium text-gray-600">Faktisk diskbruk</div>
          <div className="text-lg font-semibold text-gray-900">{formaterBytes(data.faktiskDiskbrukBytes)}</div>
          <div className="text-[11px] text-gray-500">Alt, inkl. standalone + foreldreløse</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-xs font-medium text-gray-600">DB-volum (estimat)</div>
          <div className="text-lg font-semibold text-gray-900">{formaterBytes(data.dbVolumEstimatBytes)}</div>
          <div className="text-[11px] text-gray-500">Radtelling × grov snitt. Vises, prises ikke.</div>
        </div>
      </div>

      {/* Per firma × prosjekt × modell */}
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="px-2 py-1">Firma / prosjekt</th>
              {LAGRING_MODELLER.map((m) => (
                <th key={m} className="px-2 py-1 text-right">{MODELL_NAVN[m]}</th>
              ))}
              <th className="px-2 py-1 text-right">Sum</th>
              <th className="px-2 py-1 text-right">Filer</th>
            </tr>
          </thead>
          <tbody>
            {data.perFirma.map((f) => (
              <FirmaBlokk key={f.organizationId} f={f} />
            ))}

            {/* Standalone (uten firma) — ikke fakturerbart */}
            {data.utenFirma.prosjekter.length > 0 && (
              <>
                <tr className="bg-amber-50">
                  <td className="px-2 py-1.5 font-semibold text-amber-900" colSpan={LAGRING_MODELLER.length + 3}>
                    Uten firma (standalone / prøve) — ikke fakturerbart · {formaterBytes(data.utenFirma.totalBytes)}
                  </td>
                </tr>
                {data.utenFirma.prosjekter.map((p) => (
                  <tr key={p.projectId} className="border-b border-gray-50">
                    <td className="px-2 py-1 pl-6 text-gray-700">
                      {p.prosjektNavn ?? p.projectId}{p.prosjektNummer ? ` (${p.prosjektNummer})` : ""}
                    </td>
                    <ModellCeller perModell={p.perModell} />
                    <td className="px-2 py-1 text-right font-medium tabular-nums">{formaterBytes(p.totalBytes)}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-gray-500">{p.totalAntall}</td>
                  </tr>
                ))}
              </>
            )}

            {/* Foreldreløse — reell diskbruk, aldri fakturerbar */}
            {data.foreldrelose.antall > 0 && (
              <tr className="bg-red-50">
                <td className="px-2 py-1.5 font-medium text-red-900">
                  Ikke knyttet til dokument (foreldreløse)
                </td>
                <td className="px-2 py-1.5 text-right text-red-800" colSpan={LAGRING_MODELLER.length}>
                  {data.foreldrelose.antall} filer — kan ikke attribueres til prosjekt/firma
                </td>
                <td className="px-2 py-1.5 text-right font-semibold text-red-900 tabular-nums">
                  {formaterBytes(data.foreldrelose.bytes)}
                </td>
                <td className="px-2 py-1.5 text-right text-red-800 tabular-nums">{data.foreldrelose.antall}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Dekningsgrad — filer uten målt størrelse (file_size NULL). Reell restpost
          som ellers ville deflatert volumet stille. Fakturering krever 100 % dekning. */}
      {LAGRING_MODELLER.some((m) => data.manglerStorrelse[m] > 0) && (
        <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-orange-700">
            Mangler målt størrelse
          </div>
          <ul className="mt-1 space-y-0.5 text-sm text-orange-900">
            {LAGRING_MODELLER.filter((m) => data.manglerStorrelse[m] > 0).map((m) => (
              <li key={m}>
                {data.manglerStorrelse[m]} {MODELL_NAVN[m].toLowerCase()} mangler målt
                størrelse (ikke med i volumet)
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-orange-700">
            Fakturering mot volumet forutsetter 100 % dekning i firmaet.
          </p>
        </div>
      )}
    </div>
  );
}

function FirmaBlokk({
  f,
}: {
  f: {
    organizationId: string;
    firmaNavn: string;
    prosjekter: Array<{
      projectId: string | null;
      prosjektNavn: string | null;
      prosjektNummer: string | null;
      perModell: PerModell;
      totalBytes: number;
      totalAntall: number;
    }>;
    totalBytes: number;
    totalAntall: number;
  };
}) {
  return (
    <>
      <tr className="bg-gray-50">
        <td className="px-2 py-1.5 font-semibold text-gray-900">{f.firmaNavn}</td>
        <td className="px-2 py-1.5 text-right text-xs text-gray-500" colSpan={LAGRING_MODELLER.length}>
          {f.totalAntall} filer
        </td>
        <td className="px-2 py-1.5 text-right font-semibold text-gray-900 tabular-nums">{formaterBytes(f.totalBytes)}</td>
        <td className="px-2 py-1.5 text-right text-gray-500 tabular-nums">{f.totalAntall}</td>
      </tr>
      {f.prosjekter.map((p) => (
        <tr key={p.projectId} className="border-b border-gray-50">
          <td className="px-2 py-1 pl-6 text-gray-700">
            {p.prosjektNavn ?? p.projectId}{p.prosjektNummer ? ` (${p.prosjektNummer})` : ""}
          </td>
          <ModellCeller perModell={p.perModell} />
          <td className="px-2 py-1 text-right font-medium tabular-nums">{formaterBytes(p.totalBytes)}</td>
          <td className="px-2 py-1 text-right tabular-nums text-gray-500">{p.totalAntall}</td>
        </tr>
      ))}
    </>
  );
}

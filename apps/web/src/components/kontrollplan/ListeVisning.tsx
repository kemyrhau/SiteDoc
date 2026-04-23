"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronUp, ChevronDown, Filter } from "lucide-react";

interface Punkt {
  id: string;
  kontrollplanId: string;
  omradeId: string | null;
  milepelId: string | null;
  sjekklisteMalId: string;
  faggruppeId: string;
  fristUke: number | null;
  fristAar: number | null;
  status: string;
  avhengerAvId: string | null;
  sjekklisteMal: { id: string; name: string; prefix: string | null; kontrollomrade: string | null };
  faggruppe: { id: string; name: string; color: string | null };
  omrade: { id: string; navn: string; type: string } | null;
  sjekkliste: { id: string; status: string } | null;
  avhengerAv: { id: string; status: string; sjekklisteMal: { name: string }; omrade: { navn: string } | null } | null;
}

interface Milepel {
  id: string;
  navn: string;
  maalUke: number;
  maalAar: number;
}

interface ListeVisningProps {
  punkter: Punkt[];
  milepeler: Milepel[];
  onPunktKlikk: (punkt: Punkt) => void;
}

const statusFarger: Record<string, string> = {
  planlagt: "bg-gray-100 text-gray-700",
  pagar: "bg-blue-100 text-blue-700",
  utfort: "bg-amber-100 text-amber-700",
  godkjent: "bg-green-100 text-green-700",
};

const statusNokler: Record<string, string> = {
  planlagt: "kontrollplan.statusPlanlagt",
  pagar: "kontrollplan.statusPagar",
  utfort: "kontrollplan.statusUtfort",
  godkjent: "kontrollplan.statusGodkjent",
};

const kontrollomradeNavn: Record<string, string> = {
  fukt: "Fukt",
  brann: "Brann",
  konstruksjon: "Konstruksjon",
  geo: "Geoteknikk",
  grunnarbeid: "Grunnarbeid",
  sha: "SHA",
};

type SorterFelt = "mal" | "omrade" | "faggruppe" | "frist" | "status" | "milepel" | "kontrollomrade";
type SorterRetning = "asc" | "desc";

export function ListeVisning({ punkter, milepeler, onPunktKlikk }: ListeVisningProps) {
  const { t } = useTranslation();
  const [sorterFelt, setSorterFelt] = useState<SorterFelt>("frist");
  const [sorterRetning, setSorterRetning] = useState<SorterRetning>("asc");

  // Filtre (flervalg med checkboxer)
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [faggruppeFilter, setFaggruppeFilter] = useState<Set<string>>(new Set());
  const [omradeFilter, setOmradeFilter] = useState<Set<string>>(new Set());

  // Milepæl-map
  const milepelMap = useMemo(() => new Map(milepeler.map((m) => [m.id, m])), [milepeler]);

  // Unike verdier for filtre
  const unikeStatuser = useMemo(() => [...new Set(punkter.map((p) => p.status))].sort(), [punkter]);
  const unikeFaggrupper = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of punkter) map.set(p.faggruppeId, p.faggruppe.name);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [punkter]);
  const unikeOmrader = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of punkter) if (p.omrade) map.set(p.omradeId!, p.omrade.navn);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [punkter]);

  // Filtrerte + sorterte punkter
  const visbarePunkter = useMemo(() => {
    let resultat = punkter;
    if (statusFilter.size > 0) resultat = resultat.filter((p) => statusFilter.has(p.status));
    if (faggruppeFilter.size > 0) resultat = resultat.filter((p) => faggruppeFilter.has(p.faggruppeId));
    if (omradeFilter.size > 0) resultat = resultat.filter((p) => p.omradeId && omradeFilter.has(p.omradeId));

    const r = sorterRetning === "asc" ? 1 : -1;
    return [...resultat].sort((a, b) => {
      switch (sorterFelt) {
        case "mal": return r * a.sjekklisteMal.name.localeCompare(b.sjekklisteMal.name);
        case "omrade": return r * (a.omrade?.navn ?? "").localeCompare(b.omrade?.navn ?? "");
        case "faggruppe": return r * a.faggruppe.name.localeCompare(b.faggruppe.name);
        case "frist": {
          const aV = (a.fristAar ?? 9999) * 100 + (a.fristUke ?? 99);
          const bV = (b.fristAar ?? 9999) * 100 + (b.fristUke ?? 99);
          return r * (aV - bV);
        }
        case "status": return r * a.status.localeCompare(b.status);
        case "milepel": {
          const aM = a.milepelId ? milepelMap.get(a.milepelId)?.navn ?? "" : "";
          const bM = b.milepelId ? milepelMap.get(b.milepelId)?.navn ?? "" : "";
          return r * aM.localeCompare(bM);
        }
        case "kontrollomrade": return r * (a.sjekklisteMal.kontrollomrade ?? "").localeCompare(b.sjekklisteMal.kontrollomrade ?? "");
        default: return 0;
      }
    });
  }, [punkter, statusFilter, faggruppeFilter, omradeFilter, sorterFelt, sorterRetning, milepelMap]);

  function toggleSort(felt: SorterFelt) {
    if (sorterFelt === felt) {
      setSorterRetning(sorterRetning === "asc" ? "desc" : "asc");
    } else {
      setSorterFelt(felt);
      setSorterRetning("asc");
    }
  }

  if (punkter.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-gray-50/50">
            <SortFilterHeader
              label={t("kontrollplan.sjekklisteMal")}
              felt="mal"
              sorterFelt={sorterFelt}
              sorterRetning={sorterRetning}
              onSort={toggleSort}
            />
            <SortFilterHeader
              label={t("kontrollplan.omrade")}
              felt="omrade"
              sorterFelt={sorterFelt}
              sorterRetning={sorterRetning}
              onSort={toggleSort}
              filterVerdier={unikeOmrader.map(([id, navn]) => ({ id, label: navn }))}
              aktiveFilter={omradeFilter}
              onFilter={setOmradeFilter}
            />
            <SortFilterHeader
              label={t("kontrollplan.faggruppe")}
              felt="faggruppe"
              sorterFelt={sorterFelt}
              sorterRetning={sorterRetning}
              onSort={toggleSort}
              filterVerdier={unikeFaggrupper.map(([id, navn]) => ({ id, label: navn }))}
              aktiveFilter={faggruppeFilter}
              onFilter={setFaggruppeFilter}
            />
            <SortFilterHeader
              label={t("kontrollplan.milepel")}
              felt="milepel"
              sorterFelt={sorterFelt}
              sorterRetning={sorterRetning}
              onSort={toggleSort}
            />
            <SortFilterHeader
              label={t("kontrollplan.frist")}
              felt="frist"
              sorterFelt={sorterFelt}
              sorterRetning={sorterRetning}
              onSort={toggleSort}
            />
            <SortFilterHeader
              label="Kontrollomr."
              felt="kontrollomrade"
              sorterFelt={sorterFelt}
              sorterRetning={sorterRetning}
              onSort={toggleSort}
            />
            <SortFilterHeader
              label="Status"
              felt="status"
              sorterFelt={sorterFelt}
              sorterRetning={sorterRetning}
              onSort={toggleSort}
              filterVerdier={unikeStatuser.map((s) => ({ id: s, label: t(statusNokler[s] ?? s) }))}
              aktiveFilter={statusFilter}
              onFilter={setStatusFilter}
            />
          </tr>
        </thead>
        <tbody>
          {visbarePunkter.map((punkt) => {
            const milepel = punkt.milepelId ? milepelMap.get(punkt.milepelId) : null;
            return (
              <tr
                key={punkt.id}
                onClick={() => onPunktKlikk(punkt)}
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
              >
                <td className="py-2 px-3 text-sm">{punkt.sjekklisteMal.name}</td>
                <td className="py-2 px-3 text-sm text-gray-600">{punkt.omrade?.navn ?? "—"}</td>
                <td className="py-2 px-3 text-sm">
                  <span className="flex items-center gap-1.5">
                    {punkt.faggruppe.color && (
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: punkt.faggruppe.color }} />
                    )}
                    {punkt.faggruppe.name}
                  </span>
                </td>
                <td className="py-2 px-3 text-xs text-gray-500">{milepel?.navn ?? "—"}</td>
                <td className="py-2 px-3 text-sm text-gray-600">
                  {punkt.fristUke ? `U${punkt.fristUke}/${punkt.fristAar}` : "—"}
                </td>
                <td className="py-2 px-3 text-xs text-gray-500">
                  {punkt.sjekklisteMal.kontrollomrade
                    ? kontrollomradeNavn[punkt.sjekklisteMal.kontrollomrade] ?? punkt.sjekklisteMal.kontrollomrade
                    : "—"}
                </td>
                <td className="py-2 px-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusFarger[punkt.status] ?? ""}`}>
                    {t(statusNokler[punkt.status] ?? punkt.status)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Kolonne-header med sortering + filter-dropdown                     */
/* ------------------------------------------------------------------ */

function SortFilterHeader({
  label,
  felt,
  sorterFelt,
  sorterRetning,
  onSort,
  filterVerdier,
  aktiveFilter,
  onFilter,
}: {
  label: string;
  felt: SorterFelt;
  sorterFelt: SorterFelt;
  sorterRetning: SorterRetning;
  onSort: (felt: SorterFelt) => void;
  filterVerdier?: { id: string; label: string }[];
  aktiveFilter?: Set<string>;
  onFilter?: (filter: Set<string>) => void;
}) {
  const [filterAapen, setFilterAapen] = useState(false);
  const ref = useRef<HTMLTableHeaderCellElement>(null);
  const aktiv = sorterFelt === felt;
  const harFilter = aktiveFilter && aktiveFilter.size > 0;

  useEffect(() => {
    function lukk(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setFilterAapen(false);
    }
    if (filterAapen) document.addEventListener("mousedown", lukk);
    return () => document.removeEventListener("mousedown", lukk);
  }, [filterAapen]);

  function toggleFilter(id: string) {
    if (!onFilter || !aktiveFilter) return;
    const ny = new Set(aktiveFilter);
    if (ny.has(id)) ny.delete(id); else ny.add(id);
    onFilter(ny);
  }

  return (
    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 relative" ref={ref}>
      <span className="flex items-center gap-1">
        <button type="button" onClick={() => onSort(felt)} className="hover:text-gray-700 select-none flex items-center gap-1">
          {label}
          {aktiv && (sorterRetning === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </button>
        {filterVerdier && (
          <button
            type="button"
            onClick={() => setFilterAapen(!filterAapen)}
            className={`p-0.5 rounded hover:bg-gray-200 ${harFilter ? "text-sitedoc-primary" : "text-gray-400"}`}
          >
            <Filter className="h-3 w-3" />
          </button>
        )}
      </span>

      {filterAapen && filterVerdier && (
        <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg py-1 z-50 min-w-[150px]">
          <button
            type="button"
            onClick={() => { onFilter?.(new Set()); setFilterAapen(false); }}
            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${!harFilter ? "text-sitedoc-primary font-medium" : "text-gray-600"}`}
          >
            Alle
          </button>
          {filterVerdier.map((v) => (
            <label key={v.id} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={aktiveFilter?.has(v.id) ?? false}
                onChange={() => toggleFilter(v.id)}
                className="rounded text-sitedoc-primary h-3 w-3"
              />
              {v.label}
            </label>
          ))}
        </div>
      )}
    </th>
  );
}

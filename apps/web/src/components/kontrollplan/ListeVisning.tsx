"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronUp, ChevronDown } from "lucide-react";

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

  // Milepæl-map for oppslag
  const milepelMap = useMemo(() => new Map(milepeler.map((m) => [m.id, m])), [milepeler]);

  // Sorterte punkter
  const sortertePunkter = useMemo(() => {
    const r = sorterRetning === "asc" ? 1 : -1;
    return [...punkter].sort((a, b) => {
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
  }, [punkter, sorterFelt, sorterRetning, milepelMap]);

  function toggleSort(felt: SorterFelt) {
    if (sorterFelt === felt) {
      setSorterRetning(sorterRetning === "asc" ? "desc" : "asc");
    } else {
      setSorterFelt(felt);
      setSorterRetning("asc");
    }
  }

  function SortHeader({ felt, children }: { felt: SorterFelt; children: React.ReactNode }) {
    const aktiv = sorterFelt === felt;
    return (
      <th
        onClick={() => toggleSort(felt)}
        className="text-left py-2 px-3 text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none"
      >
        <span className="flex items-center gap-1">
          {children}
          {aktiv && (sorterRetning === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </span>
      </th>
    );
  }

  if (punkter.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-gray-50/50">
            <SortHeader felt="mal">{t("kontrollplan.sjekklisteMal")}</SortHeader>
            <SortHeader felt="omrade">{t("kontrollplan.omrade")}</SortHeader>
            <SortHeader felt="faggruppe">{t("kontrollplan.faggruppe")}</SortHeader>
            <SortHeader felt="milepel">{t("kontrollplan.milepel")}</SortHeader>
            <SortHeader felt="frist">{t("kontrollplan.frist")}</SortHeader>
            <SortHeader felt="kontrollomrade">{t("kontrollplan.omrade")}</SortHeader>
            <SortHeader felt="status">Status</SortHeader>
          </tr>
        </thead>
        <tbody>
          {sortertePunkter.map((punkt) => {
            const milepel = punkt.milepelId ? milepelMap.get(punkt.milepelId) : null;
            return (
              <tr
                key={punkt.id}
                onClick={() => onPunktKlikk(punkt)}
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
              >
                <td className="py-2 px-3 text-sm">
                  {punkt.sjekklisteMal.name}
                </td>
                <td className="py-2 px-3 text-sm text-gray-600">
                  {punkt.omrade?.navn ?? "—"}
                </td>
                <td className="py-2 px-3 text-sm">
                  <span className="flex items-center gap-1.5">
                    {punkt.faggruppe.color && (
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: punkt.faggruppe.color }} />
                    )}
                    {punkt.faggruppe.name}
                  </span>
                </td>
                <td className="py-2 px-3 text-xs text-gray-500">
                  {milepel ? milepel.navn : "—"}
                </td>
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

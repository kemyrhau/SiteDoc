"use client";

import { useTranslation } from "react-i18next";

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

interface ListeVisningProps {
  punkter: Punkt[];
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

export function ListeVisning({ punkter, onPunktKlikk }: ListeVisningProps) {
  const { t } = useTranslation();

  if (punkter.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-gray-50/50">
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">{t("kontrollplan.sjekklisteMal")}</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">{t("kontrollplan.omrade")}</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">{t("kontrollplan.faggruppe")}</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">{t("kontrollplan.frist")}</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">{t("kontrollplan.status")}</th>
          </tr>
        </thead>
        <tbody>
          {punkter.map((punkt) => (
            <tr
              key={punkt.id}
              onClick={() => onPunktKlikk(punkt)}
              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
            >
              <td className="py-2 px-3 text-sm">
                {punkt.sjekklisteMal.prefix ? (
                  <span className="text-gray-400 mr-1">{punkt.sjekklisteMal.prefix}</span>
                ) : null}
                {punkt.sjekklisteMal.name}
              </td>
              <td className="py-2 px-3 text-sm text-gray-600">
                {punkt.omrade?.navn ?? "—"}
              </td>
              <td className="py-2 px-3 text-sm">
                <span className="flex items-center gap-1.5">
                  {punkt.faggruppe.color && (
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: punkt.faggruppe.color }} />
                  )}
                  {punkt.faggruppe.name}
                </span>
              </td>
              <td className="py-2 px-3 text-sm text-gray-600">
                {punkt.fristUke ? `U${punkt.fristUke}/${punkt.fristAar}` : "—"}
              </td>
              <td className="py-2 px-3">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusFarger[punkt.status] ?? ""}`}>
                  {t(statusNokler[punkt.status] ?? punkt.status)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

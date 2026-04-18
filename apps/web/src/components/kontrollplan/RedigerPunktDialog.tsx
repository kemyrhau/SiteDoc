"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { X, Trash2 } from "lucide-react";
import { UkeVelger } from "./UkeVelger";

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

interface RedigerPunktDialogProps {
  punkt: Punkt;
  allePunkter: Punkt[];
  onLukk: () => void;
  onOppdatert: () => void;
}

const statusFarger: Record<string, string> = {
  planlagt: "bg-gray-100 text-gray-700",
  pagar: "bg-blue-100 text-blue-700",
  utfort: "bg-amber-100 text-amber-700",
  godkjent: "bg-green-100 text-green-700",
};

const gyldigeOverganger: Record<string, string[]> = {
  planlagt: ["pagar"],
  pagar: ["utfort", "planlagt"],
  utfort: ["godkjent", "pagar"],
  godkjent: [],
};

export function RedigerPunktDialog({ punkt, allePunkter, onLukk, onOppdatert }: RedigerPunktDialogProps) {
  const { t } = useTranslation();
  const [fristUke, setFristUke] = useState(punkt.fristUke);
  const [fristAar, setFristAar] = useState(punkt.fristAar);
  const [avhengerAvId, setAvhengerAvId] = useState(punkt.avhengerAvId ?? "");

  const oppdaterPunkt = trpc.kontrollplan.oppdaterPunkt.useMutation({
    onSuccess: () => {
      onOppdatert();
      onLukk();
    },
  });

  const slettPunkt = trpc.kontrollplan.slettPunkt.useMutation({
    onSuccess: () => {
      onOppdatert();
      onLukk();
    },
  });

  // Avhengighets-kandidater: alle andre punkter, gruppert etter område
  const avhengighetsKandidater = useMemo(() => {
    const andre = allePunkter.filter((p) => p.id !== punkt.id);
    const gruppert = new Map<string, Punkt[]>();
    for (const p of andre) {
      const key = p.omrade?.navn ?? "—";
      if (!gruppert.has(key)) gruppert.set(key, []);
      gruppert.get(key)!.push(p);
    }
    return gruppert;
  }, [allePunkter, punkt.id]);

  function handleStatusEndring(nyStatus: string) {
    oppdaterPunkt.mutate({ punktId: punkt.id, status: nyStatus as "planlagt" | "pagar" | "utfort" | "godkjent" });
  }

  function handleLagreFrist() {
    oppdaterPunkt.mutate({ punktId: punkt.id, fristUke, fristAar });
  }

  function handleLagreAvhengighet() {
    oppdaterPunkt.mutate({ punktId: punkt.id, avhengerAvId: avhengerAvId || null });
  }

  const statusIkon = (s: string) => {
    if (s === "godkjent") return "✅";
    if (s === "utfort") return "🟠";
    if (s === "pagar") return "🟡";
    return "⬜";
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center pt-[10vh]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold">{t("kontrollplan.rediger")}</h2>
          <button onClick={onLukk} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Info */}
          <div className="text-sm">
            <div className="font-medium">
              {punkt.sjekklisteMal.prefix ? `${punkt.sjekklisteMal.prefix} — ` : ""}
              {punkt.sjekklisteMal.name}
            </div>
            <div className="text-gray-500 text-xs mt-0.5">
              {punkt.omrade?.navn ?? "—"} · {punkt.faggruppe.name}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">{t("kontrollplan.status")}</label>
            <div className="flex gap-2">
              {(["planlagt", "pagar", "utfort", "godkjent"] as const).map((s) => {
                const erAktiv = punkt.status === s;
                const kanBytte = gyldigeOverganger[punkt.status]?.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => kanBytte && handleStatusEndring(s)}
                    disabled={!kanBytte && !erAktiv}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                      erAktiv
                        ? statusFarger[s] + " ring-2 ring-sitedoc-primary/40"
                        : kanBytte
                          ? "bg-gray-50 text-gray-500 hover:bg-gray-100 cursor-pointer"
                          : "bg-gray-50 text-gray-300 cursor-not-allowed"
                    }`}
                  >
                    {t(`kontrollplan.status${s.charAt(0).toUpperCase() + s.slice(1)}` as "kontrollplan.statusPlanlagt")}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Frist */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">{t("kontrollplan.frist")}</label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <UkeVelger
                  uke={fristUke}
                  aar={fristAar}
                  onChange={(u, a) => { setFristUke(u || null); setFristAar(a || null); }}
                  placeholder={t("kontrollplan.frist") + "..."}
                />
              </div>
              <button
                onClick={handleLagreFrist}
                disabled={oppdaterPunkt.isPending}
                className="mt-4 px-2 py-1 text-xs bg-sitedoc-primary text-white rounded disabled:opacity-50"
              >
                {t("handling.lagre")}
              </button>
            </div>
          </div>

          {/* Avhengighet */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">{t("kontrollplan.avhengighet")}</label>
            <select
              value={avhengerAvId}
              onChange={(e) => setAvhengerAvId(e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-sm"
            >
              <option value="">{t("kontrollplan.ingenAvhengighet")}</option>
              {[...avhengighetsKandidater.entries()].map(([omradeNavn, punkter]) => (
                <optgroup key={omradeNavn} label={omradeNavn}>
                  {punkter.map((p) => (
                    <option key={p.id} value={p.id}>
                      {statusIkon(p.status)} {p.sjekklisteMal.name}
                      {p.fristUke ? ` — U${p.fristUke}` : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {avhengerAvId !== (punkt.avhengerAvId ?? "") && (
              <button
                onClick={handleLagreAvhengighet}
                disabled={oppdaterPunkt.isPending}
                className="mt-1 px-2 py-1 text-xs bg-sitedoc-primary text-white rounded disabled:opacity-50"
              >
                {t("handling.lagre")}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t">
          {punkt.status === "planlagt" ? (
            <button
              onClick={() => slettPunkt.mutate({ punktId: punkt.id })}
              disabled={slettPunkt.isPending}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              {t("kontrollplan.slettPunkt")}
            </button>
          ) : (
            <div />
          )}
          <button onClick={onLukk} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">
            {t("handling.lukk")}
          </button>
        </div>
      </div>
    </div>
  );
}

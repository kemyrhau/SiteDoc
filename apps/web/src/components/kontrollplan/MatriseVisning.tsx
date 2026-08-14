"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Pencil } from "lucide-react";
import { avledPunktFremdrift, avledPunktTilstand, isoUkeRef, type UkeRef } from "@/lib/kontrollplanFremdrift";

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
  varselUkerFor: number;
  avhengerAvId: string | null;
  dokumentflytId: string | null;
  drawingId: string | null;
  sjekklisteMal: { id: string; name: string; prefix: string | null; kontrollomrade: string | null };
  faggruppe: { id: string; name: string; color: string | null };
  omrade: { id: string; navn: string; type: string } | null;
  sjekkliste: { id: string; status: string; dokumentflytId: string | null; dokumentflyt: { id: string; name: string } | null } | null;
  dokumentflyt: { id: string; name: string } | null;
  drawing: { id: string; name: string } | null;
  avhengerAv: { id: string; status: string; sjekklisteMal: { name: string }; omrade: { navn: string } | null } | null;
}

interface Milepel {
  id: string;
  navn: string;
  maalUke: number;
  maalAar: number;
}

interface MatriseVisningProps {
  punkter: Punkt[];
  milepeler: Milepel[];
  onPunktKlikk: (punkt: Punkt) => void;
  onMilepelRediger?: (milepelId: string, navn: string, maalUke: number, maalAar: number) => void;
}

// Sjekk om punkt er blokkert av avhengighet
function erBlokkert(punkt: Punkt): boolean {
  if (!punkt.avhengerAv) return false;
  return punkt.avhengerAv.status !== "godkjent";
}

function StatusCelle({ punkt, naa, onClick }: { punkt: Punkt; naa: UkeRef; onClick: () => void }) {
  const { t } = useTranslation();
  const blokkert = erBlokkert(punkt);
  // Samme avledede tilstand (fremdrift × frist) som lista og tegningsmarkøren.
  const tilstand = avledPunktTilstand(punkt, naa);
  // Blokkert (uinnfridd avhengighet) overstyrer visuelt — grå/låst.
  const farge = blokkert ? "#9ca3af" : tilstand.farge;
  const tittel = blokkert
    ? `${punkt.faggruppe.name} — ${t("kontrollplan.blokkertAvAvhengighet")}`
    : `${punkt.faggruppe.name} — ${t(tilstand.labelKey)}${punkt.fristUke ? ` (U${punkt.fristUke})` : ""}`;

  return (
    <button
      onClick={onClick}
      className="w-full px-2 py-1.5 text-xs rounded hover:ring-2 hover:ring-sitedoc-primary/30 transition-all text-left"
      style={{ backgroundColor: `${farge}1a` }}
      title={tittel}
    >
      <span className="inline-flex items-center gap-1">
        <span
          aria-hidden
          className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
          style={{ backgroundColor: !blokkert && tilstand.fylt ? farge : "transparent", border: `2px solid ${farge}` }}
        />
        {punkt.fristUke ? `U${punkt.fristUke}` : ""}
      </span>
      <div className="text-[10px] truncate opacity-70">{punkt.faggruppe.name}</div>
    </button>
  );
}

export function MatriseVisning({ punkter, milepeler, onPunktKlikk, onMilepelRediger }: MatriseVisningProps) {
  const { t } = useTranslation();
  const naa = useMemo(() => isoUkeRef(new Date()), []);

  // Bygg matrise-data: grupper etter milepæl, finn unike områder og maler
  const matriseData = useMemo(() => {
    // Grupper punkter etter milepelId
    const grupper = new Map<string | null, Punkt[]>();
    for (const p of punkter) {
      const key = p.milepelId;
      if (!grupper.has(key)) grupper.set(key, []);
      grupper.get(key)!.push(p);
    }

    // Bygg seksjoner (milepæler + "uten milepæl")
    const seksjoner: {
      milepel: Milepel | null;
      omrader: { id: string | null; navn: string }[];
      maler: { id: string; name: string; prefix: string | null }[];
      punktMap: Map<string, Punkt>; // key = `${omradeId}:${malId}`
      fremdrift: Map<string, { godkjent: number; total: number }>;
    }[] = [];

    // Sorterte milepæler først, deretter null
    const milepelIder = [...milepeler.map((m) => m.id), null];
    for (const mid of milepelIder) {
      const seksjonPunkter = grupper.get(mid);
      if (!seksjonPunkter || seksjonPunkter.length === 0) continue;

      const milepel = mid ? milepeler.find((m) => m.id === mid) ?? null : null;

      // Finn unike områder og maler
      const omradeMap = new Map<string | null, string>();
      const malMap = new Map<string, { id: string; name: string; prefix: string | null }>();
      for (const p of seksjonPunkter) {
        omradeMap.set(p.omradeId, p.omrade?.navn ?? "—");
        malMap.set(p.sjekklisteMalId, p.sjekklisteMal);
      }

      const omrader = [...omradeMap.entries()].map(([id, navn]) => ({ id, navn }));
      const maler = [...malMap.values()];

      // Punkt-map og fremdrift
      const punktMap = new Map<string, Punkt>();
      const fremdrift = new Map<string, { godkjent: number; total: number }>();
      for (const p of seksjonPunkter) {
        punktMap.set(`${p.omradeId}:${p.sjekklisteMalId}`, p);
        const fKey = p.sjekklisteMalId;
        if (!fremdrift.has(fKey)) fremdrift.set(fKey, { godkjent: 0, total: 0 });
        const f = fremdrift.get(fKey)!;
        f.total++;
        if (avledPunktFremdrift(p) === "godkjent") f.godkjent++;
      }

      seksjoner.push({ milepel, omrader, maler, punktMap, fremdrift });
    }

    return seksjoner;
  }, [punkter, milepeler]);

  if (punkter.length === 0) return null;

  return (
    <div className="space-y-6">
      {matriseData.map((seksjon, idx) => {
        const totalGodkjent = [...seksjon.fremdrift.values()].reduce((s, f) => s + f.godkjent, 0);
        const totalAlle = [...seksjon.fremdrift.values()].reduce((s, f) => s + f.total, 0);
        const prosent = totalAlle > 0 ? Math.round((totalGodkjent / totalAlle) * 100) : 0;

        return (
          <div key={seksjon.milepel?.id ?? `uten-${idx}`}>
            {/* Seksjon-header */}
            <div className="flex items-center gap-3 mb-2 px-1">
              <div className="h-px flex-1 bg-gray-300" />
              {seksjon.milepel ? (
                <MilepelHeader
                  milepel={seksjon.milepel}
                  onRediger={onMilepelRediger}
                />
              ) : (
                <span className="text-sm font-semibold text-gray-700">
                  {t("kontrollplan.utenMilepel")}
                </span>
              )}
              <span className="text-xs text-gray-500">{prosent}%</span>
              <div className="h-px flex-1 bg-gray-300" />
            </div>

            {/* Matrise-tabell */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-500 w-40">
                      {t("kontrollplan.omrade")}
                    </th>
                    {seksjon.maler.map((mal) => (
                      <th key={mal.id} className="text-left py-1.5 px-2 text-xs font-medium text-gray-500 min-w-[120px]">
                        {mal.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {seksjon.omrader.map((omrade) => (
                    <tr key={omrade.id ?? "null"} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="py-1 px-2 text-xs font-medium text-gray-700 truncate max-w-[160px]">
                        {omrade.navn}
                      </td>
                      {seksjon.maler.map((mal) => {
                        const punkt = seksjon.punktMap.get(`${omrade.id}:${mal.id}`);
                        return (
                          <td key={mal.id} className="py-1 px-1">
                            {punkt ? (
                              <StatusCelle punkt={punkt} naa={naa} onClick={() => onPunktKlikk(punkt)} />
                            ) : (
                              <div className="w-full h-8" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t">
                    <td className="py-1 px-2 text-[10px] text-gray-400 font-medium">
                      {t("kontrollplan.fremdrift")}
                    </td>
                    {seksjon.maler.map((mal) => {
                      const f = seksjon.fremdrift.get(mal.id);
                      return (
                        <td key={mal.id} className="py-1 px-2 text-[10px] text-gray-400">
                          {f ? `${f.godkjent}/${f.total} (${f.total > 0 ? Math.round((f.godkjent / f.total) * 100) : 0}%)` : ""}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}

      {/* Statusforklaring */}
      <div className="flex items-center gap-4 text-[10px] text-gray-400 px-1 pt-2 border-t border-gray-100">
        <span>✅ {t("kontrollplan.statusGodkjent")}</span>
        <span>🟡 {t("kontrollplan.statusPagar")}</span>
        <span>⬜ {t("kontrollplan.statusPlanlagt")}</span>
        <span>🔒 {t("kontrollplan.statusBlokkert")}</span>
        <span>🔴 {t("kontrollplan.statusForfalt")}</span>
      </div>
    </div>
  );
}

/* Inline-redigerbar milepæl-overskrift */
function MilepelHeader({
  milepel,
  onRediger,
}: {
  milepel: Milepel;
  onRediger?: (id: string, navn: string, maalUke: number, maalAar: number) => void;
}) {
  const { t } = useTranslation();
  const [redigerer, setRedigerer] = useState(false);
  const [navn, setNavn] = useState(milepel.navn);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (redigerer) inputRef.current?.focus();
  }, [redigerer]);

  function lagre() {
    if (navn.trim() && onRediger) {
      onRediger(milepel.id, navn.trim(), milepel.maalUke, milepel.maalAar);
    }
    setRedigerer(false);
  }

  if (redigerer) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={navn}
        onChange={(e) => setNavn(e.target.value)}
        onBlur={lagre}
        onKeyDown={(e) => { if (e.key === "Enter") lagre(); if (e.key === "Escape") { setNavn(milepel.navn); setRedigerer(false); } }}
        className="text-sm font-semibold text-gray-700 border-b-2 border-sitedoc-primary bg-transparent outline-none px-1"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setRedigerer(true)}
      className="text-sm font-semibold text-gray-700 hover:text-sitedoc-primary group flex items-center gap-1"
      title={t("kontrollplan.rediger")}
    >
      {milepel.navn} ({t("kontrollplan.maalUke", { uke: milepel.maalUke })})
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
    </button>
  );
}

"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";

interface ImportSammenligningProps {
  prosjektId: string;
  dokumenter: Array<{
    id: string;
    filename: string;
    docType: string | null;
    notaType: string | null;
    notaNr: number | null;
    kontraktId: string | null;
    kontraktNavn: string | null;
  }>;
  kontraktId: string | null;
}

type Rad = {
  postnr: string;
  venstreBeskr: string | null;
  hoyreBeskr: string | null;
  venstreEnhet: string | null;
  hoyreEnhet: string | null;
  venstreMengde: number | null;
  hoyreMengde: number | null;
  venstrePris: number | null;
  hoyrePris: number | null;
  venstreSum: number | null;
  hoyreSum: number | null;
  status: "match" | "avvik-pris" | "avvik-mengde" | "avvik-begge" | "kun-venstre" | "kun-hoyre";
};

function fmt(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function num(v: unknown): number | null {
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export function ImportSammenligning({ prosjektId, dokumenter, kontraktId }: ImportSammenligningProps) {
  const { t } = useTranslation();
  const filtrert = kontraktId
    ? dokumenter.filter((d) => d.kontraktId === kontraktId)
    : dokumenter;

  const [venstreId, setVenstreId] = useState<string>("");
  const [hoyreId, setHoyreId] = useState<string>("");
  const [visKunAvvik, setVisKunAvvik] = useState(true);

  const venstreQuery = trpc.mengde.hentSpecPoster.useQuery(
    { projectId: prosjektId, dokumentId: venstreId },
    { enabled: !!venstreId },
  );
  const hoyreQuery = trpc.mengde.hentSpecPoster.useQuery(
    { projectId: prosjektId, dokumentId: hoyreId },
    { enabled: !!hoyreId },
  );

  const rader = useMemo<Rad[]>(() => {
    if (!venstreQuery.data || !hoyreQuery.data) return [];

    const venstreMap = new Map<string, (typeof venstreQuery.data)[0]>();
    for (const p of venstreQuery.data) {
      if (p.postnr) venstreMap.set(p.postnr, p);
    }
    const hoyreMap = new Map<string, (typeof hoyreQuery.data)[0]>();
    for (const p of hoyreQuery.data) {
      if (p.postnr) hoyreMap.set(p.postnr, p);
    }

    const allePostnr = new Set([...venstreMap.keys(), ...hoyreMap.keys()]);
    const sorted = [...allePostnr].sort();

    return sorted.map((postnr) => {
      const v = venstreMap.get(postnr);
      const h = hoyreMap.get(postnr);

      const vPris = num(v?.enhetspris);
      const hPris = num(h?.enhetspris);
      const vMengde = num(v?.mengdeAnbud);
      const hMengde = num(h?.mengdeAnbud);
      const vSum = num(v?.sumAnbud);
      const hSum = num(h?.sumAnbud);

      let status: Rad["status"] = "match";
      if (!v) status = "kun-hoyre";
      else if (!h) status = "kun-venstre";
      else {
        const prisAvvik = vPris !== null && hPris !== null && Math.abs(vPris - hPris) > 0.01;
        const mengdeAvvik = vMengde !== null && hMengde !== null && Math.abs(vMengde - hMengde) > 0.01;
        if (prisAvvik && mengdeAvvik) status = "avvik-begge";
        else if (prisAvvik) status = "avvik-pris";
        else if (mengdeAvvik) status = "avvik-mengde";
      }

      return {
        postnr,
        venstreBeskr: v?.beskrivelse ?? null,
        hoyreBeskr: h?.beskrivelse ?? null,
        venstreEnhet: v?.enhet ?? null,
        hoyreEnhet: h?.enhet ?? null,
        venstreMengde: vMengde,
        hoyreMengde: hMengde,
        venstrePris: vPris,
        hoyrePris: hPris,
        venstreSum: vSum,
        hoyreSum: hSum,
        status,
      };
    });
  }, [venstreQuery.data, hoyreQuery.data]);

  const synligeRader = visKunAvvik ? rader.filter((r) => r.status !== "match") : rader;

  const oppsummering = useMemo(() => {
    const match = rader.filter((r) => r.status === "match").length;
    const avvik = rader.filter((r) => r.status.startsWith("avvik")).length;
    const kunV = rader.filter((r) => r.status === "kun-venstre").length;
    const kunH = rader.filter((r) => r.status === "kun-hoyre").length;
    return { match, avvik, kunV, kunH, totalt: rader.length };
  }, [rader]);

  function dokLabel(d: (typeof filtrert)[0]) {
    const type = d.notaType === "Sluttnota" ? "Sluttnota" : d.docType === "anbudsgrunnlag" ? "Anbud" : `A-Nota ${d.notaNr ?? ""}`;
    const ext = d.filename.split(".").pop()?.toUpperCase() ?? "";
    return `${type} (${ext}) — ${d.filename}`;
  }

  const FARGE: Record<string, string> = {
    match: "",
    "avvik-pris": "bg-amber-50",
    "avvik-mengde": "bg-orange-50",
    "avvik-begge": "bg-red-50",
    "kun-venstre": "bg-blue-50",
    "kun-hoyre": "bg-purple-50",
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t("mengde.sammenligning.venstre")}</label>
          <select
            className="w-full rounded border px-2 py-1.5 text-sm"
            value={venstreId}
            onChange={(e) => setVenstreId(e.target.value)}
          >
            <option value="">Velg dokument...</option>
            {filtrert.map((d) => (
              <option key={d.id} value={d.id}>{dokLabel(d)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t("mengde.sammenligning.hoyre")}</label>
          <select
            className="w-full rounded border px-2 py-1.5 text-sm"
            value={hoyreId}
            onChange={(e) => setHoyreId(e.target.value)}
          >
            <option value="">Velg dokument...</option>
            {filtrert.map((d) => (
              <option key={d.id} value={d.id}>{dokLabel(d)}</option>
            ))}
          </select>
        </div>
      </div>

      {rader.length > 0 && (
        <>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-green-600">{t("mengde.sammenligning.antallMatch", { antall: oppsummering.match })}</span>
            <span className="text-amber-600">{t("mengde.sammenligning.antallAvvik", { antall: oppsummering.avvik })}</span>
            <span className="text-blue-600">{t("mengde.sammenligning.antallKunA", { antall: oppsummering.kunV })}</span>
            <span className="text-purple-600">{t("mengde.sammenligning.antallKunB", { antall: oppsummering.kunH })}</span>
            <span className="text-gray-400">{t("mengde.sammenligning.antallTotalt", { antall: oppsummering.totalt })}</span>
            <label className="ml-auto flex items-center gap-1.5 text-gray-500">
              <input type="checkbox" checked={visKunAvvik} onChange={(e) => setVisKunAvvik(e.target.checked)} />
              {t("mengde.sammenligning.visKunAvvik")}
            </label>
          </div>

          <div className="max-h-[60vh] overflow-auto rounded border">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase text-gray-500">
                <tr>
                  <th className="px-2 py-1.5">{t("mengde.sammenligning.postnr")}</th>
                  <th className="px-2 py-1.5">{t("mengde.sammenligning.enh")}</th>
                  <th className="px-2 py-1.5 text-right">{t("mengde.sammenligning.mengdeA")}</th>
                  <th className="px-2 py-1.5 text-right">{t("mengde.sammenligning.mengdeB")}</th>
                  <th className="px-2 py-1.5 text-right">{t("mengde.sammenligning.prisA")}</th>
                  <th className="px-2 py-1.5 text-right">{t("mengde.sammenligning.prisB")}</th>
                  <th className="px-2 py-1.5 text-right">{t("mengde.sammenligning.sumA")}</th>
                  <th className="px-2 py-1.5 text-right">{t("mengde.sammenligning.sumB")}</th>
                  <th className="px-2 py-1.5">{t("papirkurv.kolonne.status")}</th>
                </tr>
              </thead>
              <tbody>
                {synligeRader.map((r) => (
                  <tr key={r.postnr} className={`border-b ${FARGE[r.status] ?? ""}`}>
                    <td className="px-2 py-1 font-mono">{r.postnr}</td>
                    <td className="px-2 py-1">{r.venstreEnhet ?? r.hoyreEnhet ?? "—"}</td>
                    <td className={`px-2 py-1 text-right font-mono ${r.status.includes("mengde") || r.status === "avvik-begge" ? "font-semibold text-orange-700" : ""}`}>
                      {fmt(r.venstreMengde)}
                    </td>
                    <td className={`px-2 py-1 text-right font-mono ${r.status.includes("mengde") || r.status === "avvik-begge" ? "font-semibold text-orange-700" : ""}`}>
                      {fmt(r.hoyreMengde)}
                    </td>
                    <td className={`px-2 py-1 text-right font-mono ${r.status.includes("pris") || r.status === "avvik-begge" ? "font-semibold text-amber-700" : ""}`}>
                      {fmt(r.venstrePris)}
                    </td>
                    <td className={`px-2 py-1 text-right font-mono ${r.status.includes("pris") || r.status === "avvik-begge" ? "font-semibold text-amber-700" : ""}`}>
                      {fmt(r.hoyrePris)}
                    </td>
                    <td className="px-2 py-1 text-right font-mono">{fmt(r.venstreSum)}</td>
                    <td className="px-2 py-1 text-right font-mono">{fmt(r.hoyreSum)}</td>
                    <td className="px-2 py-1">
                      <span className={`text-[10px] font-medium ${
                        r.status === "match" ? "text-green-600"
                        : r.status.startsWith("kun") ? "text-blue-600"
                        : "text-amber-600"
                      }`}>
                        {r.status === "match" ? "OK" : r.status === "kun-venstre" ? "Kun A" : r.status === "kun-hoyre" ? "Kun B" : "Avvik"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(venstreQuery.isLoading || hoyreQuery.isLoading) && (
        <div className="py-8 text-center text-sm text-gray-400">Laster poster...</div>
      )}

      {venstreId && hoyreId && rader.length === 0 && !venstreQuery.isLoading && !hoyreQuery.isLoading && (
        <div className="py-8 text-center text-sm text-gray-400">{t("mengde.sammenligning.ingenPoster")}</div>
      )}

      {(!venstreId || !hoyreId) && (
        <div className="py-8 text-center text-sm text-gray-400">
          {t("mengde.sammenligning.velgTo")}
        </div>
      )}
    </div>
  );
}

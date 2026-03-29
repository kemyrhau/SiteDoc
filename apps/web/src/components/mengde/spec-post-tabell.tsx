"use client";

import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, X } from "lucide-react";

interface SpecPost {
  id: string;
  postnr: string | null;
  beskrivelse: string | null;
  enhet: string | null;
  mengdeAnbud: unknown;
  enhetspris: unknown;
  sumAnbud: unknown;
  mengdeDenne?: unknown;
  mengdeTotal?: unknown;
  verdiDenne?: unknown;
  verdiTotal?: unknown;
  prosentFerdig?: unknown;
  nsKode: string | null;
  nsTittel: string | null;
  fullNsTekst: string | null;
  eksternNotat: string | null;
}

interface SpecPostTabellProps {
  poster: SpecPost[];
  sammenligningPoster?: SpecPost[];
  sammenligningLabel?: string;
  onVelgPost: (postId: string) => void;
  valgtPostId: string | null;
}

type SorterFelt =
  | "postnr"
  | "beskrivelse"
  | "enhet"
  | "mengdeAnbud"
  | "enhetspris"
  | "sumAnbud";
type SorterRetning = "asc" | "desc";

interface SammenlignetRad {
  budsjett: SpecPost;
  nota: SpecPost | null;
  mengdeDenne: number;
  mengdeTotal: number;
  verdiDenne: number;
  verdiTotal: number;
  prosentFerdig: number;
  sumAvvik: number;
}

export function SpecPostTabell({
  poster,
  sammenligningPoster,
  sammenligningLabel,
  onVelgPost,
  valgtPostId,
}: SpecPostTabellProps) {
  const [sorterFelt, setSorterFelt] = useState<SorterFelt>("postnr");
  const [sorterRetning, setSorterRetning] = useState<SorterRetning>("asc");
  const [detaljPost, setDetaljPost] = useState<string | null>(null);

  const harSammenligning = !!sammenligningPoster && sammenligningPoster.length > 0;

  const notaMap = useMemo(() => {
    if (!sammenligningPoster) return new Map<string, SpecPost>();
    const map = new Map<string, SpecPost>();
    for (const p of sammenligningPoster) {
      if (p.postnr) map.set(p.postnr, p);
    }
    return map;
  }, [sammenligningPoster]);

  const rader: SammenlignetRad[] = useMemo(() => {
    return poster.map((budsjett) => {
      const nota = budsjett.postnr ? (notaMap.get(budsjett.postnr) ?? null) : null;
      const sumBudsjett = Number(budsjett.sumAnbud ?? 0);
      const mengdeDenne = nota ? Number(nota.mengdeDenne ?? 0) : 0;
      const mengdeTotal = nota ? Number(nota.mengdeTotal ?? 0) : 0;
      const verdiDenne = nota ? Number(nota.verdiDenne ?? 0) : 0;
      const verdiTotal = nota ? Number(nota.verdiTotal ?? 0) : 0;
      const prosentFerdig = nota ? Number(nota.prosentFerdig ?? 0) : 0;
      return { budsjett, nota, mengdeDenne, mengdeTotal, verdiDenne, verdiTotal, prosentFerdig, sumAvvik: verdiTotal - sumBudsjett };
    });
  }, [poster, notaMap]);

  const sorterteRader = useMemo(() => {
    return [...rader].sort((a, b) => {
      const aVal = a.budsjett[sorterFelt];
      const bVal = b.budsjett[sorterFelt];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (sorterFelt === "mengdeAnbud" || sorterFelt === "enhetspris" || sorterFelt === "sumAnbud") {
        return sorterRetning === "asc" ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
      }
      const cmp = String(aVal).localeCompare(String(bVal), "nb-NO", { numeric: true });
      return sorterRetning === "asc" ? cmp : -cmp;
    });
  }, [rader, sorterFelt, sorterRetning]);

  function toggleSortering(felt: SorterFelt) {
    if (sorterFelt === felt) setSorterRetning((r) => (r === "asc" ? "desc" : "asc"));
    else { setSorterFelt(felt); setSorterRetning("asc"); }
  }

  if (poster.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-gray-400">
        Ingen poster funnet. Importer anbudsgrunnlag for å komme i gang.
      </div>
    );
  }

  const totalBudsjett = rader.reduce((s, r) => s + Number(r.budsjett.sumAnbud ?? 0), 0);
  const totalVerdiDenne = harSammenligning ? rader.reduce((s, r) => s + r.verdiDenne, 0) : 0;
  const totalVerdiTotal = harSammenligning ? rader.reduce((s, r) => s + r.verdiTotal, 0) : 0;
  const totalAvvik = harSammenligning ? totalVerdiTotal - totalBudsjett : 0;

  // Kolonnerekkefølge matcher Proadm Excel:
  // Post | Beskrivelse | Mengde anbud | Enhet | Enhetspris | Sum budsjett
  // (sammenligning): Mengde denne | Verdi denne | Mengde totalt | Verdi totalt | % | Avvik

  return (
    <div className="flex h-full flex-col rounded border overflow-hidden">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr className="border-b text-xs font-medium uppercase text-gray-500">
              <th className="min-w-[36px] px-2 py-2 text-gray-400">#</th>
              <SH felt="postnr" label="Post" aktiv={sorterFelt} retning={sorterRetning} onClick={toggleSortering} cls="min-w-[110px]" />
              <SH felt="beskrivelse" label="Beskrivelse" aktiv={sorterFelt} retning={sorterRetning} onClick={toggleSortering} />
              <SH felt="mengdeAnbud" label="Mengde" aktiv={sorterFelt} retning={sorterRetning} onClick={toggleSortering} right cls="min-w-[85px]" />
              <SH felt="enhet" label="Enh" aktiv={sorterFelt} retning={sorterRetning} onClick={toggleSortering} cls="min-w-[45px]" />
              <SH felt="enhetspris" label="Enhetspris" aktiv={sorterFelt} retning={sorterRetning} onClick={toggleSortering} right cls="min-w-[90px]" />
              <SH felt="sumAnbud" label="Sum budsjett" aktiv={sorterFelt} retning={sorterRetning} onClick={toggleSortering} right cls="min-w-[100px]" />
              {harSammenligning && (
                <>
                  <th className="w-[2px] bg-gray-300 px-0" />
                  <th className="min-w-[85px] px-2 py-2 text-right text-blue-600">Mengde denne</th>
                  <th className="min-w-[90px] px-2 py-2 text-right text-blue-600">Verdi denne</th>
                  <th className="min-w-[85px] px-2 py-2 text-right text-blue-600">Mengde tot.</th>
                  <th className="min-w-[95px] px-2 py-2 text-right text-blue-600">Verdi tot.</th>
                  <th className="min-w-[45px] px-2 py-2 text-right text-blue-600">%</th>
                  <th className="min-w-[85px] px-2 py-2 text-right">Avvik</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {sorterteRader.map((rad, idx) => {
              const p = rad.budsjett;
              return (
                <tr
                  key={p.id}
                  onClick={() => onVelgPost(p.id)}
                  onDoubleClick={() => setDetaljPost(p.id)}
                  className={`cursor-pointer border-b transition-colors ${
                    valgtPostId === p.id ? "bg-blue-50 border-l-2 border-l-sitedoc-primary" : "hover:bg-gray-50"
                  }`}
                >
                  <td className="px-2 py-1.5 text-xs text-gray-400">{idx + 1}</td>
                  <td className="px-2 py-1.5 font-mono text-xs whitespace-nowrap">{p.postnr ?? "—"}</td>
                  <td className="max-w-xs truncate px-2 py-1.5">{p.beskrivelse ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmt(p.mengdeAnbud)}</td>
                  <td className="px-2 py-1.5">{p.enhet ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmt(p.enhetspris)}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmt(p.sumAnbud)}</td>
                  {harSammenligning && (
                    <>
                      <td className="w-[2px] bg-gray-200 px-0" />
                      <td className="px-2 py-1.5 text-right font-mono text-blue-700">{rad.nota ? fmt(rad.mengdeDenne) : "—"}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-blue-700">{rad.nota ? fmt(rad.verdiDenne) : "—"}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-blue-700">{rad.nota ? fmt(rad.mengdeTotal) : "—"}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-blue-700">{rad.nota ? fmt(rad.verdiTotal) : "—"}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-blue-700">{rad.nota ? fmt(rad.prosentFerdig, 0) : "—"}</td>
                      <td className={`px-2 py-1.5 text-right font-mono ${rad.sumAvvik > 0 ? "text-red-600" : rad.sumAvvik < 0 ? "text-green-600" : ""}`}>
                        {rad.nota ? fmt(rad.sumAvvik) : "—"}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0 bg-gray-50 border-t-2">
            <tr className="font-semibold text-xs">
              <td className="px-2 py-2" />
              <td className="px-2 py-2" />
              <td className="px-2 py-2">Totalt ({poster.length} poster)</td>
              <td className="px-2 py-2" />
              <td className="px-2 py-2" />
              <td className="px-2 py-2" />
              <td className="px-2 py-2 text-right font-mono">{fmt(totalBudsjett)}</td>
              {harSammenligning && (
                <>
                  <td className="px-0" />
                  <td className="px-2 py-2" />
                  <td className="px-2 py-2 text-right font-mono text-blue-700">{fmt(totalVerdiDenne)}</td>
                  <td className="px-2 py-2" />
                  <td className="px-2 py-2 text-right font-mono text-blue-700">{fmt(totalVerdiTotal)}</td>
                  <td className="px-2 py-2" />
                  <td className={`px-2 py-2 text-right font-mono ${totalAvvik > 0 ? "text-red-600" : totalAvvik < 0 ? "text-green-600" : ""}`}>{fmt(totalAvvik)}</td>
                </>
              )}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Detaljmodal */}
      {detaljPost && (() => {
        const rad = sorterteRader.find((r) => r.budsjett.id === detaljPost);
        if (!rad) return null;
        const p = rad.budsjett;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDetaljPost(null)}>
            <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b px-5 py-3">
                <h2 className="text-base font-semibold">Post {p.postnr}</h2>
                <button onClick={() => setDetaljPost(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
              </div>
              <div className="max-h-[70vh] overflow-auto p-5 space-y-4">
                <div>
                  <div className="mb-1 text-xs font-medium text-gray-500">Beskrivelse</div>
                  <div className="text-sm text-gray-800">{p.beskrivelse ?? "—"}</div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Kort label="Mengde anbud" verdi={fmt(p.mengdeAnbud)} />
                  <Kort label="Enhet" verdi={p.enhet ?? "—"} mono={false} />
                  <Kort label="Enhetspris" verdi={fmt(p.enhetspris)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Kort label="Sum budsjett" verdi={fmt(p.sumAnbud)} bg="bg-blue-50" />
                  {p.nsKode && <Kort label="NS-kode" verdi={p.nsKode} sub={p.nsTittel} bg="bg-amber-50" mono={false} />}
                </div>
                {harSammenligning && rad.nota && (
                  <div className="rounded border border-blue-200 bg-blue-50/50 p-3">
                    <div className="mb-2 text-xs font-medium text-blue-600">{sammenligningLabel}</div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <Kort label="Mengde denne" verdi={fmt(rad.mengdeDenne)} compact />
                      <Kort label="Verdi denne" verdi={fmt(rad.verdiDenne)} compact />
                      <Kort label="Mengde totalt" verdi={fmt(rad.mengdeTotal)} compact />
                      <Kort label="Verdi totalt" verdi={fmt(rad.verdiTotal)} compact />
                    </div>
                    <div className={`mt-2 text-xs font-mono ${rad.sumAvvik > 0 ? "text-red-600" : rad.sumAvvik < 0 ? "text-green-600" : "text-gray-500"}`}>
                      Avvik: {fmt(rad.sumAvvik)} ({fmt(rad.prosentFerdig, 0)}% ferdig)
                    </div>
                  </div>
                )}
                {p.fullNsTekst && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-gray-500">NS-spesifikasjon</div>
                    <div className="whitespace-pre-wrap rounded border bg-gray-50 p-3 text-xs leading-relaxed text-gray-700">{p.fullNsTekst}</div>
                  </div>
                )}
                {p.eksternNotat && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-gray-500">Ekstern merknad</div>
                    <div className="text-sm text-gray-700">{p.eksternNotat}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function SH({ felt, label, aktiv, retning, onClick, right, cls }: {
  felt: SorterFelt; label: string; aktiv: SorterFelt; retning: SorterRetning;
  onClick: (f: SorterFelt) => void; right?: boolean; cls?: string;
}) {
  const er = aktiv === felt;
  return (
    <th className={`cursor-pointer select-none px-2 py-2 hover:text-gray-700 ${right ? "text-right" : ""} ${er ? "text-sitedoc-primary" : ""} ${cls ?? ""}`} onClick={() => onClick(felt)}>
      <span className="inline-flex items-center gap-0.5">
        {label}
        {er ? (retning === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <span className="h-3 w-3" />}
      </span>
    </th>
  );
}

function Kort({ label, verdi, sub, bg, mono = true, compact }: {
  label: string; verdi: string; sub?: string | null; bg?: string; mono?: boolean; compact?: boolean;
}) {
  return (
    <div className={`rounded p-2 ${bg ?? "bg-gray-50"}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`${compact ? "text-xs" : "text-sm"} font-medium ${mono ? "font-mono" : ""}`}>{verdi}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-600">{sub}</div>}
    </div>
  );
}

function fmt(verdi: unknown, desimaler = 2): string {
  if (verdi === null || verdi === undefined) return "—";
  const num = Number(verdi);
  if (isNaN(num)) return "—";
  return num.toLocaleString("nb-NO", { minimumFractionDigits: desimaler, maximumFractionDigits: desimaler });
}

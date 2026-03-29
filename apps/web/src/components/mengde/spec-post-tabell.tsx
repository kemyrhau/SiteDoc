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
  mengdeNota: number;
  sumNota: number;
  mengdeAvvik: number;
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

  // Bygg sammenligningsmap (postnr → nota-post)
  const notaMap = useMemo(() => {
    if (!sammenligningPoster) return new Map<string, SpecPost>();
    const map = new Map<string, SpecPost>();
    for (const p of sammenligningPoster) {
      if (p.postnr) map.set(p.postnr, p);
    }
    return map;
  }, [sammenligningPoster]);

  // Sammenlignet data
  const rader: SammenlignetRad[] = useMemo(() => {
    return poster.map((budsjett) => {
      const nota = budsjett.postnr ? (notaMap.get(budsjett.postnr) ?? null) : null;
      const mengdeBudsjett = Number(budsjett.mengdeAnbud ?? 0);
      const sumBudsjett = Number(budsjett.sumAnbud ?? 0);
      const mengdeNota = nota ? Number(nota.mengdeAnbud ?? 0) : 0;
      const sumNota = nota ? Number(nota.sumAnbud ?? 0) : 0;
      return {
        budsjett,
        nota,
        mengdeNota,
        sumNota,
        mengdeAvvik: mengdeNota - mengdeBudsjett,
        sumAvvik: sumNota - sumBudsjett,
      };
    });
  }, [poster, notaMap]);

  const sorterteRader = useMemo(() => {
    return [...rader].sort((a, b) => {
      const aPost = a.budsjett;
      const bPost = b.budsjett;
      const aVal = aPost[sorterFelt];
      const bVal = bPost[sorterFelt];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (sorterFelt === "mengdeAnbud" || sorterFelt === "enhetspris" || sorterFelt === "sumAnbud") {
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        return sorterRetning === "asc" ? aNum - bNum : bNum - aNum;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      const cmp = aStr.localeCompare(bStr, "nb-NO", { numeric: true });
      return sorterRetning === "asc" ? cmp : -cmp;
    });
  }, [rader, sorterFelt, sorterRetning]);

  function toggleSortering(felt: SorterFelt) {
    if (sorterFelt === felt) {
      setSorterRetning((r) => (r === "asc" ? "desc" : "asc"));
    } else {
      setSorterFelt(felt);
      setSorterRetning("asc");
    }
  }

  if (poster.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-gray-400">
        Ingen poster funnet. Importer anbudsgrunnlag for å komme i gang.
      </div>
    );
  }

  // Totaler
  const totalBudsjett = rader.reduce((s, r) => s + Number(r.budsjett.sumAnbud ?? 0), 0);
  const totalNota = harSammenligning ? rader.reduce((s, r) => s + r.sumNota, 0) : 0;
  const totalAvvik = harSammenligning ? totalNota - totalBudsjett : 0;

  return (
    <div className="flex h-full flex-col rounded border">
      {/* Fast header */}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-xs font-medium uppercase text-gray-500">
            <th className="w-[40px] px-2 py-2 text-gray-400">#</th>
            <SorterHeader felt="postnr" label="Post" aktivFelt={sorterFelt} retning={sorterRetning} onClick={toggleSortering} bredde="w-[120px]" />
            <SorterHeader felt="beskrivelse" label="Beskrivelse" aktivFelt={sorterFelt} retning={sorterRetning} onClick={toggleSortering} />
            <SorterHeader felt="enhet" label="Enhet" aktivFelt={sorterFelt} retning={sorterRetning} onClick={toggleSortering} bredde="w-[60px]" />
            <SorterHeader felt="mengdeAnbud" label="Mengde" aktivFelt={sorterFelt} retning={sorterRetning} onClick={toggleSortering} hoyrejustert bredde="w-[100px]" />
            <SorterHeader felt="enhetspris" label="Enhetspris" aktivFelt={sorterFelt} retning={sorterRetning} onClick={toggleSortering} hoyrejustert bredde="w-[100px]" />
            <SorterHeader felt="sumAnbud" label="Sum budsjett" aktivFelt={sorterFelt} retning={sorterRetning} onClick={toggleSortering} hoyrejustert bredde="w-[110px]" />
            {harSammenligning && (
              <>
                <th className="w-px bg-gray-300" />
                <th className="w-[100px] px-2 py-2 text-right text-blue-600">Mengde {sammenligningLabel}</th>
                <th className="w-[110px] px-2 py-2 text-right text-blue-600">Sum {sammenligningLabel}</th>
                <th className="w-[100px] px-2 py-2 text-right">Avvik</th>
              </>
            )}
          </tr>
        </thead>
      </table>

      {/* Scrollbar kun her */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm">
          <tbody>
            {sorterteRader.map((rad, idx) => {
              const post = rad.budsjett;
              return (
                <tr
                  key={post.id}
                  onClick={() => onVelgPost(post.id)}
                  onDoubleClick={() => setDetaljPost(post.id)}
                  className={`cursor-pointer border-b transition-colors ${
                    valgtPostId === post.id
                      ? "bg-blue-50 border-l-2 border-l-sitedoc-primary"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <td className="w-[40px] px-2 py-2 text-xs text-gray-400">
                    {idx + 1}
                  </td>
                  <td className="w-[120px] px-2 py-2 font-mono text-xs whitespace-nowrap">
                    {post.postnr ?? "—"}
                  </td>
                  <td className="max-w-xs truncate px-2 py-2">
                    {post.beskrivelse ?? "—"}
                  </td>
                  <td className="w-[60px] px-2 py-2">{post.enhet ?? "—"}</td>
                  <td className="w-[100px] px-2 py-2 text-right font-mono">
                    {formaterTall(post.mengdeAnbud, 2)}
                  </td>
                  <td className="w-[100px] px-2 py-2 text-right font-mono">
                    {formaterTall(post.enhetspris, 2)}
                  </td>
                  <td className="w-[110px] px-2 py-2 text-right font-mono">
                    {formaterTall(post.sumAnbud, 2)}
                  </td>
                  {harSammenligning && (
                    <>
                      <td className="w-px bg-gray-200" />
                      <td className="w-[100px] px-2 py-2 text-right font-mono text-blue-700">
                        {rad.nota ? formaterTall(rad.mengdeNota, 2) : "—"}
                      </td>
                      <td className="w-[110px] px-2 py-2 text-right font-mono text-blue-700">
                        {rad.nota ? formaterTall(rad.sumNota, 2) : "—"}
                      </td>
                      <td className={`w-[100px] px-2 py-2 text-right font-mono ${
                        rad.sumAvvik > 0 ? "text-red-600" : rad.sumAvvik < 0 ? "text-green-600" : ""
                      }`}>
                        {rad.nota ? formaterTall(rad.sumAvvik, 2) : "—"}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totalrad */}
      <table className="w-full text-left text-sm border-t-2">
        <tfoot>
          <tr className="bg-gray-50 font-semibold text-xs">
            <td className="w-[40px] px-2 py-2" />
            <td className="w-[120px] px-2 py-2" />
            <td className="px-2 py-2">Totalt ({poster.length} poster)</td>
            <td className="w-[60px] px-2 py-2" />
            <td className="w-[100px] px-2 py-2" />
            <td className="w-[100px] px-2 py-2" />
            <td className="w-[110px] px-2 py-2 text-right font-mono">
              {formaterTall(totalBudsjett, 2)}
            </td>
            {harSammenligning && (
              <>
                <td className="w-px" />
                <td className="w-[100px] px-2 py-2" />
                <td className="w-[110px] px-2 py-2 text-right font-mono text-blue-700">
                  {formaterTall(totalNota, 2)}
                </td>
                <td className={`w-[100px] px-2 py-2 text-right font-mono ${
                  totalAvvik > 0 ? "text-red-600" : totalAvvik < 0 ? "text-green-600" : ""
                }`}>
                  {formaterTall(totalAvvik, 2)}
                </td>
              </>
            )}
          </tr>
        </tfoot>
      </table>

      {/* Detaljmodal ved dobbeltklikk */}
      {detaljPost && (() => {
        const rad = sorterteRader.find((r) => r.budsjett.id === detaljPost);
        if (!rad) return null;
        const post = rad.budsjett;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDetaljPost(null)}>
            <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b px-5 py-3">
                <h2 className="text-base font-semibold">
                  Post {post.postnr}
                </h2>
                <button onClick={() => setDetaljPost(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[70vh] overflow-auto p-5 space-y-4">
                <div>
                  <div className="mb-1 text-xs font-medium text-gray-500">Beskrivelse</div>
                  <div className="text-sm text-gray-800">{post.beskrivelse ?? "—"}</div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded bg-gray-50 p-3">
                    <div className="text-xs text-gray-500">Enhet</div>
                    <div className="text-sm font-medium">{post.enhet ?? "—"}</div>
                  </div>
                  <div className="rounded bg-gray-50 p-3">
                    <div className="text-xs text-gray-500">Mengde budsjett</div>
                    <div className="text-sm font-medium font-mono">{formaterTall(post.mengdeAnbud, 2)}</div>
                  </div>
                  <div className="rounded bg-gray-50 p-3">
                    <div className="text-xs text-gray-500">Enhetspris</div>
                    <div className="text-sm font-medium font-mono">{formaterTall(post.enhetspris, 2)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded bg-blue-50 p-3">
                    <div className="text-xs text-gray-500">Sum budsjett</div>
                    <div className="text-base font-semibold font-mono">{formaterTall(post.sumAnbud, 2)}</div>
                  </div>
                  {harSammenligning && rad.nota && (
                    <div className="rounded bg-blue-50 p-3">
                      <div className="text-xs text-blue-600">Sum {sammenligningLabel}</div>
                      <div className="text-base font-semibold font-mono text-blue-700">{formaterTall(rad.sumNota, 2)}</div>
                      <div className={`mt-1 text-xs font-mono ${rad.sumAvvik > 0 ? "text-red-600" : rad.sumAvvik < 0 ? "text-green-600" : "text-gray-500"}`}>
                        Avvik: {formaterTall(rad.sumAvvik, 2)}
                      </div>
                    </div>
                  )}
                </div>

                {post.nsKode && (
                  <div className="rounded bg-amber-50 p-3">
                    <div className="text-xs text-gray-500">NS-kode</div>
                    <div className="text-sm font-semibold font-mono">{post.nsKode}</div>
                    {post.nsTittel && <div className="mt-0.5 text-xs text-gray-600">{post.nsTittel}</div>}
                  </div>
                )}

                {post.fullNsTekst && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-gray-500">NS-spesifikasjon</div>
                    <div className="whitespace-pre-wrap rounded border bg-gray-50 p-3 text-xs leading-relaxed text-gray-700">
                      {post.fullNsTekst}
                    </div>
                  </div>
                )}

                {post.eksternNotat && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-gray-500">Ekstern merknad</div>
                    <div className="text-sm text-gray-700">{post.eksternNotat}</div>
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

function SorterHeader({
  felt,
  label,
  aktivFelt,
  retning,
  onClick,
  hoyrejustert,
  bredde,
}: {
  felt: SorterFelt;
  label: string;
  aktivFelt: SorterFelt;
  retning: SorterRetning;
  onClick: (felt: SorterFelt) => void;
  hoyrejustert?: boolean;
  bredde?: string;
}) {
  const erAktiv = aktivFelt === felt;
  return (
    <th
      className={`cursor-pointer select-none px-2 py-2 hover:text-gray-700 ${
        hoyrejustert ? "text-right" : ""
      } ${erAktiv ? "text-sitedoc-primary" : ""} ${bredde ?? ""}`}
      onClick={() => onClick(felt)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {erAktiv ? (
          retning === "asc" ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : (
          <span className="h-3 w-3" />
        )}
      </span>
    </th>
  );
}

function formaterTall(verdi: unknown, desimaler = 0): string {
  if (verdi === null || verdi === undefined) return "—";
  const num = Number(verdi);
  if (isNaN(num)) return "—";
  return num.toLocaleString("nb-NO", {
    minimumFractionDigits: desimaler,
    maximumFractionDigits: desimaler,
  });
}

"use client";

import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface SpecPostTabellProps {
  projectId: string;
  periodId: string | null;
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

export function SpecPostTabell({
  projectId,
  periodId,
  onVelgPost,
  valgtPostId,
}: SpecPostTabellProps) {
  const [sorterFelt, setSorterFelt] = useState<SorterFelt>("postnr");
  const [sorterRetning, setSorterRetning] = useState<SorterRetning>("asc");
  const [detaljPost, setDetaljPost] = useState<string | null>(null);

  const { data: poster, isLoading } = trpc.mengde.hentSpecPoster.useQuery(
    { projectId, periodId: periodId ?? undefined },
    { enabled: !!projectId },
  );

  const sortertePoster = useMemo(() => {
    if (!poster) return [];
    return [...poster].sort((a, b) => {
      const felt = sorterFelt;
      const aVal = a[felt];
      const bVal = b[felt];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (felt === "mengdeAnbud" || felt === "enhetspris" || felt === "sumAnbud") {
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        return sorterRetning === "asc" ? aNum - bNum : bNum - aNum;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      const cmp = aStr.localeCompare(bStr, "nb-NO", { numeric: true });
      return sorterRetning === "asc" ? cmp : -cmp;
    });
  }, [poster, sorterFelt, sorterRetning]);

  function toggleSortering(felt: SorterFelt) {
    if (sorterFelt === felt) {
      setSorterRetning((r) => (r === "asc" ? "desc" : "asc"));
    } else {
      setSorterFelt(felt);
      setSorterRetning("asc");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-gray-400">
        Laster poster...
      </div>
    );
  }

  if (!poster || poster.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-gray-400">
        Ingen poster funnet. Importer budsjett eller A-nota for å komme i gang.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded border">
      {/* Fast header */}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-xs font-medium uppercase text-gray-500">
            <th className="w-[45px] px-3 py-2 text-gray-400">#</th>
            <SorterHeader felt="postnr" label="Post" aktivFelt={sorterFelt} retning={sorterRetning} onClick={toggleSortering} bredde="w-[130px]" />
            <SorterHeader felt="beskrivelse" label="Beskrivelse" aktivFelt={sorterFelt} retning={sorterRetning} onClick={toggleSortering} />
            <SorterHeader felt="enhet" label="Enhet" aktivFelt={sorterFelt} retning={sorterRetning} onClick={toggleSortering} bredde="w-[70px]" />
            <SorterHeader felt="mengdeAnbud" label="Mengde anbud" aktivFelt={sorterFelt} retning={sorterRetning} onClick={toggleSortering} hoyrejustert bredde="w-[120px]" />
            <SorterHeader felt="enhetspris" label="Enhetspris" aktivFelt={sorterFelt} retning={sorterRetning} onClick={toggleSortering} hoyrejustert bredde="w-[100px]" />
            <SorterHeader felt="sumAnbud" label="Sum anbud" aktivFelt={sorterFelt} retning={sorterRetning} onClick={toggleSortering} hoyrejustert bredde="w-[110px]" />
          </tr>
        </thead>
      </table>

      {/* Scrollbar kun her */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm">
          <tbody>
            {sortertePoster.map((post, idx) => (
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
                <td className="w-[45px] px-3 py-2 text-xs text-gray-400">
                  {idx + 1}
                </td>
                <td className="w-[130px] px-3 py-2 font-mono text-xs whitespace-nowrap">
                  {post.postnr ?? "—"}
                </td>
                <td className="max-w-xs truncate px-3 py-2">
                  {post.beskrivelse ?? "—"}
                </td>
                <td className="w-[70px] px-3 py-2">{post.enhet ?? "—"}</td>
                <td className="w-[120px] px-3 py-2 text-right font-mono">
                  {formaterTall(post.mengdeAnbud, 2)}
                </td>
                <td className="w-[100px] px-3 py-2 text-right font-mono">
                  {formaterTall(post.enhetspris, 2)}
                </td>
                <td className="w-[110px] px-3 py-2 text-right font-mono">
                  {formaterTall(post.sumAnbud, 2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detaljmodal ved dobbeltklikk */}
      {detaljPost && (() => {
        const post = sortertePoster.find((p) => p.id === detaljPost);
        if (!post) return null;
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
                {/* Beskrivelse */}
                <div>
                  <div className="mb-1 text-xs font-medium text-gray-500">Beskrivelse</div>
                  <div className="text-sm text-gray-800">{post.beskrivelse ?? "—"}</div>
                </div>

                {/* Verdier */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded bg-gray-50 p-3">
                    <div className="text-xs text-gray-500">Enhet</div>
                    <div className="text-sm font-medium">{post.enhet ?? "—"}</div>
                  </div>
                  <div className="rounded bg-gray-50 p-3">
                    <div className="text-xs text-gray-500">Mengde anbud</div>
                    <div className="text-sm font-medium font-mono">{formaterTall(post.mengdeAnbud, 2)}</div>
                  </div>
                  <div className="rounded bg-gray-50 p-3">
                    <div className="text-xs text-gray-500">Enhetspris</div>
                    <div className="text-sm font-medium font-mono">{formaterTall(post.enhetspris, 2)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded bg-blue-50 p-3">
                    <div className="text-xs text-gray-500">Sum anbud</div>
                    <div className="text-base font-semibold font-mono">{formaterTall(post.sumAnbud, 2)}</div>
                  </div>
                  {post.nsKode && (
                    <div className="rounded bg-amber-50 p-3">
                      <div className="text-xs text-gray-500">NS-kode</div>
                      <div className="text-sm font-semibold font-mono">{post.nsKode}</div>
                      {post.nsTittel && <div className="mt-0.5 text-xs text-gray-600">{post.nsTittel}</div>}
                    </div>
                  )}
                </div>

                {/* Full NS-tekst */}
                {post.fullNsTekst && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-gray-500">NS-spesifikasjon</div>
                    <div className="whitespace-pre-wrap rounded border bg-gray-50 p-3 text-xs leading-relaxed text-gray-700">
                      {post.fullNsTekst}
                    </div>
                  </div>
                )}

                {/* Ekstern merknad */}
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
      className={`cursor-pointer select-none px-3 py-2 hover:text-gray-700 ${
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

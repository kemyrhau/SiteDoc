"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { ChevronUp, ChevronDown, X, Settings, FileSearch, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

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
  importNotat: string | null;
}

interface SpecPostTabellProps {
  poster: SpecPost[];
  sammenligningPoster?: SpecPost[];
  sammenligningLabel?: string;
  onVelgPost: (postId: string) => void;
  valgtPostId: string | null;
  prosjektId?: string;
  kontraktId?: string | null;
}

// NS 3420-koder: bokstaver + tall/punktum (FH2.21, AM3.861A) eller korte koder (AZA)
// Ekskluder enheter (RS) og vanlige ord
const NS_KODE_PAT = /^([A-Z]{1,3}\d[\w.]*[A-Z]?|[A-Z]{2,3})\s/;
const NS_KODE_EKSKLUDER = new Set(["RS", "RG", "RD", "RE", "RF", "IF", "OR", "OK", "NY", "SE", "ER", "EN", "ET", "EL", "DE"]);

/** Finn NS-kode for en post: egen, fra beskrivelse, eller arvet fra forelder */
function finnNsKode(
  post: SpecPost,
  poster: SpecPost[],
): { nsKode: string; kilde: "egen" | "beskrivelse" | "arvet"; postnr?: string; sub?: string | null } | null {
  // 1. Egen nsKode-felt
  if (post.nsKode) {
    return { nsKode: post.nsKode, kilde: "egen", sub: post.nsTittel };
  }
  // 2. NS-kode i starten av beskrivelsen (f.eks. "AZA Etablering...")
  const egenMatch = post.beskrivelse ? NS_KODE_PAT.exec(post.beskrivelse) : null;
  if (egenMatch && egenMatch[1]!.length <= 15 && !NS_KODE_EKSKLUDER.has(egenMatch[1]!)) {
    return { nsKode: egenMatch[1]!, kilde: "beskrivelse", sub: null };
  }
  // 3. Arv fra forelder
  const arvet = finnArvetNsKode(post.postnr, poster);
  return arvet ? { nsKode: arvet.nsKode, kilde: "arvet", postnr: arvet.postnr } : null;
}

/** Finn NS-kode fra nærmeste overordnet post i hierarkiet */
function finnArvetNsKode(
  postnr: string | null,
  poster: SpecPost[],
): { nsKode: string; postnr: string } | null {
  if (!postnr) return null;
  // Gå oppover: 01.03.21.2 → 01.03.21 → 01.03
  const deler = postnr.split(".");
  for (let i = deler.length - 1; i >= 2; i--) {
    const parentPostnr = deler.slice(0, i).join(".");
    const forelder = poster.find((p) => p.postnr === parentPostnr);
    if (!forelder) continue;
    if (forelder.nsKode) {
      return { nsKode: forelder.nsKode, postnr: forelder.postnr! };
    }
    const m = forelder.beskrivelse ? NS_KODE_PAT.exec(forelder.beskrivelse) : null;
    if (m && m[1]!.length <= 15 && !NS_KODE_EKSKLUDER.has(m[1]!)) {
      return { nsKode: m[1]!, postnr: forelder.postnr! };
    }
  }
  return null;
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
  prosjektId,
  kontraktId,
}: SpecPostTabellProps) {
  const [sorterFelt, setSorterFelt] = useState<SorterFelt>("postnr");
  const [sorterRetning, setSorterRetning] = useState<SorterRetning>("asc");
  const [detaljPost, setDetaljPost] = useState<string | null>(null);
  const [overskridelseTerskel, setOverskridelseTerskel] = useState(120);
  const [visInnstillinger, setVisInnstillinger] = useState(false);

  const valgtRadRef = useRef<HTMLTableRowElement>(null);

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

  // Piltast-navigering
  const navigerRad = useCallback(
    (retning: "opp" | "ned") => {
      if (!valgtPostId || !sorterteRader.length) return;
      const idx = sorterteRader.findIndex((r) => r.budsjett.id === valgtPostId);
      if (idx === -1) return;
      const nyIdx = retning === "opp" ? Math.max(0, idx - 1) : Math.min(sorterteRader.length - 1, idx + 1);
      if (nyIdx !== idx) onVelgPost(sorterteRader[nyIdx]!.budsjett.id);
    },
    [valgtPostId, sorterteRader, onVelgPost],
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowUp") { e.preventDefault(); navigerRad("opp"); }
      else if (e.key === "ArrowDown") { e.preventDefault(); navigerRad("ned"); }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigerRad]);

  // Scroll valgt rad inn i synsfeltet
  useEffect(() => {
    valgtRadRef.current?.scrollIntoView({ block: "nearest" });
  }, [valgtPostId]);

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
  // Bruk sammenligningPoster direkte for totaler — inkluderer poster som ikke matcher budsjett
  const totalVerdiDenne = harSammenligning ? sammenligningPoster!.reduce((s, p) => s + Number(p.verdiDenne ?? 0), 0) : 0;
  const totalVerdiTotal = harSammenligning ? sammenligningPoster!.reduce((s, p) => s + Number(p.verdiTotal ?? 0), 0) : 0;

  // Kolonnerekkefølge matcher Proadm Excel:
  // Postnr | Beskrivelse | [Mengder: Anbudet | Enh | Tot.forrige | Denne per. | Totalt] | Enhetspris | [Verdi: Anbudet | Tot.forrige | Denne per. | Totalt] | Utført %

  return (
    <div className="flex h-full flex-col rounded border overflow-hidden">
      {/* Innstillinger */}
      {harSammenligning && (
        <div className="flex items-center gap-2 border-b bg-gray-50 px-3 py-1.5 text-xs">
          <button
            onClick={() => setVisInnstillinger(!visInnstillinger)}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-gray-500 hover:bg-gray-200"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
          {visInnstillinger && (
            <div className="flex items-center gap-2 text-gray-600">
              <span>Markér overskridelse over</span>
              <input
                type="number"
                value={overskridelseTerskel}
                onChange={(e) => setOverskridelseTerskel(Number(e.target.value) || 100)}
                className="w-14 rounded border px-1.5 py-0.5 text-center text-xs"
                min={100}
                max={500}
                step={10}
              />
              <span>%</span>
            </div>
          )}
          {!visInnstillinger && overskridelseTerskel !== 100 && (
            <span className="text-gray-400">Overskridelse: {overskridelseTerskel}%</span>
          )}
        </div>
      )}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            {harSammenligning && (
              <tr className="border-b text-[10px] font-medium uppercase text-gray-400">
                <th className="min-w-[36px] px-2 py-1" />
                <th className="min-w-[110px] px-2 py-1" />
                <th className="px-2 py-1" />
                <th className="min-w-[80px] px-2 py-1 text-right" colSpan={2}>Mengder</th>
                <th className="w-[2px] bg-gray-200 px-0" />
                <th className="min-w-[80px] px-2 py-1 text-right text-blue-500" colSpan={3}>Mengder</th>
                <th className="min-w-[80px] px-2 py-1 text-right" />
                <th className="min-w-[90px] px-2 py-1 text-right" colSpan={1}>Verdi</th>
                <th className="w-[2px] bg-gray-200 px-0" />
                <th className="min-w-[80px] px-2 py-1 text-right text-blue-500" colSpan={2}>Verdi</th>
                <th className="min-w-[50px] px-2 py-1" />
              </tr>
            )}
            <tr className="border-b text-xs font-medium uppercase text-gray-500">
              <th className="min-w-[36px] px-2 py-2 text-gray-400">#</th>
              <SH felt="postnr" label="Postnr" aktiv={sorterFelt} retning={sorterRetning} onClick={toggleSortering} cls="min-w-[110px]" />
              <SH felt="beskrivelse" label="Beskrivelse" aktiv={sorterFelt} retning={sorterRetning} onClick={toggleSortering} />
              <SH felt="mengdeAnbud" label="Anbudet" aktiv={sorterFelt} retning={sorterRetning} onClick={toggleSortering} right cls="min-w-[80px]" />
              <SH felt="enhet" label="Enh" aktiv={sorterFelt} retning={sorterRetning} onClick={toggleSortering} cls="min-w-[40px]" />
              {harSammenligning && (
                <>
                  <th className="w-[2px] bg-gray-300 px-0" />
                  <th className="min-w-[80px] px-2 py-2 text-right text-blue-600">Denne per.</th>
                  <th className="min-w-[80px] px-2 py-2 text-right text-blue-600">Totalt</th>
                  <th className="min-w-[80px] px-2 py-2 text-right text-blue-600">Tot. forrige</th>
                </>
              )}
              <SH felt="enhetspris" label="Enhetspris" aktiv={sorterFelt} retning={sorterRetning} onClick={toggleSortering} right cls="min-w-[90px]" />
              <SH felt="sumAnbud" label="Anbudet" aktiv={sorterFelt} retning={sorterRetning} onClick={toggleSortering} right cls="min-w-[90px]" />
              {harSammenligning && (
                <>
                  <th className="w-[2px] bg-gray-300 px-0" />
                  <th className="min-w-[90px] px-2 py-2 text-right text-blue-600">Denne per.</th>
                  <th className="min-w-[90px] px-2 py-2 text-right text-blue-600">Totalt</th>
                  <th className="min-w-[50px] px-2 py-2 text-right text-blue-600">%</th>
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
                  ref={valgtPostId === p.id ? valgtRadRef : undefined}
                  onClick={() => onVelgPost(p.id)}
                  onDoubleClick={() => setDetaljPost(p.id)}
                  className={`cursor-pointer border-b transition-colors ${
                    valgtPostId === p.id
                      ? "bg-blue-100 border-l-2 border-l-sitedoc-primary"
                      : harSammenligning && rad.nota && rad.prosentFerdig > overskridelseTerskel
                        ? "bg-red-50 hover:bg-red-100"
                        : "hover:bg-gray-50"
                  }`}
                >
                  <td className="px-2 py-1.5 text-xs text-gray-400">{idx + 1}</td>
                  <td className="px-2 py-1.5 font-mono text-xs whitespace-nowrap">
                    {p.importNotat && <span className="mr-1 text-amber-500" title={p.importNotat}>*</span>}
                    {p.postnr ?? "—"}
                  </td>
                  <td className="max-w-xs truncate px-2 py-1.5">{p.beskrivelse ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmt(p.mengdeAnbud)}</td>
                  <td className="px-2 py-1.5">{p.enhet ?? "—"}</td>
                  {harSammenligning && (
                    <>
                      <td className="w-[2px] bg-gray-200 px-0" />
                      <td className="px-2 py-1.5 text-right font-mono text-blue-700">{rad.nota ? fmt(rad.mengdeDenne) : "—"}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-blue-700">{rad.nota ? fmt(rad.mengdeTotal) : "—"}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-gray-400">{rad.nota ? fmt(Number(rad.mengdeTotal) - Number(rad.mengdeDenne)) : "—"}</td>
                    </>
                  )}
                  <td className="px-2 py-1.5 text-right font-mono">{fmt(p.enhetspris)}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmt(p.sumAnbud)}</td>
                  {harSammenligning && (
                    <>
                      <td className="w-[2px] bg-gray-200 px-0" />
                      <td className="px-2 py-1.5 text-right font-mono text-blue-700">{rad.nota ? fmt(rad.verdiDenne) : "—"}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-blue-700">{rad.nota ? fmt(rad.verdiTotal) : "—"}</td>
                      <td className={`px-2 py-1.5 text-right font-mono ${rad.nota && rad.prosentFerdig > overskridelseTerskel ? "text-red-600 font-semibold" : "text-blue-700"}`}>{rad.nota ? fmt(rad.prosentFerdig, 0) : "—"}</td>
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
              {harSammenligning && (
                <>
                  <td className="px-0" />
                  <td className="px-2 py-2" />
                  <td className="px-2 py-2" />
                  <td className="px-2 py-2" />
                </>
              )}
              <td className="px-2 py-2" />
              <td className="px-2 py-2 text-right font-mono">{fmt(totalBudsjett)}</td>
              {harSammenligning && (
                <>
                  <td className="px-0" />
                  <td className="px-2 py-2 text-right font-mono text-blue-700">{fmt(totalVerdiDenne)}</td>
                  <td className="px-2 py-2 text-right font-mono text-blue-700">{fmt(totalVerdiTotal)}</td>
                  <td className="px-2 py-2" />
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
                  <Kort label="Mengde" verdi={fmt(p.mengdeAnbud)} />
                  <Kort label="Enhet" verdi={p.enhet ?? "—"} mono={false} />
                  <Kort label="Enhetspris" verdi={fmt(p.enhetspris)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Kort label="Sum anbud" verdi={fmt(p.sumAnbud)} bg="bg-blue-50" />
                  {(() => {
                    const nsInfo = finnNsKode(p, poster);
                    if (!nsInfo) return null;
                    return <Kort
                      label="NS-kode"
                      verdi={nsInfo.nsKode}
                      sub={nsInfo.kilde === "arvet" ? `Videreført fra post ${nsInfo.postnr}` : nsInfo.sub}
                      bg={nsInfo.kilde === "arvet" ? "bg-amber-50/50" : "bg-amber-50"}
                      mono={false}
                    />;
                  })()}
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
                {p.importNotat && (
                  <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
                    <div className="text-xs font-medium text-amber-700">Korrigert ved import</div>
                    <div className="text-xs text-amber-600">{p.importNotat}</div>
                  </div>
                )}
                {p.eksternNotat && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-gray-500">Ekstern merknad</div>
                    <div className="text-sm text-gray-700">{p.eksternNotat}</div>
                  </div>
                )}
                {p.postnr && prosjektId && (
                  <DokumentasjonSeksjon
                    prosjektId={prosjektId}
                    kontraktId={kontraktId ?? null}
                    postnr={p.postnr}
                  />
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

function DokumentasjonSeksjon({
  prosjektId,
  kontraktId,
  postnr,
}: {
  prosjektId: string;
  kontraktId: string | null;
  postnr: string;
}) {
  const { data: sider, isLoading } = trpc.mengde.hentDokumentasjonForPost.useQuery(
    { projectId: prosjektId, kontraktId: kontraktId ?? undefined, postnr },
    { enabled: !!postnr },
  );

  // Grupper per dokument
  const gruppert = useMemo(() => {
    if (!sider || sider.length === 0) return [];
    const map = new Map<string, { dok: (typeof sider)[0]["document"]; pages: number[] }>();
    for (const s of sider) {
      const entry = map.get(s.document.id);
      if (entry) {
        entry.pages.push(s.pageNumber);
      } else {
        map.set(s.document.id, { dok: s.document, pages: [s.pageNumber] });
      }
    }
    return Array.from(map.values()).map((g) => ({
      ...g,
      pages: g.pages.sort((a, b) => a - b),
    }));
  }, [sider]);

  const apnePdf = (fileUrl: string | null, side: number) => {
    if (!fileUrl) return;
    window.open(`/api${fileUrl}#page=${side}`, "_blank");
  };

  return (
    <div className="rounded border p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-500">
        <FileSearch className="h-3.5 w-3.5" />
        Dokumentasjon for post {postnr}
      </div>
      {isLoading ? (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          Søker...
        </div>
      ) : gruppert.length === 0 ? (
        <div className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-600">
          Ingen dokumentasjon funnet. Koble en mappe med målebrev til kontrakten for å se dokumentasjon her.
        </div>
      ) : (
        <div className="space-y-2">
          {gruppert.map((g) => (
            <div key={g.dok.id}>
              <div className="text-xs font-medium text-gray-600 truncate" title={g.dok.filename}>
                {g.dok.filename}
              </div>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {g.pages.map((side) => (
                  <button
                    key={side}
                    onClick={() => apnePdf(g.dok.fileUrl, side)}
                    className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-600 hover:bg-sitedoc-secondary hover:text-white transition-colors"
                    title={`Åpne side ${side}`}
                  >
                    s.{side}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="text-[10px] text-gray-400">{sider?.length} sider fra {gruppert.length} dokument{gruppert.length > 1 ? "er" : ""}</div>
        </div>
      )}
    </div>
  );
}

function fmt(verdi: unknown, desimaler = 2): string {
  if (verdi === null || verdi === undefined) return "—";
  const num = Number(verdi);
  if (isNaN(num)) return "—";
  return num.toLocaleString("nb-NO", { minimumFractionDigits: desimaler, maximumFractionDigits: desimaler });
}

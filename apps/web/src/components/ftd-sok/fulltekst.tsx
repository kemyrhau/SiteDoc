"use client";

import { useMemo, useEffect, useRef } from "react";
import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { SEMANTISK_KLASSE } from "./utsnitt";

interface FulltekstProps {
  prosjektId: string;
  documentId: string | null;
  søkeord?: string;
  /**
   * chunkIndex til valgt treff (S1a): høyre rute scroller til `[data-chunk=N]` og markerer den
   * chunkens ordtreff sterkere. null = ingen scroll. Virker også uten sidetall (DOCX).
   */
  valgtChunkIndex?: number | null;
  /** S5: setningen som forklarer et rent semantisk valgt treff — markeres i valgt chunk. */
  semantiskSetning?: string | null;
}

export const MARK_KLASSE = "rounded bg-yellow-200 px-0.5";
export const MARK_VALGT_KLASSE = "rounded bg-amber-300 px-0.5 ring-1 ring-amber-500";

/**
 * Hel-avsnitt-markering (relay 29.10): valgt chunk får svak bakgrunn og en strek i venstre kant — uansett
 * om S5-setningen finnes. Målt på test (`e8aac60a`, Røstbakken «dagmulkt»): rent semantiske treff kom med
 * `semantiskSetning: null` (chunken inneholder ikke ordet), så høyre rute stod helt umarkert etter rulling.
 * Chunken er et inline <span> i en `whitespace-pre-wrap`-blokk: `display:block` ville lagt linjeskift ved
 * hver chunk-grense (PDF-chunker deles midt i setninger etter overlapp-kapping). Derfor inline +
 * `box-decoration-clone`, så bakgrunn, venstre strek (inset-skygge) og padding tegnes på hvert linjefragment.
 * Farge: `sitedoc-secondary` #3b82f6 (ui-standarder.md § Fargepalett) — ikke gul (ordtreff), ikke lilla (S5).
 */
export const VALGT_AVSNITT_KLASSE =
  "box-decoration-clone bg-sitedoc-secondary/10 pl-1 shadow-[inset_3px_0_0_0_#3b82f6]";

/** Scroll-målet for valgt treff: chunk-ankeret, aldri første <mark> på siden (S1a/T1). */
export function finnScrollMål(beholder: ParentNode | null, valgtChunkIndex: number | null | undefined): Element | null {
  if (!beholder || valgtChunkIndex == null) return null;
  return beholder.querySelector(`[data-chunk="${valgtChunkIndex}"]`);
}

/** Luft over valgt chunk når ruta rulles (tidligere `scroll-mt-24`). */
export const RULLE_MARG = 96;

/**
 * F3 (relay 29.10): rull KUN nærmeste `[data-rullebeholder]` (høyre rute i søkesiden), ellers egen
 * beholder. `scrollIntoView` rullet alle forfedre — også `main` — så søkefelt og treffliste forsvant.
 */
export function rullTilChunk(egenBeholder: HTMLElement | null, valgtChunkIndex: number | null | undefined): void {
  const mål = finnScrollMål(egenBeholder, valgtChunkIndex);
  if (!mål || !egenBeholder) return;
  const beholder = egenBeholder.closest<HTMLElement>("[data-rullebeholder]") ?? egenBeholder;
  const top = mål.getBoundingClientRect().top - beholder.getBoundingClientRect().top + beholder.scrollTop - RULLE_MARG;
  beholder.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

interface Segment {
  chunkIndex: number;
  tekst: string;
}

export function Fulltekst({ prosjektId, documentId, søkeord, valgtChunkIndex, semantiskSetning }: FulltekstProps) {
  const { t } = useTranslation();
  const beholderRef = useRef<HTMLDivElement>(null);
  const { data: chunks, isLoading } = trpc.ftdSok.hentDokumentChunks.useQuery(
    { projectId: prosjektId, documentId: documentId! },
    { enabled: !!documentId },
  );

  // Rull høyre rute til valgt chunk (F3: aldri forfedrene).
  useEffect(() => {
    rullTilChunk(beholderRef.current, valgtChunkIndex);
  }, [valgtChunkIndex, documentId, chunks]);

  // Sammenhengende tekst pr. side med overlapp fjernet, men hver chunk beholder sitt eget anker.
  const sider = useMemo(() => {
    if (!chunks || chunks.length === 0) return [];

    const perSide = new Map<number, typeof chunks>();
    for (const c of chunks) {
      const side = c.pageNumber ?? 0;
      const arr = perSide.get(side) ?? [];
      arr.push(c);
      perSide.set(side, arr);
    }

    const result: Array<{ side: number; segmenter: Segment[]; sectionTitle: string | null }> = [];

    for (const [side, sideChunks] of perSide) {
      sideChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

      const segmenter: Segment[] = [];
      let forrige = "";
      for (const chunk of sideChunks) {
        // Overlapp: starten av denne chunken gjentar slutten av forrige → kapp den bort.
        const tekst = forrige ? chunk.chunkText.slice(finnOverlapp(forrige, chunk.chunkText)) : chunk.chunkText;
        segmenter.push({ chunkIndex: chunk.chunkIndex, tekst });
        forrige = chunk.chunkText;
      }

      result.push({ side, segmenter, sectionTitle: sideChunks[0]?.sectionTitle ?? null });
    }

    result.sort((a, b) => a.side - b.side);
    return result;
  }, [chunks]);

  if (!documentId) {
    return (
      <div className="text-sm text-gray-400">
        {t("ftdSok.velgTreff")}
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-sm text-gray-400">{t("ftdSok.lasterInnhold")}</div>;
  }

  if (sider.length === 0) {
    return <div className="text-sm text-gray-400">{t("ftdSok.ingenInnhold")}</div>;
  }

  // Finn filnavn fra første chunk
  const filnavn = (chunks as Array<{ document?: { filename?: string } }>)?.[0]?.document?.filename;

  return (
    <div ref={beholderRef} className="space-y-4 overflow-y-auto">
      {filnavn && (
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <FileText className="h-4 w-4 text-gray-400" />
          {filnavn}
        </div>
      )}
      {sider.map((s) => (
        <div key={s.side} data-side={s.side}>
          {s.side > 0 && (
            <div className="mb-1 text-xs text-gray-400">
              {t("ftdSok.sideHode", { side: s.side })}
              {s.sectionTitle && <span className="ml-2">· {s.sectionTitle}</span>}
            </div>
          )}
          {/* min-w-0 + break-words (F3): gab-chunker kan ha tusentegns ord uten mellomrom. */}
          <div className="min-w-0 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">
            {s.segmenter.map((seg) => {
              const erValgt = seg.chunkIndex === valgtChunkIndex;
              return (
                <span key={seg.chunkIndex} data-chunk={seg.chunkIndex} className={erValgt ? VALGT_AVSNITT_KLASSE : undefined}>
                  <ChunkTekst
                    tekst={seg.tekst}
                    søkeord={søkeord}
                    markKlasse={erValgt ? MARK_VALGT_KLASSE : MARK_KLASSE}
                    semantiskSetning={erValgt ? semantiskSetning : null}
                    semantiskEtikett={t("ftdSok.semantiskTreff")}
                  />
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Tekst i én chunk: ordtreff markert, og ev. den semantiske setningen med egen stil (S5). */
function ChunkTekst({
  tekst,
  søkeord,
  markKlasse,
  semantiskSetning,
  semantiskEtikett,
}: {
  tekst: string;
  søkeord?: string;
  markKlasse: string;
  semantiskSetning?: string | null;
  semantiskEtikett: string;
}) {
  const vanlig = (x: string) =>
    søkeord ? <HighlightTekst tekst={x} søkeord={søkeord} markKlasse={markKlasse} /> : x;
  // Setningen fra `finnBesteSetning` er alltid en eksakt delstreng av chunk-teksten (låsetest i
  // ai-sok-rangering.test.ts), så indexOf trenger ingen mellomrom-toleranse. null → ingen S5-markering
  // (målt 29.10: chunken inneholder ikke søkeordet); hel-avsnitt-markeringen på <span data-chunk> står uansett.
  const pos = semantiskSetning ? tekst.indexOf(semantiskSetning) : -1;
  if (!semantiskSetning || pos < 0) return <>{vanlig(tekst)}</>;
  return (
    <>
      {vanlig(tekst.slice(0, pos))}
      <span className="mr-1 rounded bg-purple-100 px-1 align-middle text-[10px] font-medium text-purple-700">
        {semantiskEtikett}
      </span>
      <span data-semantisk="true" className={SEMANTISK_KLASSE}>
        {semantiskSetning}
      </span>
      {vanlig(tekst.slice(pos + semantiskSetning.length))}
    </>
  );
}

/** Finn antall tegn som overlapper mellom slutten av a og starten av b */
function finnOverlapp(a: string, b: string): number {
  // Sjekk opptil 200 tegn overlapp
  const maks = Math.min(200, a.length, b.length);
  for (let len = maks; len >= 20; len--) {
    const slutt = a.slice(-len);
    const start = b.slice(0, len);
    if (slutt === start) return len;
  }
  return 0;
}

/** Highlight søkeord i tekst */
export function HighlightTekst({
  tekst,
  søkeord,
  markKlasse = MARK_KLASSE,
}: {
  tekst: string;
  søkeord: string;
  markKlasse?: string;
}) {
  const termer = søkeord
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (termer.length === 0) return <>{tekst}</>;

  // Bygg regex for alle termer
  const escaped = termer.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");

  const deler = tekst.split(regex);

  return (
    <>
      {deler.map((del, i) => {
        const erMatch = termer.some(
          (t) => del.toLowerCase() === t,
        );
        return erMatch ? (
          <mark key={i} className={markKlasse}>
            {del}
          </mark>
        ) : (
          <span key={i}>{del}</span>
        );
      })}
    </>
  );
}

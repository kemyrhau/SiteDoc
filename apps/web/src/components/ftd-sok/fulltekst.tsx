"use client";

import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { FileText, ChevronUp, ChevronDown } from "lucide-react";
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
  /**
   * SØK-2: chunkIndex for dokumentets treff i trefflista (stigende). Brukes som nav-enhet når
   * dokumentet ikke har noen ordforekomst (rent semantisk), og for å synke lista ved forrige/neste.
   */
  treffChunkIndekser?: number[];
  /**
   * SØK-2: forrige/neste flyttet til en annen chunk. Siden setter `valgtChunkIndex` (blokk-rammen følger)
   * og `valgtTreffId` når chunken er et treff i lista — ellers beholder lista valgt treff.
   */
  onVelgForekomst?: (chunkIndex: number) => void;
}

export const MARK_KLASSE = "rounded bg-yellow-200 px-0.5";
export const MARK_VALGT_KLASSE = "rounded bg-amber-300 px-0.5 ring-1 ring-amber-500";

/**
 * Hel-avsnitt-markering (relay 29.10): valgt chunk får svak bakgrunn og en strek i venstre kant — uansett
 * om S5-setningen finnes. Målt på test (`e8aac60a`, Røstbakken «dagmulkt»): rent semantiske treff kom med
 * `semantiskSetning: null` (chunken inneholder ikke ordet), så høyre rute stod helt umarkert etter rulling.
 *
 * To varianter (blokk-ramme, relay 30.10, Kenneth-hjemmel «Ja, 1 og 2»):
 * - **Blokk** når chunk-teksten slutter med linjeskift (hele avsnitt — gab-chunker avslutter alltid med `\n`):
 *   ÉN ramme med venstre strek, bakgrunn, avrundet høyre hjørne og padding. Med inline + clone ble strek og
 *   bakgrunn tegnet pr. linjefragment — 26 striper for 376 tegn, løse streker på tomme linjer, bakgrunn bare
 *   over tekstbredden (Kontrollør M1, målt `relay/sok-visning/dagmulkt-ramme-A-B-C.png`).
 * - **Inline** (fallback) når chunken er kuttet midt i en setning (PDF-chunker etter overlapp-kapping):
 *   `display:block` ville gitt linjeskift ved chunk-grensen, så bakgrunn/strek males pr. linjefragment med
 *   `box-decoration-clone`.
 * Farge: `sitedoc-secondary` #3b82f6 (ui-standarder.md § Fargepalett) — ikke gul (ordtreff), ikke lilla (S5).
 */
export const VALGT_AVSNITT_KLASSE =
  "box-decoration-clone bg-sitedoc-secondary/10 pl-1 shadow-[inset_3px_0_0_0_#3b82f6]";
export const VALGT_AVSNITT_BLOKK_KLASSE =
  "block my-1 rounded-r-md border-l-[3px] border-sitedoc-secondary bg-sitedoc-secondary/10 px-2.5 py-1.5";

/** Blokk-ramme når chunken er et helt avsnitt (slutter med linjeskift), ellers inline-fallback. */
export function velgAvsnittsklasse(tekst: string): string {
  return tekst.endsWith("\n") ? VALGT_AVSNITT_BLOKK_KLASSE : VALGT_AVSNITT_KLASSE;
}

/**
 * Scroll-målet for valgt treff: chunk-ankeret, aldri første <mark> på siden (S1a/T1).
 * SØK-2: med `forekomst` er målet den aktive ordforekomsten (`[data-forekomst=N]`) — brukes kun av forrige/neste.
 */
export function finnScrollMål(
  beholder: ParentNode | null,
  valgtChunkIndex: number | null | undefined,
  forekomst?: number | null,
): Element | null {
  if (!beholder) return null;
  if (forekomst != null) return beholder.querySelector(`[data-forekomst="${forekomst}"]`);
  if (valgtChunkIndex == null) return null;
  return beholder.querySelector(`[data-chunk="${valgtChunkIndex}"]`);
}

/** Luft over valgt chunk når ruta rulles (tidligere `scroll-mt-24`). Også luft under den klistrede raden (SØK-2). */
export const RULLE_MARG = 96;

/**
 * F3 (relay 29.10): rull KUN nærmeste `[data-rullebeholder]` (høyre rute i søkesiden), ellers egen
 * beholder. `scrollIntoView` rullet alle forfedre — også `main` — så søkefelt og treffliste forsvant.
 */
export function rullTilChunk(
  egenBeholder: HTMLElement | null,
  valgtChunkIndex: number | null | undefined,
  forekomst?: number | null,
): void {
  const mål = finnScrollMål(egenBeholder, valgtChunkIndex, forekomst);
  if (!mål || !egenBeholder) return;
  const beholder = egenBeholder.closest<HTMLElement>("[data-rullebeholder]") ?? egenBeholder;
  const top = mål.getBoundingClientRect().top - beholder.getBoundingClientRect().top + beholder.scrollTop - RULLE_MARG;
  beholder.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

/**
 * SØK-2 M3: finn antall tegn som overlapper mellom slutten av a og starten av b. Taket 200 ≥ chunkerens
 * `OVERLAPP = 100` (ftd-prosessering.ts) — låst med test, ikke med import mellom api og web.
 */
export function finnOverlapp(a: string, b: string): number {
  const maks = Math.min(200, a.length, b.length);
  for (let len = maks; len >= 20; len--) {
    const slutt = a.slice(-len);
    const start = b.slice(0, len);
    if (slutt === start) return len;
  }
  return 0;
}

/** Søketermer slik `HighlightTekst` markerer dem: ord lengre enn 2 tegn, uavhengig av store/små bokstaver. */
function markeringsTermer(søkeord: string | undefined): string[] {
  return (søkeord ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/** Del tekst i vanlige biter og ordtreff — én kilde for både <mark>-rendering og forekomst-tellingen. */
export function delOppTermer(tekst: string, søkeord: string | undefined): Array<{ tekst: string; erMatch: boolean }> {
  const termer = markeringsTermer(søkeord);
  if (termer.length === 0) return [{ tekst, erMatch: false }];
  const escaped = termer.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  return tekst.split(regex).map((del) => ({ tekst: del, erMatch: termer.some((t) => del.toLowerCase() === t) }));
}

/** Én bit av en chunk slik den tegnes: vanlig tekst, ordforekomst (nummerert i dokumentrekkefølge), S5-etikett/-setning. */
export type ChunkDel =
  | { type: "tekst"; tekst: string }
  | { type: "mark"; tekst: string; forekomst: number }
  | { type: "etikett" }
  | { type: "semantisk"; tekst: string };

interface Segment {
  chunkIndex: number;
  tekst: string;
  erValgt: boolean;
  klasse: string | undefined;
  deler: ChunkDel[];
}

interface Side {
  side: number;
  segmenter: Segment[];
  sectionTitle: string | null;
}

/**
 * Deler opp chunkens tekst: ordtreff via `delOppTermer`, og (for valgt chunk) S5-setningen som egen del.
 * Setningen fra `finnBesteSetning` er alltid en eksakt delstreng av chunk-teksten (låsetest i
 * ai-sok-rangering.test.ts), så indexOf trenger ingen mellomrom-toleranse. null → ingen S5-markering
 * (målt 29.10: chunken inneholder ikke søkeordet); hel-avsnitt-markeringen på <span data-chunk> står uansett.
 */
function byggDeler(
  tekst: string,
  søkeord: string | undefined,
  semantiskSetning: string | null | undefined,
  nesteForekomst: { n: number },
): ChunkDel[] {
  const vanlig = (x: string): ChunkDel[] =>
    delOppTermer(x, søkeord).map((d) =>
      d.erMatch ? { type: "mark", tekst: d.tekst, forekomst: nesteForekomst.n++ } : { type: "tekst", tekst: d.tekst },
    );
  const pos = semantiskSetning ? tekst.indexOf(semantiskSetning) : -1;
  if (!semantiskSetning || pos < 0) return vanlig(tekst);
  return [
    ...vanlig(tekst.slice(0, pos)),
    { type: "etikett" },
    { type: "semantisk", tekst: semantiskSetning },
    ...vanlig(tekst.slice(pos + semantiskSetning.length)),
  ];
}

export function Fulltekst({
  prosjektId,
  documentId,
  søkeord,
  valgtChunkIndex,
  semantiskSetning,
  treffChunkIndekser,
  onVelgForekomst,
}: FulltekstProps) {
  const { t } = useTranslation();
  const beholderRef = useRef<HTMLDivElement>(null);
  const { data: chunks, isLoading } = trpc.ftdSok.hentDokumentChunks.useQuery(
    { projectId: prosjektId, documentId: documentId! },
    { enabled: !!documentId },
  );

  // Sammenhengende tekst pr. side med overlapp fjernet, men hver chunk beholder sitt eget anker.
  // SØK-2 M3: valgt chunk vises HEL; overlappet (starten av valgt chunk = slutten av forgjengeren) tas fra
  // forgjengerens hale i stedet. Sidens samlede tekst er uendret — S5-setningen (ofte i overlapp-fragmentet)
  // havner dermed inne i blokk-rammen. Forekomstene nummereres i dokumentrekkefølge (nav-enhet, § 2).
  const { sider, forekomster } = useMemo(() => {
    const tom = { sider: [] as Side[], forekomster: [] as Array<{ chunkIndex: number }> };
    if (!chunks || chunks.length === 0) return tom;

    const perSide = new Map<number, typeof chunks>();
    for (const c of chunks) {
      const side = c.pageNumber ?? 0;
      const arr = perSide.get(side) ?? [];
      arr.push(c);
      perSide.set(side, arr);
    }

    const råSider: Array<{ side: number; råSegmenter: Array<{ chunkIndex: number; tekst: string }>; sectionTitle: string | null }> = [];
    for (const [side, sideChunks] of perSide) {
      sideChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
      const råSegmenter: Array<{ chunkIndex: number; tekst: string }> = [];
      let forrige = "";
      for (const chunk of sideChunks) {
        const ov = forrige ? finnOverlapp(forrige, chunk.chunkText) : 0;
        if (chunk.chunkIndex === valgtChunkIndex && ov > 0) {
          const forgjenger = råSegmenter[råSegmenter.length - 1];
          if (forgjenger) forgjenger.tekst = forgjenger.tekst.slice(0, Math.max(0, forgjenger.tekst.length - ov));
          råSegmenter.push({ chunkIndex: chunk.chunkIndex, tekst: chunk.chunkText });
        } else {
          // Overlapp: starten av denne chunken gjentar slutten av forrige → kapp den bort.
          råSegmenter.push({ chunkIndex: chunk.chunkIndex, tekst: chunk.chunkText.slice(ov) });
        }
        forrige = chunk.chunkText;
      }
      råSider.push({ side, råSegmenter, sectionTitle: sideChunks[0]?.sectionTitle ?? null });
    }
    råSider.sort((a, b) => a.side - b.side);

    const teller = { n: 0 };
    const forekomster: Array<{ chunkIndex: number }> = [];
    const sider: Side[] = råSider.map((s) => ({
      side: s.side,
      sectionTitle: s.sectionTitle,
      segmenter: s.råSegmenter.map((seg) => {
        const erValgt = seg.chunkIndex === valgtChunkIndex;
        const klasse = erValgt ? velgAvsnittsklasse(seg.tekst) : undefined;
        // Blokk-rammen avslutter linjen selv; det avsluttende linjeskiftet ville gitt en tom linje i rammen.
        const tekst = klasse === VALGT_AVSNITT_BLOKK_KLASSE ? seg.tekst.replace(/\n$/, "") : seg.tekst;
        const deler = byggDeler(tekst, søkeord, erValgt ? semantiskSetning : null, teller);
        for (const d of deler) if (d.type === "mark") forekomster.push({ chunkIndex: seg.chunkIndex });
        return { chunkIndex: seg.chunkIndex, tekst, erValgt, klasse, deler };
      }),
    }));
    return { sider, forekomster };
  }, [chunks, søkeord, valgtChunkIndex, semantiskSetning]);

  // ---- SØK-2 forrige/neste (spec § 2) ----
  // Enhet: ordforekomst når dokumentet har noen; ellers dokumentets treff-chunks fra lista; ellers skjult.
  const chunkEnheter = useMemo(
    () => (forekomster.length === 0 ? (treffChunkIndekser ?? []) : []),
    [forekomster.length, treffChunkIndekser],
  );
  const [aktivForekomst, setAktivForekomst] = useState<number | null>(null);
  // Forrige/neste krysset en chunk-grense: siden flytter valgtChunkIndex dit — effekten under skal da ikke
  // nullstille telleren eller rulle til chunk-ankeret (rullingen går til forekomsten).
  const navMålRef = useRef<number | null>(null);
  const rullTilForekomstRef = useRef(false);

  // Liste-klikk / nytt dokument: teller = første forekomst i valgt chunk (eller «–»), rull til chunk (F3: aldri forfedrene).
  useEffect(() => {
    if (navMålRef.current != null && navMålRef.current === valgtChunkIndex) {
      navMålRef.current = null;
      return;
    }
    navMålRef.current = null;
    const første = forekomster.findIndex((f) => f.chunkIndex === valgtChunkIndex);
    setAktivForekomst(første >= 0 ? første : null);
    rullTilChunk(beholderRef.current, valgtChunkIndex);
    // `forekomster` utelatt med vilje: tellerens nullstilling skal følge valget, ikke søkeordet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valgtChunkIndex, documentId, chunks]);

  // Rull til aktiv forekomst — kun etter forrige/neste.
  useEffect(() => {
    if (!rullTilForekomstRef.current) return;
    rullTilForekomstRef.current = false;
    rullTilChunk(beholderRef.current, valgtChunkIndex, aktivForekomst);
  }, [aktivForekomst, valgtChunkIndex]);

  const antallEnheter = forekomster.length > 0 ? forekomster.length : chunkEnheter.length;
  const aktivEnhet =
    forekomster.length > 0
      ? aktivForekomst
      : (() => {
          const i = chunkEnheter.indexOf(valgtChunkIndex ?? -1);
          return i >= 0 ? i : null;
        })();

  const gåTil = useCallback(
    (retning: 1 | -1) => {
      if (antallEnheter === 0) return;
      // Rundgang ved grense (A3): siste → første, første → siste. Fra «–» går neste til første, forrige til siste.
      const neste =
        aktivEnhet == null
          ? retning === 1
            ? 0
            : antallEnheter - 1
          : (aktivEnhet + retning + antallEnheter) % antallEnheter;
      if (forekomster.length > 0) {
        const målChunk = forekomster[neste]!.chunkIndex;
        if (målChunk !== valgtChunkIndex) navMålRef.current = målChunk;
        rullTilForekomstRef.current = true;
        setAktivForekomst(neste);
        if (målChunk !== valgtChunkIndex) onVelgForekomst?.(målChunk);
      } else {
        const målChunk = chunkEnheter[neste]!;
        // Chunk-enhet: siden flytter valgtChunkIndex, effekten over ruller til chunk-ankeret.
        onVelgForekomst?.(målChunk);
      }
    },
    [antallEnheter, aktivEnhet, forekomster, chunkEnheter, valgtChunkIndex, onVelgForekomst],
  );

  // Tastatur: ↑/↓ KUN når fokus er i høyre rute ([data-rullebeholder], tabIndex=0) eller på knappene — aldri globalt.
  const gåTilRef = useRef(gåTil);
  gåTilRef.current = gåTil;
  useEffect(() => {
    const egen = beholderRef.current;
    if (!egen) return;
    const rute = egen.closest<HTMLElement>("[data-rullebeholder]") ?? egen;
    const lytter = (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      gåTilRef.current(e.key === "ArrowDown" ? 1 : -1);
    };
    rute.addEventListener("keydown", lytter);
    return () => rute.removeEventListener("keydown", lytter);
  }, [documentId, isLoading, sider.length]);

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
  const visNav = antallEnheter > 0;
  const tellerTekst = t("ftdSok.tellerForekomst", { n: aktivEnhet == null ? "–" : aktivEnhet + 1, m: antallEnheter });

  return (
    <div ref={beholderRef} className="space-y-4">
      {/* SØK-2 variant A: klistret rad = filnavn + teller + ▲▼. Negativ marg nøytraliserer rutas p-4 så raden
          dekker hele bredden; `overflow` på denne diven er fjernet (sticky trenger ruta som rulle-forelder). */}
      {(filnavn || visNav) && (
        <div
          data-nav-rad=""
          className="sticky top-0 z-10 -mx-4 -mt-4 flex items-center gap-2 border-b border-gray-200 bg-gray-50/95 px-4 py-2 text-sm font-medium text-gray-700 backdrop-blur"
        >
          <FileText className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="min-w-0 flex-1 truncate" title={filnavn}>{filnavn}</span>
          {visNav && (
            <>
              <span data-teller="" aria-live="polite" className="text-xs font-normal tabular-nums text-gray-500">
                {tellerTekst}
              </span>
              <button
                type="button"
                onClick={() => gåTil(-1)}
                title={t("ftdSok.forrigeTreff")}
                aria-label={t("ftdSok.forrigeTreff")}
                className="rounded border border-gray-300 bg-white p-0.5 text-gray-600 hover:bg-gray-100"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => gåTil(1)}
                title={t("ftdSok.nesteTreff")}
                aria-label={t("ftdSok.nesteTreff")}
                className="rounded border border-gray-300 bg-white p-0.5 text-gray-600 hover:bg-gray-100"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </>
          )}
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
            {s.segmenter.map((seg) => (
              <span key={seg.chunkIndex} data-chunk={seg.chunkIndex} className={seg.klasse}>
                <ChunkTekst deler={seg.deler} aktivForekomst={aktivForekomst} semantiskEtikett={t("ftdSok.semantiskTreff")} />
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Tekst i én chunk: ordtreff markert, og ev. den semantiske setningen med egen stil (S5).
 * SØK-2 § 3: kun aktiv forekomst får amber (`MARK_VALGT_KLASSE`), alle andre gul — også inne i rammen.
 */
function ChunkTekst({
  deler,
  aktivForekomst,
  semantiskEtikett,
}: {
  deler: ChunkDel[];
  aktivForekomst: number | null;
  semantiskEtikett: string;
}) {
  return (
    <>
      {deler.map((d, i) => {
        switch (d.type) {
          case "mark":
            return (
              <mark
                key={i}
                data-forekomst={d.forekomst}
                className={d.forekomst === aktivForekomst ? MARK_VALGT_KLASSE : MARK_KLASSE}
              >
                {d.tekst}
              </mark>
            );
          case "etikett":
            return (
              <span key={i} className="mr-1 rounded bg-purple-100 px-1 align-middle text-[10px] font-medium text-purple-700">
                {semantiskEtikett}
              </span>
            );
          case "semantisk":
            return (
              <span key={i} data-semantisk="true" className={SEMANTISK_KLASSE}>
                {d.tekst}
              </span>
            );
          default:
            return <span key={i}>{d.tekst}</span>;
        }
      })}
    </>
  );
}

/** Highlight søkeord i tekst (samme oppdeling som forekomst-tellingen i Fulltekst). */
export function HighlightTekst({
  tekst,
  søkeord,
  markKlasse = MARK_KLASSE,
}: {
  tekst: string;
  søkeord: string;
  markKlasse?: string;
}) {
  const deler = delOppTermer(tekst, søkeord);
  return (
    <>
      {deler.map((del, i) =>
        del.erMatch ? (
          <mark key={i} className={markKlasse}>
            {del.tekst}
          </mark>
        ) : (
          <span key={i}>{del.tekst}</span>
        ),
      )}
    </>
  );
}

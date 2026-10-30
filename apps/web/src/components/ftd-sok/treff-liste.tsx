"use client";

import { Fragment } from "react";
import { FileText, ExternalLink, Brain, BookOpen, Layers, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSignertLenkeApner } from "@/components/SignertLenke";
import { byggUtsnitt, posisjonsEtikett, SEMANTISK_KLASSE, type UtsnittDel } from "./utsnitt";

interface Treff {
  id: string;
  documentId: string;
  chunkText: string;
  chunkIndex?: number | null;
  pageNumber: number | null;
  sectionTitle: string | null;
  filename: string;
  fileUrl: string | null;
  docType: string | null;
  folderId: string | null;
  utdrag?: string | null;
  semantiskSetning?: string | null;
  metode?: "tekst" | "semantisk" | "begge";
  // Scoring (dev-modus): hybrid har score/cosineSim/reRankScore, leksikalsk har rank
  score?: number;
  cosineSim?: number;
  reRankScore?: number;
  rank?: number;
  /** SØK-2: antall treff-chunks i dokumentet totalt (server). Vist > tak → «Vis N flere». */
  antallIDok?: number;
  [key: string]: unknown;
}

/** SØK-2: porsjon pr. «Vis N flere»-klikk; gjentatte klikk til `antallIDok` er nådd. */
export const VIS_FLERE_PORSJON = 20;

interface TreffListeProps {
  treff: Treff[];
  onVelgTreff: (treff: Treff) => void;
  valgtId: string | null;
  søkeord: string;
  /** Vis score pr. metode (dev-modus, ?debug i URL) — F.2 presisjonsanalyse. */
  visScore?: boolean;
  /** SØK-2 «Vis N flere»: hent neste porsjon for dokumentet (`vist` = rader som alt vises). */
  onVisFlere?: (documentId: string, vist: number) => void;
  /** documentId som henter flere nå (knappen deaktiveres). */
  lasterFlereFor?: string | null;
}

/** Dev-modus: kompakt score-linje pr. treff. */
function ScoreLinje({ tr }: { tr: Treff }) {
  const deler: string[] = [];
  if (tr.score != null) deler.push(`score ${tr.score.toFixed(3)}`);
  if (tr.cosineSim != null) deler.push(`cos ${tr.cosineSim.toFixed(3)}`);
  if (tr.reRankScore != null) deler.push(`rerank ${tr.reRankScore.toFixed(3)}`);
  if (tr.rank != null && tr.score == null) deler.push(`rank ${tr.rank.toFixed(4)}`);
  if (deler.length === 0) return null;
  return (
    <div className="mt-1 font-mono text-[10px] text-fuchsia-600">{deler.join(" · ")}</div>
  );
}

/** Rendrer utsnittet (delt logikk i `utsnitt.ts`): gult = ordtreff, stiplet lilla = semantisk setning. */
export function UtsnittVisning({ deler }: { deler: UtsnittDel[] }) {
  const { t } = useTranslation();
  return (
    <>
      {deler.map((d, i) =>
        d.type === "treff" ? (
          <mark key={i} className="rounded bg-yellow-200 px-0.5">{d.tekst}</mark>
        ) : d.type === "semantisk" ? (
          <span key={i} className={SEMANTISK_KLASSE} title={t("ftdSok.semantiskTreff")}>
            {d.tekst}
          </span>
        ) : (
          <Fragment key={i}>{d.tekst}</Fragment>
        ),
      )}
    </>
  );
}

function Utdrag({ tr, søkeord }: { tr: Treff; søkeord: string }) {
  return (
    <UtsnittVisning
      deler={byggUtsnitt({
        chunkText: tr.chunkText,
        søkeord,
        utdrag: tr.utdrag,
        semantiskSetning: tr.semantiskSetning,
        sectionTitle: tr.sectionTitle,
        metode: tr.metode,
      })}
    />
  );
}

/** Posisjon: «side N» når sidetall finnes, ellers «avsnitt N» — aldri begge (S2). */
function Posisjon({ tr }: { tr: Treff }) {
  const { t } = useTranslation();
  const pos = posisjonsEtikett(tr.pageNumber, tr.chunkIndex);
  if (!pos) return null;
  return pos.type === "side" ? (
    <span>{t("ftdSok.side", { side: pos.nr })}</span>
  ) : (
    // 1-indeksert for brukeren (chunkIndex er 0-basert i databasen).
    <span className="text-gray-400">{t("ftdSok.chunk", { nr: pos.nr })}</span>
  );
}

/** Badge som viser hvilken søkemetode som ga treffet. */
function MetodeBadge({ metode }: { metode?: Treff["metode"] }) {
  const { t } = useTranslation();
  if (!metode) return null;
  const konfig =
    metode === "semantisk"
      ? { Ikon: Brain, tekst: t("ftdSok.metodeSemantisk"), klasse: "bg-purple-50 text-purple-600" }
      : metode === "begge"
        ? { Ikon: Layers, tekst: t("ftdSok.metodeBegge"), klasse: "bg-blue-50 text-blue-600" }
        : { Ikon: BookOpen, tekst: t("ftdSok.metodeTekst"), klasse: "bg-gray-100 text-gray-600" };
  const { Ikon, tekst, klasse } = konfig;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${klasse}`}>
      <Ikon className="h-3 w-3" />
      {tekst}
    </span>
  );
}

export function TreffListe({ treff, onVelgTreff, valgtId, søkeord, visScore, onVisFlere, lasterFlereFor }: TreffListeProps) {
  const { t } = useTranslation();
  // Hook FØR den tidlige returnen under (Rules of Hooks).
  const apneLenke = useSignertLenkeApner(treff.map((tr) => tr.fileUrl));
  if (treff.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-400">
        {t("ftdSok.ingenTreff")}
      </div>
    );
  }

  function åpneOriginal(tr: Treff) {
    apneLenke(tr.fileUrl, { nyFane: true });
  }

  // Grupper treff pr. dokument, bevar rekkefølge (første forekomst = beste rank).
  const grupper: Array<{ documentId: string; filename: string; fileUrl: string | null; treff: Treff[] }> = [];
  const indeks = new Map<string, number>();
  for (const tr of treff) {
    let i = indeks.get(tr.documentId);
    if (i === undefined) {
      i = grupper.length;
      indeks.set(tr.documentId, i);
      grupper.push({ documentId: tr.documentId, filename: tr.filename, fileUrl: tr.fileUrl, treff: [] });
    }
    grupper[i]!.treff.push(tr);
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-500">
        {t("ftdSok.antallTreffIDok", { treff: treff.length, dok: grupper.length })}
      </div>
      {grupper.map((g) => {
        // SØK-2 Treffliste A: serveren gir inntil 5 rader pr. dokument i første søk og `antallIDok` = totalt.
        // «Vis N flere» henter neste porsjon (VIS_FLERE_PORSJON) til alt vises; knappen forsvinner da.
        const vist = g.treff.length;
        const antallIDok = Math.max(vist, ...g.treff.map((tr) => tr.antallIDok ?? 0));
        const flere = antallIDok - vist;
        return (
        <div key={g.documentId} className="rounded border">
          {/* Dokument-hode */}
          <div className="flex items-center gap-2 border-b bg-gray-50 px-3 py-2">
            <FileText className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="flex-1 truncate text-sm font-medium" title={g.filename}>{g.filename}</span>
            {flere > 0 ? (
              <span className="text-[11px] text-gray-400">
                {t("ftdSok.antallTreffAv", { vist, antall: antallIDok })}
              </span>
            ) : (
              vist > 1 && (
                <span className="text-[11px] text-gray-400">
                  {t("ftdSok.antallTreffDok", { antall: vist })}
                </span>
              )
            )}
            <button
              onClick={() => åpneOriginal(g.treff[0]!)}
              className="rounded p-0.5 text-gray-300 hover:text-sitedoc-primary"
              title={t("handling.vis")}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Treff i dokumentet */}
          <div className="divide-y">
            {g.treff.map((tr) => (
              <button
                key={tr.id}
                onClick={() => onVelgTreff(tr)}
                onDoubleClick={() => åpneOriginal(tr)}
                className={`block w-full px-3 py-2 text-left transition-colors hover:bg-gray-50 ${
                  valgtId === tr.id ? "bg-blue-50" : ""
                }`}
              >
                {/* Plassering + metode */}
                <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500">
                  {tr.sectionTitle && (
                    <span className="font-medium text-gray-600">{tr.sectionTitle}</span>
                  )}
                  <Posisjon tr={tr} />
                  <span className="ml-auto"><MetodeBadge metode={tr.metode} /></span>
                </div>
                <div className="line-clamp-3 text-xs leading-relaxed text-gray-700">
                  <Utdrag tr={tr} søkeord={søkeord} />
                </div>
                {visScore && <ScoreLinje tr={tr} />}
              </button>
            ))}
            {flere > 0 && onVisFlere && (
              <button
                type="button"
                data-vis-flere={g.documentId}
                disabled={lasterFlereFor === g.documentId}
                onClick={() => onVisFlere(g.documentId, vist)}
                className="flex w-full items-center justify-center gap-1 px-3 py-1.5 text-xs text-sitedoc-primary hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                {t("ftdSok.visFlere", { antall: Math.min(VIS_FLERE_PORSJON, flere) })}
              </button>
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
}

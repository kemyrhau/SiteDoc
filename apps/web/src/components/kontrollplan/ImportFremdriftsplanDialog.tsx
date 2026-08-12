"use client";

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import {
  X,
  Upload,
  FileText,
  ChevronDown,
  ChevronRight,
  Check,
  ArrowLeft,
  ArrowRight,
  Loader2,
} from "lucide-react";
import {
  parseMSProjectXML,
  formaterDato,
  hentAlleBarneUIDs,
} from "@/lib/ms-project-parser";
import type { MSProjectTask, MSProjectData } from "@/lib/ms-project-parser";
import { useImportTilordning } from "./importTilordning/useImportTilordning";
import type { Faggruppe } from "./importTilordning/useImportTilordning";
import { ImportMalFaggruppeTilordning } from "./importTilordning/ImportMalFaggruppeTilordning";

interface ImportFremdriftsplanDialogProps {
  kontrollplanId: string;
  projectId: string;
  byggeplassId: string;
  onLukk: () => void;
  onImportert: () => void;
}

type Steg = 1 | 2 | 3 | "oppsummering";

export function ImportFremdriftsplanDialog({
  kontrollplanId,
  projectId,
  byggeplassId,
  onLukk,
  onImportert,
}: ImportFremdriftsplanDialogProps) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  // Steg-maskin
  const [steg, setSteg] = useState<Steg>(1);

  // Steg 1: Fil + oppgavevelger
  const [fil, setFil] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<MSProjectData | null>(null);
  const [parseFeil, setParseFeil] = useState<string | null>(null);
  const [parser, setParser] = useState(false);
  const [selectedUIDs, setSelectedUIDs] = useState<Set<number>>(new Set());
  const [expandedUIDs, setExpandedUIDs] = useState<Set<number>>(new Set());
  const [dragAktiv, setDragAktiv] = useState(false);

  // Oppsummering
  const [oppretterState, setOppretterState] = useState<"idle" | "pending" | "ferdig" | "feil">("idle");
  const [dedupMelding, setDedupMelding] = useState<string | null>(null);

  const stegNr = typeof steg === "number" ? steg : 4;

  // Mal/faggruppe-tilordning (steg 2 + 3) — egen hook, gjenbrukbar av del 2 (revisjon)
  const tilordning = useImportTilordning({ projectId, parsedData, selectedUIDs, stegNr });
  const {
    importPunkter,
    initSteg2,
    hentMalNavn,
    faggrupper,
    ekskludertAntall,
    fristRange,
    punkterUtenFaggruppe,
  } = tilordning;

  const opprettPunkter = trpc.kontrollplan.opprettPunkter.useMutation();

  // ──────── Steg 1: Fil-håndtering ────────

  const handleFilValgt = useCallback(async (file: File) => {
    setFil(file);
    setParseFeil(null);
    setParser(true);
    try {
      const text = await file.text();
      const data = await parseMSProjectXML(text);
      setParsedData(data);
      // Ekspander alle toppnivå-oppgaver
      setExpandedUIDs(new Set(data.tasks.map((t) => t.uid)));
      setSelectedUIDs(new Set());
    } catch (e) {
      setParseFeil(e instanceof Error ? e.message : t("kontrollplan.importUgyldigFil"));
      setParsedData(null);
    } finally {
      setParser(false);
    }
  }, [t]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragAktiv(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.toLowerCase().endsWith(".xml")) {
        handleFilValgt(file);
      } else {
        setParseFeil(t("kontrollplan.importUgyldigFil"));
      }
    },
    [handleFilValgt, t],
  );

  const toggleTask = useCallback((uid: number, task: MSProjectTask) => {
    setSelectedUIDs((prev) => {
      const next = new Set(prev);
      if (task.isSummary) {
        const barneUIDs = hentAlleBarneUIDs(task);
        const alleValgt = barneUIDs.every((u) => prev.has(u));
        if (alleValgt) {
          barneUIDs.forEach((u) => next.delete(u));
        } else {
          barneUIDs.forEach((u) => next.add(u));
        }
      } else {
        if (next.has(uid)) next.delete(uid);
        else next.add(uid);
      }
      return next;
    });
  }, []);

  const toggleExpand = useCallback((uid: number) => {
    setExpandedUIDs((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }, []);

  const velgAlle = useCallback(() => {
    if (!parsedData) return;
    setSelectedUIDs(new Set(parsedData.flatTasks.map((t) => t.uid)));
  }, [parsedData]);

  const fjernAlle = useCallback(() => {
    setSelectedUIDs(new Set());
  }, []);

  const handleOpprett = useCallback(async () => {
    if (importPunkter.length === 0) return;
    setOppretterState("pending");
    setDedupMelding(null);

    try {
      // Klient-dedup: filtrer bort rader som allerede er importert til denne
      // kontrollplanen (samme importTaskUid + mal). Gir en vennlig melding
      // framfor at datalagets unique-guard kaster en stygg feil ved re-import.
      const eksisterende = await utils.kontrollplan.hentForByggeplass.fetch({ byggeplassId });
      const eksisterendeSet = new Set(
        (eksisterende?.punkter ?? [])
          .filter((p) => p.importTaskUid != null)
          .map((p) => `${p.importTaskUid}:${p.sjekklisteMalId}`),
      );
      const medFaggruppe = importPunkter.filter((p) => p.faggruppeId);
      const nyePunkter = medFaggruppe.filter(
        (p) => !eksisterendeSet.has(`${p.taskUid}:${p.malId}`),
      );
      const antallHoppet = medFaggruppe.length - nyePunkter.length;

      if (nyePunkter.length === 0) {
        setDedupMelding(t("kontrollplan.importAlleredeImportert"));
        setOppretterState("idle");
        return;
      }

      // hoppetOver: rader som ble vist men bevisst ikke valgt — snapshot slik at
      // en senere revisjon (del 2) ikke maser om de samme radene igjen.
      const hoppetOver = (parsedData?.flatTasks ?? [])
        .filter((tk) => !tk.isSummary && !selectedUIDs.has(tk.uid))
        .map((tk) => ({ uid: tk.uid, navn: tk.name, wbs: tk.wbs }));

      // Grupper etter (sjekklisteMalId, faggruppeId)
      const grupper = new Map<string, typeof nyePunkter>();
      for (const p of nyePunkter) {
        const key = `${p.malId}__${p.faggruppeId}`;
        if (!grupper.has(key)) grupper.set(key, []);
        grupper.get(key)!.push(p);
      }

      // Sekvensiell opprettelse. Første kall oppretter importhendelsen og
      // returnerer importKildeId; påfølgende kall peker til samme rad.
      let importKildeId: string | null = null;
      let foersteKall = true;
      for (const [_key, punkter] of grupper) {
        const foerste = punkter[0]!;
        const res = await opprettPunkter.mutateAsync({
          kontrollplanId,
          sjekklisteMalId: foerste.malId,
          faggruppeId: foerste.faggruppeId!,
          milepelId: null,
          punkter: punkter.map((p) => ({
            omradeId: null,
            fristUke: p.frist?.uke ?? null,
            fristAar: p.frist?.aar ?? null,
            importTaskUid: p.taskUid,
            importWbs: p.wbs,
          })),
          ...(foersteKall
            ? {
                importKilde: {
                  filnavn: fil?.name ?? "ukjent",
                  antallParsedeRader: parsedData?.flatTasks.length ?? 0,
                  hoppetOver,
                },
              }
            : { importKildeId }),
        });
        if (foersteKall) importKildeId = res.importKildeId;
        foersteKall = false;
      }

      if (antallHoppet > 0) {
        setDedupMelding(t("kontrollplan.importHoppetDuplikater", { antall: antallHoppet }));
      }

      // Også punkter uten faggruppe — hopp over for nå (varsle bruker)
      utils.kontrollplan.hentForByggeplass.invalidate({ byggeplassId });
      setOppretterState("ferdig");
      setTimeout(() => onImportert(), 1000);
    } catch (_e) {
      setOppretterState("feil");
    }
  }, [importPunkter, kontrollplanId, byggeplassId, opprettPunkter, utils, onImportert, parsedData, selectedUIDs, fil, t]);

  // ──────── Rendering ────────

  function renderOppgaveTre(tasks: MSProjectTask[], level: number) {
    return tasks.map((task) => {
      const erValgt = task.isSummary
        ? hentAlleBarneUIDs(task).every((u) => selectedUIDs.has(u))
        : selectedUIDs.has(task.uid);
      const erDelvisValgt = task.isSummary && !erValgt &&
        hentAlleBarneUIDs(task).some((u) => selectedUIDs.has(u));
      const erExpanded = expandedUIDs.has(task.uid);

      return (
        <div key={task.uid}>
          <div
            className={`flex items-center gap-2 py-1 px-2 text-sm hover:bg-gray-50 rounded ${
              task.isSummary ? "font-medium" : ""
            }`}
            style={{ paddingLeft: `${level * 20 + 8}px` }}
          >
            {/* Expand/collapse for sammendrag */}
            {task.isSummary ? (
              <button
                onClick={() => toggleExpand(task.uid)}
                className="p-0.5 text-gray-400 hover:text-gray-600"
              >
                {erExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="w-4" />
            )}

            {/* Checkbox */}
            <input
              type="checkbox"
              checked={erValgt}
              ref={(el) => {
                if (el) el.indeterminate = !!erDelvisValgt;
              }}
              onChange={() => toggleTask(task.uid, task)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-sitedoc-primary focus:ring-sitedoc-primary"
            />

            {/* Navn */}
            <span className={`flex-1 truncate ${task.isSummary ? "text-gray-900" : "text-gray-700"}`}>
              {task.name}
            </span>

            {/* Datoer */}
            {task.start && task.finish && (
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {formaterDato(task.start)} – {formaterDato(task.finish)}
              </span>
            )}

            {/* Ressurser */}
            {task.resourceNames.length > 0 && (
              <span className="text-xs text-gray-400 truncate max-w-[150px]">
                {task.resourceNames.join(", ")}
              </span>
            )}
          </div>

          {/* Barn */}
          {task.isSummary && erExpanded && task.children.length > 0 && (
            renderOppgaveTre(task.children, level + 1)
          )}
        </div>
      );
    });
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-900">
              {t("kontrollplan.importFremdriftsplan")}
            </h2>
            {/* Steg-indikator */}
            <div className="flex items-center gap-1 text-xs text-gray-400">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-1">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${
                    steg === s || (steg === "oppsummering" && s === 3)
                      ? "bg-sitedoc-primary text-white"
                      : typeof steg === "number" && s < steg
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                  }`}>
                    {typeof steg === "number" && s < steg ? <Check className="h-3 w-3" /> : s}
                  </span>
                  {s < 3 && <span className="w-4 h-px bg-gray-200" />}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onLukk} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Innhold */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* ═══ STEG 1: Last opp og velg ═══ */}
          {steg === 1 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                {t("kontrollplan.importSteg1Tittel")}
              </h3>

              {/* Dra-og-slipp */}
              {!parsedData && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragAktiv(true); }}
                  onDragLeave={() => setDragAktiv(false)}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                    dragAktiv
                      ? "border-sitedoc-primary bg-blue-50"
                      : fil
                        ? "border-green-300 bg-green-50"
                        : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  {parser ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Parser...
                    </div>
                  ) : parseFeil ? (
                    <div className="text-center">
                      <div className="text-sm text-red-600 mb-2">{parseFeil}</div>
                      <button
                        onClick={() => { setFil(null); setParseFeil(null); }}
                        className="text-xs text-sitedoc-primary hover:underline"
                      >
                        {t("kontrollplan.importTilbake")}
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="mb-2 h-8 w-8 text-gray-400" />
                      <div className="text-sm text-gray-600">
                        {t("kontrollplan.importDraSlipp")},{" "}
                        <label className="cursor-pointer text-sitedoc-primary hover:underline">
                          {t("kontrollplan.importEllerVelg")}
                          <input
                            type="file"
                            className="hidden"
                            accept=".xml"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleFilValgt(f);
                            }}
                          />
                        </label>
                      </div>
                      <div className="mt-1 text-xs text-gray-400">MS Project XML (.xml)</div>
                    </>
                  )}
                </div>
              )}

              {/* Oppgave-tre */}
              {parsedData && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <FileText className="h-3.5 w-3.5" />
                        {fil?.name}
                      </div>
                      <button
                        onClick={() => { setFil(null); setParsedData(null); setSelectedUIDs(new Set()); }}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        {t("handling.rediger")}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={velgAlle} className="text-xs text-sitedoc-primary hover:underline">
                        {t("kontrollplan.importVelgAlle")}
                      </button>
                      <span className="text-gray-300">|</span>
                      <button onClick={fjernAlle} className="text-xs text-gray-400 hover:underline">
                        {t("kontrollplan.importFjernAlle")}
                      </button>
                      <span className="text-xs text-gray-400 ml-2">
                        {t("kontrollplan.importAktiviteter", { antall: selectedUIDs.size })}
                      </span>
                    </div>
                  </div>

                  <div className="border rounded-lg max-h-[45vh] overflow-y-auto">
                    {renderOppgaveTre(parsedData.tasks, 0)}
                  </div>

                  {parsedData.projectName && (
                    <div className="mt-2 text-xs text-gray-400">
                      {parsedData.projectName} — {parsedData.flatTasks.length} aktiviteter, {parsedData.resources.length} ressurser
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══ STEG 2: Ressurser → Faggrupper ═══ */}
          {steg === 2 && (
            <ImportMalFaggruppeTilordning steg={2} projectId={projectId} tilordning={tilordning} />
          )}

          {/* ═══ STEG 3: Tilordne maler ═══ */}
          {steg === 3 && (
            <ImportMalFaggruppeTilordning steg={3} projectId={projectId} tilordning={tilordning} />
          )}

          {/* ═══ OPPSUMMERING ═══ */}
          {steg === "oppsummering" && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                {t("kontrollplan.importOppsummering")}
              </h3>

              {/* Sammendrag */}
              <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm text-gray-700">
                <div className="font-medium">
                  {t("kontrollplan.importOpprett", { antall: importPunkter.filter((p) => p.faggruppeId).length })}
                </div>
                {fristRange && (
                  <div className="text-xs text-gray-500 mt-1">
                    {t("kontrollplan.importFrister", { fra: fristRange.fra, til: fristRange.til })}
                  </div>
                )}
                {ekskludertAntall > 0 && (
                  <div className="text-xs text-amber-600 mt-1">
                    {t("kontrollplan.importEkskludert", { antall: ekskludertAntall })}
                  </div>
                )}
                {punkterUtenFaggruppe > 0 && (
                  <div className="text-xs text-amber-600 mt-1">
                    {punkterUtenFaggruppe} punkt uten faggruppe — hoppes over
                  </div>
                )}
              </div>

              {/* Gruppert liste: mal × faggruppe */}
              <div className="border rounded-lg max-h-[40vh] overflow-y-auto">
                {(() => {
                  // Grupper etter mal+faggruppe
                  const grupper = new Map<string, { malNavn: string; fgNavn: string; aktiviteter: string[]; frister: { uke: number; aar: number }[] }>();
                  for (const p of importPunkter.filter((p) => p.faggruppeId)) {
                    const key = `${p.malId}__${p.faggruppeId}`;
                    if (!grupper.has(key)) {
                      const fg = (faggrupper as Faggruppe[])?.find((f) => f.id === p.faggruppeId);
                      grupper.set(key, { malNavn: hentMalNavn(p.malId), fgNavn: fg?.name ?? "", aktiviteter: [], frister: [] });
                    }
                    const g = grupper.get(key)!;
                    g.aktiviteter.push(p.name);
                    if (p.frist) g.frister.push(p.frist);
                  }
                  return [...grupper.values()].map((g, i) => {
                    const minUke = g.frister.length > 0 ? Math.min(...g.frister.map((f) => f.uke)) : null;
                    const maxUke = g.frister.length > 0 ? Math.max(...g.frister.map((f) => f.uke)) : null;
                    return (
                      <div key={i} className="py-2 px-3 border-b last:border-b-0">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-gray-900 flex-1">{g.malNavn}</span>
                          <span className="text-gray-400">{g.fgNavn}</span>
                          <span className="text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{g.aktiviteter.length}x</span>
                          {minUke !== null && (
                            <span className="text-gray-400 whitespace-nowrap">
                              uke {minUke === maxUke ? minUke : `${minUke}–${maxUke}`}
                            </span>
                          )}
                        </div>
                        {g.aktiviteter.length > 1 && (
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {g.aktiviteter.join(", ")}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Status */}
              {oppretterState === "ferdig" && (
                <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
                  <Check className="h-4 w-4" />
                  {t("kontrollplan.importFerdig", { antall: importPunkter.filter((p) => p.faggruppeId).length })}
                </div>
              )}
              {oppretterState === "feil" && (
                <div className="mt-3 text-sm text-red-600">
                  Feil ved opprettelse. Prøv igjen.
                </div>
              )}
              {dedupMelding && (
                <div className="mt-3 text-sm text-amber-600">
                  {dedupMelding}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer med navigasjon */}
        <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50 rounded-b-xl">
          <div>
            {steg !== 1 && steg !== "oppsummering" && (
              <button
                onClick={() => setSteg((steg as number - 1) as Steg)}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {t("kontrollplan.importTilbake")}
              </button>
            )}
            {steg === "oppsummering" && oppretterState === "idle" && (
              <button
                onClick={() => setSteg(3)}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {t("kontrollplan.importTilbake")}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onLukk}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            >
              {t("handling.avbryt")}
            </button>

            {steg === 1 && (
              <button
                onClick={() => { initSteg2(); setSteg(2); }}
                disabled={selectedUIDs.size === 0}
                className="flex items-center gap-1 px-4 py-1.5 bg-sitedoc-primary text-white text-sm rounded hover:bg-sitedoc-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {t("kontrollplan.importNeste")}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}

            {steg === 2 && (
              <button
                onClick={() => setSteg(3)}
                className="flex items-center gap-1 px-4 py-1.5 bg-sitedoc-primary text-white text-sm rounded hover:bg-sitedoc-primary/90 transition"
              >
                {t("kontrollplan.importNeste")}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}

            {steg === 3 && (
              <button
                onClick={() => setSteg("oppsummering")}
                disabled={importPunkter.filter((p) => p.faggruppeId).length === 0}
                className="flex items-center gap-1 px-4 py-1.5 bg-sitedoc-primary text-white text-sm rounded hover:bg-sitedoc-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {t("kontrollplan.importOppsummering")}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}

            {steg === "oppsummering" && (
              <button
                onClick={handleOpprett}
                disabled={oppretterState !== "idle"}
                className="flex items-center gap-1 px-4 py-1.5 bg-sitedoc-primary text-white text-sm rounded hover:bg-sitedoc-primary/90 disabled:opacity-50 transition"
              >
                {oppretterState === "pending" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {oppretterState === "idle" && t("kontrollplan.importOpprett", {
                  antall: importPunkter.filter((p) => p.faggruppeId).length,
                })}
                {oppretterState === "pending" && "Oppretter..."}
                {oppretterState === "ferdig" && t("kontrollplan.importFerdig", {
                  antall: importPunkter.filter((p) => p.faggruppeId).length,
                })}
                {oppretterState === "feil" && "Prøv igjen"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

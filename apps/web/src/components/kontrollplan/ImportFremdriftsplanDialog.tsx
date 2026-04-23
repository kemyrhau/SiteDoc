"use client";

import { useState, useMemo, useCallback } from "react";
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
  Plus,
  ExternalLink,
  Info,
} from "lucide-react";
import {
  parseMSProjectXML,
  datoTilUkeAar,
  formaterDato,
  hentRessurserForValgteOppgaver,
  hentAlleBarneUIDs,
} from "@/lib/ms-project-parser";
import type { MSProjectTask, MSProjectData, MSProjectResource } from "@/lib/ms-project-parser";

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

  // Steg 2: Ressurs → faggruppe
  const [ressursFaggruppeMap, setRessursFaggruppeMap] = useState<Map<string, string | null>>(new Map());

  // Steg 2: Standard-faggruppe (for aktiviteter uten ressurs)
  const [standardFaggruppeId, setStandardFaggruppeId] = useState<string | null>(null);

  // Steg 3: Oppgave → mal + faggruppe-override per gruppe
  const [oppgaveMalMap, setOppgaveMalMap] = useState<Map<number, string>>(new Map());
  const [gruppeFaggruppeMap, setGruppeFaggruppeMap] = useState<Map<string, string>>(new Map());
  const [malSok, setMalSok] = useState("");
  const [aapenMalDropdown, setAapenMalDropdown] = useState<number | null>(null);

  // Oppsummering
  const [oppretterState, setOppretterState] = useState<"idle" | "pending" | "ferdig" | "feil">("idle");

  // Data — hent faggrupper fra steg 2+, maler fra steg 3+
  const stegNr = typeof steg === "number" ? steg : 4;
  const { data: faggrupper } = trpc.faggruppe.hentForProsjekt.useQuery(
    { projectId },
    { enabled: stegNr >= 2 },
  );
  const { data: maler } = trpc.mal.hentForProsjekt.useQuery(
    { projectId },
    { enabled: stegNr >= 3 },
  );
  const { data: bibliotekValg } = trpc.bibliotek.hentProsjektValg.useQuery(
    { projectId },
    { enabled: stegNr >= 3 },
  );

  const opprettPunkter = trpc.kontrollplan.opprettPunkter.useMutation();
  const opprettFaggruppe = trpc.faggruppe.opprett.useMutation();

  // Opprettelsesstatus per ressursnavn
  const [opprettende, setOpprettende] = useState<Set<string>>(new Set());

  // Fargepalett for auto-genererte faggrupper
  const FARGE_PALETT = [
    "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
    "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
  ];
  const nesteFarge = useCallback((ekstraBrukte: Set<string> = new Set()) => {
    const brukte = new Set<string>([
      ...(faggrupper ?? []).map((fg: { color: string | null }) => fg.color ?? ""),
      ...ekstraBrukte,
    ]);
    const ledig = FARGE_PALETT.find((f) => !brukte.has(f));
    return ledig ?? FARGE_PALETT[Math.floor(Math.random() * FARGE_PALETT.length)]!;
  }, [faggrupper]);

  const opprettFaggruppeForRessurs = useCallback(async (ressursNavn: string, forhandstildeltFarge?: string) => {
    if (opprettende.has(ressursNavn)) return;
    setOpprettende((prev) => new Set(prev).add(ressursNavn));
    try {
      const ny = await opprettFaggruppe.mutateAsync({
        name: ressursNavn,
        projectId,
        color: forhandstildeltFarge ?? nesteFarge(),
      });
      await utils.faggruppe.hentForProsjekt.invalidate({ projectId });
      setRessursFaggruppeMap((prev) => {
        const next = new Map(prev);
        next.set(ressursNavn, ny.id);
        return next;
      });
    } finally {
      setOpprettende((prev) => {
        const next = new Set(prev);
        next.delete(ressursNavn);
        return next;
      });
    }
  }, [opprettFaggruppe, projectId, utils, opprettende, nesteFarge]);

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

  // ──────── Steg 2: Ressurser ────────

  const valgteRessurser = useMemo(() => {
    if (!parsedData) return [];
    return hentRessurserForValgteOppgaver(parsedData.flatTasks, selectedUIDs);
  }, [parsedData, selectedUIDs]);

  // Auto-match ressurser til faggrupper ved overgang til steg 2
  const initSteg2 = useCallback(() => {
    if (!faggrupper) return;
    const map = new Map<string, string | null>();
    for (const r of valgteRessurser) {
      const match = faggrupper.find((fg: { name: string }) =>
        r.name.toLowerCase().includes(fg.name.toLowerCase()) ||
        fg.name.toLowerCase().includes(r.name.toLowerCase()),
      );
      map.set(r.name, match ? (match as { id: string }).id : null);
    }
    setRessursFaggruppeMap(map);
  }, [faggrupper, valgteRessurser]);

  // Ressurser uten matching faggruppe
  const manglendeRessurser = useMemo(() => {
    return valgteRessurser.filter((r) => !ressursFaggruppeMap.get(r.name));
  }, [valgteRessurser, ressursFaggruppeMap]);

  const opprettAlleManglende = useCallback(async () => {
    const brukteIBatch = new Set<string>();
    for (const r of manglendeRessurser) {
      const farge = nesteFarge(brukteIBatch);
      brukteIBatch.add(farge);
      await opprettFaggruppeForRessurs(r.name, farge);
    }
  }, [manglendeRessurser, opprettFaggruppeForRessurs, nesteFarge]);

  // ──────── Steg 3: Mal-tre ────────

  interface MalNode { id: string; name: string; prefix: string | null }
  interface KapittelNode { kode: string; navn: string; maler: MalNode[] }
  interface StandardNode { kode: string; navn: string; kapitler: KapittelNode[] }

  const malTre = useMemo(() => {
    if (!maler) return { standarder: [] as StandardNode[], prosjektmaler: [] as MalNode[] };

    const sjekklister = maler.filter((m: { category: string }) => m.category === "sjekkliste");
    const sok = malSok.toLowerCase();

    const bibMap = new Map<string, { kapittelKode: string; kapittelNavn: string; standardKode: string; standardNavn: string }>();
    if (bibliotekValg) {
      for (const v of bibliotekValg) {
        if (v.sjekklisteMalId && v.bibliotekMal) {
          bibMap.set(v.sjekklisteMalId, {
            kapittelKode: v.bibliotekMal.kapittel.kode,
            kapittelNavn: v.bibliotekMal.kapittel.navn,
            standardKode: v.bibliotekMal.kapittel.standard.kode,
            standardNavn: v.bibliotekMal.kapittel.standard.navn,
          });
        }
      }
    }

    const standardMap = new Map<string, { kode: string; navn: string; kapitler: Map<string, { kode: string; navn: string; maler: MalNode[] }> }>();
    const prosjektmaler: MalNode[] = [];

    for (const m of sjekklister) {
      const mal = m as { id: string; name: string; prefix: string | null };
      if (sok && !mal.name.toLowerCase().includes(sok) && !(mal.prefix ?? "").toLowerCase().includes(sok)) continue;

      const bib = bibMap.get(mal.id);
      if (bib) {
        if (!standardMap.has(bib.standardKode)) {
          standardMap.set(bib.standardKode, { kode: bib.standardKode, navn: bib.standardNavn, kapitler: new Map() });
        }
        const std = standardMap.get(bib.standardKode)!;
        if (!std.kapitler.has(bib.kapittelKode)) {
          std.kapitler.set(bib.kapittelKode, { kode: bib.kapittelKode, navn: bib.kapittelNavn, maler: [] });
        }
        std.kapitler.get(bib.kapittelKode)!.maler.push(mal);
      } else {
        prosjektmaler.push(mal);
      }
    }

    const standarder: StandardNode[] = [...standardMap.values()].map((s) => ({
      kode: s.kode,
      navn: s.navn,
      kapitler: [...s.kapitler.values()],
    }));

    return { standarder, prosjektmaler };
  }, [maler, bibliotekValg, malSok]);

  // Flat mal-liste for enkel oppslag
  const alleMaler = useMemo(() => {
    if (!maler) return [];
    return maler.filter((m: { category: string }) => m.category === "sjekkliste") as Array<{ id: string; name: string; prefix: string | null }>;
  }, [maler]);

  const hentMalNavn = useCallback(
    (malId: string) => {
      const m = alleMaler.find((mal) => mal.id === malId);
      return m ? `${m.prefix ? m.prefix + " — " : ""}${m.name}` : "";
    },
    [alleMaler],
  );

  // Grupperte oppgaver for steg 3
  type Faggruppe = { id: string; name: string; color: string | null };
  const grupperteOppgaver = useMemo(() => {
    if (!parsedData || !faggrupper) return [];

    const grupper = new Map<string, { key: string; faggruppe: Faggruppe | null; oppgaver: MSProjectTask[] }>();

    const valgteOppgaver = parsedData.flatTasks.filter((t) => selectedUIDs.has(t.uid));

    for (const oppgave of valgteOppgaver) {
      // Finn faggruppe via ressurs-mapping
      let faggruppeId: string | null = null;
      for (const rNavn of oppgave.resourceNames) {
        const mapped = ressursFaggruppeMap.get(rNavn);
        if (mapped) { faggruppeId = mapped; break; }
      }

      const key = faggruppeId ?? "__uten_faggruppe__";
      if (!grupper.has(key)) {
        const fg = faggruppeId
          ? (faggrupper as Faggruppe[]).find((f) => f.id === faggruppeId) ?? null
          : null;
        grupper.set(key, { key, faggruppe: fg, oppgaver: [] });
      }
      grupper.get(key)!.oppgaver.push(oppgave);
    }

    return [...grupper.values()];
  }, [parsedData, selectedUIDs, faggrupper, ressursFaggruppeMap]);

  const brukForAlleIGruppen = useCallback(
    (oppgaver: MSProjectTask[], malId: string) => {
      setOppgaveMalMap((prev) => {
        const next = new Map(prev);
        for (const o of oppgaver) next.set(o.uid, malId);
        return next;
      });
    },
    [],
  );

  // ──────── Oppsummering ────────

  const importPunkter = useMemo(() => {
    if (!parsedData) return [];
    return parsedData.flatTasks
      .filter((t) => selectedUIDs.has(t.uid) && oppgaveMalMap.has(t.uid))
      .map((t) => {
        const malId = oppgaveMalMap.get(t.uid)!;
        // Finn faggruppe: ressurs-mapping → gruppe-override → standard-faggruppe
        let faggruppeId: string | null = null;
        for (const rNavn of t.resourceNames) {
          const mapped = ressursFaggruppeMap.get(rNavn);
          if (mapped) { faggruppeId = mapped; break; }
        }
        const gruppeKey = faggruppeId ?? "__uten_faggruppe__";
        // Sjekk gruppe-override fra steg 3
        if (!faggruppeId && gruppeFaggruppeMap.has(gruppeKey)) {
          faggruppeId = gruppeFaggruppeMap.get(gruppeKey)!;
        }
        // Fallback til standard-faggruppe fra steg 2
        if (!faggruppeId && standardFaggruppeId) {
          faggruppeId = standardFaggruppeId;
        }
        const frist = t.finish ? datoTilUkeAar(t.finish) : null;
        return { taskUid: t.uid, name: t.name, malId, faggruppeId, frist };
      });
  }, [parsedData, selectedUIDs, oppgaveMalMap, ressursFaggruppeMap, gruppeFaggruppeMap, standardFaggruppeId]);

  const ekskludertAntall = useMemo(() => {
    if (!parsedData) return 0;
    return parsedData.flatTasks.filter(
      (t) => selectedUIDs.has(t.uid) && !oppgaveMalMap.has(t.uid),
    ).length;
  }, [parsedData, selectedUIDs, oppgaveMalMap]);

  const handleOpprett = useCallback(async () => {
    if (importPunkter.length === 0) return;
    setOppretterState("pending");

    try {
      // Grupper etter (sjekklisteMalId, faggruppeId)
      const grupper = new Map<string, typeof importPunkter>();
      for (const p of importPunkter) {
        if (!p.faggruppeId) continue; // Hopp over uten faggruppe
        const key = `${p.malId}__${p.faggruppeId}`;
        if (!grupper.has(key)) grupper.set(key, []);
        grupper.get(key)!.push(p);
      }

      // Sekvensiell opprettelse
      for (const [_key, punkter] of grupper) {
        const foerste = punkter[0]!;
        await opprettPunkter.mutateAsync({
          kontrollplanId,
          sjekklisteMalId: foerste.malId,
          faggruppeId: foerste.faggruppeId!,
          milepelId: null,
          punkter: punkter.map((p) => ({
            omradeId: null,
            fristUke: p.frist?.uke ?? null,
            fristAar: p.frist?.aar ?? null,
          })),
        });
      }

      // Også punkter uten faggruppe — hopp over for nå (varsle bruker)
      utils.kontrollplan.hentForByggeplass.invalidate({ byggeplassId });
      setOppretterState("ferdig");
      setTimeout(() => onImportert(), 1000);
    } catch (_e) {
      setOppretterState("feil");
    }
  }, [importPunkter, kontrollplanId, byggeplassId, opprettPunkter, utils, onImportert]);

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

  function renderMalVelger(taskUid: number) {
    const valgtId = oppgaveMalMap.get(taskUid);
    const erAapen = aapenMalDropdown === taskUid;

    return (
      <div className="relative">
        <button
          onClick={() => setAapenMalDropdown(erAapen ? null : taskUid)}
          className={`text-left text-xs border rounded px-2 py-1 w-56 truncate ${
            valgtId ? "text-gray-900 bg-white" : "text-gray-400 bg-gray-50"
          }`}
        >
          {valgtId ? hentMalNavn(valgtId) : t("kontrollplan.sjekklisteMal") + "..."}
        </button>

        {erAapen && (
          <div className="absolute right-0 z-50 mt-1 w-80 max-h-72 overflow-y-auto bg-white border rounded-lg shadow-lg">
            <div className="sticky top-0 bg-white p-2 border-b">
              <input
                type="text"
                value={malSok}
                onChange={(e) => setMalSok(e.target.value)}
                placeholder={t("handling.soek") + "..."}
                className="w-full text-xs border rounded px-2 py-1"
                autoFocus
              />
            </div>
            <div className="p-1">
              {/* Standarder → maler (flat, sortert etter kapittelkode) */}
              {malTre.standarder.map((std) => {
                // Flat liste av alle maler under standarden, sortert etter kapittelkode
                const flatMaler = std.kapitler.flatMap((kap) =>
                  kap.maler.map((mal) => ({ ...mal, kapittelKode: kap.kode }))
                ).sort((a, b) => a.kapittelKode.localeCompare(b.kapittelKode));

                if (flatMaler.length === 0) return null;
                return (
                  <div key={std.kode} className="mb-1">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase px-2 py-0.5">
                      {std.kode} — {std.navn}
                    </div>
                    {flatMaler.map((mal) => (
                      <button
                        key={mal.id}
                        onClick={() => {
                          setOppgaveMalMap((prev) => new Map(prev).set(taskUid, mal.id));
                          setAapenMalDropdown(null);
                          setMalSok("");
                        }}
                        className={`w-full text-left text-xs px-3 py-1 hover:bg-blue-50 rounded ${
                          valgtId === mal.id ? "bg-blue-50 text-sitedoc-primary" : "text-gray-700"
                        }`}
                      >
                        {mal.prefix ? `${mal.prefix} — ` : ""}{mal.name}
                      </button>
                    ))}
                  </div>
                );
              })}
              {/* Prosjektmaler */}
              {malTre.prosjektmaler.length > 0 && (
                <div className="mb-1">
                  <div className="text-[10px] font-semibold text-gray-400 uppercase px-2 py-0.5">
                    {t("kontrollplan.prosjektmaler") || "Prosjektmaler"}
                  </div>
                  {malTre.prosjektmaler.map((mal) => (
                    <button
                      key={mal.id}
                      onClick={() => {
                        setOppgaveMalMap((prev) => new Map(prev).set(taskUid, mal.id));
                        setAapenMalDropdown(null);
                        setMalSok("");
                      }}
                      className={`w-full text-left text-xs px-3 py-1 hover:bg-blue-50 rounded ${
                        valgtId === mal.id ? "bg-blue-50 text-sitedoc-primary" : "text-gray-700"
                      }`}
                    >
                      {mal.prefix ? `${mal.prefix} — ` : ""}{mal.name}
                    </button>
                  ))}
                </div>
              )}
              {alleMaler.length === 0 && (
                <div className="text-xs text-gray-400 px-2 py-2">
                  {t("kontrollplan.ingenMaler") || "Ingen maler funnet"}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Frist-oppsummering
  const fristRange = useMemo(() => {
    const uker = importPunkter
      .filter((p) => p.frist)
      .map((p) => p.frist!.uke);
    if (uker.length === 0) return null;
    return { fra: Math.min(...uker), til: Math.max(...uker) };
  }, [importPunkter]);

  const punkterUtenFaggruppe = useMemo(
    () => importPunkter.filter((p) => !p.faggruppeId).length,
    [importPunkter],
  );

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
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">
                {t("kontrollplan.importSteg2Tittel")}
              </h3>
              <p className="text-xs text-gray-400 mb-3">
                {t("kontrollplan.importSteg2Beskrivelse")}
              </p>

              {/* Forklaring-boks */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-3 flex gap-2">
                <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900">
                  {t("kontrollplan.importForklaring")}
                </div>
              </div>

              {/* Bulk-opprett — kun når ≥2 mangler */}
              {valgteRessurser.length > 0 && manglendeRessurser.length >= 2 && (
                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                  <div className="text-xs text-amber-800">
                    {t("kontrollplan.importManglerFaggruppe", { antall: manglendeRessurser.length })}
                    <span className="text-amber-600 ml-1">
                      ({manglendeRessurser.map((r) => r.name).join(", ")})
                    </span>
                  </div>
                  <button
                    onClick={opprettAlleManglende}
                    disabled={opprettende.size > 0}
                    className="flex items-center gap-1 text-xs text-amber-900 bg-white border border-amber-300 rounded px-2 py-1 hover:bg-amber-100 disabled:opacity-50 whitespace-nowrap"
                  >
                    {opprettende.size > 0 ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    {t("kontrollplan.importOpprettAlleManglende", { antall: manglendeRessurser.length })}
                  </button>
                </div>
              )}

              {valgteRessurser.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 mb-3">
                  {t("kontrollplan.importIngenRessurser")}
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  {valgteRessurser.map((r) => {
                    const valgtFg = ressursFaggruppeMap.get(r.name);
                    const oppretter = opprettende.has(r.name);
                    return (
                      <div key={r.name} className="flex items-center gap-3 py-2 px-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="text-sm text-gray-900">{r.name}</div>
                          <div className="text-xs text-gray-400">
                            {r.taskCount} {t("kontrollplan.importAktiviteterLiten")}
                          </div>
                        </div>
                        <span className="text-gray-300">→</span>
                        <select
                          value={valgtFg ?? ""}
                          onChange={(e) => {
                            setRessursFaggruppeMap((prev) => {
                              const next = new Map(prev);
                              next.set(r.name, e.target.value || null);
                              return next;
                            });
                          }}
                          className="text-xs border rounded px-2 py-1.5 w-48"
                        >
                          <option value="">{t("kontrollplan.importIkkeTilordnet")}</option>
                          {faggrupper?.map((fg: { id: string; name: string; color: string | null }) => (
                            <option key={fg.id} value={fg.id}>
                              {fg.name}
                            </option>
                          ))}
                        </select>
                        {!valgtFg && (
                          <button
                            onClick={() => opprettFaggruppeForRessurs(r.name)}
                            disabled={oppretter}
                            className="flex items-center gap-1 text-xs text-sitedoc-primary border border-sitedoc-primary/30 rounded px-2 py-1 hover:bg-blue-50 disabled:opacity-50 whitespace-nowrap"
                            title={t("kontrollplan.importOpprettSomFaggruppe")}
                          >
                            {oppretter ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Plus className="h-3 w-3" />
                            )}
                            {oppretter
                              ? t("kontrollplan.importOppretterFaggruppe")
                              : t("kontrollplan.importOpprettSomFaggruppe")}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Standard-faggruppe — alltid synlig */}
              <div className="flex items-center gap-3 py-2 px-3 border rounded-lg bg-gray-50">
                <div className="flex-1">
                  <div className="text-sm text-gray-900">{t("kontrollplan.importStandardFaggruppe")}</div>
                  <div className="text-xs text-gray-400">
                    {t("kontrollplan.importStandardFaggruppeHjelp")}
                  </div>
                </div>
                <select
                  value={standardFaggruppeId ?? ""}
                  onChange={(e) => setStandardFaggruppeId(e.target.value || null)}
                  className="text-xs border rounded px-2 py-1.5 w-48"
                >
                  <option value="">{t("kontrollplan.importIkkeTilordnet")}</option>
                  {faggrupper?.map((fg: { id: string; name: string; color: string | null }) => (
                    <option key={fg.id} value={fg.id}>
                      {fg.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lenke til faggruppe-admin */}
              <div className="mt-3 text-right">
                <a
                  href={`/dashbord/${projectId}/faggrupper`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-sitedoc-primary"
                >
                  {t("kontrollplan.importAdministrerFaggrupper")}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {/* ═══ STEG 3: Tilordne maler ═══ */}
          {steg === 3 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                {t("kontrollplan.importSteg3Tittel")}
              </h3>

              {grupperteOppgaver.map((gruppe, gi) => {
                const overrideFgId = gruppeFaggruppeMap.get(gruppe.key);
                const overrideFg = overrideFgId
                  ? (faggrupper as Faggruppe[])?.find((f) => f.id === overrideFgId) ?? null
                  : null;
                const visFg = gruppe.faggruppe ?? overrideFg;

                return (
                <div key={gi} className="mb-4">
                  {/* Gruppehode */}
                  <div className="flex items-center gap-2 mb-1.5 pb-1 border-b">
                    {visFg ? (
                      <>
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: visFg.color || "#6b7280" }}
                        />
                        <span className="text-xs font-medium text-gray-700">{visFg.name}</span>
                      </>
                    ) : (
                      <span className="text-xs font-medium text-gray-400">{t("kontrollplan.importIkkeTilordnet")}</span>
                    )}
                    <span className="text-xs text-gray-400">({gruppe.oppgaver.length})</span>

                    {/* Faggruppe-velger for grupper uten faggruppe */}
                    {!gruppe.faggruppe && (
                      <select
                        value={overrideFgId ?? ""}
                        onChange={(e) => {
                          setGruppeFaggruppeMap((prev) => {
                            const next = new Map(prev);
                            if (e.target.value) next.set(gruppe.key, e.target.value);
                            else next.delete(gruppe.key);
                            return next;
                          });
                        }}
                        className="text-[10px] border rounded px-1.5 py-0.5 ml-1"
                      >
                        <option value="">{t("kontrollplan.importVelgFaggruppe")}</option>
                        {faggrupper?.map((fg: { id: string; name: string }) => (
                          <option key={fg.id} value={fg.id}>{fg.name}</option>
                        ))}
                      </select>
                    )}

                    {/* Bruk for alle */}
                    {gruppe.oppgaver.length > 1 && oppgaveMalMap.has(gruppe.oppgaver[0]!.uid) && (
                      <button
                        onClick={() => {
                          const malId = oppgaveMalMap.get(gruppe.oppgaver[0]!.uid);
                          if (malId) brukForAlleIGruppen(gruppe.oppgaver, malId);
                        }}
                        className="ml-auto text-[10px] text-sitedoc-primary hover:underline"
                      >
                        {t("kontrollplan.importBrukForAlle")}
                      </button>
                    )}
                  </div>

                  {/* Oppgaver i gruppen */}
                  <div className="space-y-1">
                    {gruppe.oppgaver.map((oppgave) => {
                      const frist = oppgave.finish ? datoTilUkeAar(oppgave.finish) : null;
                      return (
                        <div key={oppgave.uid} className="flex items-center gap-2 py-1 px-2 text-xs">
                          <span className="flex-1 truncate text-gray-700">{oppgave.name}</span>
                          {frist && (
                            <span className="text-gray-400 whitespace-nowrap">
                              uke {frist.uke}/{frist.aar}
                            </span>
                          )}
                          {renderMalVelger(oppgave.uid)}
                        </div>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>
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

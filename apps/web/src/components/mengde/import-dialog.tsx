"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Upload,
  X,
  FileText,
  Loader2,
  FolderOpen,
  Check,
  AlertTriangle,
  SkipForward,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";

// ---------------------------------------------------------------------------
// Typer
// ---------------------------------------------------------------------------

interface ImportDialogProps {
  projectId: string;
  kontraktIdFraToppen?: string | null;
  open: boolean;
  onClose: () => void;
}

type Fase = "filvalg" | "konfigurasjon" | "oppsummering";
type FilStatus = "venter" | "importerer" | "importert" | "hoppet" | "duplikat" | "feil";

interface ImportResultat {
  periodeId: string;
  scenario: number;
  antallPoster: number;
  antallNyePoster: number;
  avvik: Array<{ postnr: string; felt: string; forventet: number; faktisk: number; differanse: number }>;
  totalVerdiDenne: number;
  totalVerdiTotal: number;
  gapFlagg: boolean;
  påfølgendeNr: number[];
}

interface FilIKø {
  filnavn: string;
  file?: File;
  dokumentId?: string; // fra-mappe
  docType: string;
  notaType: string;
  notaNr: string;
  periodeSlutt: string;
  kontraktId: string;
  status: FilStatus;
  resultat?: ImportResultat;
  feilmelding?: string;
  erDuplikat: boolean;
  gapAdvarsel?: string;
  manglendeNr?: number[];
}

const DOC_TYPES = [
  { value: "anbudsgrunnlag", label: "Anbudsgrunnlag (PDF/Excel/GAB/XML)" },
  { value: "a_nota", label: "A-nota / Sluttnota (PDF/Excel)" },
  { value: "t_nota", label: "T-nota (PDF/Excel)" },
  { value: "mengdebeskrivelse", label: "Mengdebeskrivelse (PDF/Word)" },
  { value: "annet", label: "Annet dokument" },
] as const;

// ---------------------------------------------------------------------------
// Hjelpefunksjoner
// ---------------------------------------------------------------------------

/** Gjett dokumenttype basert på filnavn */
export function gjettDokType(filnavn: string): string {
  const lavt = filnavn.toLowerCase();
  if (lavt.endsWith(".gab") || lavt.endsWith(".ga1")) return "anbudsgrunnlag";
  if (lavt.endsWith(".xml")) return "anbudsgrunnlag";
  if (/sluttnota|a[-\s]?nota|avdragsnota/i.test(lavt)) return "a_nota";
  if (/t[-\s]?nota|tilleggsnota/i.test(lavt)) return "t_nota";
  if (/anbud|priset|tilbud/i.test(lavt)) return "anbudsgrunnlag";
  if (/mengde/i.test(lavt)) return "mengdebeskrivelse";
  return "anbudsgrunnlag";
}

/** Gjett nota-nummer fra filnavn */
export function gjettNotaNr(filnavn: string): string {
  const m = filnavn.match(
    /(?:a[-\s]?nota|t[-\s]?nota|avdragsnota|tilleggsnota)[_\s-]*(\d+)/i,
  );
  if (m) return m[1]!;
  const fallback = filnavn.match(/[_\s](\d+)[_\s]/);
  return fallback ? fallback[1]! : "";
}

/** Gjett dato fra filnavn: "A-nota 26_31.05.25.pdf" → "2025-05-31" */
export function gjettDato(filnavn: string): string {
  const m = filnavn.match(/(\d{2})\.(\d{2})\.(\d{2,4})/);
  if (!m) return "";
  const år = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
  return `${år}-${m[2]}-${m[1]}`;
}

/** Gjett notaType fra filnavn og docType */
function gjettNotaType(filnavn: string, docType: string): string {
  if (/sluttnota/i.test(filnavn)) return "Sluttnota";
  if (docType === "a_nota") return "A-Nota";
  if (docType === "t_nota") return "T-Nota";
  return "";
}

function formaterTall(n: number): string {
  return n.toLocaleString("nb-NO", { maximumFractionDigits: 0 });
}

// ---------------------------------------------------------------------------
// Komponent
// ---------------------------------------------------------------------------

export function ImportDialog({ projectId, kontraktIdFraToppen, open, onClose }: ImportDialogProps) {
  const { t } = useTranslation();

  // Fase-state
  const [fase, setFase] = useState<Fase>("filvalg");
  const [kø, setKø] = useState<FilIKø[]>([]);
  const [gjeldendeFil, setGjeldendeFil] = useState(0);

  // Filvalg-state
  const [kilde, setKilde] = useState<"last-opp" | "fra-mappe">("last-opp");
  const [filer, setFiler] = useState<File[]>([]);
  const [dragAktiv, setDragAktiv] = useState(false);
  const [velgtMappeId, setVelgtMappeId] = useState<string | null>(null);
  const [valgteDokumenter, setValgteDokumenter] = useState<Set<string>>(new Set());

  // Feil
  const [feil, setFeil] = useState<string | null>(null);

  const utils = trpc.useUtils();

  // Data-queries
  const { data: kontrakter } = trpc.kontrakt.hentForProsjekt.useQuery(
    { projectId },
    { enabled: !!projectId && open },
  );

  const dokumenterQuery = trpc.mengde.hentDokumenter.useQuery(
    { projectId },
    { enabled: !!projectId && open },
  );
  const dokumenter = dokumenterQuery.data as Array<{
    id: string; filename: string; kontraktId: string | null;
    notaNr: number | null; notaType: string | null; docType: string | null;
  }> | undefined;

  const { data: perioder } = trpc.mengde.hentPerioder.useQuery(
    { projectId },
    { enabled: !!projectId && open },
  );
  // Set av documentId-er som har FtdNotaPeriod
  const importerteDokIds = useMemo(() => {
    if (!perioder) return new Set<string>();
    return new Set(perioder.map((p) => p.documentId));
  }, [perioder]);

  const { data: mapper } = trpc.mappe.hentForProsjekt.useQuery(
    { projectId },
    { enabled: !!projectId && open },
  );

  const { data: mappeDokumenterRaw } = trpc.mappe.hentDokumenter.useQuery(
    { folderId: velgtMappeId! },
    { enabled: !!velgtMappeId && kilde === "fra-mappe" },
  );
  const mappeDokumenter = Array.isArray(mappeDokumenterRaw) ? mappeDokumenterRaw : mappeDokumenterRaw?.dokumenter;

  // Mutations
  const registrer = trpc.mengde.registrerDokument.useMutation();
  const importerMutation = trpc.mengde.importerTilPeriode.useMutation();

  // Mappe-valg
  const mappeValg = useMemo(() => {
    if (!mapper) return [];
    type MappeNode = { id: string; name: string; parentId: string | null };
    const flat = mapper as MappeNode[];
    const childrenMap = new Map<string | null, MappeNode[]>();
    for (const m of flat) {
      const kids = childrenMap.get(m.parentId) ?? [];
      kids.push(m);
      childrenMap.set(m.parentId, kids);
    }
    const result: Array<{ value: string; label: string }> = [];
    function traverse(parentId: string | null, dybde: number) {
      const barn = childrenMap.get(parentId) ?? [];
      for (const m of barn) {
        const prefix = "\u00A0\u00A0".repeat(dybde);
        result.push({
          value: m.id,
          label: `${prefix}${dybde > 0 ? "└ " : ""}${m.name}`,
        });
        traverse(m.id, dybde + 1);
      }
    }
    traverse(null, 0);
    return result;
  }, [mapper]);

  // Gjeldende fil i køen
  const gjeldende = kø[gjeldendeFil] ?? null;

  // Sjekk duplikat for gjeldende fil
  const duplikatInfo = useMemo(() => {
    if (!gjeldende || !dokumenter) return null;
    if (gjeldende.notaType !== "A-Nota" && gjeldende.notaType !== "T-Nota" && gjeldende.notaType !== "Sluttnota") return null;
    if (!gjeldende.kontraktId) return null;

    const nr = gjeldende.notaType === "Sluttnota" ? null : parseInt(gjeldende.notaNr, 10);
    if (gjeldende.notaType !== "Sluttnota" && isNaN(nr as number)) return null;

    // Sjekk om det finnes en FtdNotaPeriod for dette notaNr + kontraktId
    const match = dokumenter.find((d) =>
      d.kontraktId === gjeldende.kontraktId &&
      importerteDokIds.has(d.id) &&
      (gjeldende.notaType === "Sluttnota"
        ? d.notaType === "Sluttnota"
        : d.notaNr === nr),
    );

    return match ? { dokumentId: match.id, filnavn: match.filename } : null;
  }, [gjeldende, dokumenter]);

  // Gap-sjekk for gjeldende fil
  const gapInfo = useMemo(() => {
    if (!gjeldende || !dokumenter) return null;
    if (gjeldende.notaType === "Sluttnota") return null;
    if (!gjeldende.kontraktId) return null;

    const nr = parseInt(gjeldende.notaNr, 10);
    if (isNaN(nr)) return null;

    // Finn alle importerte perioder for kontrakten
    const importerte = dokumenter
      .filter((d) => d.kontraktId === gjeldende.kontraktId && importerteDokIds.has(d.id) && d.notaType !== "Sluttnota" && d.notaNr !== null)
      .map((d) => d.notaNr!)
      .sort((a, b) => a - b);

    // Inkluder filer som allerede er importert i denne køen (før gjeldende)
    for (let i = 0; i < gjeldendeFil; i++) {
      const f = kø[i]!;
      if (f.status === "importert" && f.kontraktId === gjeldende.kontraktId && f.notaType !== "Sluttnota") {
        const fNr = parseInt(f.notaNr, 10);
        if (!isNaN(fNr) && !importerte.includes(fNr)) importerte.push(fNr);
      }
    }
    importerte.sort((a, b) => a - b);

    if (importerte.length === 0) return null; // Scenario 1

    const siste = importerte[importerte.length - 1]!;
    if (nr <= siste + 1) return null; // Sekvensiell eller retroaktiv

    const manglende: number[] = [];
    for (let n = siste + 1; n < nr; n++) {
      if (!importerte.includes(n)) manglende.push(n);
    }
    if (manglende.length === 0) return null;

    return { manglende };
  }, [gjeldende, dokumenter, gjeldendeFil, kø]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragAktiv(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiler((prev) => [...prev, ...droppedFiles]);
  }, []);

  const handleFilInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const nyeFiler = Array.from(e.target.files ?? []);
    setFiler((prev) => [...prev, ...nyeFiler]);
    e.target.value = ""; // Reset for å tillate samme fil igjen
  }, []);

  const fjernFil = useCallback((index: number) => {
    setFiler((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const startImport = useCallback(() => {
    const kontraktId = kontraktIdFraToppen ?? "";
    const nyKø: FilIKø[] = [];

    if (kilde === "last-opp") {
      for (const f of filer) {
        const dt = gjettDokType(f.name);
        const nt = gjettNotaType(f.name, dt);
        nyKø.push({
          filnavn: f.name,
          file: f,
          docType: dt,
          notaType: nt,
          notaNr: gjettNotaNr(f.name),
          periodeSlutt: gjettDato(f.name),
          kontraktId,
          status: "venter",
          erDuplikat: false,
        });
      }
    } else {
      const docs = (mappeDokumenter ?? []).filter((d) => valgteDokumenter.has(d.id));
      for (const d of docs) {
        const dt = gjettDokType(d.filename);
        const nt = gjettNotaType(d.filename, dt);
        nyKø.push({
          filnavn: d.filename,
          dokumentId: d.id,
          docType: dt,
          notaType: nt,
          notaNr: gjettNotaNr(d.filename),
          periodeSlutt: gjettDato(d.filename),
          kontraktId,
          status: "venter",
          erDuplikat: false,
        });
      }
    }

    // Sorter: nota-filer etter notaNr stigende
    nyKø.sort((a, b) => {
      const aNr = parseInt(a.notaNr, 10) || 9999;
      const bNr = parseInt(b.notaNr, 10) || 9999;
      // Sluttnota alltid sist
      if (a.notaType === "Sluttnota") return 1;
      if (b.notaType === "Sluttnota") return -1;
      return aNr - bNr;
    });

    setKø(nyKø);
    setGjeldendeFil(0);
    setFase("konfigurasjon");
  }, [filer, kilde, mappeDokumenter, valgteDokumenter, kontraktIdFraToppen]);

  const oppdaterGjeldende = useCallback((oppdatering: Partial<FilIKø>) => {
    setKø((prev) => prev.map((f, i) => i === gjeldendeFil ? { ...f, ...oppdatering } : f));
  }, [gjeldendeFil]);

  const hoppOver = useCallback(() => {
    oppdaterGjeldende({ status: "hoppet" });
    if (gjeldendeFil + 1 >= kø.length) {
      setFase("oppsummering");
    } else {
      setGjeldendeFil((prev) => prev + 1);
    }
  }, [gjeldendeFil, kø.length, oppdaterGjeldende]);

  const nesteFilEllerOppsummering = useCallback(() => {
    if (gjeldendeFil + 1 >= kø.length) {
      setFase("oppsummering");
    } else {
      setGjeldendeFil((prev) => prev + 1);
    }
  }, [gjeldendeFil, kø.length]);

  const importerGjeldende = useCallback(async (reimporter = false) => {
    if (!gjeldende) return;

    oppdaterGjeldende({ status: "importerer" });
    setFeil(null);

    try {
      let documentId = gjeldende.dokumentId;

      // Steg 1: Last opp fil hvis nødvendig
      if (gjeldende.file && !documentId) {
        const formData = new FormData();
        formData.append("file", gjeldende.file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error(`Opplasting feilet (${res.status})`);
        const { fileUrl, fileType } = await res.json();

        const notaNr = gjeldende.notaType === "Sluttnota" ? undefined : parseInt(gjeldende.notaNr, 10) || undefined;
        const valgtKontrakt = kontrakter?.find((k) => k.id === gjeldende.kontraktId);

        // Steg 2: Registrer dokument
        const doc = await registrer.mutateAsync({
          projectId,
          filename: gjeldende.filnavn,
          fileUrl,
          filetype: fileType ?? gjeldende.file.type,
          docType: gjeldende.docType as "a_nota" | "t_nota" | "anbudsgrunnlag" | "mengdebeskrivelse" | "annet",
          ...(gjeldende.notaType ? { notaType: gjeldende.notaType as "A-Nota" | "T-Nota" | "Sluttnota" } : {}),
          ...(notaNr ? { notaNr } : {}),
          ...(gjeldende.kontraktId ? { kontraktId: gjeldende.kontraktId, kontraktNavn: valgtKontrakt?.navn ?? undefined } : {}),
        });
        documentId = doc.id;
      }

      // Steg 3: Importer til periode (kun for a_nota/t_nota med kontraktId)
      if (documentId && (gjeldende.docType === "a_nota" || gjeldende.docType === "t_nota") && gjeldende.kontraktId) {
        const erSluttnota = gjeldende.notaType === "Sluttnota";
        const periodeNr = erSluttnota ? 1 : parseInt(gjeldende.notaNr, 10);

        if (!isNaN(periodeNr)) {
          // Vent litt for prosessering av parseren
          await new Promise((resolve) => setTimeout(resolve, 3000));

          const resultat = await importerMutation.mutateAsync({
            projectId,
            kontraktId: gjeldende.kontraktId,
            documentId,
            periodeNr,
            erSluttnota,
            gapGodkjent: (gapInfo?.manglende?.length ?? 0) > 0, // Alltid godkjent — gap vises som advarsel
          });

          if ("kreverGapGodkjenning" in resultat) {
            oppdaterGjeldende({
              status: "venter",
              gapAdvarsel: `A-nota ${resultat.manglendeNr.join(", ")} mangler`,
              manglendeNr: resultat.manglendeNr,
            });
            return;
          }

          oppdaterGjeldende({ status: "importert", resultat: resultat as ImportResultat });
          nesteFilEllerOppsummering();
          return;
        }
      }

      // Ikke-nota dokument — bare registrert
      oppdaterGjeldende({ status: "importert" });
      nesteFilEllerOppsummering();
    } catch (err) {
      oppdaterGjeldende({
        status: "feil",
        feilmelding: err instanceof Error ? err.message : "Ukjent feil",
      });
    }
  }, [gjeldende, gapInfo, kontrakter, projectId, registrer, importerMutation, oppdaterGjeldende, nesteFilEllerOppsummering]);

  const lukkDialog = useCallback(() => {
    setFase("filvalg");
    setKø([]);
    setGjeldendeFil(0);
    setFiler([]);
    setFeil(null);
    setValgteDokumenter(new Set());
    setVelgtMappeId(null);
    utils.mengde.hentDokumenter.invalidate({ projectId });
    utils.mengde.hentSpecPoster.invalidate();
    onClose();
  }, [onClose, projectId, utils]);

  function toggleDokument(id: string) {
    setValgteDokumenter((prev) => {
      const neste = new Set(prev);
      if (neste.has(id)) neste.delete(id);
      else neste.add(id);
      return neste;
    });
  }

  if (!open) return null;

  const antallFiler = kilde === "last-opp" ? filer.length : valgteDokumenter.size;

  // ---------------------------------------------------------------------------
  // FASE 1: Filvalg
  // ---------------------------------------------------------------------------
  if (fase === "filvalg") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h2 className="text-base font-semibold">{t("okonomi.importerDokument")}</h2>
            <button onClick={lukkDialog} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Kilde-faner */}
          <div className="flex border-b px-5">
            <button
              onClick={() => setKilde("last-opp")}
              className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                kilde === "last-opp" ? "border-sitedoc-primary text-sitedoc-primary" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Upload className="mr-1.5 inline h-3.5 w-3.5" />
              {t("handling.lastOpp")}
            </button>
            <button
              onClick={() => setKilde("fra-mappe")}
              className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                kilde === "fra-mappe" ? "border-sitedoc-primary text-sitedoc-primary" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <FolderOpen className="mr-1.5 inline h-3.5 w-3.5" />
              {t("okonomi.velgFraMapper")}
            </button>
          </div>

          <div className="space-y-4 p-5">
            {kilde === "last-opp" ? (
              <>
                {/* Dropzone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragAktiv(true); }}
                  onDragLeave={() => setDragAktiv(false)}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                    dragAktiv ? "border-sitedoc-primary bg-blue-50" : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  <Upload className="mb-2 h-8 w-8 text-gray-400" />
                  <div className="text-sm text-gray-600">
                    {t("okonomi.dragOgSlipp")}{" "}
                    <label className="cursor-pointer text-sitedoc-primary hover:underline">
                      {t("okonomi.velgFiler")}
                      <input type="file" className="hidden" multiple accept=".pdf,.xlsx,.xls,.xml,.csv,.docx,.doc,.gab,.ga1" onChange={handleFilInput} />
                    </label>
                  </div>
                  <div className="mt-1 text-xs text-gray-400">PDF, Excel, XML, CSV, Word</div>
                </div>

                {/* Filliste */}
                {filer.length > 0 && (
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {filer.map((f, i) => (
                      <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded border px-3 py-1.5">
                        <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                        <span className="flex-1 truncate text-sm">{f.name}</span>
                        <span className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</span>
                        <button onClick={() => fjernFil(i)} className="rounded p-0.5 text-gray-400 hover:bg-gray-100">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Mappe-velger */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">{t("okonomi.velgMappe")}</label>
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
                    <select
                      className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
                      value={velgtMappeId ?? ""}
                      onChange={(e) => { setVelgtMappeId(e.target.value || null); setValgteDokumenter(new Set()); }}
                    >
                      <option value="">{t("okonomi.velgMappe")}...</option>
                      {mappeValg.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Dokumentliste */}
                {velgtMappeId && (
                  <div className="max-h-60 overflow-y-auto rounded border">
                    {!mappeDokumenter || mappeDokumenter.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-gray-400">
                        {t("okonomi.ingenDokumenter")}
                      </div>
                    ) : (
                      <div>
                        <button
                          onClick={() => {
                            if (valgteDokumenter.size === mappeDokumenter.length) setValgteDokumenter(new Set());
                            else setValgteDokumenter(new Set(mappeDokumenter.map((d) => d.id)));
                          }}
                          className="flex w-full items-center gap-2 border-b bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100"
                        >
                          <div className={`flex h-4 w-4 items-center justify-center rounded border ${
                            valgteDokumenter.size === mappeDokumenter.length ? "border-sitedoc-primary bg-sitedoc-primary text-white" : "border-gray-300"
                          }`}>
                            {valgteDokumenter.size === mappeDokumenter.length && <Check className="h-3 w-3" />}
                          </div>
                          {t("handling.velgAlle")} ({mappeDokumenter.length})
                        </button>
                        {mappeDokumenter.map((dok) => (
                          <button
                            key={dok.id}
                            onClick={() => toggleDokument(dok.id)}
                            className="flex w-full items-center gap-2 border-b px-3 py-2 text-left hover:bg-gray-50 last:border-b-0"
                          >
                            <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              valgteDokumenter.has(dok.id) ? "border-sitedoc-primary bg-sitedoc-primary text-white" : "border-gray-300"
                            }`}>
                              {valgteDokumenter.has(dok.id) && <Check className="h-3 w-3" />}
                            </div>
                            <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                            <span className="flex-1 truncate text-sm">{dok.filename}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t px-5 py-3">
            <button onClick={lukkDialog} className="rounded px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
              {t("handling.avbryt")}
            </button>
            <button
              onClick={startImport}
              disabled={antallFiler === 0}
              className="flex items-center gap-2 rounded bg-sitedoc-primary px-4 py-1.5 text-sm text-white hover:bg-sitedoc-secondary disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {t("handling.importer")} {antallFiler} {antallFiler === 1 ? t("okonomi.fil") : t("okonomi.filer")}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // FASE 2: Per-fil konfigurasjon
  // ---------------------------------------------------------------------------
  if (fase === "konfigurasjon" && gjeldende) {
    const erNota = gjeldende.docType === "a_nota" || gjeldende.docType === "t_nota";
    const erSluttnota = gjeldende.notaType === "Sluttnota";

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h2 className="text-base font-semibold">
              {t("okonomi.fil")} {gjeldendeFil + 1} {t("okonomi.av")} {kø.length}
            </h2>
            <button onClick={lukkDialog} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Fremdrift — mini-kjede */}
          <div className="flex items-center gap-1 border-b px-5 py-2">
            {kø.map((f, i) => (
              <div key={i} className="flex items-center gap-1">
                {i > 0 && <div className="h-px w-3 bg-gray-300" />}
                <div className={`h-2.5 w-2.5 rounded-full ${
                  f.status === "importert" ? "bg-sitedoc-success" :
                  f.status === "hoppet" || f.status === "duplikat" ? "bg-gray-300" :
                  f.status === "feil" ? "bg-sitedoc-error" :
                  i === gjeldendeFil ? "bg-sitedoc-primary" :
                  "bg-gray-200"
                }`} title={f.filnavn} />
              </div>
            ))}
          </div>

          <div className="space-y-3 p-5">
            {/* Filnavn */}
            <div className="flex items-center gap-2 rounded bg-gray-50 px-3 py-2">
              <FileText className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="truncate text-sm font-medium">{gjeldende.filnavn}</span>
            </div>

            {/* Kontrakt */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">{t("okonomi.kontrakt")}</label>
              <select
                className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
                value={gjeldende.kontraktId}
                onChange={(e) => oppdaterGjeldende({ kontraktId: e.target.value })}
              >
                <option value="">{t("okonomi.velgKontrakt")}...</option>
                {kontrakter?.map((k) => (
                  <option key={k.id} value={k.id}>{k.navn}</option>
                ))}
              </select>
            </div>

            {/* Type + Nr + Dato */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">{t("okonomi.type")}</label>
                <select
                  className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
                  value={gjeldende.docType}
                  onChange={(e) => {
                    const dt = e.target.value;
                    oppdaterGjeldende({
                      docType: dt,
                      notaType: gjettNotaType(gjeldende.filnavn, dt),
                    });
                  }}
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {erNota && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">{t("okonomi.notaType")}</label>
                    <select
                      className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
                      value={gjeldende.notaType}
                      onChange={(e) => oppdaterGjeldende({ notaType: e.target.value })}
                    >
                      <option value="A-Nota">A-Nota</option>
                      <option value="T-Nota">T-Nota</option>
                      <option value="Sluttnota">Sluttnota</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      {erSluttnota ? t("okonomi.dato") : t("okonomi.nr")}
                    </label>
                    {erSluttnota ? (
                      <input
                        type="date"
                        className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                        value={gjeldende.periodeSlutt}
                        onChange={(e) => oppdaterGjeldende({ periodeSlutt: e.target.value })}
                      />
                    ) : (
                      <input
                        type="number"
                        className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                        placeholder="f.eks. 26"
                        value={gjeldende.notaNr}
                        onChange={(e) => oppdaterGjeldende({ notaNr: e.target.value })}
                      />
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Dato for ikke-sluttnota */}
            {erNota && !erSluttnota && gjeldende.periodeSlutt && (
              <div className="grid grid-cols-3 gap-3">
                <div className="col-start-3">
                  <label className="mb-1 block text-xs font-medium text-gray-500">{t("okonomi.dato")}</label>
                  <input
                    type="date"
                    className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                    value={gjeldende.periodeSlutt}
                    onChange={(e) => oppdaterGjeldende({ periodeSlutt: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* Duplikat-advarsel */}
            {duplikatInfo && (
              <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div className="text-sm text-amber-700">
                  <span className="font-medium">
                    {erSluttnota ? t("okonomi.sluttnota") : `${gjeldende.notaType} ${gjeldende.notaNr}`}
                  </span>
                  {" "}{t("okonomi.alleredeImportert")}
                </div>
              </div>
            )}

            {/* Gap-advarsel */}
            {gapInfo && (
              <div className="flex items-start gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                <div className="text-sm text-blue-700">
                  A-nota {gapInfo.manglende.join(", ")} {t("okonomi.mangler")} — {t("okonomi.importUtenKontroll")}
                </div>
              </div>
            )}

            {/* Resultat (etter import) */}
            {gjeldende.status === "importert" && gjeldende.resultat && (
              <div className="flex items-start gap-2 rounded border border-green-200 bg-green-50 px-3 py-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <div className="text-sm text-green-700">
                  {gjeldende.resultat.antallPoster} {t("okonomi.poster")}
                  {gjeldende.resultat.antallNyePoster > 0 && `, ${gjeldende.resultat.antallNyePoster} ${t("okonomi.nye")}`}
                  {gjeldende.resultat.avvik.length > 0 && (
                    <span className="text-amber-600">
                      , {gjeldende.resultat.avvik.length} {t("okonomi.avvikLabel")}
                    </span>
                  )}
                  <span className="ml-2 text-gray-500">
                    ({t("okonomi.denne")}: {formaterTall(gjeldende.resultat.totalVerdiDenne)},
                    {" "}{t("okonomi.total")}: {formaterTall(gjeldende.resultat.totalVerdiTotal)})
                  </span>
                </div>
              </div>
            )}

            {/* Feilmelding */}
            {gjeldende.status === "feil" && gjeldende.feilmelding && (
              <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <div className="text-sm text-red-600">{gjeldende.feilmelding}</div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between border-t px-5 py-3">
            <button
              onClick={hoppOver}
              disabled={gjeldende.status === "importerer"}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              <SkipForward className="h-4 w-4" />
              {t("handling.hoppOver")}
            </button>
            <div className="flex gap-2">
              {duplikatInfo && (
                <button
                  onClick={() => importerGjeldende(true)}
                  disabled={gjeldende.status === "importerer"}
                  className="flex items-center gap-1.5 rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  {t("okonomi.reimporter")}
                </button>
              )}
              {gjeldende.status === "importert" ? (
                <button
                  onClick={nesteFilEllerOppsummering}
                  className="flex items-center gap-1.5 rounded bg-sitedoc-primary px-4 py-1.5 text-sm text-white hover:bg-sitedoc-secondary"
                >
                  {gjeldendeFil + 1 >= kø.length ? t("okonomi.visOppsummering") : t("handling.neste")}
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : gjeldende.status === "feil" ? (
                <button
                  onClick={() => importerGjeldende()}
                  className="flex items-center gap-1.5 rounded bg-sitedoc-primary px-4 py-1.5 text-sm text-white hover:bg-sitedoc-secondary"
                >
                  <RotateCcw className="h-4 w-4" />
                  {t("handling.provIgjen")}
                </button>
              ) : (
                <button
                  onClick={() => importerGjeldende()}
                  disabled={gjeldende.status === "importerer" || !gjeldende.kontraktId}
                  className="flex items-center gap-1.5 rounded bg-sitedoc-primary px-4 py-1.5 text-sm text-white hover:bg-sitedoc-secondary disabled:opacity-50"
                >
                  {gjeldende.status === "importerer" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("okonomi.importerer")}
                    </>
                  ) : (
                    <>
                      {t("handling.importer")}
                      {gjeldendeFil + 1 < kø.length && <ChevronRight className="h-4 w-4" />}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // FASE 3: Oppsummering
  // ---------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-base font-semibold">{t("okonomi.importFerdig")}</h2>
          <button onClick={lukkDialog} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-5">
          <div className="space-y-2">
            {kø.map((f, i) => {
              const avvikTyper: Record<string, number> = {};
              for (const a of f.resultat?.avvik ?? []) {
                avvikTyper[a.felt] = (avvikTyper[a.felt] ?? 0) + 1;
              }

              return (
                <div key={i} className="flex items-start gap-2 rounded border px-3 py-2">
                  {/* Status-ikon */}
                  {f.status === "importert" ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  ) : f.status === "hoppet" ? (
                    <SkipForward className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  ) : f.status === "duplikat" ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  ) : f.status === "feil" ? (
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  ) : (
                    <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-gray-200" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{f.filnavn}</div>
                    <div className="text-xs text-gray-500">
                      {f.status === "importert" && f.resultat ? (
                        <>
                          {f.resultat.antallPoster} {t("okonomi.poster")}
                          {f.resultat.avvik.length > 0 && (
                            <span className="ml-1 text-amber-600">
                              — {f.resultat.avvik.length} {t("okonomi.avvikLabel")}
                              {Object.entries(avvikTyper).map(([felt, antall]) => (
                                <span key={felt}> ({antall} {felt})</span>
                              ))}
                            </span>
                          )}
                          <span className="ml-1">
                            — {t("okonomi.denne")}: {formaterTall(f.resultat.totalVerdiDenne)}
                          </span>
                        </>
                      ) : f.status === "hoppet" ? (
                        t("okonomi.hoppetOver")
                      ) : f.status === "duplikat" ? (
                        t("okonomi.duplikatBeskrivelse")
                      ) : f.status === "feil" ? (
                        <span className="text-red-500">{f.feilmelding}</span>
                      ) : (
                        t("okonomi.ikkeBehandlet")
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Oppsummering-tall */}
        <div className="border-t px-5 py-2 text-xs text-gray-500">
          {kø.filter((f) => f.status === "importert").length} {t("okonomi.importertLabel")}
          {kø.filter((f) => f.status === "hoppet").length > 0 && ` · ${kø.filter((f) => f.status === "hoppet").length} ${t("okonomi.hoppetOver")}`}
          {kø.filter((f) => f.status === "feil").length > 0 && ` · ${kø.filter((f) => f.status === "feil").length} ${t("okonomi.feilet")}`}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t px-5 py-3">
          <button
            onClick={lukkDialog}
            className="rounded bg-sitedoc-primary px-4 py-1.5 text-sm text-white hover:bg-sitedoc-secondary"
          >
            {t("handling.lukk")}
          </button>
        </div>
      </div>
    </div>
  );
}

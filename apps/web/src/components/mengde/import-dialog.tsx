"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Upload,
  X,
  FileText,
  Loader2,
  FolderOpen,
  Check,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { EntrepriseVelger } from "./entreprise-velger";

interface ImportDialogProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

const DOC_TYPES = [
  { value: "anbudsgrunnlag", label: "Anbudsgrunnlag (PDF/Excel/GAB/XML)" },
  { value: "a_nota", label: "A-nota / Sluttnota (PDF/Excel)" },
  { value: "t_nota", label: "T-nota (PDF/Excel)" },
  { value: "mengdebeskrivelse", label: "Mengdebeskrivelse (PDF/Word)" },
  { value: "annet", label: "Annet dokument" },
] as const;

/** Gjett dokumenttype basert på filnavn */
function gjettDokType(filnavn: string): string {
  const lavt = filnavn.toLowerCase();
  if (lavt.endsWith(".gab") || lavt.endsWith(".ga1")) return "anbudsgrunnlag";
  if (lavt.endsWith(".xml")) return "anbudsgrunnlag"; // NS 3459
  if (/sluttnota|a.?nota|avdragsnota/i.test(lavt)) return "a_nota";
  if (/t.?nota/i.test(lavt)) return "t_nota";
  if (/mengde/i.test(lavt)) return "mengdebeskrivelse";
  if (/anbud|priset|tilbud/i.test(lavt)) return "anbudsgrunnlag";
  return "anbudsgrunnlag";
}

/** Gjett nota-nummer fra filnavn: "A-nota 3.pdf" → 3, "Avdragsnota_7_..." → 7 */
function gjettNotaNr(filnavn: string): string {
  const m = filnavn.match(/(?:nota|avdragsnota)[_\s-]*(\d+)/i);
  return m ? m[1]! : "";
}

type Kilde = "last-opp" | "fra-mappe";

export function ImportDialog({ projectId, open, onClose }: ImportDialogProps) {
  const [kilde, setKilde] = useState<Kilde>("last-opp");
  const [fil, setFil] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>("anbudsgrunnlag");
  const [enterpriseId, setEnterpriseId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [kontraktId, setKontraktId] = useState<string>("");
  const [notaType, setNotaType] = useState<string>("");
  const [notaNr, setNotaNr] = useState<string>("");
  const [lasterOpp, setLasterOpp] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [dragAktiv, setDragAktiv] = useState(false);

  // Fra-mappe state
  const [velgtMappeId, setVelgtMappeId] = useState<string | null>(null);
  const [valgteDokumenter, setValgteDokumenter] = useState<Set<string>>(
    new Set(),
  );

  const utils = trpc.useUtils();

  // Hent kontrakter
  const { data: kontrakter } = trpc.kontrakt.hentForProsjekt.useQuery(
    { projectId },
    { enabled: !!projectId && open },
  );

  const valgtKontrakt = kontrakter?.find((k) => k.id === kontraktId);

  // Hent mapper for prosjektet
  const { data: mapper } = trpc.mappe.hentForProsjekt.useQuery(
    { projectId },
    { enabled: !!projectId && open },
  );

  // Hent dokumenter i valgt mappe
  const { data: mappeDokumenter } = trpc.mappe.hentDokumenter.useQuery(
    { folderId: velgtMappeId! },
    { enabled: !!velgtMappeId && kilde === "fra-mappe" },
  );

  // Bygg flat liste med innrykk for dropdown
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

  const registrer = trpc.mengde.registrerDokument.useMutation({
    onSuccess: () => {
      utils.mengde.hentDokumenter.invalidate({ projectId });
    },
    onError: (err) => {
      setFeil(err.message);
      setLasterOpp(false);
    },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragAktiv(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFil(droppedFile);
      const dt = gjettDokType(droppedFile.name);
      setDocType(dt);
      setNotaNr(gjettNotaNr(droppedFile.name));
      if (/sluttnota/i.test(droppedFile.name)) setNotaType("Sluttnota");
      else if (dt === "a_nota") setNotaType("A-Nota");
      else if (dt === "t_nota") setNotaType("T-Nota");
      else setNotaType("");
    }
  }, []);

  const handleLastOpp = async () => {
    if (!fil) return;
    setLasterOpp(true);
    setFeil(null);

    try {
      const formData = new FormData();
      formData.append("file", fil);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(
          errorData?.error ?? `Opplasting feilet (${res.status})`,
        );
      }

      const { fileUrl, fileType } = await res.json();

      registrer.mutate(
        {
          projectId,
          folderId: folderId ?? undefined,
          filename: fil.name,
          fileUrl,
          filetype: fileType ?? fil.type,
          docType: docType as
            | "budsjett"
            | "a_nota"
            | "t_nota"
            | "mengdebeskrivelse"
            | "annet",
          ...(notaType ? { notaType: notaType as "A-Nota" | "T-Nota" | "Sluttnota" } : {}),
          ...(notaNr ? { notaNr: parseInt(notaNr, 10) } : {}),
          ...(kontraktId ? { kontraktId, kontraktNavn: valgtKontrakt?.navn ?? undefined } : {}),
        },
        {
          onSuccess: () => {
            setFil(null);
            setFeil(null);
            setLasterOpp(false);
            onClose();
          },
        },
      );
    } catch (err) {
      setFeil(
        err instanceof Error ? err.message : "Ukjent feil ved opplasting",
      );
      setLasterOpp(false);
    }
  };

  const handleImporterFraMapper = async () => {
    if (valgteDokumenter.size === 0) return;
    setLasterOpp(true);
    setFeil(null);

    const docs = (mappeDokumenter ?? []).filter((d) =>
      valgteDokumenter.has(d.id),
    );
    let importert = 0;

    for (const dok of docs) {
      try {
        await registrer.mutateAsync({
          projectId,
          folderId: velgtMappeId ?? undefined,
          filename: dok.filename,
          fileUrl: dok.fileUrl ?? "",
          filetype: dok.filetype ?? undefined,
          docType: docType as
            | "budsjett"
            | "a_nota"
            | "t_nota"
            | "mengdebeskrivelse"
            | "annet",
          ...(notaType ? { notaType: notaType as "A-Nota" | "T-Nota" | "Sluttnota" } : {}),
          ...(notaNr ? { notaNr: parseInt(notaNr, 10) } : {}),
          ...(kontraktId ? { kontraktId, kontraktNavn: valgtKontrakt?.navn ?? undefined } : {}),
        });
        importert++;
      } catch {
        // Ignorer duplikater
      }
    }

    setLasterOpp(false);
    if (importert > 0) {
      setValgteDokumenter(new Set());
      onClose();
    } else {
      setFeil("Ingen dokumenter ble importert. De kan allerede være registrert.");
    }
  };

  function toggleDokument(id: string) {
    setValgteDokumenter((prev) => {
      const neste = new Set(prev);
      if (neste.has(id)) neste.delete(id);
      else neste.add(id);
      return neste;
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-base font-semibold">Importer dokument</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Kilde-faner */}
        <div className="flex border-b px-5">
          <button
            onClick={() => setKilde("last-opp")}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              kilde === "last-opp"
                ? "border-sitedoc-primary text-sitedoc-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Upload className="mr-1.5 inline h-3.5 w-3.5" />
            Last opp fil
          </button>
          <button
            onClick={() => setKilde("fra-mappe")}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              kilde === "fra-mappe"
                ? "border-sitedoc-primary text-sitedoc-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <FolderOpen className="mr-1.5 inline h-3.5 w-3.5" />
            Velg fra mapper
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Dokumenttype (felles) */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Dokumenttype
            </label>
            <select
              className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Kontrakt-velger (for alle typer) */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Kontrakt
            </label>
            {kontrakter && kontrakter.length > 0 ? (
              <select
                className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
                value={kontraktId}
                onChange={(e) => setKontraktId(e.target.value)}
              >
                <option value="">Velg kontrakt...</option>
                {kontrakter.map((k) => (
                  <option key={k.id} value={k.id}>{k.navn}</option>
                ))}
              </select>
            ) : (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Ingen kontrakter opprettet. Opprett en kontrakt i økonomi-toppen før import.
              </div>
            )}
          </div>

          {/* Nota-nummer (for A-nota/T-nota) */}
          {(docType === "a_nota" || docType === "t_nota") && (
            <div className="rounded border border-blue-100 bg-blue-50/30 p-3">
              <div className="mb-2 text-xs font-medium text-gray-600">Nota-registrering</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Type</label>
                  <select
                    className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
                    value={notaType || (docType === "a_nota" ? "A-Nota" : "T-Nota")}
                    onChange={(e) => setNotaType(e.target.value)}
                  >
                    <option value="A-Nota">A-Nota</option>
                    <option value="T-Nota">T-Nota</option>
                    <option value="Sluttnota">Sluttnota</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Nummer</label>
                  <input
                    type="number"
                    className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                    placeholder="f.eks. 3"
                    value={notaNr}
                    onChange={(e) => setNotaNr(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {kilde === "last-opp" ? (
            <>
              {/* Mappe-velger */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Lagre i mappe
                </label>
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
                  <select
                    className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
                    value={folderId ?? ""}
                    onChange={(e) => setFolderId(e.target.value || null)}
                  >
                    <option value="">Ingen mappe</option>
                    {mappeValg.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fil-dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragAktiv(true);
                }}
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
                {fil ? (
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-green-600" />
                    <div>
                      <div className="text-sm font-medium">{fil.name}</div>
                      <div className="text-xs text-gray-500">
                        {(fil.size / 1024).toFixed(0)} KB
                      </div>
                    </div>
                    <button
                      onClick={() => setFil(null)}
                      className="ml-2 rounded p-1 text-gray-400 hover:bg-gray-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="mb-2 h-8 w-8 text-gray-400" />
                    <div className="text-sm text-gray-600">
                      Dra og slipp fil her, eller{" "}
                      <label className="cursor-pointer text-sitedoc-primary hover:underline">
                        velg fil
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.xlsx,.xls,.xml,.csv,.docx,.doc,.gab,.ga1"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              setFil(f);
                              const dt = gjettDokType(f.name);
                              setDocType(dt);
                              setNotaNr(gjettNotaNr(f.name));
                              if (/sluttnota/i.test(f.name)) setNotaType("Sluttnota");
                              else if (dt === "a_nota") setNotaType("A-Nota");
                              else if (dt === "t_nota") setNotaType("T-Nota");
                              else setNotaType("");
                            }
                          }}
                        />
                      </label>
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      PDF, Excel, XML, CSV, Word
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Velg mappe */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Velg mappe
                </label>
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
                  <select
                    className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
                    value={velgtMappeId ?? ""}
                    onChange={(e) => {
                      setVelgtMappeId(e.target.value || null);
                      setValgteDokumenter(new Set());
                    }}
                  >
                    <option value="">Velg mappe...</option>
                    {mappeValg.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dokumentliste fra mappe */}
              {velgtMappeId && (
                <div className="max-h-60 overflow-y-auto rounded border">
                  {!mappeDokumenter || mappeDokumenter.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">
                      Ingen dokumenter i denne mappen.
                    </div>
                  ) : (
                    <div>
                      {/* Velg alle */}
                      <button
                        onClick={() => {
                          if (
                            valgteDokumenter.size === mappeDokumenter.length
                          ) {
                            setValgteDokumenter(new Set());
                          } else {
                            setValgteDokumenter(
                              new Set(mappeDokumenter.map((d) => d.id)),
                            );
                          }
                        }}
                        className="flex w-full items-center gap-2 border-b bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100"
                      >
                        <div
                          className={`flex h-4 w-4 items-center justify-center rounded border ${
                            valgteDokumenter.size === mappeDokumenter.length
                              ? "border-sitedoc-primary bg-sitedoc-primary text-white"
                              : "border-gray-300"
                          }`}
                        >
                          {valgteDokumenter.size === mappeDokumenter.length && (
                            <Check className="h-3 w-3" />
                          )}
                        </div>
                        Velg alle ({mappeDokumenter.length})
                      </button>

                      {mappeDokumenter.map((dok) => (
                        <button
                          key={dok.id}
                          onClick={() => toggleDokument(dok.id)}
                          className="flex w-full items-center gap-2 border-b px-3 py-2 text-left hover:bg-gray-50 last:border-b-0"
                        >
                          <div
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              valgteDokumenter.has(dok.id)
                                ? "border-sitedoc-primary bg-sitedoc-primary text-white"
                                : "border-gray-300"
                            }`}
                          >
                            {valgteDokumenter.has(dok.id) && (
                              <Check className="h-3 w-3" />
                            )}
                          </div>
                          <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                          <span className="flex-1 truncate text-sm">
                            {dok.filename}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(dok.uploadedAt).toLocaleDateString(
                              "nb-NO",
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {valgteDokumenter.size > 0 && (
                <div className="text-xs text-gray-500">
                  {valgteDokumenter.size} dokument
                  {valgteDokumenter.size > 1 ? "er" : ""} valgt
                </div>
              )}
            </>
          )}

          {/* Feilmelding */}
          {feil && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {feil}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button
            onClick={onClose}
            className="rounded px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            Avbryt
          </button>
          <button
            onClick={
              kilde === "last-opp" ? handleLastOpp : handleImporterFraMapper
            }
            disabled={
              lasterOpp ||
              (kilde === "last-opp" ? !fil : valgteDokumenter.size === 0)
            }
            className="flex items-center gap-2 rounded bg-sitedoc-primary px-4 py-1.5 text-sm text-white hover:bg-sitedoc-secondary disabled:opacity-50"
          >
            {lasterOpp ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importerer...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Importer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

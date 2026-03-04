"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Modal } from "@siteflow/ui";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import type { Vedlegg } from "./typer";

interface TegningsModalProps {
  open: boolean;
  onClose: () => void;
  prosjektId: string;
  bygningId?: string | null;
  standardTegningId?: string | null;
  onVelgSkjermbilde: (vedlegg: Vedlegg) => void;
}

interface Tegning {
  id: string;
  name: string;
  drawingNumber: string | null;
  discipline: string | null;
  floor: string | null;
  geoReference: unknown;
  fileUrl?: string | null;
}

interface BygningMedTegninger {
  id: string;
  name: string;
  number: number | null;
  drawings: Tegning[];
}

interface EtasjeGruppe {
  label: string;
  tegninger: Tegning[];
}

function grupperTegninger(tegninger: Tegning[]): EtasjeGruppe[] {
  const utomhus: Tegning[] = [];
  const etasjeMap = new Map<string, Tegning[]>();
  const utenEtasje: Tegning[] = [];

  for (const t of tegninger) {
    if (t.geoReference != null) {
      utomhus.push(t);
    } else if (t.floor != null && t.floor.trim() !== "") {
      const eksisterende = etasjeMap.get(t.floor) ?? [];
      eksisterende.push(t);
      etasjeMap.set(t.floor, eksisterende);
    } else {
      utenEtasje.push(t);
    }
  }

  const grupper: EtasjeGruppe[] = [];

  if (utomhus.length > 0) {
    grupper.push({ label: "Utomhus", tegninger: utomhus });
  }

  const sorterteEtasjer = [...etasjeMap.keys()].sort((a, b) =>
    a.localeCompare(b, "nb-NO", { numeric: true }),
  );
  for (const etasje of sorterteEtasjer) {
    grupper.push({ label: etasje, tegninger: etasjeMap.get(etasje)! });
  }

  if (utenEtasje.length > 0) {
    grupper.push({ label: "(Uten etasje)", tegninger: utenEtasje });
  }

  return grupper;
}

function tegningLabel(t: Tegning): string {
  const deler: string[] = [];
  if (t.drawingNumber) deler.push(t.drawingNumber);
  if (t.name && t.name !== t.drawingNumber) deler.push(t.name);
  const tekst = deler.join(" — ");
  if (t.discipline) return `${tekst} [${t.discipline}]`;
  return tekst;
}

function genererVedleggId(): string {
  return `v-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function TegningsModal({
  open,
  onClose,
  prosjektId,
  bygningId,
  standardTegningId,
  onVelgSkjermbilde,
}: TegningsModalProps) {
  const [valgtTegningId, setValgtTegningId] = useState<string | null>(null);
  const [lasterOpp, settLasterOpp] = useState(false);
  const [harAutoValgt, setHarAutoValgt] = useState(false);
  const bildeRef = useRef<HTMLImageElement>(null);

  // Hent bygninger med tegninger (inkl. floor, discipline, geoReference)
  const { data: bygningerRå } = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId && open },
  );
  const bygninger = bygningerRå as BygningMedTegninger[] | undefined;

  // Filtrer til sjekklistens bygning hvis satt, ellers vis alle
  const filtrerteBygnigner = useMemo(() => {
    if (!bygninger) return [];
    if (bygningId) {
      return bygninger.filter((b) => b.id === bygningId);
    }
    return bygninger;
  }, [bygninger, bygningId]);

  // Flat liste over alle tegninger (for å finne valgt tegning + fileUrl)
  const alleTegninger = useMemo(() => {
    const resultat: Tegning[] = [];
    for (const b of filtrerteBygnigner) {
      for (const t of b.drawings) {
        resultat.push(t);
      }
    }
    return resultat;
  }, [filtrerteBygnigner]);

  // Hent fileUrl for valgt tegning (bygning-query inkluderer ikke fileUrl)
  const { data: valgtTegningData } = trpc.tegning.hentMedId.useQuery(
    { id: valgtTegningId! },
    { enabled: !!valgtTegningId },
  );
  const valgtTegningDetalj = valgtTegningData as {
    id: string;
    name: string;
    drawingNumber: string | null;
    fileUrl: string | null;
  } | undefined;

  // Auto-velg standard-tegning ved åpning
  useEffect(() => {
    if (!open) {
      setHarAutoValgt(false);
      return;
    }
    if (harAutoValgt || !alleTegninger.length) return;

    if (standardTegningId && alleTegninger.some((t) => t.id === standardTegningId)) {
      setValgtTegningId(standardTegningId);
    }
    setHarAutoValgt(true);
  }, [open, harAutoValgt, standardTegningId, alleTegninger]);

  const lagreSomVedlegg = useCallback(async () => {
    const img = bildeRef.current;
    if (!img || !valgtTegningDetalj) return;

    settLasterOpp(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) return;

      const filnavn = `tegning-${valgtTegningDetalj.drawingNumber ?? valgtTegningDetalj.name}-${Date.now()}.png`;
      const fil = new File([blob], filnavn, { type: "image/png" });

      const formData = new FormData();
      formData.append("file", fil);

      const respons = await fetch("/api/trpc/../../../upload", {
        method: "POST",
        body: formData,
      });

      if (!respons.ok) {
        console.error("Filopplasting feilet:", respons.statusText);
        return;
      }

      const data = (await respons.json()) as {
        fileUrl: string;
        fileName: string;
      };

      onVelgSkjermbilde({
        id: genererVedleggId(),
        type: "bilde",
        url: data.fileUrl,
        filnavn: data.fileName,
        opprettet: new Date().toISOString(),
      });
      onClose();
    } catch (feil) {
      console.error("Tegningsvedlegg feilet:", feil);
    } finally {
      settLasterOpp(false);
    }
  }, [valgtTegningDetalj, onVelgSkjermbilde, onClose]);

  return (
    <Modal open={open} onClose={onClose} title="Velg tegning" className="max-w-2xl">
      <div className="flex flex-col gap-4">
        {/* Tegningsvelger med strukturert gruppering */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Tegning
          </label>
          <select
            value={valgtTegningId ?? ""}
            onChange={(e) => setValgtTegningId(e.target.value || null)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">— Velg tegning —</option>
            {filtrerteBygnigner.map((bygning) => {
              const grupper = grupperTegninger(bygning.drawings);
              // Hvis det bare er én bygning og én gruppe, ikke vis bygning-header
              const visBygningNavn = filtrerteBygnigner.length > 1;

              return grupper.map((gruppe) => (
                <optgroup
                  key={`${bygning.id}::${gruppe.label}`}
                  label={visBygningNavn
                    ? `${bygning.number ? `${bygning.number}. ` : ""}${bygning.name} — ${gruppe.label}`
                    : gruppe.label}
                >
                  {gruppe.tegninger.map((t) => (
                    <option key={t.id} value={t.id}>
                      {tegningLabel(t)}
                    </option>
                  ))}
                </optgroup>
              ));
            })}
          </select>
        </div>

        {/* Tegningsvisning */}
        {valgtTegningDetalj?.fileUrl && (
          <div className="overflow-hidden rounded-lg border border-gray-200" style={{ maxHeight: 400 }}>
            <img
              ref={bildeRef}
              src={valgtTegningDetalj.fileUrl}
              alt={valgtTegningDetalj.name}
              className="w-full object-contain"
              crossOrigin="anonymous"
              draggable={false}
            />
          </div>
        )}

        {/* Handlinger */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={lagreSomVedlegg}
            disabled={!valgtTegningDetalj?.fileUrl || lasterOpp}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {lasterOpp && <Loader2 size={14} className="animate-spin" />}
            Lagre som vedlegg
          </button>
        </div>
      </div>
    </Modal>
  );
}

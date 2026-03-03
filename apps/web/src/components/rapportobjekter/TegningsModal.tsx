"use client";

import { useState, useRef, useCallback } from "react";
import { Modal } from "@siteflow/ui";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import type { Vedlegg } from "./typer";

interface TegningsModalProps {
  open: boolean;
  onClose: () => void;
  prosjektId: string;
  onVelgSkjermbilde: (vedlegg: Vedlegg) => void;
}

function genererVedleggId(): string {
  return `v-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function TegningsModal({
  open,
  onClose,
  prosjektId,
  onVelgSkjermbilde,
}: TegningsModalProps) {
  const [valgtTegningId, setValgtTegningId] = useState<string | null>(null);
  const [lasterOpp, settLasterOpp] = useState(false);
  const bildeRef = useRef<HTMLImageElement>(null);

  const tegningQuery = trpc.tegning.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId && open },
  );
  const tegninger = tegningQuery.data as
    | Array<{
        id: string;
        name: string;
        drawingNumber: string | null;
        fileUrl: string | null;
      }>
    | undefined;

  const valgtTegning = tegninger?.find((t) => t.id === valgtTegningId);

  const lagreSomVedlegg = useCallback(async () => {
    const img = bildeRef.current;
    if (!img || !valgtTegning) return;

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

      const filnavn = `tegning-${valgtTegning.drawingNumber ?? valgtTegning.name}-${Date.now()}.png`;
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
      });
      onClose();
    } catch (feil) {
      console.error("Tegningsvedlegg feilet:", feil);
    } finally {
      settLasterOpp(false);
    }
  }, [valgtTegning, onVelgSkjermbilde, onClose]);

  return (
    <Modal open={open} onClose={onClose} title="Velg tegning" className="max-w-2xl">
      <div className="flex flex-col gap-4">
        {/* Tegningsvelger */}
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
            {tegninger?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.drawingNumber ? `${t.drawingNumber} — ` : ""}
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tegningsvisning */}
        {valgtTegning?.fileUrl && (
          <div className="overflow-hidden rounded-lg border border-gray-200" style={{ maxHeight: 400 }}>
            <img
              ref={bildeRef}
              src={valgtTegning.fileUrl}
              alt={valgtTegning.name}
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
            disabled={!valgtTegning?.fileUrl || lasterOpp}
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

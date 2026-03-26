"use client";

import { useState, useRef, useCallback } from "react";
import { Paperclip, Upload, Clipboard, Trash2, Map, X, ChevronLeft, ChevronRight } from "lucide-react";
import type { Vedlegg } from "./typer";
import { TegningsModal } from "./TegningsModal";

interface FeltDokumentasjonProps {
  kommentar: string;
  vedlegg: Vedlegg[];
  onEndreKommentar: (kommentar: string) => void;
  onLeggTilVedlegg: (vedlegg: Vedlegg) => void;
  onFjernVedlegg: (vedleggId: string) => void;
  leseModus?: boolean;
  skjulKommentar?: boolean;
  prosjektId?: string;
  bygningId?: string | null;
  standardTegningId?: string | null;
}

function genererVedleggId(): string {
  return `v-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function erBildeType(filnavn: string): boolean {
  return /\.(png|jpg|jpeg|gif|webp)$/i.test(filnavn);
}

function vedleggUrl(url: string): string {
  if (url.startsWith("http") || url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith("/uploads/")) return `/api/uploads${url.replace("/uploads", "")}`;
  return url;
}

export function FeltDokumentasjon({
  kommentar,
  vedlegg,
  onEndreKommentar,
  onLeggTilVedlegg,
  onFjernVedlegg,
  leseModus,
  skjulKommentar,
  prosjektId,
  bygningId,
  standardTegningId,
}: FeltDokumentasjonProps) {
  const [visVedleggMeny, settVisVedleggMeny] = useState(false);
  const [valgtVedlegg, settValgtVedlegg] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const bildeVedlegg = vedlegg.filter((v) => v.type === "bilde");
  const [visTegningsModal, settVisTegningsModal] = useState(false);
  const filInputRef = useRef<HTMLInputElement>(null);

  const lastOppFil = useCallback(async (fil: File) => {
    const formData = new FormData();
    formData.append("file", fil);

    try {
      const respons = await fetch("/api/trpc/../../../upload", {
        method: "POST",
        body: formData,
      });

      if (!respons.ok) {
        console.error("Filopplasting feilet:", respons.statusText);
        return;
      }

      const data = await respons.json() as { fileUrl: string; fileName: string };

      onLeggTilVedlegg({
        id: genererVedleggId(),
        type: erBildeType(data.fileName) ? "bilde" : "fil",
        url: data.fileUrl,
        filnavn: data.fileName,
        opprettet: new Date().toISOString(),
      });
    } catch (feil) {
      console.error("Filopplasting feilet:", feil);
    }
  }, [onLeggTilVedlegg]);

  const håndterFilValg = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const filer = e.target.files;
    if (!filer) return;
    for (let i = 0; i < filer.length; i++) {
      const fil = filer[i];
      if (fil) lastOppFil(fil);
    }
    // Reset input
    e.target.value = "";
  }, [lastOppFil]);

  const limInnFraUtklippstavle = useCallback(async () => {
    try {
      const elementer = await navigator.clipboard.read();
      for (const element of elementer) {
        for (const type of element.types) {
          if (type.startsWith("image/")) {
            const blob = await element.getType(type);
            const fil = new File([blob], `utklipp-${Date.now()}.png`, { type });
            await lastOppFil(fil);
          }
        }
      }
    } catch (feil) {
      console.error("Utklippstavle-lesing feilet:", feil);
    }
    settVisVedleggMeny(false);
  }, [lastOppFil]);

  const harKommentar = kommentar.length > 0;
  const harVedlegg = vedlegg.length > 0;

  // Skjul hele seksjonen i lesemodus hvis det ikke er noe innhold
  if (leseModus && !harKommentar && !harVedlegg) return null;

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      {/* Kommentar */}
      {!skjulKommentar && (
        <div className="mb-2">
          {leseModus ? (
            harKommentar && (
              <p className="text-xs text-gray-500">{kommentar}</p>
            )
          ) : (
            <textarea
              value={kommentar}
              onChange={(e) => onEndreKommentar(e.target.value)}
              placeholder="Kommentar..."
              rows={1}
              className="w-full resize-none rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-600 placeholder-gray-400 focus:border-blue-400 focus:outline-none"
            />
          )}
        </div>
      )}

      {/* Filmrull (vedlegg-thumbnails) — skjult ved print */}
      {harVedlegg && (
        <div className="print-skjul mb-2 flex flex-wrap gap-2">
          {vedlegg.map((v) => {
            const erValgt = valgtVedlegg === v.id;
            return (
              <div
                key={v.id}
                className={`relative cursor-pointer overflow-hidden rounded border-2 ${
                  erValgt ? "border-blue-500" : "border-gray-200"
                }`}
                onClick={() => {
                  if (v.type === "bilde") {
                    const idx = bildeVedlegg.findIndex((b) => b.id === v.id);
                    setLightboxIdx(idx >= 0 ? idx : null);
                  } else {
                    settValgtVedlegg(erValgt ? null : v.id);
                  }
                }}
                style={{ width: 72, height: 72 }}
              >
                {v.type === "bilde" ? (
                  <img
                    src={vedleggUrl(v.url)}
                    alt={v.filnavn}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-gray-50 p-1">
                    <Paperclip size={20} className="text-gray-400" />
                    <span className="mt-1 line-clamp-2 text-center text-[10px] text-gray-500">
                      {v.filnavn}
                    </span>
                  </div>
                )}
                {/* Slett-knapp på valgt vedlegg */}
                {erValgt && !leseModus && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFjernVedlegg(v.id);
                      settValgtVedlegg(null);
                    }}
                    className="absolute right-0 top-0 rounded-bl bg-red-500 p-0.5"
                  >
                    <Trash2 size={12} className="text-white" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {(() => {
        const lbBilde = lightboxIdx !== null ? bildeVedlegg[lightboxIdx] : null;
        if (!lbBilde || lightboxIdx === null) return null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
            onClick={() => setLightboxIdx(null)}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(null); }}
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            >
              <X size={24} />
            </button>
            {bildeVedlegg.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setLightboxIdx((lightboxIdx - 1 + bildeVedlegg.length) % bildeVedlegg.length); }}
                  className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setLightboxIdx((lightboxIdx + 1) % bildeVedlegg.length); }}
                  className="absolute right-16 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}
            <img
              src={vedleggUrl(lbBilde.url)}
              alt={lbBilde.filnavn}
              className="max-h-[90vh] max-w-[90vw] rounded object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            {!leseModus && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFjernVedlegg(lbBilde.id);
                  if (bildeVedlegg.length <= 1) setLightboxIdx(null);
                  else setLightboxIdx(Math.min(lightboxIdx, bildeVedlegg.length - 2));
                }}
                className="absolute bottom-6 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <Trash2 size={14} className="mr-1.5 inline" />
                Slett bilde
              </button>
            )}
          </div>
        );
      })()}

      {/* Print-versjon av vedlegg: 5:4 bilder i 2-kolonne rutenett */}
      {harVedlegg && (
        <div className="print-vedlegg-fullvisning">
          {(() => {
            const bildeVedlegg = vedlegg.filter((v) => v.type === "bilde");
            const filVedlegg = vedlegg.filter((v) => v.type !== "bilde");
            return (
              <>
                {bildeVedlegg.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {bildeVedlegg.map((v) => (
                      <div key={v.id}>
                        <img
                          src={vedleggUrl(v.url)}
                          alt={v.filnavn}
                          className="w-full rounded border border-gray-200 object-cover"
                          style={{ aspectRatio: "5/4" }}
                        />
                        {v.opprettet && (
                          <p className="mt-0.5 text-[10px] text-gray-400">
                            {new Date(v.opprettet).toLocaleString("nb-NO")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {filVedlegg.length > 0 && (
                  <p className="mt-1 text-xs text-gray-600">
                    {filVedlegg.map((f) => f.filnavn).join(", ")}
                  </p>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Vedlegg-handlinger (kun redigeringsmodus) */}
      {!leseModus && (
        <div className="relative flex items-center gap-3">
          <button
            type="button"
            onClick={() => settVisVedleggMeny(!visVedleggMeny)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <Paperclip size={14} />
            Vedlegg
          </button>

          {prosjektId && (
            <button
              type="button"
              onClick={() => settVisTegningsModal(true)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            >
              <Map size={14} />
              Tegning
            </button>
          )}

          {visVedleggMeny && (
            <div className="absolute bottom-full left-0 z-10 mb-1 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  filInputRef.current?.click();
                  settVisVedleggMeny(false);
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Upload size={14} />
                Last opp fra PC
              </button>
              <button
                type="button"
                onClick={limInnFraUtklippstavle}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Clipboard size={14} />
                Lim inn fra utklippstavlen
              </button>
            </div>
          )}

          <input
            ref={filInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            multiple
            onChange={håndterFilValg}
            className="hidden"
          />
        </div>
      )}

      {/* Tegningsmodal */}
      {prosjektId && (
        <TegningsModal
          open={visTegningsModal}
          onClose={() => settVisTegningsModal(false)}
          prosjektId={prosjektId}
          bygningId={bygningId}
          standardTegningId={standardTegningId}
          onVelgSkjermbilde={onLeggTilVedlegg}
        />
      )}
    </div>
  );
}

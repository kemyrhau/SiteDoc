"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { X, CheckCircle, ChevronDown, ChevronRight, Library, ExternalLink, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface BibliotekPanelProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onImportert?: () => void;
}

export function BibliotekPanel({ projectId, open, onClose, onImportert }: BibliotekPanelProps) {
  const { t } = useTranslation();
  const [åpneKapitler, setÅpneKapitler] = useState<Set<string>>(new Set());
  const [importerer, setImporterer] = useState<Set<string>>(new Set());

  const { data: standarder, isLoading } = trpc.bibliotek.hentStandarder.useQuery(undefined, { enabled: open });
  const { data: prosjektValg, refetch: refetchValg } = trpc.bibliotek.hentProsjektValg.useQuery(
    { projectId },
    { enabled: open && !!projectId },
  );
  const utils = trpc.useUtils();

  const importerMal = trpc.bibliotek.importerMal.useMutation({
    onSuccess: () => {
      refetchValg();
      utils.mal.hentForProsjekt.invalidate({ projectId });
      onImportert?.();
    },
  });

  // Map: bibliotekMalId → ProsjektBibliotekValg
  const valgMap = useMemo(() => {
    const map = new Map<string, { sjekklisteMalId: string | null }>();
    for (const v of prosjektValg ?? []) {
      map.set(v.bibliotekMalId, { sjekklisteMalId: v.sjekklisteMalId });
    }
    return map;
  }, [prosjektValg]);

  function toggleKapittel(id: string) {
    setÅpneKapitler((prev) => {
      const ny = new Set(prev);
      if (ny.has(id)) ny.delete(id);
      else ny.add(id);
      return ny;
    });
  }

  async function handleImporter(bibliotekMalId: string) {
    if (importerer.has(bibliotekMalId) || valgMap.has(bibliotekMalId)) return;
    setImporterer((prev) => new Set(prev).add(bibliotekMalId));
    try {
      await importerMal.mutateAsync({ projectId, bibliotekMalId });
    } catch {
      // Feil vises via mutation state
    } finally {
      setImporterer((prev) => {
        const ny = new Set(prev);
        ny.delete(bibliotekMalId);
        return ny;
      });
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Panel fra høyre */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Library className="h-5 w-5 text-sitedoc-primary" />
            <h2 className="text-base font-semibold">{t("bibliotek.tittel")}</h2>
          </div>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="border-b px-5 py-2 text-xs text-gray-500">
          {t("bibliotek.beskrivelse")}
        </p>

        {/* Innhold */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : !standarder || standarder.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">{t("bibliotek.ingenStandarder")}</p>
          ) : (
            <div className="space-y-4">
              {standarder.map((standard) => (
                <div key={standard.id}>
                  <h3 className="mb-2 text-sm font-semibold text-gray-800">{standard.navn}</h3>
                  <div className="space-y-1">
                    {standard.kapitler.map((kapittel) => {
                      const erÅpen = åpneKapitler.has(kapittel.id);
                      return (
                        <div key={kapittel.id} className="rounded border">
                          <button
                            onClick={() => toggleKapittel(kapittel.id)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-gray-50"
                          >
                            {erÅpen ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                            <span className="font-mono text-xs text-sitedoc-primary">{kapittel.kode}</span>
                            <span className="flex-1">{kapittel.navn}</span>
                            <span className="text-xs text-gray-400">{kapittel.maler.length}</span>
                          </button>
                          {erÅpen && kapittel.maler.length > 0 && (
                            <div className="border-t bg-gray-50/50 px-3 py-1.5">
                              {kapittel.maler.map((mal) => {
                                const valg = valgMap.get(mal.id);
                                const erImportert = !!valg;
                                const erIGang = importerer.has(mal.id);

                                return (
                                  <div
                                    key={mal.id}
                                    className={`flex items-start gap-2.5 rounded px-2 py-2 ${erImportert ? "opacity-60" : "hover:bg-white cursor-pointer"}`}
                                    onClick={() => !erImportert && handleImporter(mal.id)}
                                  >
                                    {/* Checkbox / status */}
                                    <div className="mt-0.5 flex-shrink-0">
                                      {erIGang ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-sitedoc-primary" />
                                      ) : erImportert ? (
                                        <CheckCircle className="h-4 w-4 text-sitedoc-success" />
                                      ) : (
                                        <div className="h-4 w-4 rounded border-2 border-gray-300" />
                                      )}
                                    </div>

                                    {/* Innhold */}
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium">{mal.navn}</div>
                                      <div className="flex items-center gap-2 text-[11px] text-gray-500">
                                        <span className="font-mono">{mal.referanse}</span>
                                        {mal.beskrivelse && <span>· {mal.beskrivelse}</span>}
                                      </div>
                                    </div>

                                    {/* Lenke til importert mal */}
                                    {erImportert && valg?.sjekklisteMalId && (
                                      <a
                                        href={`/dashbord/oppsett/produksjon/sjekklistemaler/${valg.sjekklisteMalId}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex-shrink-0 text-sitedoc-secondary hover:text-sitedoc-primary"
                                        title={t("bibliotek.seMal")}
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

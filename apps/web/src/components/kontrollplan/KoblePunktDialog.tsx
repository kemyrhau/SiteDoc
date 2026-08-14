"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

/**
 * «Koble eksisterende»: knytt en sjekkliste som allerede er laget (utenfor planen) til
 * kontrollpunktet. Løser de foreldreløse sjekklistene — en plan der arbeidet er gjort,
 * men koblingen aldri fantes, teller dem umiddelbart etter kobling. Kun sjekklister med
 * samme mal og som ikke alt er koblet vises (server-filtrert).
 */
export function KoblePunktDialog({
  punktId,
  byggeplassId,
  onLukk,
  onKoblet,
}: {
  punktId: string;
  byggeplassId: string;
  onLukk: () => void;
  onKoblet: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [feil, setFeil] = useState<string | null>(null);

  const { data: kandidater, isLoading } = trpc.kontrollplan.hentKoblbareSjekklister.useQuery({ punktId });

  const koble = trpc.kontrollplan.koblePunkt.useMutation({
    onSuccess: () => {
      utils.kontrollplan.hentForByggeplass.invalidate({ byggeplassId });
      onKoblet();
    },
    onError: (err: { message: string }) => setFeil(err.message),
  });

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center pt-[12vh]" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold">{t("kontrollplan.kobleEksisterende")}</h2>
          <button onClick={onLukk} className="p-1 hover:bg-gray-100 rounded text-gray-400">✕</button>
        </div>
        <div className="p-4">
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : !kandidater || kandidater.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">{t("kontrollplan.kobleIngenKandidater")}</p>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {kandidater.map((s: { id: string; title: string; number: number | null; status: string; byggeplass: { name: string } | null }) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={koble.isPending}
                  onClick={() => { setFeil(null); koble.mutate({ punktId, sjekklisteId: s.id }); }}
                  className="w-full text-left px-3 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className="text-sm font-medium">
                    {s.number != null ? `#${s.number} ` : ""}{s.title}
                  </span>
                  {s.byggeplass && <span className="block text-[11px] text-gray-400">{s.byggeplass.name}</span>}
                </button>
              ))}
            </div>
          )}
          {feil && <p className="mt-2 text-[11px] text-sitedoc-error">{feil}</p>}
        </div>
      </div>
    </div>
  );
}

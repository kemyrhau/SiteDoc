"use client";

import { useState } from "react";
import { MapPin, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";

/**
 * POST 2026-11-15 (12) D — «Hvor møter du vanligvis?» når en dagsseddel
 * opprettes på web. Vises KUN når serveren sier `trengerValg` (≥ 2 aktive
 * kontorer, aldri hatt fast sted). Ett klikk = lagret (`settMittFaste`).
 * Lukk = fortsett uten (resolveren gir «ikke valgt», spørsmålet kommer igjen).
 * Speiler mobilens `OppmoteSporsmaalArk`.
 */
export function OppmoteSporsmaalModal({ organizationId }: { organizationId: string | null }) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [lukket, setLukket] = useState(false);
  const mine = trpc.oppmotePeriode.hentMine.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: !!organizationId, retry: false },
  );
  const trengerValg = mine.data?.trengerValg === true;
  const steder = trpc.oppmotested.hentForFirma.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: !!organizationId && trengerValg },
  );
  const settMittFaste = trpc.oppmotePeriode.settMittFaste.useMutation({
    onSettled: () => {
      void utils.oppmotePeriode.hentMine.invalidate();
      setLukket(true);
    },
  });

  if (!organizationId || !trengerValg || lukket) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="text-base font-semibold text-gray-900">{t("timer.oppmote.sporsmaal")}</h2>
          <button
            type="button"
            onClick={() => setLukket(true)}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label={t("timer.besok.lukk")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-gray-600">{t("timer.oppmote.forklaring")}</p>
          <div className="flex flex-col gap-2">
            {(steder.data ?? []).map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={settMittFaste.isPending}
                onClick={() => settMittFaste.mutate({ organizationId, oppmotestedId: s.id })}
                className="flex items-center gap-2 rounded-md border border-gray-300 px-4 py-3 text-left text-sm text-gray-900 hover:bg-gray-50 disabled:opacity-50"
              >
                <MapPin className="h-4 w-4 text-sitedoc-primary" />
                {s.navn}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useByggeplass } from "@/kontekst/byggeplass-kontekst";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { useKanManageField } from "@/hooks/useKanManageField";
import { trpc } from "@/lib/trpc";

/**
 * ORDRE (22) 2026-11-15: lister filtrerer alltid på valgt byggeplass — det finnes intet valg for alle byggeplasser; det er
 * ikke et alternativ. Porten står rundt selve lista (ikke rundt siden, så «Ny …» virker):
 *   · prosjektet har byggeplasser, ingen valgt → «Velg byggeplass» med ett-klikks-knapper
 *     i stedet for lista
 *   · prosjektet har ingen byggeplass → én linje (lenke til oppsett for dem med oppsettsrett),
 *     lista vises som før
 *   · ellers → lista
 */
export function ByggeplassFilterPort({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { prosjektId } = useProsjekt();
  const { aktivByggeplass, harByggeplasser, byggeplasserLastet, velgByggeplass } = useByggeplass();
  const kanOppsett = useKanManageField();
  // Samme kall som konteksten (react-query deduper).
  const liste = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: prosjektId ?? "" },
    { enabled: !!prosjektId },
  );

  if (byggeplasserLastet && !harByggeplasser) {
    return (
      <>
        <div
          data-testid="prosjekt-mangler-byggeplass"
          className="mb-2 flex items-center gap-2 text-xs text-gray-500"
        >
          <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span>{t("byggeplass.prosjektManglerByggeplass")}</span>
          {kanOppsett && (
            <Link
              href="/dashbord/oppsett/byggeplasser"
              className="font-medium text-sitedoc-secondary hover:underline"
            >
              {t("byggeplass.leggTil")}
            </Link>
          )}
        </div>
        {children}
      </>
    );
  }

  if (harByggeplasser && !aktivByggeplass) {
    return (
      <div
        data-testid="velg-byggeplass"
        className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-gray-300 px-6 py-10 text-center"
      >
        <MapPin className="h-6 w-6 text-gray-400" />
        <div>
          <p className="font-medium text-gray-900">{t("byggeplass.velgByggeplass")}</p>
          <p className="mt-1 text-sm text-gray-500">{t("byggeplass.velgForListe")}</p>
        </div>
        <div className="flex max-w-xl flex-wrap justify-center gap-2">
          {(liste.data ?? []).map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => velgByggeplass({ id: b.id, name: b.name, number: b.number })}
              className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:border-sitedoc-secondary hover:text-sitedoc-secondary"
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

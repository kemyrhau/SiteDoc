"use client";

import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { UserPlus, Users } from "lucide-react";
import Link from "next/link";

/**
 * Delte handlinger for å bemanne HMS-behandler-leddet (HMS-gruppa):
 * «Meld meg inn» (innlogget bruker tar ansvar selv) + en lenke til gruppekortet
 * for å legge til andre. Gjenbrukes av tilgangsmatrisen, flyt-oppsettet og HmsTomBanner.
 *
 * Skillet er bevisst (Kenneth-vedtak 2026-09-10): medlemskap i HMS-gruppa gir
 * HMS-administrator (erHmsAdmin). Å ta ansvar SELV er ufarlig og løses på ett klikk
 * der problemet oppdages — derfor står «Meld meg inn» her, med en linje om hva det
 * gir. Å gi en ANNEN person rettigheten hører hjemme der rettighetene vises
 * (gruppekortet, med domene-chips synlig), ikke skjult i flyt-oppsettet.
 *
 * Server håndhever admin-nivå på meldMegInn (verifiserAdmin) — UI-gaten er kosmetisk.
 * «Meld meg inn» knyttes til innlogget bruker på serveren; ingen klient-identitet her.
 */
export function HmsBehandlerHandlinger({
  prosjektId,
  hmsGruppeId,
}: {
  prosjektId: string;
  hmsGruppeId: string;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const meldMegInn = trpc.gruppe.meldMegInn.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
      utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => meldMegInn.mutate({ groupId: hmsGruppeId, projectId: prosjektId })}
          disabled={meldMegInn.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
        >
          <UserPlus className="h-3.5 w-3.5" />
          {t("hms.behandler.meldMegInn")}
        </button>

        <Link
          href="/dashbord/oppsett/brukere?fane=brukergrupper"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
        >
          <Users className="h-3.5 w-3.5" />
          {t("hms.behandler.leggTilAndre")}
        </Link>
      </div>
      <p className="text-xs text-gray-500">{t("hms.behandler.girHmsAdmin")}</p>
    </div>
  );
}

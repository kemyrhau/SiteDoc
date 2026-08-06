"use client";

import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { HmsBehandlerHandlinger, type HmsKontakt } from "./HmsBehandlerHandlinger";
import { finnHmsGruppe, byggHmsKontakter, type HmsGruppe } from "./hms-utils";

/**
 * Funn H-banner øverst i HMS-modulen: roper når HMS-behandler-leddet (HMS-gruppa)
 * er tomt — da blir innmeldte HMS-saker liggende ubehandlet. Ett-klikks «Meld meg
 * inn» + «Velg andre» (delt komponent). Vises kun for admin (server håndhever uansett).
 *
 * Selv-innkapslet med egen tomhets-sjekk slik at touchen i hms/page.tsx blir 1–2 linjer
 * (koordinert med parallell HMS-liste-ordre — triviell rebase).
 */
export function HmsTomBanner({ prosjektId }: { prosjektId: string }) {
  const { t } = useTranslation();

  const { data: grupper } = trpc.gruppe.hentForProsjekt.useQuery({ projectId: prosjektId });
  const { data: medlemmer } = trpc.medlem.hentForProsjekt.useQuery({ projectId: prosjektId });
  const minTilgang = trpc.gruppe.hentMinTilgang.useQuery(
    { projectId: prosjektId },
    { retry: false },
  );

  const erAdmin = minTilgang.data?.erAdmin ?? false;
  const hmsGruppe = finnHmsGruppe(grupper as unknown as HmsGruppe[] | undefined);

  // Vis kun for admin, når HMS-gruppa finnes og er tom.
  if (!erAdmin || !hmsGruppe || hmsGruppe.members.length > 0) return null;

  const kontakter: HmsKontakt[] = byggHmsKontakter(
    medlemmer as unknown as Array<{ id: string; user: { name: string | null; email: string } }> | undefined,
    hmsGruppe,
  );

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {t("hms.tomBanner.tittel")}
      </div>
      <p className="text-sm leading-relaxed text-gray-600">{t("hms.tomBanner.beskrivelse")}</p>
      <HmsBehandlerHandlinger prosjektId={prosjektId} hmsGruppeId={hmsGruppe.id} kontakter={kontakter} />
    </div>
  );
}

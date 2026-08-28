"use client";

import { EmptyState } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";

/**
 * Forklaring for deaktivert ansatt (fase 1 registreringsmodell). Vises der en
 * deaktivert bruker kommer inn — dashbordet OG dyplenke til et prosjekt (via
 * `dashbord/layout.tsx`), så «Prosjektet ble ikke funnet» / «Ingen prosjekter funnet»
 * aldri møter ham. Auth er uendret; det er tilgangen (`OrganizationMember.status`) som
 * er av. Kenneth-vedtak 2026-08-28: gjelder KUN deaktivert-tilfellet. En AKTIV bruker
 * som mistet ett prosjekt får bevisst «ikke funnet» — å si «du mistet tilgangen» ville
 * lekke at prosjektet finnes til en som gjetter på URL-en (egen sak).
 */
export function DeaktivertForklaring() {
  const { t } = useTranslation();
  return (
    <EmptyState
      title={t("dashbord.deaktivertTittel")}
      description={t("dashbord.deaktivertBeskrivelse")}
    />
  );
}

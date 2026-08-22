"use client";

import { createContext, useContext } from "react";

/**
 * G (2026-08-22): er gjeldende bruker admin på dette prosjektet? Flyt-KONFIGURASJON (opprett/
 * rediger/slett flyt, roller, medlemmer) er admin-gatet server-side; denne konteksten lar UI-et
 * SKJULE de kontrollene for ikke-admin så siden ikke ser redigerbar ut når den ikke er det.
 *
 * MERK: gater KUN dokumentflyt-kontroller (de som faktisk er server-gatet). Faggruppe-CRUD på
 * samme side er IKKE admin-gatet server-side og skal derfor IKKE skjules herfra — ellers divergerer
 * klient og server.
 */
export const FlytAdminContext = createContext<boolean>(false);

/** True hvis gjeldende bruker kan endre flyt-konfigurasjon (prosjektadmin/firmaadmin/sitedocadmin). */
export function useFlytAdmin(): boolean {
  return useContext(FlytAdminContext);
}

import { useFirma } from "../kontekst/FirmaKontekst";
import { trpc } from "../lib/trpc";

/**
 * Speiler webs modulhierarki-resolver på mobil (steg 4). Firmamoduler
 * (timer/maskin/varelager) er gatet på firmataket (OrganizationModule) — mobilen
 * skal ALDRI regne tilstanden selv, men spørre `modul.effektivTilstand`.
 *
 * Vi sender kun firmaId (ikke prosjektId): mobil-timerflatene er firma-globale
 * («Mine timer» på tvers av prosjekt), så den relevante gaten er firmataket alene
 * — nøyaktig bryteren på `/dashbord/firma/moduler` Kenneths symptom kom fra.
 *
 * 🔴 Fail-open, som web (`firma/innstillinger/page.tsx:609-621`): flaten skjules
 * KUN når resolveren eksplisitt svarer `false`. `undefined` — laster, offline,
 * eller ingen firma-kontekst — betyr «oppfør deg som før» → ikke skjul. En
 * feltarbeider uten dekning skal aldri miste Timer.
 *
 * Dette er en VISNINGS-gate (skjuler innganger). Den rører ikke datalaget:
 * timer-synken og maskinkatalogen (`equipment.list`) hentes uansett.
 */
export function useFirmamodulSkjult(slug: string): boolean {
  const { valgtFirmaId } = useFirma();
  const { data } = trpc.modul.effektivTilstand.useQuery(
    { firmaId: valgtFirmaId ?? undefined, slugs: [slug] },
    { enabled: !!valgtFirmaId, staleTime: 5 * 60 * 1000 },
  );
  return data?.[slug] === false;
}

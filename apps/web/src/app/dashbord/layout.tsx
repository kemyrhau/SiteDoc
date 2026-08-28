"use client";

import { usePathname } from "next/navigation";
import { NavigasjonProvider } from "@/kontekst/navigasjon-kontekst";
import { FirmaProvider } from "@/kontekst/firma-kontekst";
import { ProsjektProvider } from "@/kontekst/prosjekt-kontekst";
import { ByggeplassProvider } from "@/kontekst/byggeplass-kontekst";
import { PresenceProvider } from "@/kontekst/presence-kontekst";
import { ToppbarFiltreProvider } from "@/kontekst/toppbar-filtre-kontekst";
import { SokModalProvider } from "@/kontekst/sok-modal-kontekst";
import { NavBreddeProvider } from "@/kontekst/nav-bredde-kontekst";
import { Toppbar } from "@/components/layout/Toppbar";
import { HovedSidebar } from "@/components/layout/HovedSidebar";
import { NavSidebar } from "@/components/layout/NavSidebar";
import { ImpersoneringBanner } from "@/components/layout/ImpersoneringBanner";
import { DeaktivertForklaring } from "@/components/DeaktivertForklaring";
import { useNyNavigasjon } from "@/hooks/useNyNavigasjon";
import { trpc } from "@/lib/trpc";

export default function DashbordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const erFirmaKontekst = pathname?.startsWith("/dashbord/firma") ?? false;
  const nyNav = useNyNavigasjon();

  // Deaktivert-guard (Kenneth-vedtak 2026-08-28): en deaktivert ansatt som kommer inn via
  // en dyplenke (bokmerke/e-post) traff «Prosjektet ble ikke funnet» i [prosjektId]/layout
  // — forklaringen lå kun på dashbord-siden. Fanges nå ÉТ sted høyt i treet (denne layouten
  // wrapper både dashbord og alle prosjekt-ruter): vis forklaringen i stedet for innhold +
  // sidebar, så «ikke funnet» / «Ingen prosjekter» aldri møter ham. Gjelder KUN deaktivert
  // (aktiv-bruker-mistet-prosjekt er en egen sak — se DeaktivertForklaring).
  const { data: minBruker } = trpc.bruker.hentMin.useQuery();
  const erDeaktivert = minBruker?.erDeaktivert === true;

  return (
    <NavigasjonProvider>
      <FirmaProvider>
        <ProsjektProvider>
          <ByggeplassProvider>
            <ToppbarFiltreProvider>
              <PresenceProvider>
                <SokModalProvider>
                  <NavBreddeProvider>
                  <div className="flex h-screen flex-col overflow-hidden">
                    <Toppbar />
                    <ImpersoneringBanner />
                    <div className="flex flex-1 overflow-hidden">
                      {erDeaktivert ? (
                        // Ingen sidebar (dens prosjektvelger ville sagt «Ingen prosjekter» —
                        // samme løgn). Toppbaren beholdes for utlogging.
                        <main className="flex-1 overflow-y-auto">
                          <DeaktivertForklaring />
                        </main>
                      ) : (
                        <>
                          {nyNav ? (
                            <NavSidebar />
                          ) : (
                            !erFirmaKontekst && <HovedSidebar />
                          )}
                          <main className="flex-1 overflow-y-auto">{children}</main>
                        </>
                      )}
                    </div>
                  </div>
                  </NavBreddeProvider>
                </SokModalProvider>
              </PresenceProvider>
            </ToppbarFiltreProvider>
          </ByggeplassProvider>
        </ProsjektProvider>
      </FirmaProvider>
    </NavigasjonProvider>
  );
}

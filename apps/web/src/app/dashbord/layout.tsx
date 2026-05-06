"use client";

import { usePathname } from "next/navigation";
import { NavigasjonProvider } from "@/kontekst/navigasjon-kontekst";
import { FirmaProvider } from "@/kontekst/firma-kontekst";
import { ProsjektProvider } from "@/kontekst/prosjekt-kontekst";
import { ByggeplassProvider } from "@/kontekst/byggeplass-kontekst";
import { PresenceProvider } from "@/kontekst/presence-kontekst";
import { Toppbar } from "@/components/layout/Toppbar";
import { HovedSidebar } from "@/components/layout/HovedSidebar";

export default function DashbordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const erFirmaKontekst = pathname?.startsWith("/dashbord/firma") ?? false;

  return (
    <NavigasjonProvider>
      <FirmaProvider>
        <ProsjektProvider>
          <ByggeplassProvider>
            <PresenceProvider>
              <div className="flex h-screen flex-col overflow-hidden">
                <Toppbar />
                <div className="flex flex-1 overflow-hidden">
                  {!erFirmaKontekst && <HovedSidebar />}
                  <main className="flex-1 overflow-y-auto">{children}</main>
                </div>
              </div>
            </PresenceProvider>
          </ByggeplassProvider>
        </ProsjektProvider>
      </FirmaProvider>
    </NavigasjonProvider>
  );
}

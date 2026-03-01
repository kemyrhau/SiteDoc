"use client";

import { NavigasjonProvider } from "@/kontekst/navigasjon-kontekst";
import { ProsjektProvider } from "@/kontekst/prosjekt-kontekst";
import { Toppbar } from "@/components/layout/Toppbar";
import { HovedSidebar } from "@/components/layout/HovedSidebar";

export default function DashbordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NavigasjonProvider>
      <ProsjektProvider>
        <div className="flex h-screen flex-col overflow-hidden">
          <Toppbar />
          <div className="flex flex-1 overflow-hidden">
            <HovedSidebar />
            {children}
          </div>
        </div>
      </ProsjektProvider>
    </NavigasjonProvider>
  );
}

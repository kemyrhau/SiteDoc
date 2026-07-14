"use client";

/**
 * Layout for innstillinger-huben (finnbarhets-revisjon, Del 3).
 *
 * Flagg PÅ (`nyNavigasjon`): delt `InnstillingerNav`-sidemeny til venstre +
 * hub-innhold (kort + søk) i hovedfeltet — supplement, ikke revisjon (Kenneths
 * beslutning). Flagg AV: uendret (bare children) → byte-identisk.
 *
 * Sidemenyen er skjult <md → mobil beholder 1c kort-liste uendret.
 */

import { InnstillingerNav } from "@/components/layout/InnstillingerNav";
import { useNyNavigasjon } from "@/hooks/useNyNavigasjon";

export default function InnstillingerLayout({ children }: { children: React.ReactNode }) {
  const nyNav = useNyNavigasjon();

  if (!nyNav) return <>{children}</>;

  return (
    <div className="flex flex-1 overflow-hidden">
      <InnstillingerNav />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

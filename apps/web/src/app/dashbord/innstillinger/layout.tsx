"use client";

/**
 * Layout for innstillinger-huben (finnbarhets-oppfølger, 2026-07-15).
 *
 * Flagg PÅ (`nyNavigasjon`): den EKSISTERENDE native innstillings-sidemenyen
 * (`OppsettSidemeny`, delt med oppsett-undersidene) til venstre + hub-innhold
 * (kort + søk) i hovedfeltet. Samme sidemeny overalt i innstillinger → ingen
 * parallell variant. Aktiv-markering følger pathname: på hub-roten lyser ingen
 * rad (ingen `oppsett/*`-href matcher).
 *
 * Flagg AV: uendret (bare children) → byte-identisk. Sidemenyen er skjult <md
 * (`hidden md:flex` i komponenten) → mobil beholder 1c kort-liste uendret.
 */

import { OppsettSidemeny } from "@/components/layout/OppsettSidemeny";
import { useNyNavigasjon } from "@/hooks/useNyNavigasjon";

export default function InnstillingerLayout({ children }: { children: React.ReactNode }) {
  const nyNav = useNyNavigasjon();

  if (!nyNav) return <>{children}</>;

  return (
    <div className="flex flex-1 overflow-hidden">
      <OppsettSidemeny />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

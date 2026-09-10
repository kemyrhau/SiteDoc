"use client";

import { Spinner } from "@sitedoc/ui";
import { useFirma } from "@/kontekst/firma-kontekst";

export default function FirmaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { valgtFirma, erSitedocAdmin, kanAdministrereFirma, isLoading } = useFirma();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // Sak #5: gate på admin-kapabilitet, ikke bare valgtFirma-eksistens. Vanlige
  // ansatte kan ha valgtFirma populert (innsyn) uten å administrere firmaet.
  if (!kanAdministrereFirma || !valgtFirma) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-500">
          {erSitedocAdmin
            ? "Velg firma fra topbar for å administrere det."
            : "Du har ikke tilgang til firmaadministrasjon."}
        </p>
      </div>
    );
  }

  // NavSidebar (i dashbord/layout) leverer FIRMA-sonen — firma-layouten har ingen
  // egen sidebar. Tilgangsgaten over beholdes uendret.
  return <main className="flex-1 overflow-auto bg-gray-50 p-6">{children}</main>;
}

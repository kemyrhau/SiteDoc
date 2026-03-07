"use client";

import { EmptyState } from "@sitedoc/ui";
import { CreditCard } from "lucide-react";

export default function FirmaFakturering() {
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-gray-900">Fakturering</h1>
      <EmptyState
        title="Kommer snart"
        description="Faktureringssiden er under utvikling. Her vil du kunne administrere abonnement, se fakturahistorikk og oppdatere betalingsinformasjon."
        action={
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <CreditCard className="h-6 w-6 text-gray-400" />
          </div>
        }
      />
    </div>
  );
}

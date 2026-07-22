"use client";

import { EmptyState } from "@sitedoc/ui";
import { CreditCard } from "lucide-react";
import { SonetonetSidehode } from "@/components/layout/SonetonetSidehode";

export default function FirmaFakturering() {
  return (
    <div>
      <SonetonetSidehode sone="firma" className="mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Fakturering</h1>
      </SonetonetSidehode>
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

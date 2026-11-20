"use client";

// w10b (B6, plan web-timeføring § 4.10): firmaet attesteringen gjelder, valgt på siden.
// Prosjektlederen er ikke firma-admin og får ikke `valgtFirma` fra firmavelgeren når hen er
// ansatt i flere firma (firma-kontekst.tsx) — derfor eget valg her: `?firma=` i adressen,
// ellers det valgte firmaet hvis hen kan attestere der, ellers det første. Nedtrekket vises
// bare når det er mer enn ett firma å velge (siden).

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useFirma } from "@/kontekst/firma-kontekst";

export type AttesteringsFirma = { id: string; navn: string };

export function useAttesteringsFirma(): {
  orgId: string | null;
  firmaer: AttesteringsFirma[];
  laster: boolean;
} {
  const searchParams = useSearchParams();
  const { valgtFirma, kanAdministrereFirma, isLoading: firmaLaster } = useFirma();
  const { data, isLoading } = trpc.timer.dagsseddel.mineAttesteringsFirmaer.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  const firmaer = useMemo(() => {
    const liste: AttesteringsFirma[] = (data ?? [])
      .filter((f) => f.harTimerModul)
      .map((f) => ({ id: f.id, navn: f.navn }));
    // sitedoc_admin attesterer i firmaet hen har valgt uten å være ansatt der (som før).
    if (
      kanAdministrereFirma &&
      valgtFirma?.aktiveFirmamoduler.includes("timer") &&
      !liste.some((f) => f.id === valgtFirma.id)
    ) {
      liste.push({ id: valgtFirma.id, navn: valgtFirma.name });
    }
    return liste;
  }, [data, kanAdministrereFirma, valgtFirma]);

  const onsket = searchParams.get("firma");
  const orgId =
    firmaer.find((f) => f.id === onsket)?.id ??
    firmaer.find((f) => f.id === valgtFirma?.id)?.id ??
    firmaer[0]?.id ??
    null;

  return { orgId, firmaer, laster: firmaLaster || isLoading };
}

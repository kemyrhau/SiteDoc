"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useFirma } from "./firma-kontekst";

const STORAGE_KEY = "sitedoc-valgt-prosjekt";

interface Prosjekt {
  id: string;
  name: string;
  projectNumber: string;
  status: string;
  description: string | null;
  address: string | null;
  primaryOrganizationId: string | null;
}

interface ProsjektKontekstType {
  valgtProsjekt: Prosjekt | null;
  prosjekter: Prosjekt[];
  isLoading: boolean;
  velgProsjekt: (id: string) => void;
  prosjektId: string | null;
}

const ProsjektKontekst = createContext<ProsjektKontekstType | null>(null);

export function ProsjektProvider({ children }: { children: ReactNode }) {
  const params = useParams<{ prosjektId?: string }>();
  const router = useRouter();
  const { valgtFirma } = useFirma();
  const urlProsjektId = params.prosjektId ?? null;

  // Initialiser som null for å unngå hydration-mismatch (localStorage kun på klient)
  const [lagretProsjektId, setLagretProsjektId] = useState<string | null>(null);

  const prosjektId = urlProsjektId ?? lagretProsjektId;

  // Les fra localStorage etter mount
  useEffect(() => {
    const lagret = localStorage.getItem(STORAGE_KEY);
    if (lagret) setLagretProsjektId(lagret);
  }, []);

  // Synkroniser: når URL har prosjektId → lagre det
  useEffect(() => {
    if (urlProsjektId) {
      setLagretProsjektId(urlProsjektId);
      localStorage.setItem(STORAGE_KEY, urlProsjektId);
    }
  }, [urlProsjektId]);

  const prosjekterQuery = trpc.prosjekt.hentAlle.useQuery({
    organizationId: valgtFirma?.id,
  });
  const prosjekter = prosjekterQuery.data as Prosjekt[] | undefined;
  const lasterProsjekter = prosjekterQuery.isLoading;

  const valgtProsjektQuery = trpc.prosjekt.hentMedId.useQuery(
    { id: prosjektId! },
    { enabled: !!prosjektId, retry: false },
  );
  const valgtProsjekt = valgtProsjektQuery.data as Prosjekt | undefined;
  const lasterValgt = valgtProsjektQuery.isLoading;

  // P1 Fase 2 (2026-05-05): Auto-reset prosjekt-kontekst ved firma-bytte når
  // aktivt prosjekt ikke tilhører valgt firma. Standalone-prosjekt
  // (primaryOrganizationId=null) regnes også som mismatch når et firma er
  // valgt — konsistent med Blokk A som filtrerer dem ut av ProsjektVelger.
  useEffect(() => {
    if (!valgtFirma) return;
    if (lasterValgt) return;
    if (!valgtProsjekt) return;
    if (valgtProsjekt.primaryOrganizationId === valgtFirma.id) return;
    setLagretProsjektId(null);
    localStorage.removeItem(STORAGE_KEY);
    router.push("/dashbord");
  }, [
    valgtFirma,
    valgtProsjekt,
    lasterValgt,
    router,
  ]);

  function velgProsjekt(id: string) {
    setLagretProsjektId(id);
    localStorage.setItem(STORAGE_KEY, id);
    router.push(`/dashbord/${id}`);
  }

  return (
    <ProsjektKontekst.Provider
      value={{
        valgtProsjekt: valgtProsjekt ?? null,
        prosjekter: prosjekter ?? [],
        isLoading: lasterProsjekter || lasterValgt,
        velgProsjekt,
        prosjektId,
      }}
    >
      {children}
    </ProsjektKontekst.Provider>
  );
}

export function useProsjekt() {
  const ctx = useContext(ProsjektKontekst);
  if (!ctx) {
    throw new Error("useProsjekt må brukes innenfor ProsjektProvider");
  }
  return ctx;
}

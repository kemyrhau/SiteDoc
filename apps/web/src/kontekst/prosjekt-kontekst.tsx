"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";

interface Prosjekt {
  id: string;
  name: string;
  projectNumber: string;
  status: string;
  description: string | null;
  address: string | null;
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
  const prosjektId = params.prosjektId ?? null;

  const { data: prosjekter, isLoading: lasterProsjekter } =
    trpc.prosjekt.hentAlle.useQuery();

  const { data: valgtProsjekt, isLoading: lasterValgt } =
    trpc.prosjekt.hentMedId.useQuery(
      { id: prosjektId! },
      { enabled: !!prosjektId },
    );

  function velgProsjekt(id: string) {
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

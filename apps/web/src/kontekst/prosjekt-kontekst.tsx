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

const STORAGE_KEY = "sitedoc-valgt-prosjekt";

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

  const { data: prosjekter, isLoading: lasterProsjekter } =
    trpc.prosjekt.hentAlle.useQuery();

  const { data: valgtProsjekt, isLoading: lasterValgt } =
    trpc.prosjekt.hentMedId.useQuery(
      { id: prosjektId! },
      { enabled: !!prosjektId, retry: false },
    );

  function velgProsjekt(id: string) {
    setLagretProsjektId(id);
    localStorage.setItem(STORAGE_KEY, id);
    router.push(`/dashbord/${id}`);
  }

  return (
    <ProsjektKontekst.Provider
      value={{
        // @ts-ignore TS2589 — tRPC type inference for nested Prisma includes
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

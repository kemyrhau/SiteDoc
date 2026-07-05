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
const SCOPE_STORAGE_KEY = "sitedoc-prosjekt-scope";

interface Prosjekt {
  id: string;
  name: string;
  projectNumber: string;
  status: string;
  description: string | null;
  address: string | null;
  primaryOrganizationId: string | null;
}

export type ProsjektScope = "alle" | "mine" | "enkelt";

interface ProsjektKontekstType {
  valgtProsjekt: Prosjekt | null;
  prosjekter: Prosjekt[];
  mineProsjekter: Prosjekt[];
  isLoading: boolean;
  /** True mens `hentMedId` resolver et persistert prosjektId (fersk økt, før valgtProsjekt finnes). Funn 1b. */
  lasterValgtProsjekt: boolean;
  velgProsjekt: (id: string) => void;
  prosjektId: string | null;
  prosjektScope: ProsjektScope;
  velgScope: (scope: "alle" | "mine") => void;
}

const ProsjektKontekst = createContext<ProsjektKontekstType | null>(null);

function lesLagretScope(): "alle" | "mine" {
  if (typeof window === "undefined") return "mine";
  const lagret = localStorage.getItem(SCOPE_STORAGE_KEY);
  return lagret === "alle" ? "alle" : "mine";
}

export function ProsjektProvider({ children }: { children: ReactNode }) {
  const params = useParams<{ prosjektId?: string }>();
  const router = useRouter();
  const { valgtFirma } = useFirma();
  const urlProsjektId = params.prosjektId ?? null;

  // Initialiser som null for å unngå hydration-mismatch (localStorage kun på klient)
  const [lagretProsjektId, setLagretProsjektId] = useState<string | null>(null);
  const [lagretScope, setLagretScope] = useState<"alle" | "mine">("mine");

  const prosjektId = urlProsjektId ?? lagretProsjektId;

  // Avledet scope: når URL har prosjektId er scope alltid "enkelt".
  // Ellers leses scope fra localStorage (default "mine").
  const prosjektScope: ProsjektScope = urlProsjektId ? "enkelt" : lagretScope;

  // Les fra localStorage etter mount
  useEffect(() => {
    const lagret = localStorage.getItem(STORAGE_KEY);
    if (lagret) setLagretProsjektId(lagret);
    setLagretScope(lesLagretScope());
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

  const mineProsjekterQuery = trpc.prosjekt.hentMine.useQuery({
    organizationId: valgtFirma?.id,
  });
  const mineProsjekter = mineProsjekterQuery.data as Prosjekt[] | undefined;

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

  function velgScope(scope: "alle" | "mine") {
    setLagretScope(scope);
    localStorage.setItem(SCOPE_STORAGE_KEY, scope);
    setLagretProsjektId(null);
    localStorage.removeItem(STORAGE_KEY);
    router.push("/dashbord");
  }

  return (
    <ProsjektKontekst.Provider
      value={{
        valgtProsjekt: valgtProsjekt ?? null,
        prosjekter: prosjekter ?? [],
        mineProsjekter: mineProsjekter ?? [],
        isLoading: lasterProsjekter || lasterValgt,
        lasterValgtProsjekt: lasterValgt,
        velgProsjekt,
        prosjektId,
        prosjektScope,
        velgScope,
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

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Card, Spinner, StatusBadge, Button, EmptyState } from "@sitedoc/ui";
import { SekundaertPanel } from "@/components/layout/SekundaertPanel";
import { DashbordPanel } from "@/components/paneler/DashbordPanel";
import { useFirma } from "@/kontekst/firma-kontekst";
import { Plus } from "lucide-react";

// Smal lokal type bryter generic-kjeden — kun feltene som faktisk brukes på siden
type ProsjektListeRad = {
  id: string;
  name: string;
  projectNumber: string;
  status: string;
  description: string | null;
};

export default function DashbordSide() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const router = useRouter();
  const { valgtFirma } = useFirma();
  const prosjekterQuery = trpc.prosjekt.hentAlle.useQuery({
    organizationId: valgtFirma?.id,
  });
  const prosjekter = prosjekterQuery.data as ProsjektListeRad[] | undefined;
  const isLoading = prosjekterQuery.isLoading;

  // Brukerens rolle styrer hva tom-state viser (admin = «opprett prosjekt»,
  // vanlig bruker = «venter på tilgang»).
  const { data: minBrukerRå } = trpc.bruker.hentMin.useQuery();
  const minBruker = minBrukerRå as { role?: string } | null | undefined;
  const erAdmin = minBruker?.role === "sitedoc_admin" || minBruker?.role === "company_admin";

  // Auto-redirect basert på antall prosjekter:
  //  0  → /dashbord/kom-i-gang (kun admin) eller bli stående med «venter på tilgang»
  //  1  → direkte til prosjektet
  //  2+ → sist besøkte (lastVisitedProjectId i localStorage). Bli stående hvis ingen.
  useEffect(() => {
    if (isLoading || !prosjekter || !minBruker) return;
    if (prosjekter.length === 0) {
      if (erAdmin) {
        router.replace("/dashbord/kom-i-gang");
      }
      // Ikke-admin: bli stående og vis «Venter på prosjekttilgang»-tom-state.
      return;
    }
    if (prosjekter.length === 1) {
      const eneste = prosjekter[0];
      if (eneste) router.replace(`/dashbord/${eneste.id}`);
      return;
    }
    if (typeof window !== "undefined") {
      const sistBesokt = localStorage.getItem("lastVisitedProjectId");
      if (sistBesokt && prosjekter.some((p) => p.id === sistBesokt)) {
        router.replace(`/dashbord/${sistBesokt}`);
      }
    }
  }, [isLoading, prosjekter, minBruker, erAdmin, router]);

  return (
    <>
      <SekundaertPanel tittel="Prosjekter">
        <DashbordPanel />
      </SekundaertPanel>
      <main className="flex-1 overflow-auto bg-gray-50 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {t("dashbord.velkommen", { navn: session?.user?.name ?? t("dashbord.bruker") })}
          </h2>
          {erAdmin && (
            <Link href="/dashbord/nytt-prosjekt">
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                {t("dashbord.nyttProsjekt")}
              </Button>
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : !prosjekter?.length ? (
          erAdmin ? (
            <EmptyState
              title={t("dashbord.ingenProsjekter")}
              description={
                valgtFirma
                  ? t("dashbord.ingenProsjekterForFirmaBeskrivelse", {
                      firma: valgtFirma.name,
                    })
                  : t("dashbord.ingenProsjekterBeskrivelse")
              }
              action={
                <Link href="/dashbord/nytt-prosjekt">
                  <Button>{t("dashbord.opprettProsjekt")}</Button>
                </Link>
              }
            />
          ) : (
            <EmptyState
              title={t("dashbord.venterPaaTilgangTittel")}
              description={t("dashbord.venterPaaTilgangBeskrivelse")}
            />
          )
        ) : (
          <>
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card className="text-center">
                <p className="text-3xl font-bold text-sitedoc-primary">
                  {prosjekter.length}
                </p>
                <p className="mt-1 text-sm text-gray-500">{t("dashbord.prosjekter")}</p>
              </Card>
              <Card className="text-center">
                <p className="text-3xl font-bold text-sitedoc-secondary">0</p>
                <p className="mt-1 text-sm text-gray-500">{t("dashbord.aktiveSjekklister")}</p>
              </Card>
              <Card className="text-center">
                <p className="text-3xl font-bold text-sitedoc-accent">0</p>
                <p className="mt-1 text-sm text-gray-500">{t("dashbord.aapneOppgaver")}</p>
              </Card>
            </div>

            <h3 className="mb-3 text-lg font-semibold">{t("dashbord.sisteProsjekter")}</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {prosjekter.slice(0, 6).map((prosjekt) => (
                <Link key={prosjekt.id} href={`/dashbord/${prosjekt.id}`}>
                  <Card className="transition-shadow hover:shadow-md">
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold">{prosjekt.name}</h4>
                        <p className="text-xs text-gray-500">
                          {prosjekt.projectNumber}
                        </p>
                      </div>
                      <StatusBadge status={prosjekt.status} />
                    </div>
                    {prosjekt.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {prosjekt.description}
                      </p>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}

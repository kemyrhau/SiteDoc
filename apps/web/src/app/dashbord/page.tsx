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
import { Plus } from "lucide-react";

export default function DashbordSide() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const router = useRouter();
  const { data: prosjekter, isLoading } = trpc.prosjekt.hentAlle.useQuery();

  // Redirect til "Kom i gang" hvis brukeren ikke har noen prosjekter
  useEffect(() => {
    if (!isLoading && prosjekter && prosjekter.length === 0) {
      router.replace("/dashbord/kom-i-gang");
    }
  }, [isLoading, prosjekter, router]);

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
          <Link href="/dashbord/nytt-prosjekt">
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              {t("dashbord.nyttProsjekt")}
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : !prosjekter?.length ? (
          <EmptyState
            title={t("dashbord.ingenProsjekter")}
            description={t("dashbord.ingenProsjekterBeskrivelse")}
            action={
              <Link href="/dashbord/nytt-prosjekt">
                <Button>{t("dashbord.opprettProsjekt")}</Button>
              </Link>
            }
          />
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

"use client";

import { useEffect } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { Verktoylinje } from "@/components/layout/Verktoylinje";
import { TreDViewerProvider, ViewerCanvas } from "@/kontekst/tred-viewer-kontekst";

export default function ProsjektLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ prosjektId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const pathname = usePathname();
  const { isLoading, isError } = trpc.prosjekt.hentMedId.useQuery(
    { id: params.prosjektId },
    { enabled: !!params.prosjektId, retry: false },
  );

  // FL: hentMedId kaster når et vanlig medlem treffer et avsluttet/arkivert prosjekt
  // (frysevakten). Da henter vi stoppside-metadata (uten frysevakt) og viser en
  // forklarende side med firmanavn — aldri en generisk 404.
  const { data: stoppside } = trpc.prosjekt.hentStoppside.useQuery(
    { id: params.prosjektId },
    { enabled: !!params.prosjektId && isError, retry: false },
  );

  // Lagre sist besøkte prosjekt for auto-redirect ved neste innlogging
  useEffect(() => {
    if (params.prosjektId && typeof window !== "undefined") {
      localStorage.setItem("lastVisitedProjectId", params.prosjektId);
    }
  }, [params.prosjektId]);

  const er3DVisning = (pathname?.endsWith("/3d-visning") || pathname?.endsWith("/tegning-3d")) ?? false;

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    // Frosset prosjekt (stoppside-metadata hentet) → forklarende side med firmanavn.
    if (stoppside && stoppside.status !== "active") {
      const tittel =
        stoppside.status === "deactivated"
          ? t("livssyklus.stoppsideDeaktivert")
          : stoppside.status === "archived"
            ? (stoppside.firmanavn
                ? t("livssyklus.stoppsideArkivert", { firma: stoppside.firmanavn })
                : t("livssyklus.stoppsideAvsluttetUtenFirma"))
            : (stoppside.firmanavn
                ? t("livssyklus.stoppsideAvsluttet", { firma: stoppside.firmanavn })
                : t("livssyklus.stoppsideAvsluttetUtenFirma"));
      const brodtekst =
        stoppside.status === "deactivated"
          ? t("livssyklus.stoppsideDeaktivertBrodtekst")
          : t("livssyklus.stoppsideBrodtekst");
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-base font-bold text-gray-900">{tittel}</p>
          <p className="text-sm text-gray-600">{brodtekst}</p>
          <button
            onClick={() => router.push("/dashbord")}
            className="mt-1 text-sm font-semibold text-sitedoc-primary hover:underline"
          >
            {t("livssyklus.tilProsjektvelger")} →
          </button>
        </div>
      );
    }
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-sm text-gray-500">{t("feil.prosjektIkkeFunnet")}</p>
        <button
          onClick={() => router.push("/dashbord")}
          className="text-sm text-sitedoc-primary hover:underline"
        >
          {t("nav.tilbakeDashbord")}
        </button>
      </div>
    );
  }

  const innhold = (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Verktoylinje />
      <div className="relative flex flex-1 overflow-hidden">
        {er3DVisning && (
          <div className="absolute inset-0 z-0">
            <ViewerCanvas erSynlig />
          </div>
        )}
        <div className={er3DVisning ? "relative z-10 flex flex-1 overflow-hidden pointer-events-none" : "flex flex-1 overflow-hidden"}>
          {children}
        </div>
      </div>
    </div>
  );

  // TreDViewerProvider lastes kun på 3D-sider for å unngå at IFC-data krasjer andre sider
  if (er3DVisning) {
    return <TreDViewerProvider>{innhold}</TreDViewerProvider>;
  }
  return innhold;
}

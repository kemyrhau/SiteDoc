"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
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
  const pathname = usePathname();
  const { isLoading, isError } = trpc.prosjekt.hentMedId.useQuery(
    { id: params.prosjektId },
    { enabled: !!params.prosjektId, retry: false },
  );

  const er3DVisning = (pathname?.endsWith("/3d-visning") || pathname?.endsWith("/tegning-3d")) ?? false;

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-sm text-gray-500">Prosjektet ble ikke funnet</p>
        <button
          onClick={() => router.push("/dashbord")}
          className="text-sm text-sitedoc-primary hover:underline"
        >
          Tilbake til dashbord
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

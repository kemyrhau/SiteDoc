"use client";

import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { Verktoylinje } from "@/components/layout/Verktoylinje";
import { TreDViewerProvider } from "@/kontekst/tred-viewer-kontekst";

export default function ProsjektLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ prosjektId: string }>();
  const router = useRouter();
  const { isLoading, isError } = trpc.prosjekt.hentMedId.useQuery(
    { id: params.prosjektId },
    { enabled: !!params.prosjektId, retry: false },
  );

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

  return (
    <TreDViewerProvider>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Verktoylinje />
        <div className="flex flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </TreDViewerProvider>
  );
}

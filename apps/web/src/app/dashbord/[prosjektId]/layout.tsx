"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@siteflow/ui";
import { Verktoylinje } from "@/components/layout/Verktoylinje";

export default function ProsjektLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ prosjektId: string }>();
  const { isLoading } = trpc.prosjekt.hentMedId.useQuery(
    { id: params.prosjektId },
    { enabled: !!params.prosjektId },
  );

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Verktoylinje />
      <div className="flex flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Card, Spinner, Badge } from "@siteflow/ui";

export default function MalDetaljSide() {
  const params = useParams<{ prosjektId: string; malId: string }>();

  const { data: mal, isLoading } = trpc.mal.hentMedId.useQuery(
    { id: params.malId },
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!mal) {
    return <p className="py-12 text-center text-gray-500">Malen ble ikke funnet.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h3 className="text-xl font-bold">{mal.name}</h3>
        {mal.description && (
          <p className="mt-1 text-sm text-gray-500">{mal.description}</p>
        )}
        <div className="mt-2 flex gap-2">
          <Badge variant="default">{mal.objects.length} objekter</Badge>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-medium text-gray-500">Rapportobjekter</h4>
        {mal.objects.length === 0 ? (
          <p className="text-sm text-gray-400">Ingen objekter lagt til ennå.</p>
        ) : (
          (mal.objects as Array<{ id: string; type: string; label: string; required: boolean; sortOrder: number }>).map((obj) => (
            <Card key={obj.id} padding={false} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-500">
                    {obj.sortOrder}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{obj.label}</p>
                    <p className="text-xs text-gray-400">{obj.type.replace(/_/g, " ")}</p>
                  </div>
                </div>
                {obj.required && <Badge variant="warning">Påkrevd</Badge>}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

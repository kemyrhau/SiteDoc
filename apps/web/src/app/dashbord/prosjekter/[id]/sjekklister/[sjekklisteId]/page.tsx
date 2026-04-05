"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Card, Spinner, StatusBadge, Badge } from "@sitedoc/ui";

export default function SjekklisteDetaljSide() {
  const params = useParams<{ id: string; sjekklisteId: string }>();

  const { data: sjekkliste, isLoading } = trpc.sjekkliste.hentMedId.useQuery(
    { id: params.sjekklisteId },
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!sjekkliste) {
    return <p className="py-12 text-center text-gray-500">Sjekklisten ble ikke funnet.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold">{sjekkliste.title}</h3>
          <StatusBadge status={sjekkliste.status} />
        </div>
        <p className="text-sm text-gray-500">
          Mal: {sjekkliste.template.name} &middot; Svarer: {sjekkliste.utforerEnterprise.name}
        </p>
        {sjekkliste.dueDate && (
          <p className="text-sm text-gray-400">
            Frist: {new Date(sjekkliste.dueDate).toLocaleDateString("nb-NO")}
          </p>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-3">
        <h4 className="text-sm font-medium text-gray-500">Rapportobjekter</h4>
        {(sjekkliste.template.objects as Array<{ id: string; type: string; label: string; required: boolean }>).map((obj) => (
          <Card key={obj.id} padding={false} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{obj.label}</p>
                <p className="text-xs text-gray-400">{obj.type.replace(/_/g, " ")}</p>
              </div>
              {obj.required && <Badge variant="warning">Påkrevd</Badge>}
            </div>
          </Card>
        ))}
      </div>

      {sjekkliste.transfers.length > 0 && (
        <Card>
          <h4 className="mb-3 text-sm font-medium text-gray-500">Historikk</h4>
          <div className="flex flex-col gap-2">
            {(sjekkliste.transfers as Array<{ id: string; fromStatus: string; toStatus: string; comment: string | null; createdAt: string }>).map((overgang) => (
              <div key={overgang.id} className="flex items-center gap-3 text-sm">
                <span className="text-xs text-gray-400">
                  {new Date(overgang.createdAt).toLocaleString("nb-NO")}
                </span>
                <StatusBadge status={overgang.fromStatus} />
                <span className="text-gray-400">&rarr;</span>
                <StatusBadge status={overgang.toStatus} />
                {overgang.comment && (
                  <span className="text-gray-500">&mdash; {overgang.comment}</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

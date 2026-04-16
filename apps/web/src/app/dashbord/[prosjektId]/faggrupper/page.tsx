"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Spinner, EmptyState, Badge, Table } from "@sitedoc/ui";

export default function FaggrupperSide() {
  const params = useParams<{ prosjektId: string }>();

  const { data: faggrupper, isLoading } = trpc.faggruppe.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  type FaggruppeRad = {
    id: string;
    name: string;
    organizationNumber: string | null;
    dokumentflytKoblinger: Array<{ id: string }>;
    _count: { bestillerChecklists: number; bestillerTasks: number };
  };

  return (
    <div>
      {!faggrupper?.length ? (
        <EmptyState
          title="Ingen faggrupper"
          description="Faggrupper administreres under Innstillinger > Feltarbeid > Faggrupper."
        />
      ) : (
        <Table<FaggruppeRad>
          kolonner={[
            {
              id: "name",
              header: "Firma",
              celle: (rad) => (
                <div>
                  <span className="font-medium text-gray-900">{rad.name}</span>
                  {rad.organizationNumber && (
                    <p className="text-xs text-gray-400">
                      Org.nr: {rad.organizationNumber}
                    </p>
                  )}
                </div>
              ),
            },
            {
              id: "members",
              header: "Medlemmer",
              celle: (rad) => (
                <Badge variant="default">{rad.dokumentflytKoblinger.length}</Badge>
              ),
              bredde: "100px",
            },
            {
              id: "checklists",
              header: "Sjekklister",
              celle: (rad) => (
                <Badge variant="primary">{rad._count.bestillerChecklists}</Badge>
              ),
              bredde: "100px",
            },
            {
              id: "tasks",
              header: "Oppgaver",
              celle: (rad) => (
                <Badge variant="warning">{rad._count.bestillerTasks}</Badge>
              ),
              bredde: "100px",
            },
          ]}
          data={(faggrupper ?? []) as FaggruppeRad[]}
          radNokkel={(rad) => rad.id}
        />
      )}
    </div>
  );
}

"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Spinner, EmptyState, Badge, Table } from "@sitedoc/ui";

export default function EntrepriserSide() {
  const params = useParams<{ prosjektId: string }>();

  const { data: entrepriser, isLoading } = trpc.entreprise.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  type EntrepriseRad = {
    id: string;
    name: string;
    organizationNumber: string | null;
    memberEnterprises: Array<{ id: string }>;
    _count: { bestillerChecklists: number; bestillerTasks: number };
  };

  return (
    <div>
      {!entrepriser?.length ? (
        <EmptyState
          title="Ingen entrepriser"
          description="Entrepriser administreres under Innstillinger > Feltarbeid > Entrepriser."
        />
      ) : (
        <Table<EntrepriseRad>
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
                <Badge variant="default">{rad.memberEnterprises.length}</Badge>
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
          data={(entrepriser ?? []) as EntrepriseRad[]}
          radNokkel={(rad) => rad.id}
        />
      )}
    </div>
  );
}

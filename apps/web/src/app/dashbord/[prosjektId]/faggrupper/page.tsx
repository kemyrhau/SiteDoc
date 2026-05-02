"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Spinner, EmptyState, Badge, Table, Button } from "@sitedoc/ui";
import { Settings } from "lucide-react";

export default function FaggrupperSide() {
  const params = useParams<{ prosjektId: string }>();

  const { data: faggrupper, isLoading } = trpc.faggruppe.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
  );

  const administrerHref = `/dashbord/prosjekter/${params.prosjektId}/faggrupper`;

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
    faggruppeNummer: string | null;
    organizationNumber: string | null;
    faggruppeKoblinger: Array<{ id: string }>;
    _count: { bestillerChecklists: number; bestillerTasks: number };
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Read-only oversikt. Bruk «Administrer faggrupper» for å opprette, redigere
          eller slette.
        </p>
        <Link href={administrerHref}>
          <Button size="sm" variant="secondary">
            <Settings className="mr-1.5 h-4 w-4" />
            Administrer faggrupper
          </Button>
        </Link>
      </div>
      {!faggrupper?.length ? (
        <EmptyState
          title="Ingen faggrupper"
          description="Faggrupper opprettes under «Administrer faggrupper»."
          action={
            <Link href={administrerHref}>
              <Button>
                <Settings className="mr-1.5 h-4 w-4" />
                Administrer faggrupper
              </Button>
            </Link>
          }
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
                <Badge variant="default">{rad.faggruppeKoblinger.length}</Badge>
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

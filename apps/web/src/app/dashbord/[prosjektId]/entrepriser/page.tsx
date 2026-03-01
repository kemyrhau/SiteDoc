"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button, Input, Modal, Spinner, EmptyState, Badge, Table } from "@siteflow/ui";
import { useVerktoylinje } from "@/hooks/useVerktoylinje";
import { Plus } from "lucide-react";

export default function EntrepriserSide() {
  const params = useParams<{ prosjektId: string }>();
  const utils = trpc.useUtils();
  const [visModal, setVisModal] = useState(false);
  const [navn, setNavn] = useState("");
  const [orgNr, setOrgNr] = useState("");

  const { data: entrepriser, isLoading } = trpc.entreprise.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
  );

  const opprettMutation = trpc.entreprise.opprett.useMutation({
    onSuccess: () => {
      utils.entreprise.hentForProsjekt.invalidate({ projectId: params.prosjektId });
      utils.prosjekt.hentMedId.invalidate({ id: params.prosjektId });
      setVisModal(false);
      setNavn("");
      setOrgNr("");
    },
  });

  useVerktoylinje([
    {
      id: "ny-entreprise",
      label: "Ny entreprise",
      ikon: <Plus className="h-4 w-4" />,
      onClick: () => setVisModal(true),
      variant: "primary",
    },
  ]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!navn.trim()) return;
    opprettMutation.mutate({
      name: navn.trim(),
      projectId: params.prosjektId,
      organizationNumber: orgNr.trim() || undefined,
    });
  }

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
    members: Array<{ id: string }>;
    _count: { createdChecklists: number; createdTasks: number };
  };

  return (
    <div>
      {!entrepriser?.length ? (
        <EmptyState
          title="Ingen entrepriser"
          description="Legg til entrepriser for å administrere arbeidsgrupper i prosjektet."
          action={<Button onClick={() => setVisModal(true)}>Legg til entreprise</Button>}
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
                <Badge variant="default">{rad.members.length}</Badge>
              ),
              bredde: "100px",
            },
            {
              id: "checklists",
              header: "Sjekklister",
              celle: (rad) => (
                <Badge variant="primary">{rad._count.createdChecklists}</Badge>
              ),
              bredde: "100px",
            },
            {
              id: "tasks",
              header: "Oppgaver",
              celle: (rad) => (
                <Badge variant="warning">{rad._count.createdTasks}</Badge>
              ),
              bredde: "100px",
            },
          ]}
          data={(entrepriser ?? []) as EntrepriseRad[]}
          radNokkel={(rad) => rad.id}
        />
      )}

      <Modal open={visModal} onClose={() => setVisModal(false)} title="Ny entreprise">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Firmanavn"
            placeholder="F.eks. Bygg AS"
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            required
          />
          <Input
            label="Organisasjonsnummer"
            placeholder="F.eks. 912345678"
            value={orgNr}
            onChange={(e) => setOrgNr(e.target.value)}
          />
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={opprettMutation.isPending}>
              Opprett
            </Button>
            <Button type="button" variant="secondary" onClick={() => setVisModal(false)}>
              Avbryt
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

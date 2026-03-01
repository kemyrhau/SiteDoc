"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Card, Button, Input, Modal, Spinner, EmptyState, Badge } from "@siteflow/ui";

export default function EntrepriserSide() {
  const params = useParams<{ id: string }>();
  const utils = trpc.useUtils();
  const [visModal, setVisModal] = useState(false);
  const [navn, setNavn] = useState("");
  const [orgNr, setOrgNr] = useState("");

  const { data: entrepriser, isLoading } = trpc.entreprise.hentForProsjekt.useQuery(
    { projectId: params.id },
  );

  const opprettMutation = trpc.entreprise.opprett.useMutation({
    onSuccess: () => {
      utils.entreprise.hentForProsjekt.invalidate({ projectId: params.id });
      utils.prosjekt.hentMedId.invalidate({ id: params.id });
      setVisModal(false);
      setNavn("");
      setOrgNr("");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!navn.trim()) return;
    opprettMutation.mutate({
      name: navn.trim(),
      projectId: params.id,
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Entrepriser</h3>
        <Button onClick={() => setVisModal(true)}>Ny entreprise</Button>
      </div>

      {!entrepriser?.length ? (
        <EmptyState
          title="Ingen entrepriser"
          description="Legg til entrepriser for å administrere arbeidsgrupper i prosjektet."
          action={<Button onClick={() => setVisModal(true)}>Legg til entreprise</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {entrepriser.map((ent) => (
            <Card key={ent.id}>
              <h4 className="font-semibold">{ent.name}</h4>
              {ent.organizationNumber && (
                <p className="text-xs text-gray-400">Org.nr: {ent.organizationNumber}</p>
              )}
              <div className="mt-3 flex gap-2">
                <Badge variant="default">{ent.members.length} medlemmer</Badge>
                <Badge variant="primary">{ent._count.createdChecklists} sjekklister</Badge>
                <Badge variant="warning">{ent._count.createdTasks} oppgaver</Badge>
              </div>
            </Card>
          ))}
        </div>
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

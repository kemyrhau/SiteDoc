"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, Button, Input, Textarea, Modal, Spinner, EmptyState, Badge } from "@siteflow/ui";

export default function MalerSide() {
  const params = useParams<{ id: string }>();
  const utils = trpc.useUtils();
  const [visModal, setVisModal] = useState(false);
  const [navn, setNavn] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");

  const { data: maler, isLoading } = trpc.mal.hentForProsjekt.useQuery(
    { projectId: params.id },
  );

  const opprettMutation = trpc.mal.opprett.useMutation({
    onSuccess: () => {
      utils.mal.hentForProsjekt.invalidate({ projectId: params.id });
      setVisModal(false);
      setNavn("");
      setBeskrivelse("");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!navn.trim()) return;
    opprettMutation.mutate({
      projectId: params.id,
      name: navn.trim(),
      description: beskrivelse.trim() || undefined,
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
        <h3 className="text-lg font-semibold">Rapportmaler</h3>
        <Button onClick={() => setVisModal(true)}>Ny mal</Button>
      </div>

      {!maler?.length ? (
        <EmptyState
          title="Ingen maler"
          description="Opprett en rapportmal for å bygge sjekklister."
          action={<Button onClick={() => setVisModal(true)}>Opprett mal</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {maler.map((mal) => (
            <Link
              key={mal.id}
              href={`/dashbord/prosjekter/${params.id}/maler/${mal.id}`}
            >
              <Card className="transition-shadow hover:shadow-md">
                <h4 className="font-semibold">{mal.name}</h4>
                {mal.description && (
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                    {mal.description}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <Badge variant="default">{mal._count.objects} objekter</Badge>
                  <Badge variant="primary">{mal._count.checklists} sjekklister</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal open={visModal} onClose={() => setVisModal(false)} title="Ny rapportmal">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Malnavn"
            placeholder="F.eks. Kontrollsjekkliste - Elektro"
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            required
          />
          <Textarea
            label="Beskrivelse"
            placeholder="Beskriv hva malen skal brukes til..."
            value={beskrivelse}
            onChange={(e) => setBeskrivelse(e.target.value)}
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

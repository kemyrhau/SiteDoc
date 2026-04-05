"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button, Input, Textarea, Modal, Spinner, EmptyState, Badge, Table } from "@sitedoc/ui";
import { useVerktoylinje } from "@/hooks/useVerktoylinje";
import { Plus } from "lucide-react";

export default function MalerSide() {
  const params = useParams<{ prosjektId: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const [visModal, setVisModal] = useState(false);
  const [navn, setNavn] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");

  const { data: tillatelser, isLoading: lasterTillatelser } =
    trpc.gruppe.hentMineTillatelser.useQuery({ projectId: params.prosjektId });

  const harTilgang = tillatelser?.includes("manage_field");

  const { data: maler, isLoading } = trpc.mal.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: harTilgang },
  );

  const opprettMutation = trpc.mal.opprett.useMutation({
    onSuccess: () => {
      utils.mal.hentForProsjekt.invalidate({ projectId: params.prosjektId });
      setVisModal(false);
      setNavn("");
      setBeskrivelse("");
    },
  });

  useVerktoylinje([
    {
      id: "ny-mal",
      label: "Ny mal",
      ikon: <Plus className="h-4 w-4" />,
      onClick: () => setVisModal(true),
      variant: "primary",
    },
  ]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!navn.trim()) return;
    opprettMutation.mutate({
      projectId: params.prosjektId,
      name: navn.trim(),
      description: beskrivelse.trim() || undefined,
    });
  }

  if (lasterTillatelser || isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!harTilgang) {
    return (
      <EmptyState
        title="Ingen tilgang"
        description="Du har ikke tilgang til denne siden. Kun produksjons-administratorer kan se maler."
      />
    );
  }

  type MalRad = {
    id: string;
    name: string;
    description: string | null;
    _count: { objects: number; checklists: number };
  };

  return (
    <div>
      {!maler?.length ? (
        <EmptyState
          title="Ingen maler"
          description="Opprett en rapportmal for å bygge sjekklister."
          action={<Button onClick={() => setVisModal(true)}>Opprett mal</Button>}
        />
      ) : (
        <Table<MalRad>
          kolonner={[
            {
              id: "name",
              header: "Malnavn",
              celle: (rad) => (
                <span className="font-medium text-gray-900">{rad.name}</span>
              ),
            },
            {
              id: "description",
              header: "Beskrivelse",
              celle: (rad) => (
                <span className="text-gray-600 line-clamp-1">
                  {rad.description ?? "—"}
                </span>
              ),
            },
            {
              id: "objects",
              header: "Objekter",
              celle: (rad) => (
                <Badge variant="default">{rad._count.objects}</Badge>
              ),
              bredde: "100px",
            },
            {
              id: "checklists",
              header: "Sjekklister",
              celle: (rad) => (
                <Badge variant="primary">{rad._count.checklists}</Badge>
              ),
              bredde: "100px",
            },
          ]}
          data={(maler ?? []) as MalRad[]}
          radNokkel={(rad) => rad.id}
          onRadKlikk={(rad) =>
            router.push(`/dashbord/${params.prosjektId}/maler/${rad.id}`)
          }
        />
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

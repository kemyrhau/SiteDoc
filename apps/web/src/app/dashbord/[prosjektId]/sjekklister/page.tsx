"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button, Select, Modal, Spinner, EmptyState, StatusBadge, Table } from "@siteflow/ui";
import { useVerktoylinje } from "@/hooks/useVerktoylinje";
import { Plus } from "lucide-react";

export default function SjekklisteSide() {
  const params = useParams<{ prosjektId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status");
  const utils = trpc.useUtils();
  const [visModal, setVisModal] = useState(false);
  const [valgtMal, setValgtMal] = useState("");
  const [valgtSvarer, setValgtSvarer] = useState("");
  const [tittel, setTittel] = useState("");

  const { data: sjekklister, isLoading } = trpc.sjekkliste.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
  );

  const { data: maler } = trpc.mal.hentForProsjekt.useQuery({ projectId: params.prosjektId });
  const { data: entrepriser } = trpc.entreprise.hentForProsjekt.useQuery({ projectId: params.prosjektId });

  const opprettMutation = trpc.sjekkliste.opprett.useMutation({
    onSuccess: () => {
      utils.sjekkliste.hentForProsjekt.invalidate({ projectId: params.prosjektId });
      setVisModal(false);
      setValgtMal("");
      setValgtSvarer("");
      setTittel("");
    },
  });

  useVerktoylinje([
    {
      id: "ny-sjekkliste",
      label: "Ny sjekkliste",
      ikon: <Plus className="h-4 w-4" />,
      onClick: () => setVisModal(true),
      variant: "primary",
    },
  ]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valgtMal || !valgtSvarer || !tittel.trim()) return;

    const oppretterEntreprise = entrepriser?.[0];
    if (!oppretterEntreprise) return;

    opprettMutation.mutate({
      templateId: valgtMal,
      creatorUserId: "",
      creatorEnterpriseId: oppretterEntreprise.id,
      responderEnterpriseId: valgtSvarer,
      title: tittel.trim(),
    });
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const filtrerte = sjekklister
    ? statusFilter
      ? sjekklister.filter((s) => s.status === statusFilter)
      : sjekklister
    : [];

  type SjekklisteRad = {
    id: string;
    title: string;
    status: string;
    dueDate: string | null;
    template: { name: string };
    responderEnterprise: { name: string };
  };

  return (
    <div>
      {!sjekklister?.length ? (
        <EmptyState
          title="Ingen sjekklister"
          description="Opprett en sjekkliste basert på en rapportmal."
          action={<Button onClick={() => setVisModal(true)}>Opprett sjekkliste</Button>}
        />
      ) : (
        <Table<SjekklisteRad>
          kolonner={[
            {
              id: "title",
              header: "Tittel",
              celle: (rad) => (
                <span className="font-medium text-gray-900">{rad.title}</span>
              ),
            },
            {
              id: "template",
              header: "Mal",
              celle: (rad) => (
                <span className="text-gray-600">{rad.template.name}</span>
              ),
            },
            {
              id: "responder",
              header: "Svarer",
              celle: (rad) => (
                <span className="text-gray-600">{rad.responderEnterprise.name}</span>
              ),
            },
            {
              id: "dueDate",
              header: "Frist",
              celle: (rad) =>
                rad.dueDate ? (
                  <span className="text-gray-500">
                    {new Date(rad.dueDate).toLocaleDateString("nb-NO")}
                  </span>
                ) : (
                  <span className="text-gray-300">—</span>
                ),
              bredde: "120px",
            },
            {
              id: "status",
              header: "Status",
              celle: (rad) => <StatusBadge status={rad.status} />,
              bredde: "120px",
            },
          ]}
          data={filtrerte as SjekklisteRad[]}
          radNokkel={(rad) => rad.id}
          onRadKlikk={(rad) =>
            router.push(`/dashbord/${params.prosjektId}/sjekklister/${rad.id}`)
          }
          tomMelding="Ingen sjekklister med denne statusen"
        />
      )}

      <Modal open={visModal} onClose={() => setVisModal(false)} title="Ny sjekkliste">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Tittel</label>
            <input
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-siteflow-primary focus:outline-none focus:ring-1 focus:ring-siteflow-primary"
              placeholder="F.eks. Kontroll elektro - 3. etasje"
              value={tittel}
              onChange={(e) => setTittel(e.target.value)}
              required
            />
          </div>
          <Select
            label="Rapportmal"
            options={maler?.map((m) => ({ value: m.id, label: m.name })) ?? []}
            value={valgtMal}
            onChange={(e) => setValgtMal(e.target.value)}
            placeholder="Velg mal..."
          />
          <Select
            label="Ansvarlig entreprise (svarer)"
            options={entrepriser?.map((e) => ({ value: e.id, label: e.name })) ?? []}
            value={valgtSvarer}
            onChange={(e) => setValgtSvarer(e.target.value)}
            placeholder="Velg entreprise..."
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

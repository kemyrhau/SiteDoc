"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button, Input, Textarea, Select, Modal, Spinner, EmptyState, StatusBadge, Badge, Table } from "@siteflow/ui";
import { useVerktoylinje } from "@/hooks/useVerktoylinje";
import { Plus } from "lucide-react";

const prioriteter = [
  { value: "low", label: "Lav" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "Høy" },
  { value: "critical", label: "Kritisk" },
];

const prioritetFarge: Record<string, "default" | "primary" | "warning" | "danger"> = {
  low: "default",
  medium: "primary",
  high: "warning",
  critical: "danger",
};

export default function OppgaverSide() {
  const params = useParams<{ prosjektId: string }>();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status");
  const utils = trpc.useUtils();
  const [visModal, setVisModal] = useState(false);
  const [tittel, setTittel] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");
  const [prioritet, setPrioritet] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [valgtOppretter, setValgtOppretter] = useState("");
  const [valgtSvarer, setValgtSvarer] = useState("");
  const [valgtMalId, setValgtMalId] = useState("");

  const oppgaveQuery = trpc.oppgave.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
  );
  const oppgaver = oppgaveQuery.data as Array<{
    id: string; title: string; status: string; priority: string;
    dueDate: string | null; description: string | null;
    responderEnterprise: { name: string };
  }> | undefined;
  const isLoading = oppgaveQuery.isLoading;

  const { data: entrepriser } = trpc.entreprise.hentForProsjekt.useQuery({ projectId: params.prosjektId });
  const { data: maler } = trpc.mal.hentForProsjekt.useQuery({ projectId: params.prosjektId });
  const oppgaveMaler = (maler ?? []).filter((m: { category: string }) => m.category === "oppgave");
  const { data: mineEntrepriser } = trpc.medlem.hentMineEntrepriser.useQuery(
    { projectId: params.prosjektId },
  );

  const opprettMutation = trpc.oppgave.opprett.useMutation({
    onSuccess: () => {
      utils.oppgave.hentForProsjekt.invalidate({ projectId: params.prosjektId });
      setVisModal(false);
      setTittel("");
      setBeskrivelse("");
      setPrioritet("medium");
      setValgtOppretter("");
      setValgtSvarer("");
      setValgtMalId("");
    },
  });

  useVerktoylinje([
    {
      id: "ny-oppgave",
      label: "Ny oppgave",
      ikon: <Plus className="h-4 w-4" />,
      onClick: () => setVisModal(true),
      variant: "primary",
    },
  ]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tittel.trim() || !valgtOppretter || !valgtSvarer || !valgtMalId) return;

    opprettMutation.mutate({
      templateId: valgtMalId,
      creatorEnterpriseId: valgtOppretter,
      responderEnterpriseId: valgtSvarer,
      title: tittel.trim(),
      description: beskrivelse.trim() || undefined,
      priority: prioritet,
    });
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const filtrerte = oppgaver
    ? statusFilter
      ? oppgaver.filter((o) => o.status === statusFilter)
      : oppgaver
    : [];

  type OppgaveRad = {
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    description: string | null;
    responderEnterprise: { name: string };
  };

  // Oppretter-dropdown: brukerens entrepriser (eller alle for admin)
  const oppretterAlternativer = (mineEntrepriser ?? []).map((e) => ({
    value: e.id,
    label: e.name,
  }));

  // Svarer-dropdown: alle entrepriser i prosjektet
  const svarerAlternativer = (entrepriser ?? []).map((e) => ({
    value: e.id,
    label: e.name,
  }));

  return (
    <div>
      {!oppgaver?.length ? (
        <EmptyState
          title="Ingen oppgaver"
          description="Opprett oppgaver for å tildele arbeid til entrepriser."
          action={<Button onClick={() => setVisModal(true)}>Opprett oppgave</Button>}
        />
      ) : (
        <Table<OppgaveRad>
          kolonner={[
            {
              id: "title",
              header: "Tittel",
              celle: (rad) => (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{rad.title}</span>
                  <Badge variant={prioritetFarge[rad.priority] ?? "default"}>
                    {prioriteter.find((p) => p.value === rad.priority)?.label ?? rad.priority}
                  </Badge>
                </div>
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
          data={filtrerte as OppgaveRad[]}
          radNokkel={(rad) => rad.id}
          tomMelding="Ingen oppgaver med denne statusen"
        />
      )}

      <Modal open={visModal} onClose={() => setVisModal(false)} title="Ny oppgave">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Select
            label="Oppgavemal"
            options={oppgaveMaler.map((m: { id: string; name: string }) => ({ value: m.id, label: m.name }))}
            value={valgtMalId}
            onChange={(e) => setValgtMalId(e.target.value)}
            placeholder="Velg mal..."
          />
          <Input
            label="Tittel"
            placeholder="F.eks. Monter brannventiler i 5. etasje"
            value={tittel}
            onChange={(e) => setTittel(e.target.value)}
            required
          />
          <Textarea
            label="Beskrivelse"
            placeholder="Beskriv oppgaven..."
            value={beskrivelse}
            onChange={(e) => setBeskrivelse(e.target.value)}
          />
          <Select
            label="Prioritet"
            options={prioriteter}
            value={prioritet}
            onChange={(e) => setPrioritet(e.target.value as "low" | "medium" | "high" | "critical")}
          />
          <Select
            label="Oppretter-entreprise"
            options={oppretterAlternativer}
            value={valgtOppretter}
            onChange={(e) => setValgtOppretter(e.target.value)}
            placeholder="Velg entreprise..."
          />
          <Select
            label="Ansvarlig entreprise (svarer)"
            options={svarerAlternativer}
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

"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Card, Button, Input, Textarea, Select, Modal, Spinner, EmptyState, StatusBadge, Badge } from "@sitedoc/ui";

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
  const params = useParams<{ id: string }>();
  const utils = trpc.useUtils();
  const [visModal, setVisModal] = useState(false);
  const [tittel, setTittel] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");
  const [prioritet, setPrioritet] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [valgtSvarer, setValgtSvarer] = useState("");
  const [valgtMalId, setValgtMalId] = useState("");

  const { data: oppgaver, isLoading } = trpc.oppgave.hentForProsjekt.useQuery(
    { projectId: params.id },
  );

  const { data: faggrupper } = trpc.faggruppe.hentForProsjekt.useQuery({ projectId: params.id });
  const { data: maler } = trpc.mal.hentForProsjekt.useQuery({ projectId: params.id });
  const oppgaveMaler = (maler ?? []).filter((m: { category: string }) => m.category === "oppgave");

  const opprettMutation = trpc.oppgave.opprett.useMutation({
    onSuccess: () => {
      utils.oppgave.hentForProsjekt.invalidate({ projectId: params.id });
      setVisModal(false);
      setTittel("");
      setBeskrivelse("");
      setPrioritet("medium");
      setValgtSvarer("");
      setValgtMalId("");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tittel.trim() || !valgtSvarer || !valgtMalId) return;

    const oppretterFaggruppe = faggrupper?.[0];
    if (!oppretterFaggruppe) return;

    opprettMutation.mutate({
      templateId: valgtMalId,
      bestillerFaggruppeId: oppretterFaggruppe.id,
      utforerFaggruppeId: valgtSvarer,
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Oppgaver</h3>
        <Button onClick={() => setVisModal(true)}>Ny oppgave</Button>
      </div>

      {!oppgaver?.length ? (
        <EmptyState
          title="Ingen oppgaver"
          description="Opprett oppgaver for å tildele arbeid til faggrupper."
          action={<Button onClick={() => setVisModal(true)}>Opprett oppgave</Button>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {(oppgaver as Array<{ id: string; title: string; description: string | null; priority: string; status: string; dueDate: string | null; utforerFaggruppe: { name: string } }>).map((oppgave) => (
            <Card key={oppgave.id} className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{oppgave.title}</p>
                  <Badge variant={prioritetFarge[oppgave.priority] ?? "default"}>
                    {prioriteter.find((p) => p.value === oppgave.priority)?.label ?? oppgave.priority}
                  </Badge>
                </div>
                <p className="text-xs text-gray-400">
                  Svarer: {oppgave.utforerFaggruppe.name}
                  {oppgave.description && ` · ${oppgave.description.slice(0, 60)}...`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {oppgave.dueDate && (
                  <span className="text-xs text-gray-400">
                    Frist: {new Date(oppgave.dueDate).toLocaleDateString("nb-NO")}
                  </span>
                )}
                <StatusBadge status={oppgave.status} />
              </div>
            </Card>
          ))}
        </div>
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
            label="Ansvarlig faggruppe"
            options={faggrupper?.map((ent) => ({ value: ent.id, label: ent.name })) ?? []}
            value={valgtSvarer}
            onChange={(e) => setValgtSvarer(e.target.value)}
            placeholder="Velg faggruppe..."
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

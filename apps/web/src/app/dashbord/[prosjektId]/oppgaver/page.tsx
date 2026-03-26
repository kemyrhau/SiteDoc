"use client";

import { useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button, Modal, Spinner, EmptyState, StatusBadge, Badge, Table } from "@sitedoc/ui";
import { useVerktoylinje } from "@/hooks/useVerktoylinje";
import { useBygning } from "@/kontekst/bygning-kontekst";
import { Plus, Trash2 } from "lucide-react";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status");
  const utils = trpc.useUtils();
  const [visModal, setVisModal] = useState(false);
  const { aktivBygning } = useBygning();

  const oppgaveQuery = trpc.oppgave.hentForProsjekt.useQuery(
    { projectId: params.prosjektId, ...(aktivBygning?.id ? { buildingId: aktivBygning.id } : {}) },
  );
  const oppgaver = oppgaveQuery.data as Array<{
    id: string; title: string; status: string; priority: string;
    number: number | null;
    dueDate: string | null; description: string | null;
    template: { prefix: string | null; name: string } | null;
    responderEnterprise: { name: string };
  }> | undefined;
  const isLoading = oppgaveQuery.isLoading;

  const { data: maler } = trpc.mal.hentForProsjekt.useQuery({ projectId: params.prosjektId });
  const oppgaveMaler = ((maler ?? []) as Array<{ id: string; name: string; prefix?: string | null; category: string }>).filter((m) => m.category === "oppgave");
  const { data: mineEntrepriser } = trpc.medlem.hentMineEntrepriser.useQuery(
    { projectId: params.prosjektId },
  );
  const { data: dokumentflyter } = trpc.dokumentflyt.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
  );

  const slettMutasjon = trpc.oppgave.slett.useMutation({
    onSuccess: () => {
      utils.oppgave.hentForProsjekt.invalidate({ projectId: params.prosjektId });
    },
  });

  const opprettMutation = trpc.oppgave.opprett.useMutation({
    onSuccess: (_data: unknown) => {
      const resultat = _data as { id: string };
      utils.oppgave.hentForProsjekt.invalidate({ projectId: params.prosjektId });
      setVisModal(false);
      router.push(`/dashbord/${params.prosjektId}/oppgaver/${resultat.id}`);
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

  function handleOpprettFraMal(malId: string) {
    const oppretter = mineEntrepriser?.[0];
    if (!oppretter) return;

    // Finn dokumentflyt som matcher denne malen og oppretter-entreprisen
    const alleDf = (dokumentflyter ?? []) as Array<{
      id: string;
      medlemmer: Array<{ enterprise?: { id: string } | null; group?: { id: string } | null; projectMember?: { id: string } | null; rolle: string }>;
      maler: Array<{ template: { id: string } }>;
    }>;
    const matchDf = alleDf.find((df) =>
      df.maler.some((m) => m.template.id === malId) &&
      df.medlemmer.some((m) =>
        m.rolle === "oppretter" && (m.enterprise?.id === oppretter.id || m.group || m.projectMember),
      ),
    );
    const svarer = matchDf?.medlemmer.find((m) => m.rolle === "svarer");
    const svarerEntrepriseId = svarer?.enterprise?.id ?? oppretter.id;

    const mal = oppgaveMaler.find((m) => m.id === malId);
    opprettMutation.mutate({
      templateId: malId,
      creatorEnterpriseId: oppretter.id,
      responderEnterpriseId: svarerEntrepriseId,
      title: mal?.name ?? "Ny oppgave",
      priority: "medium",
      workflowId: matchDf?.id,
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
    number: number | null;
    status: string;
    priority: string;
    dueDate: string | null;
    description: string | null;
    template: { prefix: string | null; name: string } | null;
    responderEnterprise: { name: string };
  };


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
              celle: (rad) => {
                const prefiks = rad.template?.prefix && rad.number
                  ? `${rad.template.prefix}-${String(rad.number).padStart(3, "0")}`
                  : null;
                return (
                  <div className="flex items-center gap-2">
                    {prefiks && <span className="text-xs font-medium text-gray-400">{prefiks}</span>}
                    <span className="font-medium text-gray-900">{rad.title}</span>
                    <Badge variant={prioritetFarge[rad.priority] ?? "default"}>
                      {prioriteter.find((p) => p.value === rad.priority)?.label ?? rad.priority}
                    </Badge>
                  </div>
                );
              },
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
            {
              id: "handlinger",
              header: "",
              celle: (rad) =>
                rad.status === "draft" ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Er du sikker på at du vil slette denne oppgaven?")) {
                        slettMutasjon.mutate({ id: rad.id });
                      }
                    }}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    title="Slett oppgave"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null,
              bredde: "48px",
            },
          ]}
          data={filtrerte as OppgaveRad[]}
          radNokkel={(rad) => rad.id}
          onRadKlikk={(rad) => router.push(`/dashbord/${params.prosjektId}/oppgaver/${rad.id}`)}
          tomMelding="Ingen oppgaver med denne statusen"
        />
      )}

      <Modal open={visModal} onClose={() => setVisModal(false)} title="Velg oppgavemal">
        <div className="space-y-1">
          {oppgaveMaler.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">Ingen oppgavemaler tilgjengelig</p>
          ) : (
            oppgaveMaler.map((m) => (
              <button
                key={m.id}
                onClick={() => handleOpprettFraMal(m.id)}
                disabled={opprettMutation.isPending}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-gray-50 disabled:opacity-50"
              >
                <span className="text-sm font-medium text-gray-800">{m.name}</span>
                {m.prefix && (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">{m.prefix}</span>
                )}
              </button>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}

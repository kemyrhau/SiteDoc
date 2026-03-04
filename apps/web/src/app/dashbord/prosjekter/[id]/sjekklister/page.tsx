"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, Button, Select, Modal, Spinner, EmptyState, StatusBadge } from "@siteflow/ui";

export default function SjekklisteSide() {
  const params = useParams<{ id: string }>();
  const utils = trpc.useUtils();
  const [visModal, setVisModal] = useState(false);
  const [valgtMal, setValgtMal] = useState("");
  const [valgtSvarer, setValgtSvarer] = useState("");
  const [valgtEmne, setValgtEmne] = useState("");

  const { data: sjekklister, isLoading } = trpc.sjekkliste.hentForProsjekt.useQuery(
    { projectId: params.id },
  );

  const { data: malerRå } = trpc.mal.hentForProsjekt.useQuery({ projectId: params.id });
  const maler = malerRå as Array<{ id: string; name: string; subjects?: string[] }> | undefined;
  const { data: entrepriser } = trpc.entreprise.hentForProsjekt.useQuery({ projectId: params.id });

  const opprettMutation = trpc.sjekkliste.opprett.useMutation({
    onSuccess: () => {
      utils.sjekkliste.hentForProsjekt.invalidate({ projectId: params.id });
      setVisModal(false);
      setValgtMal("");
      setValgtSvarer("");
      setValgtEmne("");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valgtMal || !valgtSvarer) return;

    // Bruker første entreprise som oppretter (forenklet — forbedres med sesjonskontekst)
    const oppretterEntreprise = entrepriser?.[0];
    if (!oppretterEntreprise) return;

    opprettMutation.mutate({
      templateId: valgtMal,
      creatorEnterpriseId: oppretterEntreprise.id,
      responderEnterpriseId: valgtSvarer,
      subject: valgtEmne || undefined,
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
        <h3 className="text-lg font-semibold">Sjekklister</h3>
        <Button onClick={() => setVisModal(true)}>Ny sjekkliste</Button>
      </div>

      {!sjekklister?.length ? (
        <EmptyState
          title="Ingen sjekklister"
          description="Opprett en sjekkliste basert på en rapportmal."
          action={<Button onClick={() => setVisModal(true)}>Opprett sjekkliste</Button>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {(sjekklister as Array<{ id: string; title: string; status: string; dueDate: string | null; template: { name: string }; responderEnterprise: { name: string } }>).map((sjekk) => (
            <Link
              key={sjekk.id}
              href={`/dashbord/prosjekter/${params.id}/sjekklister/${sjekk.id}`}
            >
              <Card className="flex items-center justify-between transition-shadow hover:shadow-md">
                <div>
                  <p className="font-medium">{sjekk.title}</p>
                  <p className="text-xs text-gray-400">
                    {sjekk.template.name} &middot; Svarer: {sjekk.responderEnterprise.name}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {sjekk.dueDate && (
                    <span className="text-xs text-gray-400">
                      Frist: {new Date(sjekk.dueDate).toLocaleDateString("nb-NO")}
                    </span>
                  )}
                  <StatusBadge status={sjekk.status} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal open={visModal} onClose={() => setVisModal(false)} title="Ny sjekkliste">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Select
            label="Rapportmal"
            options={maler?.map((m) => ({ value: m.id, label: m.name })) ?? []}
            value={valgtMal}
            onChange={(e) => {
              setValgtMal(e.target.value);
              setValgtEmne("");
            }}
            placeholder="Velg mal..."
          />
          {(() => {
            const malData = maler?.find((m) => m.id === valgtMal);
            const subjects = Array.isArray(malData?.subjects)
              ? malData.subjects.filter((s) => s.trim() !== "")
              : [];
            return subjects.length > 0 ? (
              <Select
                label="Emne"
                options={subjects.map((s) => ({ value: s, label: s }))}
                value={valgtEmne}
                onChange={(e) => setValgtEmne(e.target.value)}
                placeholder="Velg emne..."
              />
            ) : null;
          })()}
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

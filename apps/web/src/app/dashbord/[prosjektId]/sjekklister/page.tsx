"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button, Select, Modal, Spinner, EmptyState, StatusBadge, Table } from "@siteflow/ui";
import { useVerktoylinje } from "@/hooks/useVerktoylinje";
import type { VerktoylinjeHandling } from "@/kontekst/navigasjon-kontekst";
import { Plus, Printer } from "lucide-react";

export default function SjekklisteSide() {
  const params = useParams<{ prosjektId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status");
  const utils = trpc.useUtils();
  const [visModal, setVisModal] = useState(false);
  const [valgtMal, setValgtMal] = useState("");
  const [valgtOppretter, setValgtOppretter] = useState("");
  const [valgtSvarer, setValgtSvarer] = useState("");
  const [valgtEmne, setValgtEmne] = useState("");
  const [valgtBygning, setValgtBygning] = useState("");
  const [valgte, setValgte] = useState<Set<string>>(new Set());

  const { data: sjekklister, isLoading } = trpc.sjekkliste.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
  );

  const { data: maler } = trpc.mal.hentForProsjekt.useQuery({ projectId: params.prosjektId });
  const { data: entrepriser } = trpc.entreprise.hentForProsjekt.useQuery({ projectId: params.prosjektId });
  const { data: mineEntrepriser } = trpc.medlem.hentMineEntrepriser.useQuery(
    { projectId: params.prosjektId },
  );
  const { data: bygninger } = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
  );

  const opprettMutation = trpc.sjekkliste.opprett.useMutation({
    onSuccess: () => {
      utils.sjekkliste.hentForProsjekt.invalidate({ projectId: params.prosjektId });
      setVisModal(false);
      setValgtMal("");
      setValgtOppretter("");
      setValgtSvarer("");
      setValgtEmne("");
      setValgtBygning("");
    },
  });

  function apneModal() {
    setValgtBygning("");
    setVisModal(true);
  }

  const verktoylinjeHandlinger = useMemo((): VerktoylinjeHandling[] => {
    const handlinger: VerktoylinjeHandling[] = [
      {
        id: "ny-sjekkliste",
        label: "Ny sjekkliste",
        ikon: <Plus className="h-4 w-4" />,
        onClick: apneModal,
        variant: "primary",
      },
    ];

    if (valgte.size > 0) {
      handlinger.push({
        id: "skriv-ut-valgte",
        label: `Skriv ut valgte (${valgte.size})`,
        ikon: <Printer className="h-4 w-4" />,
        onClick: () => {
          const ider = Array.from(valgte).join(",");
          router.push(`/dashbord/${params.prosjektId}/sjekklister/skriv-ut?ider=${ider}`);
        },
        variant: "secondary",
      });
    }

    return handlinger;
    // eslint-disable-next-line
  }, [valgte, params.prosjektId, router]);

  useVerktoylinje(verktoylinjeHandlinger, [valgte.size]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valgtMal || !valgtOppretter || !valgtSvarer) return;

    opprettMutation.mutate({
      templateId: valgtMal,
      creatorEnterpriseId: valgtOppretter,
      responderEnterpriseId: valgtSvarer,
      subject: valgtEmne || undefined,
      buildingId: valgtBygning || undefined,
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
      ? sjekklister.filter((s: { status: string }) => s.status === statusFilter)
      : sjekklister
    : [];

  type SjekklisteRad = {
    id: string;
    title: string;
    status: string;
    dueDate: string | null;
    template: { name: string };
    responderEnterprise: { name: string };
    building: { id: string; name: string; number: number | null } | null;
  };

  // Forhåndsdefinerte emner fra valgt mal
  const malSubjects = (() => {
    if (!maler || !valgtMal) return [];
    const malData = (maler as Array<{ id: string; subjects?: unknown }>).find((m) => m.id === valgtMal);
    if (!malData || !Array.isArray(malData.subjects)) return [];
    return (malData.subjects as string[]).filter((s) => s.trim() !== "");
  })();

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

  // Lokasjon-dropdown
  const bygningAlternativer = (bygninger ?? []).map((b) => ({
    value: b.id,
    label: b.number ? `${b.number}. ${b.name}` : b.name,
  }));

  return (
    <div>
      {!sjekklister?.length ? (
        <EmptyState
          title="Ingen sjekklister"
          description="Opprett en sjekkliste basert på en rapportmal."
          action={<Button onClick={apneModal}>Opprett sjekkliste</Button>}
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
              id: "building",
              header: "Lokasjon",
              celle: (rad) =>
                rad.building ? (
                  <span className="text-gray-600">{rad.building.name}</span>
                ) : (
                  <span className="text-gray-300">—</span>
                ),
              bredde: "150px",
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
          velgbar
          valgteRader={valgte}
          onValgEndring={setValgte}
        />
      )}

      <Modal open={visModal} onClose={() => setVisModal(false)} title="Ny sjekkliste">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Select
            label="Rapportmal"
            options={(maler as Array<{ id: string; name: string }> | undefined)?.map((m) => ({ value: m.id, label: m.name })) ?? []}
            value={valgtMal}
            onChange={(e) => {
              setValgtMal(e.target.value);
              setValgtEmne("");
            }}
            placeholder="Velg mal..."
          />
          {malSubjects.length > 0 && (
            <Select
              label="Emne"
              options={malSubjects.map((s) => ({ value: s, label: s }))}
              value={valgtEmne}
              onChange={(e) => setValgtEmne(e.target.value)}
              placeholder="Velg emne..."
            />
          )}
          <Select
            label="Lokasjon"
            options={bygningAlternativer}
            value={valgtBygning}
            onChange={(e) => setValgtBygning(e.target.value)}
            placeholder="Ingen lokasjon"
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

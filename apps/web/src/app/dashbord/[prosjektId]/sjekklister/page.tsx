"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button, Select, Modal, Spinner, EmptyState, StatusBadge, Table } from "@sitedoc/ui";
import { useVerktoylinje } from "@/hooks/useVerktoylinje";
import { useBygning } from "@/kontekst/bygning-kontekst";
import type { VerktoylinjeHandling } from "@/kontekst/navigasjon-kontekst";
import { Plus, Printer, Trash2 } from "lucide-react";

export default function SjekklisteSide() {
  const params = useParams<{ prosjektId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status");
  const utils = trpc.useUtils();
  const { aktivBygning, standardTegning } = useBygning();
  const [visModal, setVisModal] = useState(false);
  const [valgtMal, setValgtMal] = useState("");
  const [valgtOppretter, setValgtOppretter] = useState("");
  const [valgtSvarer, setValgtSvarer] = useState("");
  const [valgtEmne, setValgtEmne] = useState("");
  const [valgtBygning, setValgtBygning] = useState("");
  const [valgtTegning, setValgtTegning] = useState("");
  const [valgte, setValgte] = useState<Set<string>>(new Set());
  const [visSlettModal, setVisSlettModal] = useState(false);
  const [slettFeil, setSlettFeil] = useState<string | null>(null);
  const [kolonneFiltre, setKolonneFiltre] = useState<Record<string, string>>({});

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
  const { data: tegninger } = trpc.tegning.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: visModal },
  );

  const slettMutation = trpc.sjekkliste.slett.useMutation({
    onSuccess: () => {
      utils.sjekkliste.hentForProsjekt.invalidate({ projectId: params.prosjektId });
    },
  });

  async function slettValgte() {
    setSlettFeil(null);
    const ider = Array.from(valgte);
    for (const id of ider) {
      try {
        await slettMutation.mutateAsync({ id });
      } catch (err) {
        const melding = err instanceof Error ? err.message : "Ukjent feil";
        setSlettFeil(melding);
        return;
      }
    }
    setValgte(new Set());
    setVisSlettModal(false);
  }

  const opprettMutation = trpc.sjekkliste.opprett.useMutation({
    onSuccess: () => {
      utils.sjekkliste.hentForProsjekt.invalidate({ projectId: params.prosjektId });
      setVisModal(false);
      setValgtMal("");
      setValgtOppretter("");
      setValgtSvarer("");
      setValgtEmne("");
      setValgtBygning("");
      setValgtTegning("");
    },
  });

  function apneModal() {
    // Forhåndsvelg fra standard-tegning kontekst
    setValgtBygning(aktivBygning?.id ?? "");
    setValgtTegning(standardTegning?.id ?? "");
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
      handlinger.push({
        id: "slett-valgte",
        label: `Slett (${valgte.size})`,
        ikon: <Trash2 className="h-4 w-4" />,
        onClick: () => {
          setSlettFeil(null);
          setVisSlettModal(true);
        },
        variant: "danger",
      });
    }

    return handlinger;
    // eslint-disable-next-line
  }, [valgte, params.prosjektId, router, aktivBygning?.id, standardTegning?.id]);

  useVerktoylinje(verktoylinjeHandlinger, [valgte.size, aktivBygning?.id, standardTegning?.id]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valgtMal || !valgtOppretter || !valgtSvarer) return;

    opprettMutation.mutate({
      templateId: valgtMal,
      creatorEnterpriseId: valgtOppretter,
      responderEnterpriseId: valgtSvarer,
      subject: valgtEmne || undefined,
      buildingId: valgtBygning || undefined,
      drawingId: valgtTegning || undefined,
    });
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  type SjekklisteRad = {
    id: string;
    title: string;
    status: string;
    dueDate: string | null;
    creatorEnterprise: { name: string };
    template: { name: string };
    responderEnterprise: { name: string };
    building: { id: string; name: string; number: number | null } | null;
  };

  // Statusfilter fra sidepanel
  const statusFiltrerte = sjekklister
    ? statusFilter
      ? sjekklister.filter((s: { status: string }) => s.status === statusFilter)
      : sjekklister
    : [];

  // Kolonnefiltre (Mal, Lokasjon, Svarer, Oppretter)
  const filtrerte = (statusFiltrerte as SjekklisteRad[]).filter((rad) => {
    if (kolonneFiltre.template && rad.template.name !== kolonneFiltre.template) return false;
    if (kolonneFiltre.building) {
      if (!rad.building || rad.building.name !== kolonneFiltre.building) return false;
    }
    if (kolonneFiltre.responder && rad.responderEnterprise.name !== kolonneFiltre.responder) return false;
    if (kolonneFiltre.creator && rad.creatorEnterprise.name !== kolonneFiltre.creator) return false;
    return true;
  });

  // Bygg filteralternativer fra faktisk data
  const malAlternativer = [...new Set((statusFiltrerte as SjekklisteRad[]).map((s) => s.template.name))].sort().map((n) => ({ value: n, label: n }));
  const lokasjonAlternativer = [...new Set((statusFiltrerte as SjekklisteRad[]).filter((s) => s.building).map((s) => s.building!.name))].sort().map((n) => ({ value: n, label: n }));
  const svarerAlternativerFilter = [...new Set((statusFiltrerte as SjekklisteRad[]).map((s) => s.responderEnterprise.name))].sort().map((n) => ({ value: n, label: n }));
  const oppretterAlternativerFilter = [...new Set((statusFiltrerte as SjekklisteRad[]).map((s) => s.creatorEnterprise.name))].sort().map((n) => ({ value: n, label: n }));

  // Forhåndsdefinerte emner fra valgt mal
  const malSubjects = (() => {
    if (!maler || !valgtMal) return [];
    const malData = (maler as Array<{ id: string; subjects?: unknown }>).find((m) => m.id === valgtMal);
    if (!malData || !Array.isArray(malData.subjects)) return [];
    return (malData.subjects as string[]).filter((s) => s.trim() !== "");
  })();

  // Oppretter-dropdown
  const oppretterAlternativer = (mineEntrepriser ?? []).map((e) => ({
    value: e.id,
    label: e.name,
  }));

  // Svarer-dropdown
  const svarerAlternativer = (entrepriser ?? []).map((e) => ({
    value: e.id,
    label: e.name,
  }));

  // Lokasjon-dropdown
  const bygningAlternativer = (bygninger ?? []).map((b) => ({
    value: b.id,
    label: b.number ? `${b.number}. ${b.name}` : b.name,
  }));

  // Tegning-dropdown — filtrert etter valgt bygning
  const tegningAlternativer = ((tegninger ?? []) as Array<{ id: string; name: string; drawingNumber: string | null; buildingId: string | null }>)
    .filter((t) => !valgtBygning || t.buildingId === valgtBygning)
    .map((t) => ({
      value: t.id,
      label: t.drawingNumber ? `${t.drawingNumber} ${t.name}` : t.name,
    }));

  function handleFilterEndring(kolonneId: string, verdi: string) {
    setKolonneFiltre((prev) => {
      const neste = { ...prev };
      if (verdi) {
        neste[kolonneId] = verdi;
      } else {
        delete neste[kolonneId];
      }
      return neste;
    });
  }

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
              sorterbar: true,
              sorterVerdi: (rad) => rad.title,
            },
            {
              id: "template",
              header: "Mal",
              celle: (rad) => (
                <span className="text-gray-600">{rad.template.name}</span>
              ),
              sorterbar: true,
              sorterVerdi: (rad) => rad.template.name,
              filtrerbar: true,
              filterAlternativer: malAlternativer,
            },
            {
              id: "creator",
              header: "Oppretter",
              celle: (rad) => (
                <span className="text-gray-600">{rad.creatorEnterprise.name}</span>
              ),
              sorterbar: true,
              sorterVerdi: (rad) => rad.creatorEnterprise.name,
              filtrerbar: true,
              filterAlternativer: oppretterAlternativerFilter,
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
              sorterbar: true,
              sorterVerdi: (rad) => rad.building?.name ?? null,
              filtrerbar: true,
              filterAlternativer: lokasjonAlternativer,
            },
            {
              id: "responder",
              header: "Svarer",
              celle: (rad) => (
                <span className="text-gray-600">{rad.responderEnterprise.name}</span>
              ),
              sorterbar: true,
              sorterVerdi: (rad) => rad.responderEnterprise.name,
              filtrerbar: true,
              filterAlternativer: svarerAlternativerFilter,
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
              sorterbar: true,
              sorterVerdi: (rad) => rad.dueDate,
            },
            {
              id: "status",
              header: "Status",
              celle: (rad) => <StatusBadge status={rad.status} />,
              bredde: "120px",
              sorterbar: true,
              sorterVerdi: (rad) => rad.status,
            },
          ]}
          data={filtrerte}
          radNokkel={(rad) => rad.id}
          onRadKlikk={(rad) =>
            router.push(`/dashbord/${params.prosjektId}/sjekklister/${rad.id}`)
          }
          tomMelding="Ingen sjekklister med denne statusen"
          velgbar
          valgteRader={valgte}
          onValgEndring={setValgte}
          filterVerdier={kolonneFiltre}
          onFilterEndring={handleFilterEndring}
        />
      )}

      <Modal open={visSlettModal} onClose={() => setVisSlettModal(false)} title="Slett sjekkliste(r)?">
        <div className="flex flex-col gap-4">
          <p className="text-gray-600">
            Er du sikker på at du vil slette {valgte.size} sjekkliste(r)? Denne handlingen kan ikke angres.
          </p>
          {slettFeil && (
            <p className="text-sm text-red-600 bg-red-50 rounded p-3">{slettFeil}</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="danger" onClick={slettValgte} loading={slettMutation.isPending}>
              Slett
            </Button>
            <Button variant="secondary" onClick={() => setVisSlettModal(false)}>
              Avbryt
            </Button>
          </div>
        </div>
      </Modal>

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
            onChange={(e) => {
              setValgtBygning(e.target.value);
              // Nullstill tegning hvis bygning endres
              if (e.target.value !== valgtBygning) setValgtTegning("");
            }}
            placeholder="Ingen lokasjon"
          />
          <Select
            label="Tegning"
            options={tegningAlternativer}
            value={valgtTegning}
            onChange={(e) => setValgtTegning(e.target.value)}
            placeholder="Ingen tegning"
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

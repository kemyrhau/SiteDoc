"use client";

import { useState, useMemo, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button, Modal, Spinner, EmptyState, StatusBadge, Badge, Table } from "@sitedoc/ui";
import { useVerktoylinje } from "@/hooks/useVerktoylinje";
import { useBygning } from "@/kontekst/bygning-kontekst";
import { Plus, Trash2, Columns3 } from "lucide-react";

// --- Typer ---

interface OppgaveRad {
  id: string;
  title: string;
  subject: string | null;
  number: number | null;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  template: { prefix: string | null; name: string } | null;
  creator: { name: string | null } | null;
  creatorEnterprise: { name: string };
  responderEnterprise: { name: string };
  drawing: { name: string; floor: string | null; building: { id: string; name: string } | null } | null;
  recipientUser: { name: string | null } | null;
  recipientGroup: { name: string } | null;
}

// --- Konstanter ---

const STATUS_ALTERNATIVER = [
  { value: "draft", label: "Utkast" },
  { value: "sent", label: "Sendt" },
  { value: "received", label: "Mottatt" },
  { value: "in_progress", label: "Under arbeid" },
  { value: "responded", label: "Besvart" },
  { value: "approved", label: "Godkjent" },
  { value: "rejected", label: "Avvist" },
  { value: "closed", label: "Lukket" },
  { value: "cancelled", label: "Avbrutt" },
];

const PRIORITETER = [
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

// --- Kolonnedefinisjoner ---

type KolonneId = "nr" | "tittel" | "emne" | "status" | "prioritet" | "lokasjon" | "oppretter" | "svarer" | "mottaker" | "mal" | "opprettet" | "endret" | "frist" | "handlinger";

interface KolonneInfo {
  id: KolonneId;
  navn: string;
  fast: boolean; // Kan ikke fjernes
}

const ALLE_KOLONNER: KolonneInfo[] = [
  { id: "nr", navn: "Nr", fast: true },
  { id: "tittel", navn: "Tittel", fast: true },
  { id: "status", navn: "Status", fast: true },
  { id: "emne", navn: "Emne", fast: false },
  { id: "prioritet", navn: "Prioritet", fast: false },
  { id: "lokasjon", navn: "Lokasjon", fast: false },
  { id: "oppretter", navn: "Oppretter", fast: false },
  { id: "svarer", navn: "Svarer", fast: false },
  { id: "mottaker", navn: "Mottaker", fast: false },
  { id: "mal", navn: "Mal", fast: false },
  { id: "opprettet", navn: "Opprettet", fast: false },
  { id: "endret", navn: "Sist endret", fast: false },
  { id: "frist", navn: "Frist", fast: false },
  { id: "handlinger", navn: "", fast: true },
];

const STANDARD_KOLONNER: KolonneId[] = ["nr", "tittel", "emne", "status", "svarer", "lokasjon", "frist", "handlinger"];

function hentLagredeKolonner(): KolonneId[] {
  if (typeof window === "undefined") return STANDARD_KOLONNER;
  try {
    const lagret = localStorage.getItem("sitedoc-oppgave-kolonner");
    if (lagret) return JSON.parse(lagret) as KolonneId[];
  } catch { /* ignorer */ }
  return STANDARD_KOLONNER;
}

function lagreKolonner(kolonner: KolonneId[]) {
  try {
    localStorage.setItem("sitedoc-oppgave-kolonner", JSON.stringify(kolonner));
  } catch { /* ignorer */ }
}

// --- Hjelpefunksjoner ---

function formaterNummer(rad: OppgaveRad): string {
  if (rad.template?.prefix && rad.number) {
    return `${rad.template.prefix}-${String(rad.number).padStart(3, "0")}`;
  }
  return rad.number ? String(rad.number) : "—";
}

function formaterLokasjon(rad: OppgaveRad): string {
  const deler: string[] = [];
  if (rad.drawing?.building?.name) deler.push(rad.drawing.building.name);
  if (rad.drawing?.floor) deler.push(rad.drawing.floor);
  return deler.join(" / ") || "—";
}

function formaterMottaker(rad: OppgaveRad): string {
  if (rad.recipientUser?.name) return rad.recipientUser.name;
  if (rad.recipientGroup?.name) return rad.recipientGroup.name;
  return "—";
}

function formaterDato(dato: string | null): string {
  if (!dato) return "—";
  return new Date(dato).toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
}

// --- Komponent ---

export default function OppgaverSide() {
  const params = useParams<{ prosjektId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status");
  const utils = trpc.useUtils();
  const [visModal, setVisModal] = useState(false);
  const [visKolonneVelger, setVisKolonneVelger] = useState(false);
  const [aktiveKolonner, setAktiveKolonner] = useState<KolonneId[]>(hentLagredeKolonner);
  const [filterVerdier, setFilterVerdier] = useState<Record<string, string>>({});
  const { aktivBygning } = useBygning();

  const oppgaveQuery = trpc.oppgave.hentForProsjekt.useQuery(
    { projectId: params.prosjektId, ...(aktivBygning?.id ? { buildingId: aktivBygning.id } : {}) },
  );
  const oppgaver = oppgaveQuery.data as OppgaveRad[] | undefined;
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

  // Bygg dynamiske filteralternativer fra data
  const dynamiskFilter = useMemo(() => {
    if (!oppgaver) return {};
    const emner = [...new Set(oppgaver.map((o) => o.subject).filter(Boolean) as string[])].sort();
    const entrepriser = [...new Set(oppgaver.map((o) => o.responderEnterprise.name))].sort();
    const oppretter = [...new Set(oppgaver.map((o) => o.creatorEnterprise.name))].sort();
    const maler = [...new Set(oppgaver.map((o) => o.template?.name).filter(Boolean) as string[])].sort();
    const lokasjoner = [...new Set(oppgaver.map((o) => formaterLokasjon(o)).filter((l) => l !== "—"))].sort();
    return {
      emne: emner.map((e) => ({ value: e, label: e })),
      svarer: entrepriser.map((e) => ({ value: e, label: e })),
      oppretter: oppretter.map((e) => ({ value: e, label: e })),
      mal: maler.map((m) => ({ value: m, label: m })),
      lokasjon: lokasjoner.map((l) => ({ value: l, label: l })),
      prioritet: PRIORITETER,
      status: STATUS_ALTERNATIVER,
    };
  }, [oppgaver]);

  // Filtrer data
  const filtrerte = useMemo(() => {
    let resultat = oppgaver ?? [];
    if (statusFilter) resultat = resultat.filter((o) => o.status === statusFilter);
    for (const [kolId, verdi] of Object.entries(filterVerdier)) {
      if (!verdi) continue;
      resultat = resultat.filter((o) => {
        switch (kolId) {
          case "status": return o.status === verdi;
          case "emne": return o.subject === verdi;
          case "prioritet": return o.priority === verdi;
          case "svarer": return o.responderEnterprise.name === verdi;
          case "oppretter": return o.creatorEnterprise.name === verdi;
          case "mal": return o.template?.name === verdi;
          case "lokasjon": return formaterLokasjon(o) === verdi;
          default: return true;
        }
      });
    }
    return resultat;
  }, [oppgaver, statusFilter, filterVerdier]);

  const handleFilterEndring = useCallback((kolonneId: string, verdi: string) => {
    setFilterVerdier((prev) => ({ ...prev, [kolonneId]: verdi }));
  }, []);

  const toggleKolonne = useCallback((kolId: KolonneId) => {
    setAktiveKolonner((prev) => {
      const ny = prev.includes(kolId)
        ? prev.filter((k) => k !== kolId)
        : [...prev.slice(0, -1), kolId, prev[prev.length - 1]!]; // Sett inn før "handlinger"
      lagreKolonner(ny);
      return ny;
    });
  }, []);

  // Bygg kolonnedefinisjoner for aktive kolonner
  const kolonneDefinisjoner = useMemo(() => {
    const defs: Record<KolonneId, Parameters<typeof Table<OppgaveRad>>[0]["kolonner"][number]> = {
      nr: {
        id: "nr",
        header: "Nr",
        celle: (rad) => <span className="text-xs font-medium text-gray-500 whitespace-nowrap">{formaterNummer(rad)}</span>,
        bredde: "90px",
        sorterbar: true,
        sorterVerdi: (rad) => rad.number ?? 0,
      },
      tittel: {
        id: "tittel",
        header: "Tittel",
        celle: (rad) => <span className="font-medium text-gray-900">{rad.title}</span>,
        sorterbar: true,
        sorterVerdi: (rad) => rad.title,
      },
      emne: {
        id: "emne",
        header: "Emne",
        celle: (rad) => rad.subject
          ? <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{rad.subject}</span>
          : <span className="text-gray-300">—</span>,
        sorterbar: true,
        sorterVerdi: (rad) => rad.subject ?? "",
        filtrerbar: true,
        filterAlternativer: dynamiskFilter.emne ?? [],
      },
      status: {
        id: "status",
        header: "Status",
        celle: (rad) => <StatusBadge status={rad.status} />,
        bredde: "130px",
        sorterbar: true,
        sorterVerdi: (rad) => rad.status,
        filtrerbar: true,
        filterAlternativer: dynamiskFilter.status ?? [],
      },
      prioritet: {
        id: "prioritet",
        header: "Prioritet",
        celle: (rad) => (
          <Badge variant={prioritetFarge[rad.priority] ?? "default"}>
            {PRIORITETER.find((p) => p.value === rad.priority)?.label ?? rad.priority}
          </Badge>
        ),
        bredde: "100px",
        sorterbar: true,
        sorterVerdi: (rad) => ["low", "medium", "high", "critical"].indexOf(rad.priority),
        filtrerbar: true,
        filterAlternativer: dynamiskFilter.prioritet ?? [],
      },
      lokasjon: {
        id: "lokasjon",
        header: "Lokasjon",
        celle: (rad) => {
          const lok = formaterLokasjon(rad);
          return lok !== "—"
            ? <span className="text-xs text-gray-600">{lok}</span>
            : <span className="text-gray-300">—</span>;
        },
        sorterbar: true,
        sorterVerdi: (rad) => formaterLokasjon(rad),
        filtrerbar: true,
        filterAlternativer: dynamiskFilter.lokasjon ?? [],
      },
      oppretter: {
        id: "oppretter",
        header: "Oppretter",
        celle: (rad) => <span className="text-gray-600">{rad.creatorEnterprise.name}</span>,
        sorterbar: true,
        sorterVerdi: (rad) => rad.creatorEnterprise.name,
        filtrerbar: true,
        filterAlternativer: dynamiskFilter.oppretter ?? [],
      },
      svarer: {
        id: "svarer",
        header: "Svarer",
        celle: (rad) => <span className="text-gray-600">{rad.responderEnterprise.name}</span>,
        sorterbar: true,
        sorterVerdi: (rad) => rad.responderEnterprise.name,
        filtrerbar: true,
        filterAlternativer: dynamiskFilter.svarer ?? [],
      },
      mottaker: {
        id: "mottaker",
        header: "Mottaker",
        celle: (rad) => {
          const m = formaterMottaker(rad);
          return m !== "—"
            ? <span className="text-gray-600">{m}</span>
            : <span className="text-gray-300">—</span>;
        },
        sorterbar: true,
        sorterVerdi: (rad) => formaterMottaker(rad),
      },
      mal: {
        id: "mal",
        header: "Mal",
        celle: (rad) => rad.template
          ? <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">{rad.template.name}</span>
          : <span className="text-gray-300">—</span>,
        sorterbar: true,
        sorterVerdi: (rad) => rad.template?.name ?? "",
        filtrerbar: true,
        filterAlternativer: dynamiskFilter.mal ?? [],
      },
      opprettet: {
        id: "opprettet",
        header: "Opprettet",
        celle: (rad) => <span className="text-xs text-gray-500">{formaterDato(rad.createdAt)}</span>,
        bredde: "100px",
        sorterbar: true,
        sorterVerdi: (rad) => new Date(rad.createdAt).getTime(),
      },
      endret: {
        id: "endret",
        header: "Sist endret",
        celle: (rad) => <span className="text-xs text-gray-500">{formaterDato(rad.updatedAt)}</span>,
        bredde: "100px",
        sorterbar: true,
        sorterVerdi: (rad) => new Date(rad.updatedAt).getTime(),
      },
      frist: {
        id: "frist",
        header: "Frist",
        celle: (rad) => rad.dueDate
          ? <span className="text-xs text-gray-500">{formaterDato(rad.dueDate)}</span>
          : <span className="text-gray-300">—</span>,
        bredde: "100px",
        sorterbar: true,
        sorterVerdi: (rad) => rad.dueDate ? new Date(rad.dueDate).getTime() : null,
      },
      handlinger: {
        id: "handlinger",
        header: "",
        celle: (rad) =>
          (rad.status === "draft" || rad.status === "cancelled") ? (
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
    };

    return aktiveKolonner.map((id) => defs[id]).filter(Boolean);
  }, [aktiveKolonner, dynamiskFilter, slettMutasjon]);

  // Aktive filter for visning
  const aktiveFilter = Object.entries(filterVerdier).filter(([_, v]) => v);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      {/* Filterbar */}
      {(oppgaver?.length ?? 0) > 0 && (
        <div className="mb-3 flex items-center gap-2">
          {/* Kolonnevelger */}
          <div className="relative">
            <button
              onClick={() => setVisKolonneVelger(!visKolonneVelger)}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <Columns3 className="h-3.5 w-3.5" />
              Kolonner
            </button>
            {visKolonneVelger && (
              <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                {ALLE_KOLONNER.filter((k) => k.navn && !k.fast).map((kol) => (
                  <label
                    key={kol.id}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={aktiveKolonner.includes(kol.id)}
                      onChange={() => toggleKolonne(kol.id)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                    />
                    {kol.navn}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Aktive filter-tags */}
          {aktiveFilter.map(([kolId, verdi]) => {
            const kolNavn = ALLE_KOLONNER.find((k) => k.id === kolId)?.navn ?? kolId;
            return (
              <span
                key={kolId}
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
              >
                {kolNavn}: {verdi}
                <button
                  onClick={() => handleFilterEndring(kolId, "")}
                  className="ml-0.5 text-blue-500 hover:text-blue-800"
                >×</button>
              </span>
            );
          })}
          {aktiveFilter.length > 1 && (
            <button
              onClick={() => setFilterVerdier({})}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Nullstill
            </button>
          )}

          {/* Antall */}
          <span className="ml-auto text-xs text-gray-400">
            {filtrerte.length} av {oppgaver?.length ?? 0}
          </span>
        </div>
      )}

      {!oppgaver?.length ? (
        <EmptyState
          title="Ingen oppgaver"
          description="Opprett oppgaver for å tildele arbeid til entrepriser."
          action={<Button onClick={() => setVisModal(true)}>Opprett oppgave</Button>}
        />
      ) : (
        <Table<OppgaveRad>
          kolonner={kolonneDefinisjoner}
          data={filtrerte}
          radNokkel={(rad) => rad.id}
          onRadKlikk={(rad) => router.push(`/dashbord/${params.prosjektId}/oppgaver/${rad.id}`)}
          tomMelding="Ingen oppgaver matcher filtrene"
          filterVerdier={filterVerdier}
          onFilterEndring={handleFilterEndring}
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

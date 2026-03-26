"use client";

import { useState, useMemo, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button, Modal, Spinner, EmptyState, StatusBadge, Table } from "@sitedoc/ui";
import { useVerktoylinje } from "@/hooks/useVerktoylinje";
import { useBygning } from "@/kontekst/bygning-kontekst";
import type { VerktoylinjeHandling } from "@/kontekst/navigasjon-kontekst";
import { Plus, Printer, Trash2, Columns3 } from "lucide-react";

// --- Typer ---

interface SjekklisteRad {
  id: string;
  title: string;
  subject: string | null;
  number: number | null;
  status: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  template: { prefix: string | null; name: string };
  creator: { name: string | null } | null;
  creatorEnterprise: { name: string };
  responderEnterprise: { name: string };
  building: { id: string; name: string } | null;
  drawing: { name: string; floor: string | null } | null;
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

type KolonneId = "nr" | "tittel" | "emne" | "mal" | "status" | "lokasjon" | "ansvarlig" | "opprettetAv" | "oppretterEntreprise" | "svarerEntreprise" | "opprettet" | "endret" | "frist";

interface KolonneInfo {
  id: KolonneId;
  navn: string;
  fast: boolean;
}

const ALLE_KOLONNER: KolonneInfo[] = [
  { id: "nr", navn: "Nr", fast: true },
  { id: "tittel", navn: "Tittel", fast: true },
  { id: "status", navn: "Status", fast: true },
  { id: "emne", navn: "Emne", fast: false },
  { id: "mal", navn: "Mal", fast: false },
  { id: "ansvarlig", navn: "Ansvarlig", fast: false },
  { id: "lokasjon", navn: "Lokasjon", fast: false },
  { id: "opprettetAv", navn: "Opprettet av", fast: false },
  { id: "oppretterEntreprise", navn: "Oppretter-entreprise", fast: false },
  { id: "svarerEntreprise", navn: "Svarer-entreprise", fast: false },
  { id: "opprettet", navn: "Opprettet", fast: false },
  { id: "endret", navn: "Sist endret", fast: false },
  { id: "frist", navn: "Frist", fast: false },
];

const STANDARD_KOLONNER: KolonneId[] = ["nr", "tittel", "emne", "mal", "status", "ansvarlig", "lokasjon", "frist"];

const STORAGE_KEY = "sitedoc-sjekkliste-kolonner-v2";

function hentLagredeKolonner(): KolonneId[] {
  if (typeof window === "undefined") return STANDARD_KOLONNER;
  try {
    const lagret = localStorage.getItem(STORAGE_KEY);
    if (lagret) {
      const parsed = JSON.parse(lagret) as string[];
      const gyldige = ALLE_KOLONNER.map((k) => k.id);
      const filtrert = parsed.filter((k) => gyldige.includes(k as KolonneId)) as KolonneId[];
      if (filtrert.length > 0) return filtrert;
    }
  } catch { /* ignorer */ }
  return STANDARD_KOLONNER;
}

function lagreKolonner(kolonner: KolonneId[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(kolonner));
  } catch { /* ignorer */ }
}

// --- Hjelpefunksjoner ---

function formaterNummer(rad: SjekklisteRad): string {
  if (rad.template?.prefix && rad.number) {
    return `${rad.template.prefix}-${String(rad.number).padStart(3, "0")}`;
  }
  return rad.number ? String(rad.number) : "—";
}

function formaterLokasjon(rad: SjekklisteRad): string {
  const deler: string[] = [];
  if (rad.building?.name) deler.push(rad.building.name);
  if (rad.drawing?.floor) deler.push(rad.drawing.floor);
  return deler.join(" / ") || "—";
}

function formaterAnsvarlig(rad: SjekklisteRad): string {
  if (rad.recipientUser?.name) return rad.recipientUser.name;
  if (rad.recipientGroup?.name) return rad.recipientGroup.name;
  return rad.responderEnterprise.name;
}

function formaterDato(dato: string | null): string {
  if (!dato) return "—";
  return new Date(dato).toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
}

// --- Komponent ---

export default function SjekklisteSide() {
  const params = useParams<{ prosjektId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status");
  const utils = trpc.useUtils();
  const { aktivBygning, standardTegning } = useBygning();
  const [visModal, setVisModal] = useState(false);
  const [valgte, setValgte] = useState<Set<string>>(new Set());
  const [visSlettModal, setVisSlettModal] = useState(false);
  const [slettFeil, setSlettFeil] = useState<string | null>(null);
  const [visKolonneVelger, setVisKolonneVelger] = useState(false);
  const [aktiveKolonner, setAktiveKolonner] = useState<KolonneId[]>(hentLagredeKolonner);
  const [filterVerdier, setFilterVerdier] = useState<Record<string, string>>({});

  const { data: sjekklister, isLoading } = trpc.sjekkliste.hentForProsjekt.useQuery(
    { projectId: params.prosjektId, ...(aktivBygning?.id ? { buildingId: aktivBygning.id } : {}) },
  );

  const { data: maler } = trpc.mal.hentForProsjekt.useQuery({ projectId: params.prosjektId });
  const sjekklisteMaler = ((maler ?? []) as Array<{ id: string; name: string; prefix?: string; category: string }>).filter((m) => m.category === "sjekkliste");
  const { data: mineEntrepriser } = trpc.medlem.hentMineEntrepriser.useQuery(
    { projectId: params.prosjektId },
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

  const { data: dokumentflyter } = trpc.dokumentflyt.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
  );

  const opprettMutation = trpc.sjekkliste.opprett.useMutation({
    onSuccess: (_data: unknown) => {
      const resultat = _data as { id: string };
      utils.sjekkliste.hentForProsjekt.invalidate({ projectId: params.prosjektId });
      setVisModal(false);
      router.push(`/dashbord/${params.prosjektId}/sjekklister/${resultat.id}`);
    },
  });

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

    opprettMutation.mutate({
      templateId: malId,
      creatorEnterpriseId: oppretter.id,
      responderEnterpriseId: svarerEntrepriseId,
      workflowId: matchDf?.id,
    });
  }

  const verktoylinjeHandlinger = useMemo((): VerktoylinjeHandling[] => {
    const handlinger: VerktoylinjeHandling[] = [
      {
        id: "ny-sjekkliste",
        label: "Ny sjekkliste",
        ikon: <Plus className="h-4 w-4" />,
        onClick: () => setVisModal(true),
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

  // Dynamiske filteralternativer
  const dynamiskFilter = useMemo(() => {
    const data = (sjekklister ?? []) as SjekklisteRad[];
    return {
      emne: [...new Set(data.map((s) => s.subject).filter(Boolean) as string[])].sort().map((e) => ({ value: e, label: e })),
      mal: [...new Set(data.map((s) => s.template.name))].sort().map((n) => ({ value: n, label: n })),
      ansvarlig: [...new Set(data.map((s) => formaterAnsvarlig(s)))].sort().map((a) => ({ value: a, label: a })),
      opprettetAv: [...new Set(data.map((s) => s.creator?.name).filter(Boolean) as string[])].sort().map((n) => ({ value: n, label: n })),
      oppretterEntreprise: [...new Set(data.map((s) => s.creatorEnterprise.name))].sort().map((n) => ({ value: n, label: n })),
      svarerEntreprise: [...new Set(data.map((s) => s.responderEnterprise.name))].sort().map((n) => ({ value: n, label: n })),
      lokasjon: [...new Set(data.map((s) => formaterLokasjon(s)).filter((l) => l !== "—"))].sort().map((l) => ({ value: l, label: l })),
      status: STATUS_ALTERNATIVER,
    };
  }, [sjekklister]);

  // Filtrer data
  const filtrerte = useMemo(() => {
    let resultat = (sjekklister ?? []) as SjekklisteRad[];
    if (statusFilter) resultat = resultat.filter((s) => s.status === statusFilter);
    for (const [kolId, verdi] of Object.entries(filterVerdier)) {
      if (!verdi) continue;
      resultat = resultat.filter((s) => {
        switch (kolId) {
          case "status": return s.status === verdi;
          case "emne": return s.subject === verdi;
          case "mal": return s.template.name === verdi;
          case "ansvarlig": return formaterAnsvarlig(s) === verdi;
          case "opprettetAv": return s.creator?.name === verdi;
          case "oppretterEntreprise": return s.creatorEnterprise.name === verdi;
          case "svarerEntreprise": return s.responderEnterprise.name === verdi;
          case "lokasjon": return formaterLokasjon(s) === verdi;
          default: return true;
        }
      });
    }
    return resultat;
  }, [sjekklister, statusFilter, filterVerdier]);

  const handleFilterEndring = useCallback((kolonneId: string, verdi: string) => {
    setFilterVerdier((prev) => ({ ...prev, [kolonneId]: verdi }));
  }, []);

  const toggleKolonne = useCallback((kolId: KolonneId) => {
    setAktiveKolonner((prev) => {
      const ny = prev.includes(kolId) ? prev.filter((k) => k !== kolId) : [...prev, kolId];
      lagreKolonner(ny);
      return ny;
    });
  }, []);

  // Bygg kolonnedefinisjoner
  const kolonneDefinisjoner = useMemo(() => {
    const defs: Record<KolonneId, Parameters<typeof Table<SjekklisteRad>>[0]["kolonner"][number]> = {
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
        filterAlternativer: dynamiskFilter.emne,
      },
      mal: {
        id: "mal",
        header: "Mal",
        celle: (rad) => <span className="text-gray-600">{rad.template.name}</span>,
        sorterbar: true,
        sorterVerdi: (rad) => rad.template.name,
        filtrerbar: true,
        filterAlternativer: dynamiskFilter.mal,
      },
      status: {
        id: "status",
        header: "Status",
        celle: (rad) => <StatusBadge status={rad.status} />,
        bredde: "130px",
        sorterbar: true,
        sorterVerdi: (rad) => rad.status,
        filtrerbar: true,
        filterAlternativer: dynamiskFilter.status,
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
        filterAlternativer: dynamiskFilter.lokasjon,
      },
      ansvarlig: {
        id: "ansvarlig",
        header: "Ansvarlig",
        celle: (rad) => <span className="text-gray-600">{formaterAnsvarlig(rad)}</span>,
        sorterbar: true,
        sorterVerdi: (rad) => formaterAnsvarlig(rad),
        filtrerbar: true,
        filterAlternativer: dynamiskFilter.ansvarlig,
      },
      opprettetAv: {
        id: "opprettetAv",
        header: "Opprettet av",
        celle: (rad) => rad.creator?.name
          ? <span className="text-gray-600">{rad.creator.name}</span>
          : <span className="text-gray-300">—</span>,
        sorterbar: true,
        sorterVerdi: (rad) => rad.creator?.name ?? "",
        filtrerbar: true,
        filterAlternativer: dynamiskFilter.opprettetAv,
      },
      oppretterEntreprise: {
        id: "oppretterEntreprise",
        header: "Oppretter-entreprise",
        celle: (rad) => <span className="text-xs text-gray-500">{rad.creatorEnterprise.name}</span>,
        sorterbar: true,
        sorterVerdi: (rad) => rad.creatorEnterprise.name,
        filtrerbar: true,
        filterAlternativer: dynamiskFilter.oppretterEntreprise,
      },
      svarerEntreprise: {
        id: "svarerEntreprise",
        header: "Svarer-entreprise",
        celle: (rad) => <span className="text-xs text-gray-500">{rad.responderEnterprise.name}</span>,
        sorterbar: true,
        sorterVerdi: (rad) => rad.responderEnterprise.name,
        filtrerbar: true,
        filterAlternativer: dynamiskFilter.svarerEntreprise,
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
    };

    return aktiveKolonner.map((id) => defs[id]).filter(Boolean);
  }, [aktiveKolonner, dynamiskFilter]);

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
      {(sjekklister?.length ?? 0) > 0 && (
        <div className="mb-3 flex items-center gap-2">
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
                {ALLE_KOLONNER.filter((k) => !k.fast).map((kol) => (
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

          <span className="ml-auto text-xs text-gray-400">
            {filtrerte.length} av {sjekklister?.length ?? 0}
          </span>
        </div>
      )}

      {!sjekklister?.length ? (
        <EmptyState
          title="Ingen sjekklister"
          description="Opprett en sjekkliste basert på en rapportmal."
          action={<Button onClick={() => setVisModal(true)}>Opprett sjekkliste</Button>}
        />
      ) : (
        <Table<SjekklisteRad>
          kolonner={kolonneDefinisjoner}
          data={filtrerte}
          radNokkel={(rad) => rad.id}
          onRadKlikk={(rad) => router.push(`/dashbord/${params.prosjektId}/sjekklister/${rad.id}`)}
          tomMelding="Ingen sjekklister matcher filtrene"
          velgbar
          valgteRader={valgte}
          onValgEndring={setValgte}
          filterVerdier={filterVerdier}
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

      <Modal open={visModal} onClose={() => setVisModal(false)} title="Velg sjekklistemal">
        <div className="space-y-1">
          {sjekklisteMaler.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">Ingen sjekklistemaler tilgjengelig</p>
          ) : (
            sjekklisteMaler.map((m: { id: string; name: string; prefix?: string }) => (
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

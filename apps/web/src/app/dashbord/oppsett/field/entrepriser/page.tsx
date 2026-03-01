"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  Button,
  Input,
  Modal,
  Spinner,
  EmptyState,
  SearchInput,
} from "@siteflow/ui";
import {
  Plus,
  Eye,
  Printer,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Pencil,
  Trash2,
  Workflow as WorkflowIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Fargepalett for entrepriser                                        */
/* ------------------------------------------------------------------ */

const entrepriseFarger = [
  { bg: "bg-blue-600", border: "border-blue-700", tekst: "text-white" },
  { bg: "bg-emerald-600", border: "border-emerald-700", tekst: "text-white" },
  { bg: "bg-purple-600", border: "border-purple-700", tekst: "text-white" },
  { bg: "bg-amber-500", border: "border-amber-600", tekst: "text-white" },
  { bg: "bg-rose-600", border: "border-rose-700", tekst: "text-white" },
  { bg: "bg-teal-600", border: "border-teal-700", tekst: "text-white" },
  { bg: "bg-indigo-600", border: "border-indigo-700", tekst: "text-white" },
  { bg: "bg-orange-600", border: "border-orange-700", tekst: "text-white" },
];

function hentFarge(indeks: number) {
  return entrepriseFarger[indeks % entrepriseFarger.length]!;
}

/* ------------------------------------------------------------------ */
/*  Treprikk-meny (gjenbrukbar)                                       */
/* ------------------------------------------------------------------ */

function TreprikkMeny({
  handlinger,
  className = "",
}: {
  handlinger: Array<{
    label: string;
    ikon: React.ReactNode;
    onClick: () => void;
    fare?: boolean;
  }>;
  className?: string;
}) {
  const [apen, setApen] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setApen(!apen);
        }}
        className="rounded p-1 text-gray-400 hover:bg-black/10 hover:text-gray-600"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {apen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setApen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {handlinger.map((h) => (
              <button
                key={h.label}
                onClick={() => {
                  setApen(false);
                  h.onClick();
                }}
                className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm ${
                  h.fare
                    ? "text-red-600 hover:bg-red-50"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {h.ikon}
                {h.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Arbeidsforløp-rad                                                  */
/* ------------------------------------------------------------------ */

interface ArbeidsforlopData {
  id: string;
  name: string;
  templates: Array<{
    template: { id: string; name: string; category: string };
  }>;
}

function ArbeidsforlopRad({
  arbeidsforlop,
  entrepriseNavn,
  onRediger: _onRediger,
  onSlett,
}: {
  arbeidsforlop: ArbeidsforlopData;
  entrepriseNavn: string;
  onRediger: (af: ArbeidsforlopData) => void;
  onSlett: (id: string) => void;
}) {
  const [ekspandert, setEkspandert] = useState(false);

  const oppgaveMaler = arbeidsforlop.templates.filter(
    (t) => t.template.category === "oppgave",
  );
  const sjekklisteMaler = arbeidsforlop.templates.filter(
    (t) => t.template.category === "sjekkliste",
  );

  const oppsummering = [
    oppgaveMaler.length > 0 ? `Oppgaver: ${oppgaveMaler.length}` : null,
    sjekklisteMaler.length > 0
      ? `Sjekklister: ${sjekklisteMaler.length}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <div className="flex items-center gap-1 py-2 pl-4 pr-2">
        <button
          onClick={() => setEkspandert(!ekspandert)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {ekspandert ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
          <WorkflowIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-800">
            {arbeidsforlop.name}
          </span>
          {oppsummering && (
            <span className="ml-2 text-xs text-gray-400">{oppsummering}</span>
          )}
        </button>

        <TreprikkMeny
          handlinger={[
            {
              label: "Rediger arbeidsforløp",
              ikon: <Pencil className="h-4 w-4 text-gray-400" />,
              onClick: () => _onRediger(arbeidsforlop),
            },
            {
              label: "Slett arbeidsforløp",
              ikon: <Trash2 className="h-4 w-4 text-red-400" />,
              onClick: () => onSlett(arbeidsforlop.id),
              fare: true,
            },
          ]}
        />
      </div>

      {ekspandert && (
        <div className="mb-2 ml-12 mr-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="mb-1 text-xs font-medium text-gray-500">
            Entreprise: {entrepriseNavn}
          </p>
          {oppgaveMaler.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-semibold text-gray-600">Oppgavetyper</p>
              <ul className="mt-1 space-y-0.5">
                {oppgaveMaler.map((t) => (
                  <li key={t.template.id} className="text-xs text-gray-500">
                    {t.template.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {sjekklisteMaler.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600">
                Sjekklistetyper
              </p>
              <ul className="mt-1 space-y-0.5">
                {sjekklisteMaler.map((t) => (
                  <li key={t.template.id} className="text-xs text-gray-500">
                    {t.template.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {arbeidsforlop.templates.length === 0 && (
            <p className="text-xs text-gray-400">Ingen maler tilknyttet</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Entreprise-gruppe                                                  */
/* ------------------------------------------------------------------ */

interface EntrepriseData {
  id: string;
  name: string;
  organizationNumber: string | null;
  fargeIndeks: number;
}

function EntrepriseGruppeKomponent({
  entreprise,
  arbeidsforloper,
  onRedigerEntreprise,
  onSlettEntreprise,
  onLeggTilArbeidsforlop,
  onRedigerArbeidsforlop,
  onSlettArbeidsforlop,
}: {
  entreprise: EntrepriseData;
  arbeidsforloper: ArbeidsforlopData[];
  onRedigerEntreprise: (id: string) => void;
  onSlettEntreprise: (id: string) => void;
  onLeggTilArbeidsforlop: (enterpriseId: string) => void;
  onRedigerArbeidsforlop: (af: ArbeidsforlopData, entrepriseNavn: string) => void;
  onSlettArbeidsforlop: (id: string) => void;
}) {
  const [ekspandert, setEkspandert] = useState(true);
  const farge = hentFarge(entreprise.fargeIndeks);

  return (
    <div className="mb-4">
      {/* Entreprise-header */}
      <div
        className={`flex items-center rounded-t-lg ${farge.bg} ${farge.border} border`}
      >
        <button
          onClick={() => setEkspandert(!ekspandert)}
          className="flex flex-1 items-center gap-2 px-4 py-2.5 text-left"
        >
          {ekspandert ? (
            <ChevronDown className={`h-4 w-4 ${farge.tekst}`} />
          ) : (
            <ChevronRight className={`h-4 w-4 ${farge.tekst}`} />
          )}
          <span className={`text-sm font-semibold ${farge.tekst}`}>
            {entreprise.name}
          </span>
        </button>

        <div className="mr-2">
          <TreprikkMeny
            className={`[&_button]:${farge.tekst} [&>button]:text-white [&>button]:hover:bg-white/20`}
            handlinger={[
              {
                label: "Legg til arbeidsforløp",
                ikon: <Plus className="h-4 w-4 text-gray-400" />,
                onClick: () => onLeggTilArbeidsforlop(entreprise.id),
              },
              {
                label: "Rediger entreprise",
                ikon: <Pencil className="h-4 w-4 text-gray-400" />,
                onClick: () => onRedigerEntreprise(entreprise.id),
              },
              {
                label: "Slett entreprise",
                ikon: <Trash2 className="h-4 w-4 text-red-400" />,
                onClick: () => onSlettEntreprise(entreprise.id),
                fare: true,
              },
            ]}
          />
        </div>
      </div>

      {ekspandert && (
        <div
          className={`rounded-b-lg border border-t-0 ${farge.border} bg-white py-1`}
        >
          {arbeidsforloper.length > 0 ? (
            arbeidsforloper.map((af) => (
              <ArbeidsforlopRad
                key={af.id}
                arbeidsforlop={af}
                entrepriseNavn={entreprise.name}
                onRediger={(data) =>
                  onRedigerArbeidsforlop(data, entreprise.name)
                }
                onSlett={onSlettArbeidsforlop}
              />
            ))
          ) : (
            <p className="px-8 py-4 text-sm text-gray-400">
              Ingen arbeidsforløp konfigurert
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Rediger arbeidsforløp modal                                        */
/* ------------------------------------------------------------------ */

function RedigerArbeidsforlopModal({
  open,
  onClose,
  entrepriseNavn,
  arbeidsforlopId,
  initialNavn,
  initialTemplateIds,
  maler,
  erLagrer,
  onLagre,
}: {
  open: boolean;
  onClose: () => void;
  entrepriseNavn: string;
  arbeidsforlopId: string | null;
  initialNavn: string;
  initialTemplateIds: string[];
  maler: Array<{ id: string; name: string; category: string }>;
  erLagrer: boolean;
  onLagre: (data: { navn: string; templateIds: string[] }) => void;
}) {
  const [navn, setNavn] = useState(initialNavn);
  const [valgte, setValgte] = useState<Set<string>>(
    new Set(initialTemplateIds),
  );

  // Synkroniser ved åpning
  const [forrigeOpen, setForrigeOpen] = useState(false);
  if (open && !forrigeOpen) {
    setNavn(initialNavn);
    setValgte(new Set(initialTemplateIds));
  }
  if (open !== forrigeOpen) setForrigeOpen(open);

  const oppgaveMaler = maler.filter((m) => m.category === "oppgave");
  const sjekklisteMaler = maler.filter((m) => m.category === "sjekkliste");

  function toggleMal(id: string) {
    setValgte((prev) => {
      const neste = new Set(prev);
      if (neste.has(id)) {
        neste.delete(id);
      } else {
        neste.add(id);
      }
      return neste;
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={arbeidsforlopId ? "Rediger arbeidsforløp" : "Nytt arbeidsforløp"}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!navn.trim()) return;
          onLagre({ navn: navn.trim(), templateIds: Array.from(valgte) });
        }}
        className="flex flex-col gap-4"
      >
        <div className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">Entreprise</span>{" "}
          {entrepriseNavn}
        </div>

        <Input
          label="Navn på arbeidsforløp"
          placeholder="F.eks. Uavhengig Kontroll"
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
          required
        />

        {/* To-kolonne avhukingsliste */}
        <div className="grid grid-cols-2 gap-6">
          {/* Oppgavetyper */}
          <div>
            <label className="mb-2 flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-siteflow-primary accent-siteflow-primary"
                checked={
                  oppgaveMaler.length > 0 &&
                  oppgaveMaler.every((m) => valgte.has(m.id))
                }
                onChange={() => {
                  const alleValgt = oppgaveMaler.every((m) => valgte.has(m.id));
                  setValgte((prev) => {
                    const neste = new Set(prev);
                    for (const m of oppgaveMaler) {
                      if (alleValgt) neste.delete(m.id);
                      else neste.add(m.id);
                    }
                    return neste;
                  });
                }}
              />
              <span className="text-sm font-semibold text-gray-900">
                Oppgavetype
              </span>
            </label>
            <div className="space-y-1.5">
              {oppgaveMaler.map((mal) => (
                <label
                  key={mal.id}
                  className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-siteflow-primary accent-siteflow-primary"
                    checked={valgte.has(mal.id)}
                    onChange={() => toggleMal(mal.id)}
                  />
                  <span className="text-sm text-gray-700">{mal.name}</span>
                </label>
              ))}
              {oppgaveMaler.length === 0 && (
                <p className="text-xs text-gray-400">Ingen oppgavemaler</p>
              )}
            </div>
          </div>

          {/* Sjekklistetyper */}
          <div>
            <label className="mb-2 flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-siteflow-primary accent-siteflow-primary"
                checked={
                  sjekklisteMaler.length > 0 &&
                  sjekklisteMaler.every((m) => valgte.has(m.id))
                }
                onChange={() => {
                  const alleValgt = sjekklisteMaler.every((m) =>
                    valgte.has(m.id),
                  );
                  setValgte((prev) => {
                    const neste = new Set(prev);
                    for (const m of sjekklisteMaler) {
                      if (alleValgt) neste.delete(m.id);
                      else neste.add(m.id);
                    }
                    return neste;
                  });
                }}
              />
              <span className="text-sm font-semibold text-gray-900">
                Sjekklistetype
              </span>
            </label>
            <div className="space-y-1.5">
              {sjekklisteMaler.map((mal) => (
                <label
                  key={mal.id}
                  className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-siteflow-primary accent-siteflow-primary"
                    checked={valgte.has(mal.id)}
                    onChange={() => toggleMal(mal.id)}
                  />
                  <span className="text-sm text-gray-700">{mal.name}</span>
                </label>
              ))}
              {sjekklisteMaler.length === 0 && (
                <p className="text-xs text-gray-400">Ingen sjekklistemaler</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="submit" loading={erLagrer}>
            OK
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Hovedside                                                          */
/* ------------------------------------------------------------------ */

export default function EntrepriserSide() {
  const params = useParams<{ prosjektId: string }>();
  const utils = trpc.useUtils();

  // Søk
  const [sok, setSok] = useState("");

  // Entreprise-modaler
  const [visNyEntrepriseModal, setVisNyEntrepriseModal] = useState(false);
  const [nyEntrepriseNavn, setNyEntrepriseNavn] = useState("");
  const [nyOrgNummer, setNyOrgNummer] = useState("");
  const [redigerEntrepriseId, setRedigerEntrepriseId] = useState<string | null>(null);
  const [redigerNavn, setRedigerNavn] = useState("");
  const [redigerOrgNummer, setRedigerOrgNummer] = useState("");
  const [slettEntrepriseId, setSlettEntrepriseId] = useState<string | null>(null);

  // Arbeidsforløp-modal
  const [afModalOpen, setAfModalOpen] = useState(false);
  const [afEntrepriseId, setAfEntrepriseId] = useState<string | null>(null);
  const [afEntrepriseNavn, setAfEntrepriseNavn] = useState("");
  const [afId, setAfId] = useState<string | null>(null);
  const [afInitialNavn, setAfInitialNavn] = useState("");
  const [afInitialTemplateIds, setAfInitialTemplateIds] = useState<string[]>([]);
  const [slettAfId, setSlettAfId] = useState<string | null>(null);

  // Data
  const { data: entrepriser, isLoading } =
    trpc.entreprise.hentForProsjekt.useQuery(
      { projectId: params.prosjektId! },
      { enabled: !!params.prosjektId },
    );

  const { data: maler } = trpc.mal.hentForProsjekt.useQuery(
    { projectId: params.prosjektId! },
    { enabled: !!params.prosjektId },
  );

  // Hent arbeidsforløp for alle entrepriser
  const entrepriseIds = entrepriser?.map((e) => e.id) ?? [];
  const arbeidsforlopQueries = entrepriseIds.map((eid) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    trpc.arbeidsforlop.hentForEntreprise.useQuery(
      { enterpriseId: eid },
      { enabled: !!eid },
    ),
  );

  // Bygg map: entrepriseId -> arbeidsforløp[]
  const arbeidsforlopMap = new Map<string, ArbeidsforlopData[]>();
  entrepriseIds.forEach((eid, i) => {
    const query = arbeidsforlopQueries[i];
    if (query?.data) {
      arbeidsforlopMap.set(eid, query.data as ArbeidsforlopData[]);
    }
  });

  // Mutasjoner — entreprise
  const opprettEntrepriseMutation = trpc.entreprise.opprett.useMutation({
    onSuccess: () => {
      utils.entreprise.hentForProsjekt.invalidate({ projectId: params.prosjektId! });
      setVisNyEntrepriseModal(false);
      setNyEntrepriseNavn("");
      setNyOrgNummer("");
    },
  });

  const oppdaterEntrepriseMutation = trpc.entreprise.oppdater.useMutation({
    onSuccess: () => {
      utils.entreprise.hentForProsjekt.invalidate({ projectId: params.prosjektId! });
      setRedigerEntrepriseId(null);
    },
  });

  const slettEntrepriseMutation = trpc.entreprise.slett.useMutation({
    onSuccess: () => {
      utils.entreprise.hentForProsjekt.invalidate({ projectId: params.prosjektId! });
      setSlettEntrepriseId(null);
    },
  });

  // Mutasjoner — arbeidsforløp
  const opprettAfMutation = trpc.arbeidsforlop.opprett.useMutation({
    onSuccess: (_d: unknown, vars: { enterpriseId: string }) => {
      utils.arbeidsforlop.hentForEntreprise.invalidate({
        enterpriseId: vars.enterpriseId,
      });
      setAfModalOpen(false);
    },
  });

  const oppdaterAfMutation = trpc.arbeidsforlop.oppdater.useMutation({
    onSuccess: () => {
      // Invalidere alle entreprisers arbeidsforløp
      for (const eid of entrepriseIds) {
        utils.arbeidsforlop.hentForEntreprise.invalidate({ enterpriseId: eid });
      }
      setAfModalOpen(false);
    },
  });

  const slettAfMutation = trpc.arbeidsforlop.slett.useMutation({
    onSuccess: () => {
      for (const eid of entrepriseIds) {
        utils.arbeidsforlop.hentForEntreprise.invalidate({ enterpriseId: eid });
      }
      setSlettAfId(null);
    },
  });

  // Handlinger
  function handleRedigerEntreprise(id: string) {
    const ent = entrepriser?.find((e) => e.id === id);
    if (!ent) return;
    setRedigerEntrepriseId(id);
    setRedigerNavn(ent.name);
    setRedigerOrgNummer(ent.organizationNumber ?? "");
  }

  function handleLeggTilArbeidsforlop(enterpriseId: string) {
    const ent = entrepriser?.find((e) => e.id === enterpriseId);
    setAfEntrepriseId(enterpriseId);
    setAfEntrepriseNavn(ent?.name ?? "");
    setAfId(null);
    setAfInitialNavn("");
    setAfInitialTemplateIds([]);
    setAfModalOpen(true);
  }

  function handleRedigerArbeidsforlop(
    af: ArbeidsforlopData,
    entrepriseNavn: string,
  ) {
    // Finn entrepriseId for dette arbeidsforløpet
    for (const [eid, afs] of arbeidsforlopMap) {
      if (afs.some((a) => a.id === af.id)) {
        setAfEntrepriseId(eid);
        break;
      }
    }
    setAfEntrepriseNavn(entrepriseNavn);
    setAfId(af.id);
    setAfInitialNavn(af.name);
    setAfInitialTemplateIds(af.templates.map((t) => t.template.id));
    setAfModalOpen(true);
  }

  function handleLagreArbeidsforlop(data: {
    navn: string;
    templateIds: string[];
  }) {
    if (afId) {
      oppdaterAfMutation.mutate({
        id: afId,
        name: data.navn,
        templateIds: data.templateIds,
      });
    } else if (afEntrepriseId) {
      opprettAfMutation.mutate({
        enterpriseId: afEntrepriseId,
        name: data.navn,
        templateIds: data.templateIds,
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  // Entreprise-data med fargeindeks
  const entrepriseData: EntrepriseData[] =
    entrepriser?.map((e, i) => ({
      id: e.id,
      name: e.name,
      organizationNumber: e.organizationNumber ?? null,
      fargeIndeks: i,
    })) ?? [];

  // Søkefiltrering
  const filtrert = sok
    ? entrepriseData.filter((e) => {
        const soketekst = sok.toLowerCase();
        if (e.name.toLowerCase().includes(soketekst)) return true;
        const afs = arbeidsforlopMap.get(e.id) ?? [];
        return afs.some((af) => af.name.toLowerCase().includes(soketekst));
      })
    : entrepriseData;

  // Mal-data for modal (id, name, category)
  type MalItem = { id: string; name: string; category: string };
  const malListe: MalItem[] =
    (maler as Array<{ id: string; name: string; category?: string }> | undefined)?.map((m) => ({
      id: m.id,
      name: m.name,
      category: m.category ?? "sjekkliste",
    })) ?? [];

  return (
    <div>
      {/* Verktøylinje */}
      <div className="mb-4 flex items-center gap-3">
        <Button size="sm" onClick={() => setVisNyEntrepriseModal(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Legg til entreprise
        </Button>
        <Button variant="ghost" size="sm">
          <Eye className="mr-1.5 h-4 w-4" />
          Vis detaljer
        </Button>
        <Button variant="ghost" size="sm">
          <Printer className="mr-1.5 h-4 w-4" />
          Skriv ut
        </Button>
      </div>

      {/* Søk */}
      <div className="mb-4 flex items-center gap-3">
        <SearchInput
          verdi={sok}
          onChange={setSok}
          placeholder="Søk"
          className="w-72"
        />
        <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <Plus className="h-3.5 w-3.5" />
          Tilføy filter
        </button>
      </div>

      {/* Kolonne-header */}
      <div className="mb-3 flex items-center gap-0 pl-8">
        <div className="w-[280px]">
          <span className="text-sm font-semibold text-gray-700">Oppretter</span>
        </div>
        <div className="w-[60px]" />
        <div className="w-[280px]">
          <span className="text-sm font-semibold text-gray-700">Svarer</span>
        </div>
      </div>

      {/* Entreprise-grupper */}
      {filtrert.length === 0 ? (
        <EmptyState
          title="Ingen entrepriser"
          description="Legg til entrepriser for å konfigurere dokumentflyt mellom oppretter og svarer."
          action={
            <Button onClick={() => setVisNyEntrepriseModal(true)}>
              Legg til entreprise
            </Button>
          }
        />
      ) : (
        filtrert.map((ent) => (
          <EntrepriseGruppeKomponent
            key={ent.id}
            entreprise={ent}
            arbeidsforloper={arbeidsforlopMap.get(ent.id) ?? []}
            onRedigerEntreprise={handleRedigerEntreprise}
            onSlettEntreprise={setSlettEntrepriseId}
            onLeggTilArbeidsforlop={handleLeggTilArbeidsforlop}
            onRedigerArbeidsforlop={handleRedigerArbeidsforlop}
            onSlettArbeidsforlop={setSlettAfId}
          />
        ))
      )}

      {/* Ny entreprise modal */}
      <Modal
        open={visNyEntrepriseModal}
        onClose={() => setVisNyEntrepriseModal(false)}
        title="Legg til entreprise"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!nyEntrepriseNavn.trim() || !params.prosjektId) return;
            opprettEntrepriseMutation.mutate({
              name: nyEntrepriseNavn.trim(),
              projectId: params.prosjektId,
              organizationNumber: nyOrgNummer.trim() || undefined,
            });
          }}
          className="flex flex-col gap-4"
        >
          <Input
            label="Navn"
            placeholder="F.eks. Elektro AS"
            value={nyEntrepriseNavn}
            onChange={(e) => setNyEntrepriseNavn(e.target.value)}
            required
          />
          <Input
            label="Organisasjonsnummer"
            placeholder="Valgfritt"
            value={nyOrgNummer}
            onChange={(e) => setNyOrgNummer(e.target.value)}
          />
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={opprettEntrepriseMutation.isPending}>
              Opprett
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setVisNyEntrepriseModal(false)}
            >
              Avbryt
            </Button>
          </div>
        </form>
      </Modal>

      {/* Rediger entreprise modal */}
      <Modal
        open={redigerEntrepriseId !== null}
        onClose={() => setRedigerEntrepriseId(null)}
        title="Rediger entreprise"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!redigerEntrepriseId || !redigerNavn.trim()) return;
            oppdaterEntrepriseMutation.mutate({
              id: redigerEntrepriseId,
              name: redigerNavn.trim(),
              organizationNumber: redigerOrgNummer.trim() || undefined,
            });
          }}
          className="flex flex-col gap-4"
        >
          <Input
            label="Navn"
            value={redigerNavn}
            onChange={(e) => setRedigerNavn(e.target.value)}
            required
          />
          <Input
            label="Organisasjonsnummer"
            placeholder="Valgfritt"
            value={redigerOrgNummer}
            onChange={(e) => setRedigerOrgNummer(e.target.value)}
          />
          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              loading={oppdaterEntrepriseMutation.isPending}
            >
              Lagre
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRedigerEntrepriseId(null)}
            >
              Avbryt
            </Button>
          </div>
        </form>
      </Modal>

      {/* Slett entreprise bekreftelse */}
      <Modal
        open={slettEntrepriseId !== null}
        onClose={() => setSlettEntrepriseId(null)}
        title="Slett entreprise"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            Er du sikker på at du vil slette denne entreprisen? Alle tilknyttede
            arbeidsforløp vil også bli fjernet.
          </p>
          <div className="flex gap-3 pt-2">
            <Button
              variant="danger"
              loading={slettEntrepriseMutation.isPending}
              onClick={() => {
                if (!slettEntrepriseId) return;
                slettEntrepriseMutation.mutate({ id: slettEntrepriseId });
              }}
            >
              Slett
            </Button>
            <Button
              variant="secondary"
              onClick={() => setSlettEntrepriseId(null)}
            >
              Avbryt
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rediger/Opprett arbeidsforløp modal */}
      <RedigerArbeidsforlopModal
        open={afModalOpen}
        onClose={() => setAfModalOpen(false)}
        entrepriseNavn={afEntrepriseNavn}
        arbeidsforlopId={afId}
        initialNavn={afInitialNavn}
        initialTemplateIds={afInitialTemplateIds}
        maler={malListe}
        erLagrer={opprettAfMutation.isPending || oppdaterAfMutation.isPending}
        onLagre={handleLagreArbeidsforlop}
      />

      {/* Slett arbeidsforløp bekreftelse */}
      <Modal
        open={slettAfId !== null}
        onClose={() => setSlettAfId(null)}
        title="Slett arbeidsforløp"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            Er du sikker på at du vil slette dette arbeidsforløpet?
          </p>
          <div className="flex gap-3 pt-2">
            <Button
              variant="danger"
              loading={slettAfMutation.isPending}
              onClick={() => {
                if (!slettAfId) return;
                slettAfMutation.mutate({ id: slettAfId });
              }}
            >
              Slett
            </Button>
            <Button
              variant="secondary"
              onClick={() => setSlettAfId(null)}
            >
              Avbryt
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

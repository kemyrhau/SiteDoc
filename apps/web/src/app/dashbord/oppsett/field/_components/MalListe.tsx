"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { Button, Input, Textarea, Modal, Spinner, EmptyState, SearchInput } from "@sitedoc/ui";
import { Plus, Pencil, Trash2, MoreVertical, ChevronDown, Lock, Building2 } from "lucide-react";
import { EntrepriseTilknytningModal } from "./EntrepriseTilknytningModal";

type MalKategori = "oppgave" | "sjekkliste";

interface MalListeProps {
  kategori: MalKategori;
  tittel: string;
  opprettTekst: string;
  tomTittel: string;
  tomBeskrivelse: string;
}

type MalRad = {
  id: string;
  name: string;
  description: string | null;
  prefix: string | null;
  category: string;
  version: number;
  subjects: unknown;
  enableChangeLog: boolean;
  _count: { objects: number; checklists: number };
};

// Dropdown-meny som lukkes ved klikk utenfor
function Dropdown({
  trigger,
  children,
  align = "left",
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div
          className={`absolute top-full z-50 mt-1 min-w-[200px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full px-4 py-2 text-left text-sm transition-colors ${
        disabled
          ? "cursor-not-allowed text-gray-300"
          : "text-gray-700 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

export function MalListe({
  kategori,
  tittel: _tittel,
  opprettTekst,
  tomTittel,
  tomBeskrivelse,
}: MalListeProps) {
  const { prosjektId } = useProsjekt();
  const router = useRouter();
  const utils = trpc.useUtils();

  const [valgtId, setValgtId] = useState<string | null>(null);
  const [sok, setSok] = useState("");
  const [visOpprettModal, setVisOpprettModal] = useState(false);
  const [visRedigerModal, setVisRedigerModal] = useState(false);
  const [visSlettBekreftelse, setVisSlettBekreftelse] = useState(false);

  // Opprett-felter
  const [navn, setNavn] = useState("");
  const [prefiks, setPrefiks] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");
  const [prefiksFeil, setPrefiksFeil] = useState<string | null>(null);
  const [domain, setDomain] = useState<"bygg" | "hms" | "kvalitet">("bygg");
  const [valgteWorkflowIds, setValgteWorkflowIds] = useState<Set<string>>(new Set());
  const [visEntrepriseTilknytning, setVisEntrepriseTilknytning] = useState(false);
  const [aktiverOppretting, _setAktiverOppretting] = useState(true);

  // Rediger-felter
  const [redigerNavn, setRedigerNavn] = useState("");
  const [redigerPrefiks, setRedigerPrefiks] = useState("");
  const [redigerBeskrivelse, setRedigerBeskrivelse] = useState("");
  const [redigerSubjects, setRedigerSubjects] = useState<string[]>([]);
  const [redigerEnableChangeLog, setRedigerEnableChangeLog] = useState(false);

  const { data: alleMaler, isLoading } = trpc.mal.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const opprettMutation = trpc.mal.opprett.useMutation({
    onSuccess: () => {
      utils.mal.hentForProsjekt.invalidate({ projectId: prosjektId! });
      utils.arbeidsforlop.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setVisOpprettModal(false);
      setNavn("");
      setPrefiks("");
      setBeskrivelse("");
      setPrefiksFeil(null);
      setDomain("bygg");
      setValgteWorkflowIds(new Set());
    },
  });

  const oppdaterMutation = trpc.mal.oppdaterMal.useMutation({
    onSuccess: () => {
      utils.mal.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setVisRedigerModal(false);
    },
  });

  const slettMutation = trpc.mal.slettMal.useMutation({
    onSuccess: () => {
      utils.mal.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setVisSlettBekreftelse(false);
      setValgtId(null);
    },
  });

  function handlePrefiksEndring(verdi: string) {
    setPrefiks(verdi);
    if (verdi && /\d$/.test(verdi)) {
      setPrefiksFeil("Prefiks kan ikke avsluttes med et nummer");
    } else {
      setPrefiksFeil(null);
    }
  }

  function handleOpprett(e: React.FormEvent) {
    e.preventDefault();
    if (!navn.trim() || !prosjektId) return;
    if (prefiksFeil) return;
    opprettMutation.mutate({
      projectId: prosjektId,
      name: navn.trim(),
      prefix: prefiks.trim() || undefined,
      description: beskrivelse.trim() || undefined,
      category: kategori,
      domain,
      workflowIds: Array.from(valgteWorkflowIds),
    });
  }

  function handleRediger(e: React.FormEvent) {
    e.preventDefault();
    if (!valgtId || !redigerNavn.trim()) return;
    oppdaterMutation.mutate({
      id: valgtId,
      name: redigerNavn.trim(),
      prefix: redigerPrefiks.trim() || undefined,
      description: redigerBeskrivelse.trim() || undefined,
      subjects: redigerSubjects.filter((s) => s.trim() !== ""),
      enableChangeLog: redigerEnableChangeLog,
    });
  }

  function handleSlett() {
    if (!valgtId) return;
    slettMutation.mutate({ id: valgtId });
  }

  function apneRediger() {
    const mal = maler.find((m) => m.id === valgtId);
    if (!mal) return;
    setRedigerNavn(mal.name);
    setRedigerPrefiks(mal.prefix ?? "");
    setRedigerBeskrivelse(mal.description ?? "");
    const subjects = Array.isArray(mal.subjects) ? (mal.subjects as string[]) : [];
    setRedigerSubjects(subjects);
    setRedigerEnableChangeLog(mal.enableChangeLog);
    setVisRedigerModal(true);
  }

  function handleDobbeltklikk(mal: MalRad) {
    router.push(`/dashbord/oppsett/field/${kategori === "sjekkliste" ? "sjekklistemaler" : "oppgavemaler"}/${mal.id}`);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  // Filtrer på kategori og søk
  const maler = (alleMaler as MalRad[] | undefined)
    ?.filter((m) => m.category === kategori)
    ?.filter((m) => {
      if (!sok.trim()) return true;
      const s = sok.toLowerCase();
      return (
        m.name.toLowerCase().includes(s) ||
        (m.prefix?.toLowerCase().includes(s) ?? false) ||
        (m.description?.toLowerCase().includes(s) ?? false)
      );
    })
    ?.sort((a, b) => a.name.localeCompare(b.name, "nb")) ?? [];

  const valgtMal = maler.find((m) => m.id === valgtId);
  const harValg = !!valgtId;

  return (
    <div className="flex flex-col h-full">
      {/* Verktøylinje */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3 mb-0">
        {/* + Tilføy dropdown */}
        <Dropdown
          trigger={
            <button className="inline-flex items-center gap-1.5 rounded-md bg-[#5a7a2e] px-4 py-2 text-sm font-medium text-white hover:bg-[#4d6926] transition-colors">
              <Plus className="h-4 w-4" />
              Tilføy
              <ChevronDown className="h-3 w-3" />
            </button>
          }
        >
          <DropdownItem onClick={() => setVisOpprettModal(true)}>
            Opprett ny
          </DropdownItem>
          <DropdownItem disabled>Importer fra annet prosjekt</DropdownItem>
          <DropdownItem disabled>Importer fra firma</DropdownItem>
          <DropdownItem disabled>Opprett fra PDF</DropdownItem>
        </Dropdown>

        {/* Rediger */}
        <button
          onClick={apneRediger}
          disabled={!harValg}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
            harValg
              ? "text-gray-600 hover:text-gray-900"
              : "text-gray-300 cursor-not-allowed"
          }`}
        >
          <Pencil className="h-4 w-4" />
          Rediger
        </button>

        {/* Slett */}
        <button
          onClick={() => setVisSlettBekreftelse(true)}
          disabled={!harValg}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
            harValg
              ? "text-gray-600 hover:text-red-600"
              : "text-gray-300 cursor-not-allowed"
          }`}
        >
          <Trash2 className="h-4 w-4" />
          Slett
        </button>

        {/* Mer-meny */}
        <Dropdown
          trigger={
            <button className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
              <MoreVertical className="h-4 w-4" />
              Mer
              <ChevronDown className="h-3 w-3" />
            </button>
          }
        >
          <DropdownItem disabled>Kopier mal</DropdownItem>
          <DropdownItem disabled>Eksporter</DropdownItem>
        </Dropdown>

        {/* Søk */}
        <div className="ml-auto">
          <SearchInput
            verdi={sok}
            onChange={setSok}
            placeholder="Søk..."
            className="w-48"
          />
        </div>
      </div>

      {/* Tabell */}
      {maler.length === 0 && !sok.trim() ? (
        <EmptyState
          title={tomTittel}
          description={tomBeskrivelse}
          action={
            <button
              onClick={() => setVisOpprettModal(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#5a7a2e] px-4 py-2 text-sm font-medium text-white hover:bg-[#4d6926] transition-colors"
            >
              <Plus className="h-4 w-4" />
              {opprettTekst}
            </button>
          }
        />
      ) : maler.length === 0 && sok.trim() ? (
        <div className="py-12 text-center text-sm text-gray-500">
          Ingen maler funnet for &laquo;{sok}&raquo;
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700">
                  Navn
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700 w-[140px]">
                  Prefiks
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700 w-[100px]">
                  Versjon
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {maler.map((mal) => (
                <tr
                  key={mal.id}
                  onClick={() => setValgtId(mal.id === valgtId ? null : mal.id)}
                  onDoubleClick={() => handleDobbeltklikk(mal)}
                  className={`cursor-pointer transition-colors ${
                    mal.id === valgtId
                      ? "bg-blue-50"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <svg
                        className="h-5 w-5 flex-shrink-0 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                        />
                      </svg>
                      <span className="font-medium text-gray-900">
                        {mal.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {mal.prefix ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {mal.version.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bunnlinje: Lås maler */}
      {maler.length > 0 && (
        <div className="border-t border-gray-200 px-4 py-3 mt-auto">
          <button className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <Lock className="h-4 w-4" />
            Klikk for å låse {kategori === "sjekkliste" ? "sjekklistemaler" : "oppgavemaler"}
          </button>
        </div>
      )}

      {/* Opprett-modal */}
      <Modal
        open={visOpprettModal}
        onClose={() => setVisOpprettModal(false)}
        title={opprettTekst}
      >
        <form onSubmit={handleOpprett} className="flex flex-col gap-4">
          <Input
            label="Malnavn"
            placeholder={
              kategori === "oppgave"
                ? "F.eks. Avvik, Befaringsnotat..."
                : "F.eks. Kontrollsjekkliste - Elektro..."
            }
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            required
          />
          <Input
            label="Prefiks"
            placeholder="F.eks. BHO, S-BET, KBO..."
            value={prefiks}
            onChange={(e) => handlePrefiksEndring(e.target.value)}
            error={prefiksFeil ?? undefined}
          />

          {/* Entreprisetilknytning */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Entreprise
            </label>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {valgteWorkflowIds.size === 0
                  ? "Ingen entrepriser er valgt"
                  : `${valgteWorkflowIds.size} arbeidsforløp valgt`}
              </span>
              <button
                type="button"
                onClick={() => setVisEntrepriseTilknytning(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Building2 className="h-3.5 w-3.5" />
                Velg
              </button>
            </div>
          </div>

          {/* Fagområde */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Fagområde
            </label>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value as "bygg" | "hms" | "kvalitet")}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
            >
              <option value="bygg">Bygg</option>
              <option value="hms">HMS</option>
              <option value="kvalitet">Kvalitet</option>
            </select>
          </div>

          {/* Innstillinger */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Innstillinger
            </label>
            <label className="flex items-center gap-2 cursor-not-allowed opacity-60">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={aktiverOppretting}
                disabled
                readOnly
              />
              <span className="text-sm text-gray-500">
                Aktiver oppretting av nye {kategori === "sjekkliste" ? "sjekklister" : "oppgaver"}
              </span>
              <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-400">
                kommer snart
              </span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setVisOpprettModal(false)}
            >
              Avbryt
            </Button>
            <Button type="submit" loading={opprettMutation.isPending} disabled={!!prefiksFeil}>
              OK
            </Button>
          </div>
        </form>
      </Modal>

      {/* Entreprisetilknytning-modal (sekundær, z-60) */}
      {prosjektId && (
        <EntrepriseTilknytningModal
          open={visEntrepriseTilknytning}
          onClose={() => setVisEntrepriseTilknytning(false)}
          prosjektId={prosjektId}
          kategori={kategori}
          valgteWorkflowIds={valgteWorkflowIds}
          onBekreft={(ids) => {
            setValgteWorkflowIds(ids);
            setVisEntrepriseTilknytning(false);
          }}
        />
      )}

      {/* Rediger-modal */}
      <Modal
        open={visRedigerModal}
        onClose={() => setVisRedigerModal(false)}
        title="Rediger mal"
      >
        <form onSubmit={handleRediger} className="flex flex-col gap-4">
          <Input
            label="Malnavn"
            value={redigerNavn}
            onChange={(e) => setRedigerNavn(e.target.value)}
            required
          />
          <Input
            label="Prefiks"
            placeholder="F.eks. BHO, S-BET, KBO..."
            value={redigerPrefiks}
            onChange={(e) => setRedigerPrefiks(e.target.value)}
          />
          <Textarea
            label="Beskrivelse"
            value={redigerBeskrivelse}
            onChange={(e) => setRedigerBeskrivelse(e.target.value)}
          />

          {/* Forhåndsdefinerte emner */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Forhåndsdefinerte emner
            </label>
            <p className="text-xs text-gray-500 mb-1">
              Vises som nedtrekksmeny ved opprettelse av {kategori === "sjekkliste" ? "sjekkliste" : "oppgave"}
            </p>
            <div className="flex flex-col gap-2">
              {redigerSubjects.map((emne, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={emne}
                    onChange={(e) => {
                      const oppdatert = [...redigerSubjects];
                      oppdatert[index] = e.target.value;
                      setRedigerSubjects(oppdatert);
                    }}
                    placeholder="Skriv emne..."
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setRedigerSubjects(redigerSubjects.filter((_, i) => i !== index));
                    }}
                    className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    title="Fjern emne"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRedigerSubjects([...redigerSubjects, ""])}
                className="inline-flex items-center gap-1.5 self-start rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Legg til emne
              </button>
            </div>
          </div>

          {/* Endringslogg (kun for sjekklister) */}
          {kategori === "sjekkliste" && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Innstillinger
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary focus:ring-sitedoc-primary"
                  checked={redigerEnableChangeLog}
                  onChange={(e) => setRedigerEnableChangeLog(e.target.checked)}
                />
                <span className="text-sm text-gray-700">
                  Aktiver automatisk endringslogg
                </span>
              </label>
              <p className="text-xs text-gray-500 ml-6">
                Logger feltendringer med tidsstempel og bruker nederst i sjekklisten
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={oppdaterMutation.isPending}>
              Lagre
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setVisRedigerModal(false)}
            >
              Avbryt
            </Button>
          </div>
        </form>
      </Modal>

      {/* Slett-bekreftelse */}
      <Modal
        open={visSlettBekreftelse}
        onClose={() => setVisSlettBekreftelse(false)}
        title="Slett mal"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            Er du sikker på at du vil slette malen{" "}
            <strong>{valgtMal?.name}</strong>? Denne handlingen kan ikke angres.
          </p>
          <div className="flex gap-3 pt-2">
            <Button
              variant="danger"
              onClick={handleSlett}
              loading={slettMutation.isPending}
            >
              Slett
            </Button>
            <Button
              variant="secondary"
              onClick={() => setVisSlettBekreftelse(false)}
            >
              Avbryt
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

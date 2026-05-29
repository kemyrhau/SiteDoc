"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { Button, Input, Textarea, Modal, Spinner, EmptyState, SearchInput } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, MoreVertical, ChevronDown, Lock, Building2, Library } from "lucide-react";
import { FaggruppeTilknytningModal } from "./FaggruppeTilknytningModal";
import { BibliotekPanel } from "@/components/bibliotek/BibliotekPanel";

type MalKategori = "oppgave" | "sjekkliste";

interface MalListeProps {
  kategori: MalKategori;
  tittel: string;
  opprettTekst: string;
  tomTittel: string;
  tomBeskrivelse: string;
  hjelpInnhold?: React.ReactNode;
}

type HmsSubdomain = "avvik" | "sja" | "ruh";
type HmsSynlighet = "privat" | "apen";

type MalRad = {
  id: string;
  name: string;
  description: string | null;
  prefix: string | null;
  category: string;
  domain: string;
  subdomain: HmsSubdomain | null;
  hmsSynlighet: HmsSynlighet | null;
  version: number;
  subjects: unknown;
  enableChangeLog: boolean;
  _count: { objects: number; checklists: number; tasks: number };
};

// Default-synlighet per subdomain. Bruker kan overstyre manuelt.
function defaultSynlighet(subdomain: HmsSubdomain): HmsSynlighet {
  return subdomain === "sja" ? "apen" : "privat";
}

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
  hjelpInnhold,
}: MalListeProps) {
  const { prosjektId } = useProsjekt();
  const { t } = useTranslation();
  const router = useRouter();
  const utils = trpc.useUtils();

  const [valgtId, setValgtId] = useState<string | null>(null);
  const [sok, setSok] = useState("");
  const [visOpprettModal, setVisOpprettModal] = useState(false);
  const [visRedigerModal, setVisRedigerModal] = useState(false);
  const [visSlettBekreftelse, setVisSlettBekreftelse] = useState(false);
  const [visBibliotek, setVisBibliotek] = useState(false);

  // Opprett-felter
  const [navn, setNavn] = useState("");
  const [prefiks, setPrefiks] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");
  const [prefiksFeil, setPrefiksFeil] = useState<string | null>(null);
  const [erHms, setErHms] = useState(false);
  const [subdomain, setSubdomain] = useState<HmsSubdomain>("avvik");
  const [hmsSynlighet, setHmsSynlighet] = useState<HmsSynlighet>("privat");
  const [valgteWorkflowIds, setValgteWorkflowIds] = useState<Set<string>>(new Set());
  const [visFaggruppeTilknytning, setVisFaggruppeTilknytning] = useState(false);
  const [aktiverOppretting, _setAktiverOppretting] = useState(true);

  // Rediger-felter
  const [redigerNavn, setRedigerNavn] = useState("");
  const [redigerPrefiks, setRedigerPrefiks] = useState("");
  const [redigerBeskrivelse, setRedigerBeskrivelse] = useState("");
  const [redigerSubjects, setRedigerSubjects] = useState<string[]>([]);
  const [redigerEnableChangeLog, setRedigerEnableChangeLog] = useState(false);
  const [redigerWorkflowIds, setRedigerWorkflowIds] = useState<Set<string>>(new Set());
  const [visRedigerFlytModal, setVisRedigerFlytModal] = useState(false);
  const [redigerCategory, setRedigerCategory] = useState<MalKategori>("sjekkliste");
  const [redigerErHms, setRedigerErHms] = useState(false);
  const [redigerOpprinneligErHms, setRedigerOpprinneligErHms] = useState(false);
  const [redigerSubdomain, setRedigerSubdomain] = useState<HmsSubdomain>("avvik");
  const [redigerHmsSynlighet, setRedigerHmsSynlighet] = useState<HmsSynlighet>("privat");
  const [redigerOpprinneligSynlighet, setRedigerOpprinneligSynlighet] = useState<HmsSynlighet | null>(null);

  const { data: alleMaler, isLoading } = trpc.mal.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const { data: moduler } = trpc.modul.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );
  const hmsModulAktiv = moduler?.some(
    (m) => m.moduleSlug === "hms-avvik" && m.status === "aktiv",
  ) ?? false;

  const opprettMutation = trpc.mal.opprett.useMutation({
    onSuccess: () => {
      utils.mal.hentForProsjekt.invalidate({ projectId: prosjektId! });
      utils.dokumentflyt.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setVisOpprettModal(false);
      setNavn("");
      setPrefiks("");
      setBeskrivelse("");
      setPrefiksFeil(null);
      setErHms(false);
      setSubdomain("avvik");
      setHmsSynlighet("privat");
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
    setPrefiksFeil(null);
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
      domain: erHms ? "hms" : "bygg",
      subdomain: erHms ? subdomain : null,
      hmsSynlighet: erHms ? hmsSynlighet : null,
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
      category: redigerCategory,
      domain: redigerErHms ? "hms" : "bygg",
      subdomain: redigerErHms ? redigerSubdomain : null,
      hmsSynlighet: redigerErHms ? redigerHmsSynlighet : null,
      subjects: redigerSubjects.filter((s) => s.trim() !== ""),
      enableChangeLog: redigerEnableChangeLog,
      workflowIds: Array.from(redigerWorkflowIds),
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
    setRedigerCategory(mal.category as MalKategori);
    const erHmsNa = mal.domain === "hms";
    setRedigerErHms(erHmsNa);
    setRedigerOpprinneligErHms(erHmsNa);
    const radSubdomain: HmsSubdomain = (mal.subdomain ?? "avvik");
    const radSynlighet: HmsSynlighet = mal.hmsSynlighet ?? defaultSynlighet(radSubdomain);
    setRedigerSubdomain(radSubdomain);
    setRedigerHmsSynlighet(radSynlighet);
    setRedigerOpprinneligSynlighet(erHmsNa ? radSynlighet : null);
    const koblinger = (mal as { dokumentflytMaler?: Array<{ dokumentflytId: string }> }).dokumentflytMaler ?? [];
    setRedigerWorkflowIds(new Set(koblinger.map((k) => k.dokumentflytId)));
    setVisRedigerModal(true);
  }

  function handleDobbeltklikk(mal: MalRad) {
    router.push(`/dashbord/oppsett/produksjon/${kategori === "sjekkliste" ? "sjekklistemaler" : "oppgavemaler"}/${mal.id}`);
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
              {t("handling.leggTil")}
              <ChevronDown className="h-3 w-3" />
            </button>
          }
        >
          <DropdownItem onClick={() => setVisOpprettModal(true)}>
            {t("maler.opprettNy")}
          </DropdownItem>
          {kategori === "sjekkliste" && (
            <DropdownItem onClick={() => setVisBibliotek(true)}>
              <span className="flex items-center gap-1.5"><Library className="h-3.5 w-3.5" />{t("bibliotek.hentFraBibliotek")}</span>
            </DropdownItem>
          )}
          <DropdownItem disabled>{t("maler.importerFraProsjekt")}</DropdownItem>
          <DropdownItem disabled>{t("maler.importerFraFirma")}</DropdownItem>
          <DropdownItem disabled>{t("maler.opprettFraPdf")}</DropdownItem>
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
          {t("handling.rediger")}
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
          {t("handling.slett")}
        </button>

        {/* Mer-meny */}
        <Dropdown
          trigger={
            <button className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
              <MoreVertical className="h-4 w-4" />
              {t("handling.mer")}
              <ChevronDown className="h-3 w-3" />
            </button>
          }
        >
          <DropdownItem disabled>{t("maler.kopierMal")}</DropdownItem>
          <DropdownItem disabled>{t("handling.eksporter")}</DropdownItem>
        </Dropdown>

        {/* Søk */}
        <div className="ml-auto flex items-center gap-2">
          <SearchInput
            verdi={sok}
            onChange={setSok}
            placeholder={t("handling.soek") + "..."}
            className="w-48"
          />
          {hjelpInnhold}
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
                  {t("tabell.navn")}
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700 w-[120px]">
                  {t("tabell.fagomraade")}
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700 w-[100px]">
                  {t("tabell.antallPunkter")}
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700 w-[140px]">
                  {t("maler.prefiks")}
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700 w-[100px]">
                  {t("maler.versjon")}
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
                    {t(`maler.domain.${mal.domain}`)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {mal._count?.objects ?? 0}
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
            label={t("maler.malnavn")}
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
            label={t("maler.prefiks")}
            placeholder="F.eks. BHO, S-BET, KBO..."
            value={prefiks}
            onChange={(e) => handlePrefiksEndring(e.target.value)}
            error={prefiksFeil ?? undefined}
          />

          {/* Dokumentflyt-kobling */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t("maler.dokumentflyt")}
            </label>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {valgteWorkflowIds.size === 0
                  ? t("maler.ingenDokumentflytValgt")
                  : `${valgteWorkflowIds.size} ${t("maler.dokumentflytValgt")}`}
              </span>
              <button
                type="button"
                onClick={() => setVisFaggruppeTilknytning(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Building2 className="h-3.5 w-3.5" />
                {t("handling.velg")}
              </button>
            </div>
            {valgteWorkflowIds.size === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                {t("maler.ingenDokumentflytAdvarsel")}
              </p>
            )}
          </div>

          {/* Type (låst basert på mal-builder-side) */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t("maler.type.label")}
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 opacity-60 cursor-not-allowed">
                <input
                  type="radio"
                  name="opprett-type"
                  value="oppgave"
                  checked={kategori === "oppgave"}
                  disabled
                  readOnly
                  className="h-4 w-4 text-sitedoc-primary"
                />
                <span className="text-sm text-gray-700">{t("maler.type.oppgave")}</span>
              </label>
              <label className="flex items-center gap-2 opacity-60 cursor-not-allowed">
                <input
                  type="radio"
                  name="opprett-type"
                  value="sjekkliste"
                  checked={kategori === "sjekkliste"}
                  disabled
                  readOnly
                  className="h-4 w-4 text-sitedoc-primary"
                />
                <span className="text-sm text-gray-700">{t("maler.type.sjekkliste")}</span>
              </label>
            </div>
          </div>

          {/* HMS-hake (gated på ProjectModule hms-avvik) */}
          {hmsModulAktiv && (
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary focus:ring-sitedoc-primary"
                  checked={erHms}
                  onChange={(e) => {
                    setErHms(e.target.checked);
                    if (e.target.checked) {
                      setHmsSynlighet(defaultSynlighet(subdomain));
                    }
                  }}
                />
                <span className="text-sm font-medium text-gray-700">
                  {t("maler.hms.hake")}
                </span>
              </label>
              <p className="text-xs text-gray-500 ml-6">
                {t("maler.hms.beskrivelse")}
              </p>
            </div>
          )}

          {/* HMS-subdomain + synlighet (kun når HMS er valgt) */}
          {hmsModulAktiv && erHms && (
            <div className="flex flex-col gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 ml-6">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  {t("hms.subdomain.label")}
                </label>
                <div className="flex gap-4">
                  {(["avvik", "sja", "ruh"] as HmsSubdomain[]).map((sd) => (
                    <label key={sd} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="opprett-subdomain"
                        value={sd}
                        checked={subdomain === sd}
                        onChange={() => {
                          setSubdomain(sd);
                          setHmsSynlighet(defaultSynlighet(sd));
                        }}
                        className="h-4 w-4 text-sitedoc-primary"
                      />
                      <span className="text-sm text-gray-700">
                        {t(`hms.subdomain.${sd}`)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  {t("hms.synlighet.label")}
                </label>
                <div className="flex gap-4">
                  {(["privat", "apen"] as HmsSynlighet[]).map((v) => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="opprett-synlighet"
                        value={v}
                        checked={hmsSynlighet === v}
                        onChange={() => setHmsSynlighet(v)}
                        className="h-4 w-4 text-sitedoc-primary"
                      />
                      <span className="text-sm text-gray-700">
                        {t(`hms.synlighet.${v}`)}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  {hmsSynlighet === "privat"
                    ? t("hms.synlighet.privatBeskrivelse")
                    : t("hms.synlighet.apenBeskrivelse")}
                </p>
              </div>
            </div>
          )}

          {/* Innstillinger */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t("nav.innstillinger")}
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
                {t("produksjon.kommerSnart")}
              </span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setVisOpprettModal(false)}
            >
              {t("handling.avbryt")}
            </Button>
            <Button type="submit" loading={opprettMutation.isPending} disabled={!!prefiksFeil}>
              {t("handling.ok")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Dokumentflyt-velger for opprett-modal */}
      {prosjektId && (
        <FaggruppeTilknytningModal
          open={visFaggruppeTilknytning}
          onClose={() => setVisFaggruppeTilknytning(false)}
          prosjektId={prosjektId}
          kategori={kategori}
          valgteWorkflowIds={valgteWorkflowIds}
          onBekreft={(ids) => {
            setValgteWorkflowIds(ids);
            setVisFaggruppeTilknytning(false);
          }}
        />
      )}

      {/* Dokumentflyt-velger for rediger-modal */}
      {prosjektId && (
        <FaggruppeTilknytningModal
          open={visRedigerFlytModal}
          onClose={() => setVisRedigerFlytModal(false)}
          prosjektId={prosjektId}
          kategori={kategori}
          valgteWorkflowIds={redigerWorkflowIds}
          onBekreft={(ids) => {
            setRedigerWorkflowIds(ids);
            setVisRedigerFlytModal(false);
          }}
        />
      )}

      {/* Rediger-modal */}
      <Modal
        open={visRedigerModal}
        onClose={() => setVisRedigerModal(false)}
        title={t("maler.redigerMal")}
      >
        <form onSubmit={handleRediger} className="flex flex-col gap-4">
          <Input
            label={t("maler.malnavn")}
            value={redigerNavn}
            onChange={(e) => setRedigerNavn(e.target.value)}
            required
          />
          <Input
            label={t("maler.prefiks")}
            placeholder="F.eks. BHO, S-BET, KBO..."
            value={redigerPrefiks}
            onChange={(e) => setRedigerPrefiks(e.target.value)}
          />
          <Textarea
            label={t("tabell.beskrivelse")}
            value={redigerBeskrivelse}
            onChange={(e) => setRedigerBeskrivelse(e.target.value)}
          />

          {/* Type (redigerbar — låst hvis dokumenter eksisterer) */}
          {(() => {
            const harDokumenter =
              (valgtMal?._count?.checklists ?? 0) + (valgtMal?._count?.tasks ?? 0) > 0;
            return (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  {t("maler.type.label")}
                </label>
                <div className="flex gap-4">
                  <label
                    className={`flex items-center gap-2 ${
                      harDokumenter ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                    }`}
                  >
                    <input
                      type="radio"
                      name="rediger-type"
                      value="oppgave"
                      checked={redigerCategory === "oppgave"}
                      disabled={harDokumenter}
                      onChange={() => setRedigerCategory("oppgave")}
                      className="h-4 w-4 text-sitedoc-primary"
                    />
                    <span className="text-sm text-gray-700">{t("maler.type.oppgave")}</span>
                  </label>
                  <label
                    className={`flex items-center gap-2 ${
                      harDokumenter ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                    }`}
                  >
                    <input
                      type="radio"
                      name="rediger-type"
                      value="sjekkliste"
                      checked={redigerCategory === "sjekkliste"}
                      disabled={harDokumenter}
                      onChange={() => setRedigerCategory("sjekkliste")}
                      className="h-4 w-4 text-sitedoc-primary"
                    />
                    <span className="text-sm text-gray-700">{t("maler.type.sjekkliste")}</span>
                  </label>
                </div>
                {harDokumenter && (
                  <p className="mt-1 text-xs text-gray-500">
                    {t("maler.feilKonvertering", {
                      antall: (valgtMal?._count?.checklists ?? 0) + (valgtMal?._count?.tasks ?? 0),
                      defaultValue:
                        "Kan ikke endre type — det finnes eksisterende dokumenter knyttet til denne malen.",
                    })}
                  </p>
                )}
              </div>
            );
          })()}

          {/* HMS-hake (redigerbar) — vises alltid i rediger-modal slik at
              eksisterende ikke-HMS-mal kan konverteres uten at HMS-modulen
              må aktiveres på prosjektet først. Server blokkerer domain-skift
              hvis dokumenter finnes. */}
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary focus:ring-sitedoc-primary"
                checked={redigerErHms}
                onChange={(e) => {
                  setRedigerErHms(e.target.checked);
                  if (e.target.checked && redigerOpprinneligSynlighet === null) {
                    setRedigerHmsSynlighet(defaultSynlighet(redigerSubdomain));
                  }
                }}
              />
              <span className="text-sm font-medium text-gray-700">
                {t("maler.hms.hake")}
              </span>
            </label>
            <p className="text-xs text-gray-500 ml-6">
              {t("maler.hms.beskrivelse")}
            </p>
            {redigerErHms !== redigerOpprinneligErHms && (
              <p className="mt-1 text-xs text-amber-600 ml-6">
                {t("maler.hms.endringAdvarsel")}
              </p>
            )}
          </div>

          {/* HMS-subdomain + synlighet i rediger-modus */}
          {redigerErHms && (
            <div className="flex flex-col gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 ml-6">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  {t("hms.subdomain.label")}
                </label>
                <div className="flex gap-4">
                  {(["avvik", "sja", "ruh"] as HmsSubdomain[]).map((sd) => (
                    <label key={sd} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="rediger-subdomain"
                        value={sd}
                        checked={redigerSubdomain === sd}
                        onChange={() => {
                          setRedigerSubdomain(sd);
                          if (redigerOpprinneligSynlighet === null) {
                            setRedigerHmsSynlighet(defaultSynlighet(sd));
                          }
                        }}
                        className="h-4 w-4 text-sitedoc-primary"
                      />
                      <span className="text-sm text-gray-700">
                        {t(`hms.subdomain.${sd}`)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  {t("hms.synlighet.label")}
                </label>
                <div className="flex gap-4">
                  {(["privat", "apen"] as HmsSynlighet[]).map((v) => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="rediger-synlighet"
                        value={v}
                        checked={redigerHmsSynlighet === v}
                        onChange={() => setRedigerHmsSynlighet(v)}
                        className="h-4 w-4 text-sitedoc-primary"
                      />
                      <span className="text-sm text-gray-700">
                        {t(`hms.synlighet.${v}`)}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  {redigerHmsSynlighet === "privat"
                    ? t("hms.synlighet.privatBeskrivelse")
                    : t("hms.synlighet.apenBeskrivelse")}
                </p>
                {redigerOpprinneligSynlighet !== null
                  && redigerHmsSynlighet !== redigerOpprinneligSynlighet && (
                  <p className="mt-1 text-xs text-amber-600">
                    {t("hms.synlighet.endringAdvarsel")}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Dokumentflyt-kobling */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t("maler.dokumentflyt")}
            </label>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {redigerWorkflowIds.size === 0
                  ? t("maler.ingenDokumentflytValgt")
                  : `${redigerWorkflowIds.size} ${t("maler.dokumentflytValgt")}`}
              </span>
              <button
                type="button"
                onClick={() => setVisRedigerFlytModal(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Building2 className="h-3.5 w-3.5" />
                {t("handling.velg")}
              </button>
            </div>
            {redigerWorkflowIds.size === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                {t("maler.ingenDokumentflytAdvarsel")}
              </p>
            )}
          </div>

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
                {t("maler.leggTilEmne")}
              </button>
            </div>
          </div>

          {/* Endringslogg — gjelder både oppgave- og sjekkliste-maler */}
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
              Logger feltendringer med tidsstempel og bruker
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={oppdaterMutation.isPending}>
              {t("handling.lagre")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setVisRedigerModal(false)}
            >
              {t("handling.avbryt")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Slett-bekreftelse */}
      <Modal
        open={visSlettBekreftelse}
        onClose={() => setVisSlettBekreftelse(false)}
        title={t("maler.slettMal")}
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
              {t("handling.slett")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setVisSlettBekreftelse(false)}
            >
              {t("handling.avbryt")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bibliotek-panel */}
      {kategori === "sjekkliste" && prosjektId && (
        <BibliotekPanel
          projectId={prosjektId}
          open={visBibliotek}
          onClose={() => setVisBibliotek(false)}
          onImportert={() => utils.mal.hentForProsjekt.invalidate({ projectId: prosjektId })}
        />
      )}
    </div>
  );
}

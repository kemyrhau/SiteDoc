"use client";

import { useState } from "react";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import {
  Button,
  Input,
  Select,
  Modal,
  Spinner,
  EmptyState,
  SearchInput,
} from "@sitedoc/ui";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Pencil,
  Trash2,
  Building2,
  FileText,
} from "lucide-react";
import { ENTERPRISE_INDUSTRIES, ENTERPRISE_COLORS } from "@sitedoc/shared";
import {
  hentFargeForEntreprise,
  nesteAutoFarge,
  FARGE_MAP,
} from "../_components/entreprise-farger";
import {
  DokumentflytInlineKort,
  InviterNyMedlemModal,
  type DokumentflytData,
  type EntrepriseItem,
  type ProsjektMedlemItem,
} from "../_components/dokumentflyt-komponenter";

/* ------------------------------------------------------------------ */
/*  Fargevelger                                                        */
/* ------------------------------------------------------------------ */

function FargeVelger({
  valgt,
  onChange,
}: {
  valgt: string;
  onChange: (farge: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ENTERPRISE_COLORS.map((farge) => {
        const fargeData = FARGE_MAP[farge];
        return (
          <button
            key={farge}
            type="button"
            onClick={() => onChange(farge)}
            className={`h-6 w-6 rounded-full ${fargeData?.bg ?? "bg-gray-400"} ${
              valgt === farge ? "ring-2 ring-offset-2 ring-gray-400" : ""
            }`}
            title={farge}
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Treprikk-meny                                                      */
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
/*  Typer                                                              */
/* ------------------------------------------------------------------ */

interface EntrepriseData {
  id: string;
  name: string;
  enterpriseNumber: string | null;
  organizationNumber: string | null;
  color: string | null;
  industry: string | null;
  companyName: string | null;
  fargeIndeks: number;
}

/* ------------------------------------------------------------------ */
/*  EntrepriseKort — expanderbart med dokumentflyter                    */
/* ------------------------------------------------------------------ */

function EntrepriseKort({
  entreprise,
  dokumentflyter,
  prosjektId,
  entrepriseListe,
  medlemmer,
  onRediger,
  onSlett,
  onDfRediger,
  onDfSlett,
  onDfOppdatert,
  onNyDokumentflyt,
  onInviterNy,
}: {
  entreprise: EntrepriseData;
  dokumentflyter: DokumentflytData[];
  prosjektId: string;
  entrepriseListe: EntrepriseItem[];
  medlemmer: ProsjektMedlemItem[];
  onRediger: () => void;
  onSlett: () => void;
  onDfRediger: (df: DokumentflytData) => void;
  onDfSlett: (id: string) => void;
  onDfOppdatert: () => void;
  onNyDokumentflyt: (entrepriseId: string) => void;
  onInviterNy: (dokumentflytId: string, rolle: "oppretter" | "svarer", steg: number) => void;
}) {
  const [ekspandert, setEkspandert] = useState(true);
  const farge = hentFargeForEntreprise(entreprise.color, entreprise.fargeIndeks);

  const headerTekst = [
    entreprise.enterpriseNumber,
    entreprise.name,
  ].filter(Boolean).join(" ")
    + (entreprise.companyName ? `, ${entreprise.companyName}` : "");

  return (
    <div className="mb-3 rounded-lg border border-gray-200 bg-white">
      {/* Enterprise header */}
      <div className={`flex items-center rounded-t-lg ${farge.bg} ${farge.border} border`}>
        <button
          onClick={() => setEkspandert(!ekspandert)}
          className="flex flex-1 items-center gap-2 px-4 py-2.5"
        >
          {ekspandert ? (
            <ChevronDown className={`h-4 w-4 ${farge.tekst}`} />
          ) : (
            <ChevronRight className={`h-4 w-4 ${farge.tekst}`} />
          )}
          <Building2 className={`h-4 w-4 ${farge.tekst}`} />
          <span className={`text-sm font-semibold ${farge.tekst}`}>
            {headerTekst}
          </span>
          {entreprise.industry && (
            <span className={`text-xs ${farge.tekst} opacity-70`}>
              · {entreprise.industry}
            </span>
          )}
          {entreprise.organizationNumber && (
            <span className={`text-xs ${farge.tekst} opacity-50`}>
              · Org. {entreprise.organizationNumber}
            </span>
          )}
          <span className={`ml-1 text-xs ${farge.tekst} opacity-60`}>
            ({dokumentflyter.length} dokumentflyt{dokumentflyter.length !== 1 ? "er" : ""})
          </span>
        </button>

        <div className="mr-2">
          <TreprikkMeny
            className="[&>button]:text-white [&>button]:hover:bg-white/20"
            handlinger={[
              {
                label: "Rediger entreprise",
                ikon: <Pencil className="h-4 w-4 text-gray-400" />,
                onClick: onRediger,
              },
              {
                label: "Ny dokumentflyt",
                ikon: <FileText className="h-4 w-4 text-gray-400" />,
                onClick: () => onNyDokumentflyt(entreprise.id),
              },
              {
                label: "Slett entreprise",
                ikon: <Trash2 className="h-4 w-4 text-red-400" />,
                onClick: onSlett,
                fare: true,
              },
            ]}
          />
        </div>
      </div>

      {/* Dokumentflyter */}
      {ekspandert && (
        <div className="p-3">
          {dokumentflyter.length === 0 ? (
            <div className="flex items-center justify-between rounded-md border border-dashed border-gray-200 px-4 py-3">
              <span className="text-sm text-gray-400">Ingen dokumentflyter</span>
              <button
                onClick={() => onNyDokumentflyt(entreprise.id)}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-sitedoc-primary hover:bg-blue-50"
              >
                <Plus className="h-3 w-3" />
                Legg til
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {dokumentflyter.map((df) => (
                <DokumentflytInlineKort
                  key={df.id}
                  dokumentflyt={df}
                  prosjektId={prosjektId}
                  entrepriser={entrepriseListe}
                  medlemmer={medlemmer}
                  onRediger={() => onDfRediger(df)}
                  onSlett={() => onDfSlett(df.id)}
                  onOppdatert={onDfOppdatert}
                  onInviterNy={onInviterNy}
                />
              ))}
              <button
                onClick={() => onNyDokumentflyt(entreprise.id)}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              >
                <Plus className="h-3 w-3" />
                Ny dokumentflyt
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EntrepriseVeiviser                                                 */
/* ------------------------------------------------------------------ */

type VeiviserMetode = "kopier" | "importer" | "tom";

function EntrepriseVeiviser({
  open,
  onClose,
  prosjektId,
  entrepriser,
  prosjekter,
  onOpprettet,
}: {
  open: boolean;
  onClose: () => void;
  prosjektId: string;
  entrepriser: EntrepriseData[];
  prosjekter: Array<{ id: string; name: string; projectNumber: string }>;
  onOpprettet: () => void;
}) {
  const [steg, setSteg] = useState(1);
  const [metode, setMetode] = useState<VeiviserMetode>("tom");

  const [kopierEntrepriseId, setKopierEntrepriseId] = useState("");
  const [importProsjektId, setImportProsjektId] = useState("");
  const [importEntrepriseId, setImportEntrepriseId] = useState("");
  const [nyNavn, setNyNavn] = useState("");
  const [nyNummer, setNyNummer] = useState("");
  const [nyBransje, setNyBransje] = useState("");
  const [nyFirma, setNyFirma] = useState("");

  const { data: importEntrepriser } =
    trpc.entreprise.hentForProsjekt.useQuery(
      { projectId: importProsjektId },
      { enabled: !!importProsjektId && metode === "importer" },
    );

  const utils = trpc.useUtils();

  const opprettMutation = trpc.entreprise.opprett.useMutation({
    onSuccess: () => {
      utils.entreprise.hentForProsjekt.invalidate({ projectId: prosjektId });
      onOpprettet();
      lukkOgNullstill();
    },
  });

  const kopierMutation = trpc.entreprise.kopier.useMutation({
    onSuccess: () => {
      utils.entreprise.hentForProsjekt.invalidate({ projectId: prosjektId });
      onOpprettet();
      lukkOgNullstill();
    },
  });

  function lukkOgNullstill() {
    setSteg(1);
    setMetode("tom");
    setKopierEntrepriseId("");
    setImportProsjektId("");
    setImportEntrepriseId("");
    setNyNavn("");
    setNyNummer("");
    setNyBransje("");
    setNyFirma("");
    onClose();
  }

  const erLagrer = opprettMutation.isPending || kopierMutation.isPending;
  const andreProsjekter = prosjekter.filter((p) => p.id !== prosjektId);
  const harAndreProsjekter = andreProsjekter.length > 0;
  const harEntrepriser = entrepriser.length > 0;

  const [forrigeOpen, setForrigeOpen] = useState(false);
  if (open && !forrigeOpen) {
    setSteg(1);
    setMetode("tom");
    setKopierEntrepriseId("");
    setImportProsjektId("");
    setImportEntrepriseId("");
    setNyNavn("");
    setNyNummer("");
    setNyBransje("");
    setNyFirma("");
  }
  if (open !== forrigeOpen) setForrigeOpen(open);

  function handleNeste() {
    if (steg === 1) {
      // Alle metoder går til steg 2 for å sette navn
      setSteg(2);
      return;
    }

    if (steg === 2) {
      if (metode === "kopier" && kopierEntrepriseId && nyNavn.trim()) {
        kopierMutation.mutate({
          sourceEnterpriseId: kopierEntrepriseId,
          targetProjectId: prosjektId,
          name: nyNavn.trim(),
          color: nesteAutoFarge(entrepriser.map((e) => e.color)),
          memberIds: [],
        });
        return;
      }
      if (metode === "importer" && importEntrepriseId && nyNavn.trim()) {
        kopierMutation.mutate({
          sourceEnterpriseId: importEntrepriseId,
          targetProjectId: prosjektId,
          name: nyNavn.trim(),
          color: nesteAutoFarge(entrepriser.map((e) => e.color)),
          memberIds: [],
        });
        return;
      }
      if (metode === "tom" && nyNavn.trim()) {
        opprettMutation.mutate({
          name: nyNavn.trim(),
          projectId: prosjektId,
          enterpriseNumber: nyNummer.trim() || undefined,
          color: nesteAutoFarge(entrepriser.map((e) => e.color)),
          industry: nyBransje.trim() || undefined,
          companyName: nyFirma.trim() || undefined,
          memberIds: [],
        });
        return;
      }
    }
  }

  const kanGaVidere = (() => {
    if (steg === 1) {
      if (metode === "kopier") return !!kopierEntrepriseId;
      if (metode === "importer") return harAndreProsjekter;
      return true;
    }
    if (steg === 2) {
      if (metode === "kopier") return !!nyNavn.trim();
      if (metode === "importer") return !!importEntrepriseId && !!nyNavn.trim();
      if (metode === "tom") return !!nyNavn.trim();
    }
    return false;
  })();

  const knappTekst = (() => {
    if (steg === 2 && metode === "kopier") return "Kopier";
    if (steg === 2 && metode === "importer") return "Importer";
    if (steg === 2 && metode === "tom") return "Opprett";
    return "Neste";
  })();

  return (
    <Modal open={open} onClose={lukkOgNullstill} title="Legg til entreprise">
      <div className="flex flex-col gap-5">
        {steg === 1 && (
          <>
            <p className="text-sm text-gray-600">
              Velg hvordan du vil legge til en entreprise:
            </p>
            <div className="flex flex-col gap-2">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                  metode === "kopier" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                } ${!harEntrepriser ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <input
                  type="radio"
                  name="metode"
                  value="kopier"
                  checked={metode === "kopier"}
                  onChange={() => setMetode("kopier")}
                  disabled={!harEntrepriser}
                  className="mt-0.5 accent-sitedoc-primary"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900">
                    Kopier fra nåværende prosjekt
                  </span>
                  {metode === "kopier" && harEntrepriser && (
                    <div className="mt-2">
                      <Select
                        options={[
                          { value: "", label: "Velg entreprise..." },
                          ...entrepriser.map((e) => ({ value: e.id, label: e.name })),
                        ]}
                        value={kopierEntrepriseId}
                        onChange={(e) => setKopierEntrepriseId(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                  metode === "importer" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                } ${!harAndreProsjekter ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <input
                  type="radio"
                  name="metode"
                  value="importer"
                  checked={metode === "importer"}
                  onChange={() => setMetode("importer")}
                  disabled={!harAndreProsjekter}
                  className="mt-0.5 accent-sitedoc-primary"
                />
                <span className="text-sm font-medium text-gray-900">
                  Importer fra annet prosjekt
                </span>
              </label>

              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                  metode === "tom" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="metode"
                  value="tom"
                  checked={metode === "tom"}
                  onChange={() => setMetode("tom")}
                  className="mt-0.5 accent-sitedoc-primary"
                />
                <span className="text-sm font-medium text-gray-900">
                  Opprett tom entreprise
                </span>
              </label>
            </div>
          </>
        )}

        {steg === 2 && metode === "kopier" && (
          <>
            <p className="text-sm text-gray-500">
              Strukturen fra <strong>{entrepriser.find((e) => e.id === kopierEntrepriseId)?.name}</strong> kopieres. Gi den nye entreprisen et navn:
            </p>
            <Input
              label="Navn på ny entreprise"
              placeholder="F.eks. Tømrer"
              value={nyNavn}
              onChange={(e) => setNyNavn(e.target.value)}
              required
            />
          </>
        )}

        {steg === 2 && metode === "importer" && (
          <>
            <Select
              label="Velg prosjekt"
              options={[
                { value: "", label: "Velg prosjekt..." },
                ...andreProsjekter.map((p) => ({
                  value: p.id,
                  label: `${p.name} (${p.projectNumber})`,
                })),
              ]}
              value={importProsjektId}
              onChange={(e) => {
                setImportProsjektId(e.target.value);
                setImportEntrepriseId("");
              }}
            />
            {importProsjektId && (
              <Select
                label="Velg entreprise å kopiere"
                options={[
                  { value: "", label: "Velg entreprise..." },
                  ...(importEntrepriser?.map((e) => ({
                    value: e.id,
                    label: e.name,
                  })) ?? []),
                ]}
                value={importEntrepriseId}
                onChange={(e) => setImportEntrepriseId(e.target.value)}
              />
            )}
            {importEntrepriseId && (
              <Input
                label="Navn på ny entreprise"
                placeholder="F.eks. Tømrer"
                value={nyNavn}
                onChange={(e) => setNyNavn(e.target.value)}
                required
              />
            )}
          </>
        )}

        {steg === 2 && metode === "tom" && (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Entreprise <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={nyNummer}
                  onChange={(e) => setNyNummer(e.target.value)}
                  placeholder="Nr."
                  className="w-[60px] rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={nyNavn}
                  onChange={(e) => setNyNavn(e.target.value)}
                  placeholder="F.eks. Tømrer"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Bransje</label>
              <input
                list="bransje-liste-ny"
                placeholder="Velg eller skriv inn bransje..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={nyBransje}
                onChange={(e) => setNyBransje(e.target.value)}
              />
              <datalist id="bransje-liste-ny">
                {ENTERPRISE_INDUSTRIES.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
            <Input
              label="Firma"
              placeholder="Firmanavn"
              value={nyFirma}
              onChange={(e) => setNyFirma(e.target.value)}
            />
          </>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={lukkOgNullstill}>
            Avbryt
          </Button>
          {steg > 1 && (
            <Button variant="secondary" type="button" onClick={() => setSteg(1)}>
              Forrige
            </Button>
          )}
          <Button onClick={handleNeste} loading={erLagrer} disabled={!kanGaVidere}>
            {knappTekst}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  OpprettDokumentflytModal                                           */
/* ------------------------------------------------------------------ */

function OpprettDokumentflytModal({
  open,
  onClose,
  prosjektId,
  entrepriser,
  maler,
  forvalgtEntrepriseId,
}: {
  open: boolean;
  onClose: () => void;
  prosjektId: string;
  entrepriser: EntrepriseItem[];
  maler: Array<{ id: string; name: string; category: string }>;
  forvalgtEntrepriseId?: string;
}) {
  const [navn, setNavn] = useState("");
  const [oppretterType, setOppretterType] = useState<"bruker" | "gruppe">("bruker");
  const [oppretterId, setOppretterId] = useState("");
  const [mottakerType, setMottakerType] = useState<"bruker" | "gruppe">("bruker");
  const [mottakerId, setMottakerId] = useState("");
  const [valgteMaler, setValgteMaler] = useState<Set<string>>(new Set());

  // Hent prosjektmedlemmer og grupper for mottaker-velgeren
  const { data: _medlemmer } = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: open },
  );
  const medlemmer = (_medlemmer ?? []) as Array<{ id: string; user: { name: string | null; email: string } }>;

  const { data: _grupper } = trpc.gruppe.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: open },
  );
  const grupper = (_grupper ?? []) as Array<{ id: string; name: string }>;

  const utils = trpc.useUtils();
  const opprettMutation = trpc.dokumentflyt.opprett.useMutation({
    onSuccess: () => {
      utils.dokumentflyt.hentForProsjekt.invalidate({ projectId: prosjektId });
      nullstill();
      onClose();
    },
  });

  function nullstill() {
    setNavn("");
    setOppretterType("bruker");
    setOppretterId("");
    setMottakerType("bruker");
    setMottakerId("");
    setValgteMaler(new Set());
  }

  const [forrigeOpen, setForrigeOpen] = useState(false);
  if (open && !forrigeOpen) {
    nullstill();
  }
  if (open !== forrigeOpen) setForrigeOpen(open);

  const oppgaveMaler = maler.filter((m) => m.category === "oppgave");
  const sjekklisteMaler = maler.filter((m) => m.category === "sjekkliste");

  function toggleMal(id: string) {
    setValgteMaler((prev) => {
      const neste = new Set(prev);
      if (neste.has(id)) neste.delete(id);
      else neste.add(id);
      return neste;
    });
  }

  function handleOpprett(e: React.FormEvent) {
    e.preventDefault();
    if (!navn.trim()) return;

    const dfMedlemmer: Array<{
      enterpriseId?: string;
      projectMemberId?: string;
      rolle: "oppretter" | "svarer";
      steg: number;
    }> = [];

    if (oppretterId) {
      dfMedlemmer.push({
        projectMemberId: oppretterId,
        enterpriseId: forvalgtEntrepriseId,
        rolle: "oppretter",
        steg: 1,
      });
    }
    if (mottakerId) {
      dfMedlemmer.push({
        projectMemberId: mottakerId,
        rolle: "svarer",
        steg: 1,
      });
    }

    opprettMutation.mutate({
      projectId: prosjektId,
      name: navn.trim(),
      templateIds: Array.from(valgteMaler),
      medlemmer: dfMedlemmer,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Ny dokumentflyt">
      <form onSubmit={handleOpprett} className="flex flex-col gap-4">
        <Input
          label="Navn"
          placeholder="F.eks. Byggherre → Bygg"
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
          required
        />

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Opprett/send
          </label>
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              onClick={() => { setOppretterType("bruker"); setOppretterId(""); }}
              className={`rounded-full px-3 py-1 text-xs font-medium ${oppretterType === "bruker" ? "bg-sitedoc-primary text-white" : "bg-gray-100 text-gray-600"}`}
            >
              Bruker
            </button>
            <button
              type="button"
              onClick={() => { setOppretterType("gruppe"); setOppretterId(""); }}
              className={`rounded-full px-3 py-1 text-xs font-medium ${oppretterType === "gruppe" ? "bg-sitedoc-primary text-white" : "bg-gray-100 text-gray-600"}`}
            >
              Gruppe
            </button>
          </div>
          <select
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
            value={oppretterId}
            onChange={(e) => setOppretterId(e.target.value)}
          >
            {oppretterType === "bruker" ? (
              <>
                <option value="">Velg bruker...</option>
                {medlemmer.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.user.name ?? m.user.email}
                  </option>
                ))}
              </>
            ) : (
              <>
                <option value="">Velg gruppe...</option>
                {grupper.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </>
            )}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Mottaker
          </label>
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              onClick={() => { setMottakerType("bruker"); setMottakerId(""); }}
              className={`rounded-full px-3 py-1 text-xs font-medium ${mottakerType === "bruker" ? "bg-sitedoc-primary text-white" : "bg-gray-100 text-gray-600"}`}
            >
              Bruker
            </button>
            <button
              type="button"
              onClick={() => { setMottakerType("gruppe"); setMottakerId(""); }}
              className={`rounded-full px-3 py-1 text-xs font-medium ${mottakerType === "gruppe" ? "bg-sitedoc-primary text-white" : "bg-gray-100 text-gray-600"}`}
            >
              Gruppe
            </button>
          </div>
          <select
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
            value={mottakerId}
            onChange={(e) => setMottakerId(e.target.value)}
          >
            {mottakerType === "bruker" ? (
              <>
                <option value="">Velg bruker...</option>
                {medlemmer.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.user.name ?? m.user.email}
                  </option>
                ))}
              </>
            ) : (
              <>
                <option value="">Velg gruppe...</option>
                {grupper.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </>
            )}
          </select>
        </div>

        {/* Maler */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="mb-2 flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary accent-sitedoc-primary"
                checked={oppgaveMaler.length > 0 && oppgaveMaler.every((m) => valgteMaler.has(m.id))}
                onChange={() => {
                  const alleValgt = oppgaveMaler.every((m) => valgteMaler.has(m.id));
                  setValgteMaler((prev) => {
                    const neste = new Set(prev);
                    for (const m of oppgaveMaler) {
                      if (alleValgt) neste.delete(m.id); else neste.add(m.id);
                    }
                    return neste;
                  });
                }}
              />
              <span className="text-sm font-semibold text-gray-900">Oppgavetype</span>
            </label>
            <div className="space-y-1.5">
              {oppgaveMaler.map((mal) => (
                <label key={mal.id} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary accent-sitedoc-primary"
                    checked={valgteMaler.has(mal.id)}
                    onChange={() => toggleMal(mal.id)}
                  />
                  <span className="text-sm text-gray-700">{mal.name}</span>
                </label>
              ))}
              {oppgaveMaler.length === 0 && <p className="text-xs text-gray-400">Ingen oppgavemaler</p>}
            </div>
          </div>
          <div>
            <label className="mb-2 flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary accent-sitedoc-primary"
                checked={sjekklisteMaler.length > 0 && sjekklisteMaler.every((m) => valgteMaler.has(m.id))}
                onChange={() => {
                  const alleValgt = sjekklisteMaler.every((m) => valgteMaler.has(m.id));
                  setValgteMaler((prev) => {
                    const neste = new Set(prev);
                    for (const m of sjekklisteMaler) {
                      if (alleValgt) neste.delete(m.id); else neste.add(m.id);
                    }
                    return neste;
                  });
                }}
              />
              <span className="text-sm font-semibold text-gray-900">Sjekklistetype</span>
            </label>
            <div className="space-y-1.5">
              {sjekklisteMaler.map((mal) => (
                <label key={mal.id} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary accent-sitedoc-primary"
                    checked={valgteMaler.has(mal.id)}
                    onChange={() => toggleMal(mal.id)}
                  />
                  <span className="text-sm text-gray-700">{mal.name}</span>
                </label>
              ))}
              {sjekklisteMaler.length === 0 && <p className="text-xs text-gray-400">Ingen sjekklistemaler</p>}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="submit" loading={opprettMutation.isPending} disabled={!navn.trim()}>
            Opprett
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  RedigerDokumentflytModal                                           */
/* ------------------------------------------------------------------ */

function RedigerDokumentflytModal({
  open,
  onClose,
  prosjektId,
  dokumentflyt,
  maler,
}: {
  open: boolean;
  onClose: () => void;
  prosjektId: string;
  dokumentflyt: DokumentflytData | null;
  maler: Array<{ id: string; name: string; category: string }>;
}) {
  const [navn, setNavn] = useState("");
  const [valgteMaler, setValgteMaler] = useState<Set<string>>(new Set());

  const utils = trpc.useUtils();
  const oppdaterMutation = trpc.dokumentflyt.oppdater.useMutation({
    onSuccess: () => {
      utils.dokumentflyt.hentForProsjekt.invalidate({ projectId: prosjektId });
      onClose();
    },
  });

  const [forrigeId, setForrigeId] = useState<string | null>(null);
  if (dokumentflyt && dokumentflyt.id !== forrigeId) {
    setForrigeId(dokumentflyt.id);
    setNavn(dokumentflyt.name);
    setValgteMaler(new Set(dokumentflyt.maler.map((m) => m.template.id)));
  }

  const oppgaveMaler = maler.filter((m) => m.category === "oppgave");
  const sjekklisteMaler = maler.filter((m) => m.category === "sjekkliste");

  function toggleMal(id: string) {
    setValgteMaler((prev) => {
      const neste = new Set(prev);
      if (neste.has(id)) neste.delete(id);
      else neste.add(id);
      return neste;
    });
  }

  function handleLagre(e: React.FormEvent) {
    e.preventDefault();
    if (!dokumentflyt || !navn.trim()) return;
    oppdaterMutation.mutate({
      id: dokumentflyt.id,
      projectId: prosjektId,
      name: navn.trim(),
      templateIds: Array.from(valgteMaler),
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Rediger dokumentflyt">
      <form onSubmit={handleLagre} className="flex flex-col gap-4">
        <Input
          label="Navn"
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="mb-2 flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary accent-sitedoc-primary"
                checked={oppgaveMaler.length > 0 && oppgaveMaler.every((m) => valgteMaler.has(m.id))}
                onChange={() => {
                  const alleValgt = oppgaveMaler.every((m) => valgteMaler.has(m.id));
                  setValgteMaler((prev) => {
                    const neste = new Set(prev);
                    for (const m of oppgaveMaler) {
                      if (alleValgt) neste.delete(m.id); else neste.add(m.id);
                    }
                    return neste;
                  });
                }}
              />
              <span className="text-sm font-semibold text-gray-900">Oppgavetype</span>
            </label>
            <div className="space-y-1.5">
              {oppgaveMaler.map((mal) => (
                <label key={mal.id} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary accent-sitedoc-primary"
                    checked={valgteMaler.has(mal.id)}
                    onChange={() => toggleMal(mal.id)}
                  />
                  <span className="text-sm text-gray-700">{mal.name}</span>
                </label>
              ))}
              {oppgaveMaler.length === 0 && <p className="text-xs text-gray-400">Ingen oppgavemaler</p>}
            </div>
          </div>
          <div>
            <label className="mb-2 flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary accent-sitedoc-primary"
                checked={sjekklisteMaler.length > 0 && sjekklisteMaler.every((m) => valgteMaler.has(m.id))}
                onChange={() => {
                  const alleValgt = sjekklisteMaler.every((m) => valgteMaler.has(m.id));
                  setValgteMaler((prev) => {
                    const neste = new Set(prev);
                    for (const m of sjekklisteMaler) {
                      if (alleValgt) neste.delete(m.id); else neste.add(m.id);
                    }
                    return neste;
                  });
                }}
              />
              <span className="text-sm font-semibold text-gray-900">Sjekklistetype</span>
            </label>
            <div className="space-y-1.5">
              {sjekklisteMaler.map((mal) => (
                <label key={mal.id} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary accent-sitedoc-primary"
                    checked={valgteMaler.has(mal.id)}
                    onChange={() => toggleMal(mal.id)}
                  />
                  <span className="text-sm text-gray-700">{mal.name}</span>
                </label>
              ))}
              {sjekklisteMaler.length === 0 && <p className="text-xs text-gray-400">Ingen sjekklistemaler</p>}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="submit" loading={oppdaterMutation.isPending} disabled={!navn.trim()}>
            Lagre
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
  const { prosjektId, prosjekter } = useProsjekt();
  const utils = trpc.useUtils();

  const [sok, setSok] = useState("");
  const [visVeiviser, setVisVeiviser] = useState(false);

  // Entreprise rediger/slett
  const [redigerEntrepriseId, setRedigerEntrepriseId] = useState<string | null>(null);
  const [redigerNavn, setRedigerNavn] = useState("");
  const [redigerNummer, setRedigerNummer] = useState("");
  const [redigerOrgNummer, setRedigerOrgNummer] = useState("");
  const [redigerFarge, setRedigerFarge] = useState("");
  const [redigerBransje, setRedigerBransje] = useState("");
  const [redigerFirma, setRedigerFirma] = useState("");
  const [slettEntrepriseId, setSlettEntrepriseId] = useState<string | null>(null);

  // Dokumentflyt rediger/slett/opprett
  const [redigerDf, setRedigerDf] = useState<DokumentflytData | null>(null);
  const [slettDfId, setSlettDfId] = useState<string | null>(null);
  const [visOpprettDf, setVisOpprettDf] = useState(false);
  const [forvalgtEntrepriseId, setForvalgtEntrepriseId] = useState<string | undefined>();

  // Inviter
  const [inviterInfo, setInviterInfo] = useState<{
    dokumentflytId: string;
    rolle: "oppretter" | "svarer";
    steg: number;
  } | null>(null);

  // Data
  const { data: entrepriser, isLoading: lasterEntrepriser } = trpc.entreprise.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const { data: dokumentflyter, isLoading: lasterDf } = trpc.dokumentflyt.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const { data: maler } = trpc.mal.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const { data: medlemmer } = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const oppdaterEntrepriseMutation = trpc.entreprise.oppdater.useMutation({
    onSuccess: () => {
      utils.entreprise.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setRedigerEntrepriseId(null);
    },
  });

  const slettEntrepriseMutation = trpc.entreprise.slett.useMutation({
    onSuccess: () => {
      utils.entreprise.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setSlettEntrepriseId(null);
    },
  });

  const slettDfMutation = trpc.dokumentflyt.slett.useMutation({
    onSuccess: () => {
      utils.dokumentflyt.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setSlettDfId(null);
    },
  });

  function handleRedigerEntreprise(id: string) {
    const ent = entrepriser?.find((e) => e.id === id);
    if (!ent) return;
    setRedigerEntrepriseId(id);
    setRedigerNavn(ent.name);
    setRedigerNummer(ent.enterpriseNumber ?? "");
    setRedigerOrgNummer(ent.organizationNumber ?? "");
    setRedigerFarge(ent.color ?? "");
    setRedigerBransje(ent.industry ?? "");
    setRedigerFirma(ent.companyName ?? "");
  }

  function handleDfOppdatert() {
    utils.dokumentflyt.hentForProsjekt.invalidate({ projectId: prosjektId! });
  }

  function handleNyDokumentflyt(entrepriseId: string) {
    setForvalgtEntrepriseId(entrepriseId);
    setVisOpprettDf(true);
  }

  const isLoading = lasterEntrepriser || lasterDf;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!prosjektId) return null;

  const entrepriseData: EntrepriseData[] = entrepriser?.map((e, i) => ({
    id: e.id,
    name: e.name,
    enterpriseNumber: e.enterpriseNumber ?? null,
    organizationNumber: e.organizationNumber ?? null,
    color: e.color ?? null,
    industry: e.industry ?? null,
    companyName: e.companyName ?? null,
    fargeIndeks: i,
  })) ?? [];

  const entrepriseListe: EntrepriseItem[] = entrepriseData.map((e) => ({
    id: e.id,
    name: e.name,
    color: e.color,
  }));

  const malListe = (maler ?? []).map((m: { id: string; name: string; category: string }) => ({
    id: m.id,
    name: m.name,
    category: m.category,
  }));

  const medlemListe: ProsjektMedlemItem[] = (medlemmer as ProsjektMedlemItem[] | undefined) ?? [];

  const alleDf = (dokumentflyter ?? []) as DokumentflytData[];

  // Grupper dokumentflyter per entreprise
  // En dokumentflyt tilhører en entreprise hvis den har et medlem (oppretter eller svarer) fra den entreprisen
  const entrepriseIder = new Set(entrepriseData.map((e) => e.id));

  function hentDfForEntreprise(entrepriseId: string): DokumentflytData[] {
    return alleDf.filter((df) =>
      df.medlemmer.some((m) => m.enterprise?.id === entrepriseId),
    );
  }

  // "Felles" — dokumentflyter som involverer ALLE entrepriser, eller ingen spesifikk
  const fellesDf = alleDf.filter((df) => {
    const involverteEntrepriser = new Set(
      df.medlemmer.filter((m) => m.enterprise).map((m) => m.enterprise!.id),
    );
    // Ingen entreprisemedlemmer (kun personmedlemmer) eller alle entrepriser involvert
    if (involverteEntrepriser.size === 0) return true;
    if (involverteEntrepriser.size >= entrepriseIder.size && entrepriseIder.size > 0) {
      // Sjekk at alle entrepriser er involvert
      return Array.from(entrepriseIder).every((id) => involverteEntrepriser.has(id));
    }
    return false;
  });

  const filtrert = sok
    ? entrepriseData.filter((e) => {
        const s = sok.toLowerCase();
        return (
          e.name.toLowerCase().includes(s) ||
          e.companyName?.toLowerCase().includes(s) ||
          e.enterpriseNumber?.toLowerCase().includes(s) ||
          e.industry?.toLowerCase().includes(s)
        );
      })
    : entrepriseData;

  return (
    <div>
      {/* Verktøylinje */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Entrepriser og dokumentflyt</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => { setForvalgtEntrepriseId(undefined); setVisOpprettDf(true); }}>
            <Plus className="mr-1.5 h-4 w-4" />
            Ny dokumentflyt
          </Button>
          <Button size="sm" onClick={() => setVisVeiviser(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Ny entreprise
          </Button>
        </div>
      </div>

      {/* Søk */}
      {entrepriseData.length > 4 && (
        <div className="mb-4">
          <SearchInput
            verdi={sok}
            onChange={setSok}
            placeholder="Søk i entrepriser..."
            className="w-72"
          />
        </div>
      )}

      {/* Entrepriser med dokumentflyter */}
      {filtrert.length === 0 && fellesDf.length === 0 ? (
        <EmptyState
          title="Ingen entrepriser"
          description="Legg til entrepriser med dokumentflyt for å styre godkjenning og kommunikasjon."
          action={
            <Button onClick={() => setVisVeiviser(true)}>
              Legg til entreprise
            </Button>
          }
        />
      ) : (
        <>
          {filtrert.map((ent) => (
            <EntrepriseKort
              key={ent.id}
              entreprise={ent}
              dokumentflyter={hentDfForEntreprise(ent.id)}
              prosjektId={prosjektId}
              entrepriseListe={entrepriseListe}
              medlemmer={medlemListe}
              onRediger={() => handleRedigerEntreprise(ent.id)}
              onSlett={() => setSlettEntrepriseId(ent.id)}
              onDfRediger={setRedigerDf}
              onDfSlett={setSlettDfId}
              onDfOppdatert={handleDfOppdatert}
              onNyDokumentflyt={handleNyDokumentflyt}
              onInviterNy={(dfId, rolle, steg) =>
                setInviterInfo({ dokumentflytId: dfId, rolle, steg })
              }
            />
          ))}

          {/* Felles dokumentflyter */}
          {fellesDf.length > 0 && (
            <div className="mb-3 rounded-lg border border-gray-200 bg-white">
              <div className="flex items-center rounded-t-lg border border-gray-300 bg-gray-100 px-4 py-2.5">
                <Building2 className="mr-2 h-4 w-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-700">
                  Felles
                </span>
                <span className="ml-1 text-xs text-gray-400">
                  ({fellesDf.length} dokumentflyt{fellesDf.length !== 1 ? "er" : ""})
                </span>
              </div>
              <div className="space-y-2 p-3">
                {fellesDf.map((df) => (
                  <DokumentflytInlineKort
                    key={df.id}
                    dokumentflyt={df}
                    prosjektId={prosjektId}
                    entrepriser={entrepriseListe}
                    medlemmer={medlemListe}
                    onRediger={() => setRedigerDf(df)}
                    onSlett={() => setSlettDfId(df.id)}
                    onOppdatert={handleDfOppdatert}
                    onInviterNy={(dfId, rolle, steg) =>
                      setInviterInfo({ dokumentflytId: dfId, rolle, steg })
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modaler */}
      <EntrepriseVeiviser
        open={visVeiviser}
        onClose={() => setVisVeiviser(false)}
        prosjektId={prosjektId}
        entrepriser={entrepriseData}
        prosjekter={prosjekter}
        onOpprettet={() => {}}
      />

      <OpprettDokumentflytModal
        open={visOpprettDf}
        onClose={() => setVisOpprettDf(false)}
        prosjektId={prosjektId}
        entrepriser={entrepriseListe}
        maler={malListe}
        forvalgtEntrepriseId={forvalgtEntrepriseId}
      />

      <RedigerDokumentflytModal
        open={redigerDf !== null}
        onClose={() => setRedigerDf(null)}
        prosjektId={prosjektId}
        dokumentflyt={redigerDf}
        maler={malListe}
      />

      <InviterNyMedlemModal
        open={inviterInfo !== null}
        onClose={() => setInviterInfo(null)}
        prosjektId={prosjektId}
        dokumentflytId={inviterInfo?.dokumentflytId ?? ""}
        rolle={inviterInfo?.rolle ?? "oppretter"}
        steg={inviterInfo?.steg ?? 1}
        onFerdig={() => {
          handleDfOppdatert();
          utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
        }}
      />

      {/* Rediger entreprise */}
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
              enterpriseNumber: redigerNummer.trim() || undefined,
              organizationNumber: redigerOrgNummer.trim() || undefined,
              color: redigerFarge || undefined,
              industry: redigerBransje.trim() || undefined,
              companyName: redigerFirma.trim() || undefined,
            });
          }}
          className="flex flex-col gap-4"
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Entreprise <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-3">
              <FargeVelger valgt={redigerFarge} onChange={setRedigerFarge} />
              <input
                type="text"
                value={redigerNummer}
                onChange={(e) => setRedigerNummer(e.target.value)}
                placeholder="Nr."
                className="w-[60px] rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                type="text"
                value={redigerNavn}
                onChange={(e) => setRedigerNavn(e.target.value)}
                placeholder="Navn"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Bransje</label>
            <input
              list="bransje-liste-rediger"
              placeholder="Velg eller skriv inn bransje..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={redigerBransje}
              onChange={(e) => setRedigerBransje(e.target.value)}
            />
            <datalist id="bransje-liste-rediger">
              {ENTERPRISE_INDUSTRIES.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>

          <Input
            label="Firma"
            placeholder="Firmanavn"
            value={redigerFirma}
            onChange={(e) => setRedigerFirma(e.target.value)}
          />

          <Input
            label="Organisasjonsnummer"
            placeholder="Valgfritt"
            value={redigerOrgNummer}
            onChange={(e) => setRedigerOrgNummer(e.target.value)}
          />

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={oppdaterEntrepriseMutation.isPending}>
              Lagre
            </Button>
            <Button type="button" variant="secondary" onClick={() => setRedigerEntrepriseId(null)}>
              Avbryt
            </Button>
          </div>
        </form>
      </Modal>

      {/* Slett entreprise */}
      <Modal
        open={slettEntrepriseId !== null}
        onClose={() => setSlettEntrepriseId(null)}
        title="Slett entreprise"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            Er du sikker på at du vil slette denne entreprisen og alle tilhørende dokumentflyter?
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
            <Button variant="secondary" onClick={() => setSlettEntrepriseId(null)}>
              Avbryt
            </Button>
          </div>
        </div>
      </Modal>

      {/* Slett dokumentflyt */}
      <Modal
        open={slettDfId !== null}
        onClose={() => setSlettDfId(null)}
        title="Slett dokumentflyt"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            Er du sikker på at du vil slette denne dokumentflyten?
            Eksisterende dokumenter påvirkes ikke.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setSlettDfId(null)}>
              Avbryt
            </Button>
            <Button
              variant="danger"
              loading={slettDfMutation.isPending}
              onClick={() => {
                if (slettDfId) {
                  slettDfMutation.mutate({ id: slettDfId, projectId: prosjektId });
                }
              }}
            >
              Slett
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

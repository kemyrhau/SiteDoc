"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Spinner, EmptyState, Button, Input, Modal } from "@sitedoc/ui";
import { Building2, Plus, Users, FolderKanban, X, Pencil, Plug, Trash2, ChevronDown, ChevronRight } from "lucide-react";

const INTEGRASJON_TYPER = ["proadm", "hr", "gps", "smartdoc"] as const;
type IntegrasjonsType = (typeof INTEGRASJON_TYPER)[number];

const TYPE_LABEL: Record<IntegrasjonsType, string> = {
  proadm: "Proadm",
  hr: "HR-system",
  gps: "GPS",
  smartdoc: "SmartDoc",
};

export default function AdminFirmaer() {
  const utils = trpc.useUtils();
  const { data: organisasjoner, isLoading } =
    trpc.admin.hentAlleOrganisasjoner.useQuery();
  const { data: _alleProsjekter } =
    trpc.admin.hentAlleProsjekter.useQuery();
  const alleProsjekter = _alleProsjekter as { id: string; name: string; projectNumber: string }[] | undefined;
  const { data: standaloneFaggrupper } =
    trpc.admin.hentStandaloneFaggrupper.useQuery();

  const [visOpprett, setVisOpprett] = useState(false);
  const [nyttNavn, setNyttNavn] = useState("");
  const [nyttOrgNr, setNyttOrgNr] = useState("");

  // Rediger firma
  const [redigerOrg, setRedigerOrg] = useState<{ id: string; name: string; organizationNumber: string } | null>(null);
  const [redigertNavn, setRedigertNavn] = useState("");
  const [redigertOrgNr, setRedigertOrgNr] = useState("");

  // Tilknytt prosjekt
  const [tilknyttOrgId, setTilknyttOrgId] = useState<string | null>(null);
  const [valgtProsjektId, setValgtProsjektId] = useState("");

  // Integrasjon
  const [utvidetOrgId, setUtvidetOrgId] = useState<string | null>(null);
  const [integrasjonModal, setIntegrasjonModal] = useState<{
    orgId: string;
    integrasjonId?: string;
    type: IntegrasjonsType;
    url: string;
    apiKey: string;
    aktiv: boolean;
    harEksisterendeNøkkel: boolean;
  } | null>(null);

  const invalidateAll = () => {
    utils.admin.hentAlleOrganisasjoner.invalidate();
    utils.admin.hentAlleProsjekter.invalidate();
    utils.admin.hentStandaloneFaggrupper.invalidate();
  };

  const invalidateIntegrasjon = (orgId: string) => {
    utils.admin.hentIntegrasjonerForOrg.invalidate({ organizationId: orgId });
  };

  const opprettMutasjon = trpc.admin.opprettOrganisasjon.useMutation({
    onSuccess: () => {
      invalidateAll();
      setVisOpprett(false);
      setNyttNavn("");
      setNyttOrgNr("");
    },
  });

  const oppdaterOrgMutasjon = trpc.admin.oppdaterOrganisasjon.useMutation({
    onSuccess: () => {
      invalidateAll();
      setRedigerOrg(null);
    },
  });

  const tilknyttMutasjon = trpc.admin.tilknyttProsjekt.useMutation({
    onSuccess: () => {
      invalidateAll();
      setTilknyttOrgId(null);
      setValgtProsjektId("");
    },
  });

  const fjernMutasjon = trpc.admin.fjernProsjektTilknytning.useMutation({
    onSuccess: () => invalidateAll(),
  });

  const opprettIntMutasjon = trpc.admin.opprettIntegrasjon.useMutation({
    onSuccess: (_data: unknown) => {
      if (integrasjonModal) invalidateIntegrasjon(integrasjonModal.orgId);
      setIntegrasjonModal(null);
    },
  });

  const oppdaterIntMutasjon = trpc.admin.oppdaterIntegrasjon.useMutation({
    onSuccess: (_data: unknown) => {
      if (integrasjonModal) invalidateIntegrasjon(integrasjonModal.orgId);
      setIntegrasjonModal(null);
    },
  });

  const slettIntMutasjon = trpc.admin.slettIntegrasjon.useMutation({
    onSuccess: (_data: unknown, variabler) => {
      // Invaliderer for alle orger (vi vet ikke orgId fra input)
      utils.admin.hentIntegrasjonerForOrg.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  // Finn prosjekter som ikke allerede er tilknyttet valgt org
  const tilknyttedeProsjektIder = new Set(
    organisasjoner?.flatMap((org) => org.projects.map((op) => op.project.id)) ?? [],
  );
  const ledigeProsjekter = alleProsjekter?.filter((p) => !tilknyttedeProsjektIder.has(p.id)) ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Firmaer</h1>
        <Button onClick={() => setVisOpprett(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Opprett firma
        </Button>
      </div>

      {!organisasjoner || organisasjoner.length === 0 ? (
        <EmptyState
          title="Ingen firmaer"
          description="Opprett et firma for å komme i gang."
        />
      ) : (
        <div className="space-y-3">
          {organisasjoner.map((org) => (
            <OrgKort
              key={org.id}
              org={org}
              erUtvidet={utvidetOrgId === org.id}
              onToggleUtvidet={() => setUtvidetOrgId(utvidetOrgId === org.id ? null : org.id)}
              onRediger={() => {
                setRedigerOrg({ id: org.id, name: org.name, organizationNumber: org.organizationNumber ?? "" });
                setRedigertNavn(org.name);
                setRedigertOrgNr(org.organizationNumber ?? "");
              }}
              onTilknyttProsjekt={() => { setTilknyttOrgId(org.id); setValgtProsjektId(""); }}
              onFjernProsjekt={(projectId) => fjernMutasjon.mutate({ organizationId: org.id, projectId })}
              onOpprettIntegrasjon={(type) => setIntegrasjonModal({
                orgId: org.id, type, url: "", apiKey: "", aktiv: true, harEksisterendeNøkkel: false,
              })}
              onRedigerIntegrasjon={(int) => setIntegrasjonModal({
                orgId: org.id,
                integrasjonId: int.id,
                type: int.type as IntegrasjonsType,
                url: int.url ?? "",
                apiKey: "",
                aktiv: int.aktiv,
                harEksisterendeNøkkel: int.harNøkkel,
              })}
              onSlettIntegrasjon={(intId) => slettIntMutasjon.mutate({ id: intId })}
            />
          ))}
        </div>
      )}

      {/* Standalone faggrupper */}
      {standaloneFaggrupper && standaloneFaggrupper.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">Standalone faggrupper (uten firma)</h2>
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
            <div className="space-y-2">
              {standaloneFaggrupper.map((ent) => (
                <div key={ent.id} className="flex items-center justify-between rounded bg-white px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-900">{ent.name}</span>
                    {ent.companyName && (
                      <span className="ml-2 text-gray-400">{ent.companyName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{ent.project.name}</span>
                    <span>{ent.faggruppeKoblinger.length} medl.</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Opprett firma-modal */}
      <Modal
        open={visOpprett}
        onClose={() => setVisOpprett(false)}
        title="Opprett firma"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            opprettMutasjon.mutate({
              name: nyttNavn,
              organizationNumber: nyttOrgNr || undefined,
            });
          }}
          className="space-y-4"
        >
          <Input
            label="Firmanavn"
            value={nyttNavn}
            onChange={(e) => setNyttNavn(e.target.value)}
            required
          />
          <Input
            label="Org.nr (valgfritt)"
            value={nyttOrgNr}
            onChange={(e) => setNyttOrgNr(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setVisOpprett(false)}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={!nyttNavn || opprettMutasjon.isPending}>
              Opprett
            </Button>
          </div>
        </form>
      </Modal>

      {/* Rediger firma-modal */}
      <Modal
        open={!!redigerOrg}
        onClose={() => setRedigerOrg(null)}
        title="Rediger firma"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!redigerOrg) return;
            oppdaterOrgMutasjon.mutate({
              id: redigerOrg.id,
              name: redigertNavn,
              organizationNumber: redigertOrgNr || null,
            });
          }}
          className="space-y-4"
        >
          <Input
            label="Firmanavn"
            value={redigertNavn}
            onChange={(e) => setRedigertNavn(e.target.value)}
            required
          />
          <Input
            label="Org.nr (valgfritt)"
            value={redigertOrgNr}
            onChange={(e) => setRedigertOrgNr(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRedigerOrg(null)}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={!redigertNavn || oppdaterOrgMutasjon.isPending}>
              Lagre
            </Button>
          </div>
        </form>
      </Modal>

      {/* Tilknytt prosjekt-modal */}
      <Modal
        open={!!tilknyttOrgId}
        onClose={() => setTilknyttOrgId(null)}
        title="Tilknytt prosjekt til firma"
      >
        <div className="space-y-4">
          {ledigeProsjekter.length === 0 ? (
            <p className="text-sm text-gray-500">Alle prosjekter er allerede tilknyttet et firma.</p>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Velg prosjekt</label>
              <select
                value={valgtProsjektId}
                onChange={(e) => setValgtProsjektId(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Velg...</option>
                {ledigeProsjekter.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.projectNumber})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTilknyttOrgId(null)}>
              Avbryt
            </Button>
            <Button
              disabled={!valgtProsjektId || tilknyttMutasjon.isPending}
              onClick={() => tilknyttMutasjon.mutate({ organizationId: tilknyttOrgId!, projectId: valgtProsjektId })}
            >
              Tilknytt
            </Button>
          </div>
        </div>
      </Modal>

      {/* Integrasjon-modal (opprett/rediger) */}
      <Modal
        open={!!integrasjonModal}
        onClose={() => setIntegrasjonModal(null)}
        title={integrasjonModal?.integrasjonId ? "Rediger integrasjon" : "Ny integrasjon"}
      >
        {integrasjonModal && (
          <IntegrasjonSkjema
            modal={integrasjonModal}
            onEndre={(felt, verdi) => setIntegrasjonModal({ ...integrasjonModal, [felt]: verdi })}
            onLagre={() => {
              const m = integrasjonModal;
              if (m.integrasjonId) {
                // Oppdater eksisterende
                // apiKey-logikk:
                // - Bruker endret nøkkel → send ny verdi
                // - Bruker lot feltet stå tomt → send undefined (behold eksisterende)
                // - Bruker vil slette nøkkel → feltet er ikke eksponert for sletting i UI
                const apiKey = m.apiKey.length > 0 ? m.apiKey : undefined;
                oppdaterIntMutasjon.mutate({
                  id: m.integrasjonId,
                  url: m.url || null,
                  apiKey,
                  aktiv: m.aktiv,
                });
              } else {
                opprettIntMutasjon.mutate({
                  organizationId: m.orgId,
                  type: m.type,
                  url: m.url || undefined,
                  apiKey: m.apiKey || undefined,
                  aktiv: m.aktiv,
                });
              }
            }}
            erLagrer={opprettIntMutasjon.isPending || oppdaterIntMutasjon.isPending}
            onAvbryt={() => setIntegrasjonModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  OrgKort — et organisasjonskort med brukere, prosjekter, integrasj. */
/* ------------------------------------------------------------------ */

interface IntegrasjonData {
  id: string;
  type: string;
  url: string | null;
  harNøkkel: boolean;
  aktiv: boolean;
  createdAt: string;
  config: unknown;
}

function OrgKort({
  org,
  erUtvidet,
  onToggleUtvidet,
  onRediger,
  onTilknyttProsjekt,
  onFjernProsjekt,
  onOpprettIntegrasjon,
  onRedigerIntegrasjon,
  onSlettIntegrasjon,
}: {
  org: {
    id: string;
    name: string;
    organizationNumber: string | null;
    users: Array<{ id: string; name: string | null; email: string; role: string }>;
    projects: Array<{ project: { id: string; name: string; projectNumber: string } }>;
  };
  erUtvidet: boolean;
  onToggleUtvidet: () => void;
  onRediger: () => void;
  onTilknyttProsjekt: () => void;
  onFjernProsjekt: (projectId: string) => void;
  onOpprettIntegrasjon: (type: IntegrasjonsType) => void;
  onRedigerIntegrasjon: (int: IntegrasjonData) => void;
  onSlettIntegrasjon: (intId: string) => void;
}) {
  const { data: _integrasjoner } = trpc.admin.hentIntegrasjonerForOrg.useQuery(
    { organizationId: org.id },
    { enabled: erUtvidet },
  );
  const integrasjoner = _integrasjoner as IntegrasjonData[] | undefined;

  // Finn typer som ikke er brukt ennå
  const brukteTyper = new Set(integrasjoner?.map((i) => i.type) ?? []);
  const ledigeTyper = INTEGRASJON_TYPER.filter((t) => !brukteTyper.has(t));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
            <Building2 className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{org.name}</h3>
            {org.organizationNumber && (
              <p className="text-xs text-gray-500">
                Org.nr: {org.organizationNumber}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {org.users.length} brukere
          </span>
          <span className="flex items-center gap-1">
            <FolderKanban className="h-4 w-4" />
            {org.projects.length} prosjekter
          </span>
          <button
            onClick={onRediger}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            title="Rediger firma"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Brukere */}
      {org.users.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="mb-1.5 text-xs font-semibold text-gray-600">Brukere</p>
          <div className="flex flex-wrap gap-1.5">
            {org.users.map((u) => (
              <span
                key={u.id}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                  u.role === "company_admin"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {u.name ?? u.email}
                {u.role === "company_admin" && (
                  <span className="text-purple-400">admin</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Prosjekter */}
      <div className="mt-3 border-t border-gray-100 pt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-600">Prosjekter</p>
          <button
            onClick={onTilknyttProsjekt}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-blue-600 transition-colors hover:bg-blue-50"
          >
            <Plus className="h-3 w-3" />
            Tilknytt prosjekt
          </button>
        </div>
        {org.projects.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {org.projects.map((op) => (
              <span
                key={op.project.id}
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
              >
                {op.project.name}
                <span className="text-blue-400">{op.project.projectNumber}</span>
                <button
                  onClick={() => onFjernProsjekt(op.project.id)}
                  className="ml-0.5 rounded-full p-0.5 text-blue-400 hover:bg-blue-100 hover:text-blue-600"
                  title="Fjern fra firma"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">Ingen prosjekter tilknyttet</p>
        )}
      </div>

      {/* Integrasjoner — kollapserbar */}
      <div className="mt-3 border-t border-gray-100 pt-3">
        <button
          onClick={onToggleUtvidet}
          className="flex w-full items-center justify-between text-xs font-semibold text-gray-600"
        >
          <span className="flex items-center gap-1">
            <Plug className="h-3.5 w-3.5" />
            Integrasjoner
            {integrasjoner && integrasjoner.length > 0 && (
              <span className="ml-1 rounded-full bg-gray-100 px-1.5 text-[10px] font-medium text-gray-500">
                {integrasjoner.length}
              </span>
            )}
          </span>
          {erUtvidet ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        {erUtvidet && (
          <div className="mt-2 space-y-1.5">
            {(integrasjoner ?? []).map((int) => (
              <div key={int.id} className="flex items-center justify-between rounded bg-gray-50 px-3 py-1.5 text-xs">
                <div className="flex items-center gap-3">
                  <span className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-[10px] font-medium text-gray-700">
                    {int.type}
                  </span>
                  {int.url && <span className="text-gray-500 truncate max-w-[200px]">{int.url}</span>}
                  <span className={`flex items-center gap-1 ${int.aktiv ? "text-green-600" : "text-gray-400"}`}>
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${int.aktiv ? "bg-green-500" : "bg-gray-300"}`} />
                    {int.aktiv ? "Aktiv" : "Inaktiv"}
                  </span>
                  <span className="text-gray-400">
                    {int.harNøkkel ? "Nøkkel registrert" : "Ingen nøkkel"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onRedigerIntegrasjon(int as IntegrasjonData)}
                    className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                    title="Rediger"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => onSlettIntegrasjon(int.id)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    title="Slett"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}

            {ledigeTyper.length > 0 && (
              <div className="flex gap-1.5 pt-1">
                {ledigeTyper.map((type) => (
                  <button
                    key={type}
                    onClick={() => onOpprettIntegrasjon(type)}
                    className="flex items-center gap-1 rounded border border-dashed border-gray-300 px-2 py-1 text-[11px] text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700"
                  >
                    <Plus className="h-3 w-3" />
                    {TYPE_LABEL[type]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  IntegrasjonSkjema — inne i modal                                    */
/* ------------------------------------------------------------------ */

function IntegrasjonSkjema({
  modal,
  onEndre,
  onLagre,
  erLagrer,
  onAvbryt,
}: {
  modal: {
    integrasjonId?: string;
    type: IntegrasjonsType;
    url: string;
    apiKey: string;
    aktiv: boolean;
    harEksisterendeNøkkel: boolean;
  };
  onEndre: (felt: string, verdi: string | boolean) => void;
  onLagre: () => void;
  erLagrer: boolean;
  onAvbryt: () => void;
}) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onLagre(); }}
      className="space-y-4"
    >
      {/* Type — kun synlig, ikke redigerbar */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
        {modal.integrasjonId ? (
          <p className="rounded bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
            {TYPE_LABEL[modal.type]}
          </p>
        ) : (
          <select
            value={modal.type}
            onChange={(e) => onEndre("type", e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {INTEGRASJON_TYPER.map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
        )}
      </div>

      <Input
        label="URL"
        value={modal.url}
        onChange={(e) => onEndre("url", e.target.value)}
        placeholder="https://..."
      />

      {/* API-nøkkel — alltid tomt ved lasting, viser status */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">API-nøkkel</label>
        <input
          type="password"
          value={modal.apiKey}
          onChange={(e) => onEndre("apiKey", e.target.value)}
          placeholder={modal.harEksisterendeNøkkel ? "Nøkkel registrert — la stå tomt for å beholde" : "Ingen nøkkel registrert"}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          autoComplete="off"
        />
        {modal.harEksisterendeNøkkel && (
          <p className="mt-1 text-[11px] text-gray-400">
            La feltet stå tomt for å beholde eksisterende nøkkel. Skriv inn ny verdi for å erstatte.
          </p>
        )}
      </div>

      {/* Aktiv-toggle */}
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={modal.aktiv}
          onChange={(e) => onEndre("aktiv", e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        Aktiv
      </label>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onAvbryt}>
          Avbryt
        </Button>
        <Button type="submit" disabled={erLagrer}>
          {modal.integrasjonId ? "Lagre" : "Opprett"}
        </Button>
      </div>
    </form>
  );
}

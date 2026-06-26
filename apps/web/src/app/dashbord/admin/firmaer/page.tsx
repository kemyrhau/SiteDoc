"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Spinner, EmptyState, Button, Input, Modal } from "@sitedoc/ui";
import { Building2, Plus, X, Pencil, Plug, Trash2, Truck, Clock, Search, Package } from "lucide-react";
import { HjelpKnapp, HjelpFane } from "@/components/hjelp/HjelpModal";
import { useTranslation } from "react-i18next";

const INTEGRASJON_TYPER = ["proadm", "hr", "gps", "smartdoc", "reginn"] as const;
type IntegrasjonsType = (typeof INTEGRASJON_TYPER)[number];

const TYPE_LABEL: Record<IntegrasjonsType, string> = {
  proadm: "Proadm",
  hr: "HR-system",
  gps: "GPS",
  smartdoc: "SmartDoc",
  reginn: "Reginn MREG",
};

// Smal lokal type bryter generic-kjeden — kun feltene som faktisk brukes
type OrganisasjonRad = {
  id: string;
  name: string;
  organizationNumber: string | null;
  // Steg 1e Fase B: aktiveFirmamoduler erstatter har_*_modul-flagg.
  aktiveFirmamoduler: string[];
  users: Array<{ id: string; name: string | null; email: string; role: string }>;
  projects: Array<{ project: { id: string; name: string; projectNumber: string } }>;
};

interface IntegrasjonData {
  id: string;
  type: string;
  url: string | null;
  harNøkkel: boolean;
  aktiv: boolean;
  createdAt: string;
  config: unknown;
}

export default function AdminFirmaer() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const orgQuery = trpc.admin.hentAlleOrganisasjoner.useQuery();
  const organisasjoner = orgQuery.data as OrganisasjonRad[] | undefined;
  const isLoading = orgQuery.isLoading;
  const { data: _alleProsjekter } = trpc.admin.hentAlleProsjekter.useQuery();
  const alleProsjekter = _alleProsjekter as { id: string; name: string; projectNumber: string }[] | undefined;

  const [visOpprett, setVisOpprett] = useState(false);
  const [nyttNavn, setNyttNavn] = useState("");
  const [nyttOrgNr, setNyttOrgNr] = useState("");

  // Slide-over (detalj-panel for valgt firma)
  const [valgtOrgId, setValgtOrgId] = useState<string | null>(null);
  const valgtOrg = organisasjoner?.find((o) => o.id === valgtOrgId) ?? null;

  // Rediger firma
  const [redigerOrg, setRedigerOrg] = useState<{ id: string; name: string; organizationNumber: string } | null>(null);
  const [redigertNavn, setRedigertNavn] = useState("");
  const [redigertOrgNr, setRedigertOrgNr] = useState("");

  // Tilknytt prosjekt
  const [tilknyttOrgId, setTilknyttOrgId] = useState<string | null>(null);
  const [valgtProsjektId, setValgtProsjektId] = useState("");

  // Integrasjon-modal
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
  };

  const invalidateIntegrasjon = (orgId: string) => {
    utils.admin.hentIntegrasjonerForOrg.invalidate({ organizationId: orgId });
  };

  const [brregFeil, setBrregFeil] = useState<string | null>(null);
  const [opprettFeil, setOpprettFeil] = useState<string | null>(null);
  const nyttOrgNrRenset = nyttOrgNr.replace(/\s/g, "");
  const nyttOrgNrErNiSiffer = /^\d{9}$/.test(nyttOrgNrRenset);
  const brregOppslag = trpc.organisasjon.hentFraBrreg.useQuery(
    { orgnr: nyttOrgNrRenset },
    { enabled: false, retry: false },
  );

  async function hentFraBrreg() {
    setBrregFeil(null);
    const resultat = await brregOppslag.refetch();
    if (resultat.error) {
      setBrregFeil(resultat.error.message);
      return;
    }
    if (resultat.data) {
      setNyttNavn(resultat.data.navn);
    }
  }

  const opprettMutasjon = trpc.admin.opprettOrganisasjon.useMutation({
    onSuccess: () => {
      invalidateAll();
      setVisOpprett(false);
      setNyttNavn("");
      setNyttOrgNr("");
      setOpprettFeil(null);
    },
    onError: (error) => setOpprettFeil(error.message),
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
    onSuccess: () => {
      utils.admin.hentIntegrasjonerForOrg.invalidate();
    },
  });

  // Lukk slide-over på Escape
  useEffect(() => {
    if (!valgtOrgId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setValgtOrgId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [valgtOrgId]);

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
        <h1 className="text-lg font-semibold text-gray-900">
          Firmaer
          {organisasjoner && (
            <span className="ml-2 text-sm font-normal text-gray-400">({organisasjoner.length})</span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          <Button onClick={() => setVisOpprett(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Opprett firma
          </Button>
          <HjelpKnapp>
            <HjelpFane tittel={t("hjelp.firmaer.hvaTittel")}>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">{t("hjelp.firmaer.hva")}</p>
                <div className="space-y-3">
                  <div className="rounded-lg border border-gray-200 px-4 py-3">
                    <h4 className="text-sm font-semibold text-gray-900">{t("hjelp.firmaer.prosjekterTittel")}</h4>
                    <p className="mt-1 text-sm text-gray-600">{t("hjelp.firmaer.prosjekterBeskrivelse")}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 px-4 py-3">
                    <h4 className="text-sm font-semibold text-gray-900">{t("hjelp.firmaer.integrasjonerTittel")}</h4>
                    <p className="mt-1 text-sm text-gray-600">{t("hjelp.firmaer.integrasjonerBeskrivelse")}</p>
                  </div>
                </div>
              </div>
            </HjelpFane>
          </HjelpKnapp>
        </div>
      </div>

      {!organisasjoner || organisasjoner.length === 0 ? (
        <EmptyState title="Ingen firmaer" description="Opprett et firma for å komme i gang." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Firma</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 w-20">Brukere</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 w-24">Prosjekter</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Integrasjoner</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Moduler</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {organisasjoner.map((org) => (
                <FirmaRad
                  key={org.id}
                  org={org}
                  onVelg={() => setValgtOrgId(org.id)}
                  onRediger={(e) => {
                    e.stopPropagation();
                    setRedigerOrg({ id: org.id, name: org.name, organizationNumber: org.organizationNumber ?? "" });
                    setRedigertNavn(org.name);
                    setRedigertOrgNr(org.organizationNumber ?? "");
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-over: detalj-panel for valgt firma */}
      {valgtOrg && (
        <FirmaDetaljSlideOver
          org={valgtOrg}
          onLukk={() => setValgtOrgId(null)}
          onTilknyttProsjekt={() => {
            setTilknyttOrgId(valgtOrg.id);
            setValgtProsjektId("");
          }}
          onFjernProsjekt={(projectId) => fjernMutasjon.mutate({ organizationId: valgtOrg.id, projectId })}
          onOpprettIntegrasjon={(type) =>
            setIntegrasjonModal({
              orgId: valgtOrg.id,
              type,
              url: "",
              apiKey: "",
              aktiv: true,
              harEksisterendeNøkkel: false,
            })
          }
          onRedigerIntegrasjon={(int) =>
            setIntegrasjonModal({
              orgId: valgtOrg.id,
              integrasjonId: int.id,
              type: int.type as IntegrasjonsType,
              url: int.url ?? "",
              apiKey: "",
              aktiv: int.aktiv,
              harEksisterendeNøkkel: int.harNøkkel,
            })
          }
          onSlettIntegrasjon={(intId) => slettIntMutasjon.mutate({ id: intId })}
        />
      )}

      {/* Opprett firma-modal */}
      <Modal open={visOpprett} onClose={() => setVisOpprett(false)} title="Opprett firma">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setOpprettFeil(null);
            opprettMutasjon.mutate({ name: nyttNavn, organizationNumber: nyttOrgNr || undefined });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700">Org.nr (valgfritt)</label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={nyttOrgNr}
                onChange={(e) => {
                  setNyttOrgNr(e.target.value);
                  setBrregFeil(null);
                }}
                placeholder="123 456 789"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={hentFraBrreg}
                disabled={!nyttOrgNrErNiSiffer || brregOppslag.isFetching}
                title={!nyttOrgNrErNiSiffer ? t("brreg.hint") : undefined}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Search className="h-4 w-4" />
                {brregOppslag.isFetching ? t("brreg.henter") : t("brreg.hent")}
              </button>
            </div>
            {brregFeil && <p className="mt-1 text-xs text-red-500">{brregFeil}</p>}
          </div>
          <Input label="Firmanavn" value={nyttNavn} onChange={(e) => setNyttNavn(e.target.value)} required />
          {opprettFeil && <p className="text-xs text-red-500">{opprettFeil}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setVisOpprett(false)}>Avbryt</Button>
            <Button type="submit" disabled={!nyttNavn || opprettMutasjon.isPending}>Opprett</Button>
          </div>
        </form>
      </Modal>

      {/* Rediger firma-modal */}
      <Modal open={!!redigerOrg} onClose={() => setRedigerOrg(null)} title="Rediger firma">
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
          <Input label="Firmanavn" value={redigertNavn} onChange={(e) => setRedigertNavn(e.target.value)} required />
          <Input label="Org.nr (valgfritt)" value={redigertOrgNr} onChange={(e) => setRedigertOrgNr(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRedigerOrg(null)}>Avbryt</Button>
            <Button type="submit" disabled={!redigertNavn || oppdaterOrgMutasjon.isPending}>Lagre</Button>
          </div>
        </form>
      </Modal>

      {/* Tilknytt prosjekt-modal */}
      <Modal open={!!tilknyttOrgId} onClose={() => setTilknyttOrgId(null)} title="Tilknytt prosjekt til firma">
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
                  <option key={p.id} value={p.id}>{p.name} ({p.projectNumber})</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTilknyttOrgId(null)}>Avbryt</Button>
            <Button
              disabled={!valgtProsjektId || tilknyttMutasjon.isPending}
              onClick={() => tilknyttMutasjon.mutate({ organizationId: tilknyttOrgId!, projectId: valgtProsjektId })}
            >
              Tilknytt
            </Button>
          </div>
        </div>
      </Modal>

      {/* Integrasjon-modal */}
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
                const apiKey = m.apiKey.length > 0 ? m.apiKey : undefined;
                oppdaterIntMutasjon.mutate({ id: m.integrasjonId, url: m.url || null, apiKey, aktiv: m.aktiv });
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
/*  ModulPiller — kompakt visning av firmamoduler (timer/maskin/varelager) */
/* ------------------------------------------------------------------ */

const FIRMAMODULER = [
  { slug: "timer", label: "Timer", ikon: Clock },
  { slug: "maskin", label: "Maskin", ikon: Truck },
  { slug: "varelager", label: "Varelager", ikon: Package },
] as const;

function ModulPiller({
  aktiveFirmamoduler,
  storrelse = "sm",
}: {
  aktiveFirmamoduler: string[];
  storrelse?: "xs" | "sm";
}) {
  const klasseAktiv =
    storrelse === "xs"
      ? "inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 ring-1 ring-inset ring-green-200"
      : "inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-200";
  const klasseInaktiv =
    storrelse === "xs"
      ? "inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-400 ring-1 ring-inset ring-gray-200"
      : "inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-400 ring-1 ring-inset ring-gray-200";
  const ikonStr = storrelse === "xs" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <div className="flex flex-wrap gap-1.5">
      {FIRMAMODULER.map(({ slug, label, ikon: Ikon }) => {
        const aktiv = aktiveFirmamoduler.includes(slug);
        return (
          <span
            key={slug}
            className={aktiv ? klasseAktiv : klasseInaktiv}
            title={aktiv ? `${label}-modul aktivert` : `${label}-modul ikke aktivert`}
          >
            <Ikon className={ikonStr} />
            {label}
          </span>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FirmaRad — én rad i kompakt tabell                                 */
/* ------------------------------------------------------------------ */

function FirmaRad({
  org,
  onVelg,
  onRediger,
}: {
  org: OrganisasjonRad;
  onVelg: () => void;
  onRediger: (e: React.MouseEvent) => void;
}) {
  // Hent integrasjoner for denne org for å vise typer i tabell-raden
  const intQuery = trpc.admin.hentIntegrasjonerForOrg.useQuery({ organizationId: org.id });
  const integrasjoner = intQuery.data as IntegrasjonData[] | undefined;
  const aktiveTyper = (integrasjoner ?? []).filter((i) => i.aktiv).map((i) => i.type);

  return (
    <tr
      className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50"
      onClick={onVelg}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-purple-100">
            <Building2 className="h-4 w-4 text-purple-600" />
          </div>
          <div>
            <div className="font-medium text-gray-900">{org.name}</div>
            {org.organizationNumber && (
              <div className="text-xs text-gray-400">Org.nr: {org.organizationNumber}</div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-center text-gray-700">{org.users.length}</td>
      <td className="px-4 py-3 text-center text-gray-700">{org.projects.length}</td>
      <td className="px-4 py-3">
        {aktiveTyper.length === 0 ? (
          <span className="text-xs text-gray-400">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {aktiveTyper.map((type) => (
              <span
                key={type}
                className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-700"
              >
                {TYPE_LABEL[type as IntegrasjonsType] ?? type}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <ModulPiller aktiveFirmamoduler={org.aktiveFirmamoduler} storrelse="xs" />
      </td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={onRediger}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Rediger firma"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  FirmaDetaljSlideOver — slide-over panel med detaljer                */
/* ------------------------------------------------------------------ */

function FirmaDetaljSlideOver({
  org,
  onLukk,
  onTilknyttProsjekt,
  onFjernProsjekt,
  onOpprettIntegrasjon,
  onRedigerIntegrasjon,
  onSlettIntegrasjon,
}: {
  org: OrganisasjonRad;
  onLukk: () => void;
  onTilknyttProsjekt: () => void;
  onFjernProsjekt: (projectId: string) => void;
  onOpprettIntegrasjon: (type: IntegrasjonsType) => void;
  onRedigerIntegrasjon: (int: IntegrasjonData) => void;
  onSlettIntegrasjon: (intId: string) => void;
}) {
  const intQuery = trpc.admin.hentIntegrasjonerForOrg.useQuery({ organizationId: org.id });
  const integrasjoner = intQuery.data as IntegrasjonData[] | undefined;
  const brukteTyper = new Set(integrasjoner?.map((i) => i.type) ?? []);
  const ledigeTyper = INTEGRASJON_TYPER.filter((t) => !brukteTyper.has(t));

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onLukk} aria-hidden="true" />

      {/* Slide-over panel */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-hidden border-l border-gray-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <Building2 className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{org.name}</h2>
              {org.organizationNumber && (
                <p className="text-xs text-gray-500">Org.nr: {org.organizationNumber}</p>
              )}
            </div>
          </div>
          <button
            onClick={onLukk}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Lukk"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Firmamoduler */}
          <section className="mb-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Firmamoduler</h3>
            <ModulPiller aktiveFirmamoduler={org.aktiveFirmamoduler} />
            <p className="mt-2 text-[11px] text-gray-400">
              Velg firmaet i FirmaVelger og gå til <code className="text-gray-500">/dashbord/firma/moduler</code> for å aktivere/deaktivere.
            </p>
          </section>

          {/* Brukere */}
          <section className="mb-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Brukere ({org.users.length})
            </h3>
            {org.users.length === 0 ? (
              <p className="text-sm text-gray-400">Ingen brukere</p>
            ) : (
              <div className="space-y-1">
                {org.users.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-2 rounded border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-gray-900">{u.name ?? u.email}</div>
                      {u.name && <div className="truncate text-[11px] text-gray-500">{u.email}</div>}
                    </div>
                    {u.role === "company_admin" && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                        admin
                      </span>
                    )}
                    {u.role === "sitedoc_admin" && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        sitedoc-admin
                      </span>
                    )}
                    {u.role !== "sitedoc_admin" && (
                      <ImperserKnapp targetUserId={u.id} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Prosjekter */}
          <section className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Prosjekter ({org.projects.length})
              </h3>
              <button
                onClick={onTilknyttProsjekt}
                className="flex items-center gap-1 rounded text-xs text-blue-600 hover:underline"
              >
                <Plus className="h-3 w-3" />
                Tilknytt
              </button>
            </div>
            {org.projects.length === 0 ? (
              <p className="text-sm text-gray-400">Ingen prosjekter</p>
            ) : (
              <div className="space-y-1">
                {org.projects.map((op) => (
                  <div
                    key={op.project.id}
                    className="flex items-center justify-between rounded border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="text-gray-900">{op.project.name}</div>
                      <div className="text-[11px] text-gray-500">{op.project.projectNumber}</div>
                    </div>
                    <button
                      onClick={() => onFjernProsjekt(op.project.id)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                      title="Fjern fra firma"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Integrasjoner */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <Plug className="h-3.5 w-3.5" />
              Integrasjoner
            </h3>
            <div className="space-y-1">
              {(integrasjoner ?? []).map((int) => (
                <div
                  key={int.id}
                  className="flex items-center justify-between rounded border border-gray-100 bg-gray-50 px-3 py-2 text-xs"
                >
                  <div className="flex flex-1 items-center gap-2">
                    <span className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-[10px] font-medium text-gray-700">
                      {int.type}
                    </span>
                    {int.url && <span className="truncate text-gray-500">{int.url}</span>}
                    <span className={`flex items-center gap-1 ${int.aktiv ? "text-green-600" : "text-gray-400"}`}>
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${int.aktiv ? "bg-green-500" : "bg-gray-300"}`} />
                      {int.aktiv ? "Aktiv" : "Inaktiv"}
                    </span>
                    <span className="text-gray-400">
                      {int.harNøkkel ? "Nøkkel" : "Ingen nøkkel"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onRedigerIntegrasjon(int)}
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
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {ledigeTyper.map((type) => (
                    <button
                      key={type}
                      onClick={() => onOpprettIntegrasjon(type)}
                      className="flex items-center gap-1 rounded border border-dashed border-gray-300 px-2 py-1 text-[11px] text-gray-500 hover:border-gray-400 hover:text-gray-700"
                    >
                      <Plus className="h-3 w-3" />
                      {TYPE_LABEL[type]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
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
    <form onSubmit={(e) => { e.preventDefault(); onLagre(); }} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
        {modal.integrasjonId ? (
          <p className="rounded bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">{TYPE_LABEL[modal.type]}</p>
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

      <Input label="URL" value={modal.url} onChange={(e) => onEndre("url", e.target.value)} placeholder="https://..." />

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
        <Button type="button" variant="secondary" onClick={onAvbryt}>Avbryt</Button>
        <Button type="submit" disabled={erLagrer}>
          {modal.integrasjonId ? "Lagre" : "Opprett"}
        </Button>
      </div>
    </form>
  );
}

function ImperserKnapp({ targetUserId }: { targetUserId: string }) {
  const router = useRouter();
  const start = trpc.admin.startImpersonering.useMutation({
    onSuccess: () => {
      if (typeof window !== "undefined") window.location.href = "/dashbord";
      router.refresh();
    },
  });
  return (
    <button
      type="button"
      onClick={() => start.mutate({ targetUserId })}
      disabled={start.isPending}
      title="Logg inn som denne brukeren"
      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 transition-colors hover:bg-amber-50 hover:text-amber-900 disabled:opacity-50"
    >
      {start.isPending ? "..." : "Imperser"}
    </button>
  );
}

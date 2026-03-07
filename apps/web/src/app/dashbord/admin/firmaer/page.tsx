"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Spinner, EmptyState, Button, Input, Modal } from "@sitedoc/ui";
import { Building2, Plus, Users, FolderKanban, X, Trash2 } from "lucide-react";

export default function AdminFirmaer() {
  const utils = trpc.useUtils();
  const { data: organisasjoner, isLoading } =
    trpc.admin.hentAlleOrganisasjoner.useQuery();
  const { data: alleProsjekter } =
    trpc.admin.hentAlleProsjekter.useQuery();

  const [visOpprett, setVisOpprett] = useState(false);
  const [nyttNavn, setNyttNavn] = useState("");
  const [nyttOrgNr, setNyttOrgNr] = useState("");

  // Tilknytt prosjekt
  const [tilknyttOrgId, setTilknyttOrgId] = useState<string | null>(null);
  const [valgtProsjektId, setValgtProsjektId] = useState("");

  const invalidateAll = () => {
    utils.admin.hentAlleOrganisasjoner.invalidate();
    utils.admin.hentAlleProsjekter.invalidate();
  };

  const opprettMutasjon = trpc.admin.opprettOrganisasjon.useMutation({
    onSuccess: () => {
      invalidateAll();
      setVisOpprett(false);
      setNyttNavn("");
      setNyttOrgNr("");
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
            <div
              key={org.id}
              className="rounded-lg border border-gray-200 bg-white p-5"
            >
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
                    onClick={() => { setTilknyttOrgId(org.id); setValgtProsjektId(""); }}
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
                          onClick={() => fjernMutasjon.mutate({ organizationId: org.id, projectId: op.project.id })}
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
            </div>
          ))}
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
    </div>
  );
}

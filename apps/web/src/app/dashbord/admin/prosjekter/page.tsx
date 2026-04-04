"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Spinner, EmptyState, Button, Input, Modal } from "@sitedoc/ui";
import { FolderKanban, Plus, Trash2, X, Clock, AlertTriangle, Sparkles, CalendarPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminProsjekter() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: prosjekter, isLoading } =
    trpc.admin.hentAlleProsjekter.useQuery();
  const { data: organisasjoner } =
    trpc.admin.hentAlleOrganisasjoner.useQuery();

  const opprettMalprosjekt = trpc.prosjekt.opprettTestprosjekt.useMutation({
    onSuccess: (prosjekt) => {
      invalidateAll();
      router.push(`/dashbord/${prosjekt.id}`);
    },
  });

  const [visOpprett, setVisOpprett] = useState(false);
  const [nyttNavn, setNyttNavn] = useState("");
  const [nyBeskrivelse, setNyBeskrivelse] = useState("");
  const [nyttFirmaId, setNyttFirmaId] = useState("");

  // Sletting
  const [slettProsjektId, setSlettProsjektId] = useState<string | null>(null);
  const [slettProsjektNavn, setSlettProsjektNavn] = useState("");
  const [bekreftNavn, setBekreftNavn] = useState("");

  const { data: statistikk, isLoading: statLaster } =
    trpc.admin.hentProsjektStatistikk.useQuery(
      { projectId: slettProsjektId! },
      { enabled: !!slettProsjektId },
    );

  const invalidateAll = () => {
    utils.admin.hentAlleProsjekter.invalidate();
    utils.admin.hentAlleOrganisasjoner.invalidate();
  };

  const opprettMutasjon = trpc.admin.opprettProsjekt.useMutation({
    onSuccess: (_data: unknown, variabler: { name: string; description?: string; organizationId?: string }) => {
      invalidateAll();
      setVisOpprett(false);
      setNyttNavn("");
      setNyBeskrivelse("");
      setNyttFirmaId("");
    },
  });

  const slettMutasjon = trpc.admin.slettProsjekt.useMutation({
    onSuccess: () => {
      invalidateAll();
      setSlettProsjektId(null);
      setSlettProsjektNavn("");
      setBekreftNavn("");
    },
  });

  const tilknyttMutasjon = trpc.admin.tilknyttProsjekt.useMutation({
    onSuccess: () => invalidateAll(),
  });

  const fjernTilknytningMutasjon = trpc.admin.fjernProsjektTilknytning.useMutation({
    onSuccess: () => invalidateAll(),
  });

  const slettUtlopteMutasjon = trpc.admin.slettUtlopteProsjekter.useMutation({
    onSuccess: (_data: unknown) => {
      invalidateAll();
    },
  });

  const forlengMutasjon = trpc.admin.forlengProsjekt.useMutation({
    onSuccess: () => invalidateAll(),
  });

  function dagerIgjen(opprettet: string | Date, trialExpiresAt?: string | Date | null) {
    const utloper = trialExpiresAt
      ? new Date(trialExpiresAt)
      : (() => { const d = new Date(opprettet); d.setDate(d.getDate() + 30); return d; })();
    return Math.ceil((utloper.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  function forleng(projectId: string, dager: number) {
    forlengMutasjon.mutate({ projectId, dager });
  }

  function aapneSlett(id: string, navn: string) {
    setSlettProsjektId(id);
    setSlettProsjektNavn(navn);
    setBekreftNavn("");
  }

  function endreFirma(prosjektId: string, orgId: string, nåværendeOrgId: string | null) {
    if (orgId === "") {
      // Fjern tilknytning
      if (nåværendeOrgId) {
        fjernTilknytningMutasjon.mutate({ organizationId: nåværendeOrgId, projectId: prosjektId });
      }
    } else {
      // Fjern gammel + tilknytt ny
      if (nåværendeOrgId && nåværendeOrgId !== orgId) {
        fjernTilknytningMutasjon.mutate(
          { organizationId: nåværendeOrgId, projectId: prosjektId },
          { onSuccess: () => tilknyttMutasjon.mutate({ organizationId: orgId, projectId: prosjektId }) },
        );
      } else {
        tilknyttMutasjon.mutate({ organizationId: orgId, projectId: prosjektId });
      }
    }
  }

  function opprett() {
    opprettMutasjon.mutate({
      name: nyttNavn,
      description: nyBeskrivelse || undefined,
      organizationId: nyttFirmaId || undefined,
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!prosjekter || prosjekter.length === 0) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Alle prosjekter</h1>
          <Button onClick={() => setVisOpprett(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Opprett prosjekt
          </Button>
        </div>
        <EmptyState title="Ingen prosjekter" description="Det finnes ingen prosjekter i systemet." />
        <OpprettModal
          open={visOpprett}
          onClose={() => setVisOpprett(false)}
          navn={nyttNavn}
          setNavn={setNyttNavn}
          beskrivelse={nyBeskrivelse}
          setBeskrivelse={setNyBeskrivelse}
          firmaId={nyttFirmaId}
          setFirmaId={setNyttFirmaId}
          organisasjoner={organisasjoner ?? []}
          onOpprett={opprett}
          laster={opprettMutasjon.isPending}
        />
      </div>
    );
  }

  const harData = statistikk && (statistikk.sjekklister > 0 || statistikk.oppgaver > 0 || statistikk.maler > 0 || statistikk.tegninger > 0 || statistikk.mapper > 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">
          Alle prosjekter
          <span className="ml-2 text-sm font-normal text-gray-400">({prosjekter.length})</span>
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (confirm("Deaktiver prosjekter >30 dager og slett prosjekter >90 dager uten firma?")) {
                slettUtlopteMutasjon.mutate();
              }
            }}
            loading={slettUtlopteMutasjon.isPending}
          >
            <AlertTriangle className="mr-1.5 h-4 w-4" />
            Rydd utløpte
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => opprettMalprosjekt.mutate()}
            disabled={opprettMalprosjekt.isPending}
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            {opprettMalprosjekt.isPending ? "Oppretter…" : "Opprett malprosjekt"}
          </Button>
          <Button onClick={() => setVisOpprett(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Opprett prosjekt
          </Button>
        </div>
      </div>

      {slettUtlopteMutasjon.data && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Deaktivert {(slettUtlopteMutasjon.data as { deaktivert: number; slettet: number }).deaktivert} prosjekter,
          slettet {(slettUtlopteMutasjon.data as { deaktivert: number; slettet: number }).slettet} utløpte prosjekter.
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-600">Prosjekt</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Nr</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Opprettet av</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600" style={{ minWidth: 180 }}>Firma</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Medl.</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Sjekk.</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Oppg.</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Prøveperiode</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {prosjekter.map((p) => {
              const orgProj = p.organizationProjects[0] ?? null;
              const nåværendeOrgId = orgProj?.organization.id ?? null;

              return (
                <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashbord/${p.id}`}
                      className="flex items-center gap-2 font-medium text-gray-900 hover:text-blue-600"
                    >
                      <FolderKanban className="h-4 w-4 text-gray-400" />
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.projectNumber}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {p.members[0]?.user?.name || p.members[0]?.user?.email || "–"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <select
                        value={nåværendeOrgId ?? ""}
                        onChange={(e) => endreFirma(p.id, e.target.value, nåværendeOrgId)}
                        className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      >
                        <option value="">Ingen firma</option>
                        {organisasjoner?.map((org) => (
                          <option key={org.id} value={org.id}>{org.name}</option>
                        ))}
                      </select>
                      {nåværendeOrgId && (
                        <button
                          onClick={() => endreFirma(p.id, "", nåværendeOrgId)}
                          className="flex-shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          title="Fjern firmatilknytning"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{p.members.length}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{(p as unknown as { _count: { checklists: number } })._count?.checklists ?? 0}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{(p as unknown as { _count: { tasks: number } })._count?.tasks ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {orgProj ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Aktiv
                        </span>
                      ) : (() => {
                        const dager = dagerIgjen(p.createdAt, (p as unknown as { trialExpiresAt?: string | null }).trialExpiresAt);
                        return (
                          <>
                            {dager <= 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                <AlertTriangle className="h-3 w-3" />
                                Utløpt
                              </span>
                            ) : (
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                dager <= 7
                                  ? "bg-red-100 text-red-700"
                                  : dager <= 14
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-blue-100 text-blue-700"
                              }`}>
                                <Clock className="h-3 w-3" />
                                {dager} dager
                              </span>
                            )}
                            <button
                              onClick={() => forleng(p.id, 30)}
                              className="rounded p-0.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                              title="Forleng 30 dager"
                              disabled={forlengMutasjon.isPending}
                            >
                              <CalendarPlus className="h-3.5 w-3.5" />
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : p.status === "deactivated"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-600"
                    }`}>
                      {p.status === "active" ? "Aktiv" : p.status === "deactivated" ? "Deaktivert" : p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => aapneSlett(p.id, p.name)}
                      className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      title="Slett prosjekt"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Opprett-modal */}
      <OpprettModal
        open={visOpprett}
        onClose={() => setVisOpprett(false)}
        navn={nyttNavn}
        setNavn={setNyttNavn}
        beskrivelse={nyBeskrivelse}
        setBeskrivelse={setNyBeskrivelse}
        firmaId={nyttFirmaId}
        setFirmaId={setNyttFirmaId}
        organisasjoner={organisasjoner ?? []}
        onOpprett={opprett}
        laster={opprettMutasjon.isPending}
      />

      {/* Slett-modal */}
      <Modal
        open={!!slettProsjektId}
        onClose={() => setSlettProsjektId(null)}
        title="Slett prosjekt"
      >
        <div className="space-y-4">
          {statLaster ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : (
            <>
              {harData && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="mb-2 text-sm font-medium text-red-800">
                    Dette prosjektet inneholder data som vil bli permanent slettet:
                  </p>
                  <ul className="space-y-1 text-sm text-red-700">
                    {statistikk.sjekklister > 0 && <li>{statistikk.sjekklister} sjekkliste{statistikk.sjekklister !== 1 && "r"}</li>}
                    {statistikk.oppgaver > 0 && <li>{statistikk.oppgaver} oppgave{statistikk.oppgaver !== 1 && "r"}</li>}
                    {statistikk.maler > 0 && <li>{statistikk.maler} mal{statistikk.maler !== 1 && "er"}</li>}
                    {statistikk.tegninger > 0 && <li>{statistikk.tegninger} tegning{statistikk.tegninger !== 1 && "er"}</li>}
                    {statistikk.mapper > 0 && <li>{statistikk.mapper} mappe{statistikk.mapper !== 1 && "r"}</li>}
                    {statistikk.entrepriser > 0 && <li>{statistikk.entrepriser} entreprise{statistikk.entrepriser !== 1 && "r"}</li>}
                    {statistikk.medlemmer > 0 && <li>{statistikk.medlemmer} medlem{statistikk.medlemmer !== 1 && "mer"}</li>}
                  </ul>
                </div>
              )}

              <p className="text-sm text-gray-600">
                Skriv <span className="font-semibold text-gray-900">{slettProsjektNavn}</span> for å bekrefte sletting.
              </p>

              <Input
                label="Prosjektnavn"
                value={bekreftNavn}
                onChange={(e) => setBekreftNavn(e.target.value)}
                placeholder={slettProsjektNavn}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSlettProsjektId(null)}
                >
                  Avbryt
                </Button>
                <Button
                  variant="danger"
                  disabled={bekreftNavn !== slettProsjektNavn || slettMutasjon.isPending}
                  onClick={() => slettMutasjon.mutate({ projectId: slettProsjektId! })}
                >
                  Slett permanent
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

function OpprettModal({
  open, onClose, navn, setNavn, beskrivelse, setBeskrivelse, firmaId, setFirmaId, organisasjoner, onOpprett, laster,
}: {
  open: boolean;
  onClose: () => void;
  navn: string;
  setNavn: (v: string) => void;
  beskrivelse: string;
  setBeskrivelse: (v: string) => void;
  firmaId: string;
  setFirmaId: (v: string) => void;
  organisasjoner: { id: string; name: string }[];
  onOpprett: () => void;
  laster: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Opprett prosjekt">
      <form
        onSubmit={(e) => { e.preventDefault(); onOpprett(); }}
        className="space-y-4"
      >
        <Input
          label="Prosjektnavn"
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
          required
        />
        <Input
          label="Beskrivelse (valgfritt)"
          value={beskrivelse}
          onChange={(e) => setBeskrivelse(e.target.value)}
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Firma (valgfritt)</label>
          <select
            value={firmaId}
            onChange={(e) => setFirmaId(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Ingen firma</option>
            {organisasjoner.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="submit" disabled={!navn || laster}>
            Opprett
          </Button>
        </div>
      </form>
    </Modal>
  );
}

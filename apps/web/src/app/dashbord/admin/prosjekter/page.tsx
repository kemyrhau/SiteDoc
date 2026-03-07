"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Spinner, EmptyState, Button, Input, Modal } from "@sitedoc/ui";
import { FolderKanban, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

export default function AdminProsjekter() {
  const utils = trpc.useUtils();
  const { data: prosjekter, isLoading } =
    trpc.admin.hentAlleProsjekter.useQuery();

  const [visOpprett, setVisOpprett] = useState(false);
  const [nyttNavn, setNyttNavn] = useState("");
  const [nyBeskrivelse, setNyBeskrivelse] = useState("");

  // Sletting
  const [slettProsjektId, setSlettProsjektId] = useState<string | null>(null);
  const [slettProsjektNavn, setSlettProsjektNavn] = useState("");
  const [bekreftNavn, setBekreftNavn] = useState("");

  const { data: statistikk, isLoading: statLaster } =
    trpc.admin.hentProsjektStatistikk.useQuery(
      { projectId: slettProsjektId! },
      { enabled: !!slettProsjektId },
    );

  const opprettMutasjon = trpc.admin.opprettProsjekt.useMutation({
    onSuccess: () => {
      utils.admin.hentAlleProsjekter.invalidate();
      setVisOpprett(false);
      setNyttNavn("");
      setNyBeskrivelse("");
    },
  });

  const slettMutasjon = trpc.admin.slettProsjekt.useMutation({
    onSuccess: () => {
      utils.admin.hentAlleProsjekter.invalidate();
      utils.admin.hentAlleOrganisasjoner.invalidate();
      setSlettProsjektId(null);
      setSlettProsjektNavn("");
      setBekreftNavn("");
    },
  });

  function aapneSlett(id: string, navn: string) {
    setSlettProsjektId(id);
    setSlettProsjektNavn(navn);
    setBekreftNavn("");
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
          onOpprett={() => opprettMutasjon.mutate({ name: nyttNavn, description: nyBeskrivelse || undefined })}
          laster={opprettMutasjon.isPending}
        />
      </div>
    );
  }

  const harData = statistikk && (statistikk.sjekklister > 0 || statistikk.oppgaver > 0 || statistikk.maler > 0 || statistikk.tegninger > 0 || statistikk.mapper > 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Alle prosjekter</h1>
        <Button onClick={() => setVisOpprett(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Opprett prosjekt
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-600">Prosjekt</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Nr</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Firma</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Medl.</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Entr.</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {prosjekter.map((p) => (
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
                <td className="px-4 py-3">
                  {p.organizationProjects[0] ? (
                    <span className="rounded bg-purple-50 px-1.5 py-0.5 text-xs text-purple-600">
                      {p.organizationProjects[0].organization.name}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">&mdash;</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-gray-500">{p.members.length}</td>
                <td className="px-4 py-3 text-center text-gray-500">{p.enterprises.length}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {p.status === "active" ? "Aktiv" : p.status}
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
            ))}
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
        onOpprett={() => opprettMutasjon.mutate({ name: nyttNavn, description: nyBeskrivelse || undefined })}
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
  open, onClose, navn, setNavn, beskrivelse, setBeskrivelse, onOpprett, laster,
}: {
  open: boolean;
  onClose: () => void;
  navn: string;
  setNavn: (v: string) => void;
  beskrivelse: string;
  setBeskrivelse: (v: string) => void;
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

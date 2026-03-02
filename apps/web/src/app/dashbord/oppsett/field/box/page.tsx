"use client";

import { useState } from "react";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { Button, Modal, Input, Spinner } from "@siteflow/ui";
import {
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Pencil,
  MoreVertical,
  FolderPlus,
  File,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Treprikk-meny                                                      */
/* ------------------------------------------------------------------ */

function TreprikkMeny({
  handlinger,
}: {
  handlinger: Array<{
    label: string;
    ikon: React.ReactNode;
    onClick: () => void;
    fare?: boolean;
  }>;
}) {
  const [apen, setApen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setApen(!apen);
        }}
        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {apen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setApen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
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
/*  Mappe-tre komponent (rekursiv)                                     */
/* ------------------------------------------------------------------ */

interface MappeTreData {
  id: string;
  name: string;
  children: MappeTreData[];
  _count?: { documents: number };
}

function MappeTreRad({
  mappe,
  dybde,
  onLeggTilUndermappe,
  onGiNyttNavn,
  onSlett,
}: {
  mappe: MappeTreData;
  dybde: number;
  onLeggTilUndermappe: (parentId: string) => void;
  onGiNyttNavn: (id: string, navn: string) => void;
  onSlett: (id: string) => void;
}) {
  const [ekspandert, setEkspandert] = useState(dybde < 2);
  const harBarn = mappe.children.length > 0;
  const antallDokumenter = mappe._count?.documents ?? 0;

  return (
    <div>
      <div
        className="group flex items-center gap-1 rounded-md py-1.5 pr-2 hover:bg-gray-50"
        style={{ paddingLeft: `${dybde * 20 + 8}px` }}
      >
        <button
          onClick={() => setEkspandert(!ekspandert)}
          className="flex-shrink-0 rounded p-0.5 text-gray-400"
        >
          {harBarn ? (
            ekspandert ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <span className="inline-block h-3.5 w-3.5" />
          )}
        </button>

        <FolderOpen className="h-4 w-4 flex-shrink-0 text-amber-500" />
        <span className="flex-1 truncate text-sm text-gray-800">
          {mappe.name}
        </span>
        {antallDokumenter > 0 && (
          <span className="mr-2 text-xs text-gray-400">
            {antallDokumenter} <File className="mb-px inline h-3 w-3" />
          </span>
        )}

        <div className="opacity-0 group-hover:opacity-100">
          <TreprikkMeny
            handlinger={[
              {
                label: "Ny undermappe",
                ikon: <FolderPlus className="h-4 w-4 text-gray-400" />,
                onClick: () => onLeggTilUndermappe(mappe.id),
              },
              {
                label: "Gi nytt navn",
                ikon: <Pencil className="h-4 w-4 text-gray-400" />,
                onClick: () => onGiNyttNavn(mappe.id, mappe.name),
              },
              {
                label: "Slett mappe",
                ikon: <Trash2 className="h-4 w-4 text-red-400" />,
                onClick: () => onSlett(mappe.id),
                fare: true,
              },
            ]}
          />
        </div>
      </div>

      {ekspandert &&
        mappe.children.map((barn) => (
          <MappeTreRad
            key={barn.id}
            mappe={barn}
            dybde={dybde + 1}
            onLeggTilUndermappe={onLeggTilUndermappe}
            onGiNyttNavn={onGiNyttNavn}
            onSlett={onSlett}
          />
        ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hovedside                                                          */
/* ------------------------------------------------------------------ */

export default function BoxSide() {
  const { prosjektId } = useProsjekt();
  const utils = trpc.useUtils();

  const [visNyMappeModal, setVisNyMappeModal] = useState(false);
  const [nyMappeNavn, setNyMappeNavn] = useState("");
  const [nyMappeParentId, setNyMappeParentId] = useState<string | null>(null);
  const [giNyttNavnId, setGiNyttNavnId] = useState<string | null>(null);
  const [giNyttNavnVerdi, setGiNyttNavnVerdi] = useState("");
  const [slettMappeId, setSlettMappeId] = useState<string | null>(null);

  // Hent mappestruktur
  const { data: mapper, isLoading } = trpc.mappe.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  // Mutasjoner
  const opprettMappeMutation = trpc.mappe.opprett.useMutation({
    onSuccess: () => {
      utils.mappe.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setVisNyMappeModal(false);
      setNyMappeNavn("");
      setNyMappeParentId(null);
    },
  });

  const oppdaterMappeMutation = trpc.mappe.oppdater.useMutation({
    onSuccess: () => {
      utils.mappe.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setGiNyttNavnId(null);
      setGiNyttNavnVerdi("");
    },
  });

  const slettMappeMutation = trpc.mappe.slett.useMutation({
    onSuccess: () => {
      utils.mappe.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setSlettMappeId(null);
    },
  });

  function handleLeggTilUndermappe(parentId: string) {
    setNyMappeParentId(parentId);
    setNyMappeNavn("");
    setVisNyMappeModal(true);
  }

  function handleGiNyttNavn(id: string, navn: string) {
    setGiNyttNavnId(id);
    setGiNyttNavnVerdi(navn);
  }

  // Bygg tre fra flat liste
  function byggTre(
    flat: Array<{
      id: string;
      name: string;
      parentId: string | null;
      _count?: { documents: number };
    }>,
  ): MappeTreData[] {
    const map = new Map<string, MappeTreData>();
    const roots: MappeTreData[] = [];

    for (const m of flat) {
      map.set(m.id, { id: m.id, name: m.name, children: [], _count: m._count });
    }

    for (const m of flat) {
      const node = map.get(m.id)!;
      if (m.parentId) {
        const parent = map.get(m.parentId);
        if (parent) parent.children.push(node);
        else roots.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  const mappeTre = mapper ? byggTre(mapper as Array<{ id: string; name: string; parentId: string | null; _count?: { documents: number } }>) : [];

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-gray-900">Mappeoppsett</h2>

      {/* Mappestruktur */}
      <div>
        <div className="mb-3 flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Mappestruktur
          </h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setNyMappeParentId(null);
              setNyMappeNavn("");
              setVisNyMappeModal(true);
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Ny mappe
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner size="md" />
          </div>
        ) : mappeTre.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-8 text-center">
            <FolderOpen className="mx-auto mb-2 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">
              Ingen mapper ennå. Opprett den første mappen for prosjektet.
            </p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => {
                setNyMappeParentId(null);
                setNyMappeNavn("");
                setVisNyMappeModal(true);
              }}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Opprett mappe
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white py-2">
            {mappeTre.map((mappe) => (
              <MappeTreRad
                key={mappe.id}
                mappe={mappe}
                dybde={0}
                onLeggTilUndermappe={handleLeggTilUndermappe}
                onGiNyttNavn={handleGiNyttNavn}
                onSlett={setSlettMappeId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Ny mappe modal */}
      <Modal
        open={visNyMappeModal}
        onClose={() => setVisNyMappeModal(false)}
        title={nyMappeParentId ? "Ny undermappe" : "Ny mappe"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!nyMappeNavn.trim() || !prosjektId) return;
            opprettMappeMutation.mutate({
              projectId: prosjektId,
              name: nyMappeNavn.trim(),
              parentId: nyMappeParentId ?? undefined,
            });
          }}
          className="flex flex-col gap-4"
        >
          <Input
            label="Mappenavn"
            placeholder="F.eks. Tegninger, Dokumenter..."
            value={nyMappeNavn}
            onChange={(e) => setNyMappeNavn(e.target.value)}
            required
          />
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={opprettMappeMutation.isPending}>
              Opprett
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setVisNyMappeModal(false)}
            >
              Avbryt
            </Button>
          </div>
        </form>
      </Modal>

      {/* Gi nytt navn modal */}
      <Modal
        open={giNyttNavnId !== null}
        onClose={() => setGiNyttNavnId(null)}
        title="Gi nytt navn"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!giNyttNavnId || !giNyttNavnVerdi.trim()) return;
            oppdaterMappeMutation.mutate({
              id: giNyttNavnId,
              name: giNyttNavnVerdi.trim(),
            });
          }}
          className="flex flex-col gap-4"
        >
          <Input
            label="Nytt navn"
            value={giNyttNavnVerdi}
            onChange={(e) => setGiNyttNavnVerdi(e.target.value)}
            required
          />
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={oppdaterMappeMutation.isPending}>
              Lagre
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setGiNyttNavnId(null)}
            >
              Avbryt
            </Button>
          </div>
        </form>
      </Modal>

      {/* Slett mappe bekreftelse */}
      <Modal
        open={slettMappeId !== null}
        onClose={() => setSlettMappeId(null)}
        title="Slett mappe"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            Er du sikker på at du vil slette denne mappen? Alle undermapper og
            dokumenter vil også bli slettet.
          </p>
          <div className="flex gap-3 pt-2">
            <Button
              variant="danger"
              loading={slettMappeMutation.isPending}
              onClick={() => {
                if (!slettMappeId) return;
                slettMappeMutation.mutate({ id: slettMappeId });
              }}
            >
              Slett
            </Button>
            <Button
              variant="secondary"
              onClick={() => setSlettMappeId(null)}
            >
              Avbryt
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

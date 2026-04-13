"use client";

import { useState, useMemo } from "react";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { Button, Modal, Input, Spinner, Select } from "@sitedoc/ui";
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
  Shield,
  X,
  Building2,
  Users,
  User,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Typer                                                              */
/* ------------------------------------------------------------------ */

interface TilgangEntry {
  accessType: "enterprise" | "group" | "user";
  enterpriseId?: string;
  groupId?: string;
  userId?: string;
  // Visningsdata
  navn: string;
  farge?: string | null;
}

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
/*  TilgangModal                                                       */
/* ------------------------------------------------------------------ */

function TilgangModal({
  mappeId,
  mappeNavn,
  prosjektId,
  onLukk,
}: {
  mappeId: string;
  mappeNavn: string;
  prosjektId: string;
  onLukk: () => void;
}) {
  const utils = trpc.useUtils();

  // Hent gjeldende tilgang
  const { data: tilgang, isLoading: lasterTilgang } = trpc.mappe.hentTilgang.useQuery(
    { folderId: mappeId },
  );

  // Hent tilgjengelige entrepriser, grupper og medlemmer
  const { data: entrepriser } = trpc.entreprise.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );
  const { data: grupper } = trpc.gruppe.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );
  const { data: medlemmer } = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );

  // Lokal state
  const [modus, setModus] = useState<"inherit" | "custom">("inherit");
  const [oppforinger, setOppforinger] = useState<TilgangEntry[]>([]);
  const [initialisert, setInitialisert] = useState(false);

  // Ny oppføring-state
  const [nyType, setNyType] = useState<"enterprise" | "group" | "user">("enterprise");
  const [nyId, setNyId] = useState("");

  // Initialiser fra server-data
  if (tilgang && !initialisert) {
    setModus(tilgang.accessMode as "inherit" | "custom");
    setOppforinger(
      tilgang.accessEntries.map((e) => ({
        accessType: e.accessType as "enterprise" | "group" | "user",
        enterpriseId: e.enterprise?.id,
        groupId: e.group?.id,
        userId: e.user?.id,
        navn:
          e.enterprise?.name ??
          e.group?.name ??
          e.user?.name ??
          e.user?.email ??
          "Ukjent",
        farge: e.enterprise?.color ?? null,
      })),
    );
    setInitialisert(true);
  }

  const settTilgangMutation = trpc.mappe.settTilgang.useMutation({
    onSuccess: () => {
      utils.mappe.hentForProsjekt.invalidate({ projectId: prosjektId });
      utils.mappe.hentTilgang.invalidate({ folderId: mappeId });
      onLukk();
    },
  });

  // Tilgjengelige alternativer for dropdown (filtrer ut allerede lagt til)
  const tilgjengeligeAlternativer = useMemo(() => {
    if (nyType === "enterprise") {
      return (entrepriser ?? [] as Array<{ id: string; name: string }>)
        .filter((e: { id: string }) => !oppforinger.some((o) => o.enterpriseId === e.id))
        .map((e: { id: string; name: string }) => ({ value: e.id, label: e.name }));
    }
    if (nyType === "group") {
      return (grupper ?? [] as Array<{ id: string; name: string }>)
        .filter((g: { id: string }) => !oppforinger.some((o) => o.groupId === g.id))
        .map((g: { id: string; name: string }) => ({ value: g.id, label: g.name }));
    }
    // user
    return (medlemmer ?? [] as Array<{ user: { id: string; name: string | null; email: string } }>)
      .filter((m: { user: { id: string } }) => !oppforinger.some((o) => o.userId === m.user.id))
      .map((m: { user: { id: string; name: string | null; email: string } }) => ({
        value: m.user.id,
        label: m.user.name ?? m.user.email,
      }));
  }, [nyType, entrepriser, grupper, medlemmer, oppforinger]);

  function leggTil() {
    if (!nyId) return;

    let navn = "";
    let farge: string | null = null;

    if (nyType === "enterprise") {
      const e = (entrepriser as Array<{ id: string; name: string; color?: string | null }> | undefined)?.find((e) => e.id === nyId);
      navn = e?.name ?? "";
      farge = e?.color ?? null;
    } else if (nyType === "group") {
      const g = (grupper as Array<{ id: string; name: string }> | undefined)?.find((g) => g.id === nyId);
      navn = g?.name ?? "";
    } else {
      const m = (medlemmer as Array<{ user: { id: string; name: string | null; email: string } }> | undefined)?.find((m) => m.user.id === nyId);
      navn = m?.user.name ?? m?.user.email ?? "";
    }

    setOppforinger([
      ...oppforinger,
      {
        accessType: nyType,
        enterpriseId: nyType === "enterprise" ? nyId : undefined,
        groupId: nyType === "group" ? nyId : undefined,
        userId: nyType === "user" ? nyId : undefined,
        navn,
        farge,
      },
    ]);
    setNyId("");
  }

  function fjern(index: number) {
    setOppforinger(oppforinger.filter((_, i) => i !== index));
  }

  function lagre() {
    settTilgangMutation.mutate({
      folderId: mappeId,
      accessMode: modus,
      entries: oppforinger.map((o) => ({
        accessType: o.accessType,
        enterpriseId: o.enterpriseId,
        groupId: o.groupId,
        userId: o.userId,
      })),
    });
  }

  const typeBadgeFarge: Record<string, string> = {
    enterprise: "bg-amber-100 text-amber-700",
    group: "bg-blue-100 text-blue-700",
    user: "bg-emerald-100 text-emerald-700",
  };

  const typeIkon: Record<string, JSX.Element> = {
    enterprise: <Building2 className="h-3 w-3" />,
    group: <Users className="h-3 w-3" />,
    user: <User className="h-3 w-3" />,
  };

  const typeLabel: Record<string, string> = {
    enterprise: "Entreprise",
    group: "Gruppe",
    user: "Bruker",
  };

  if (lasterTilgang) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Tilgangsmodus */}
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">Tilgangsmodus</p>
        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
            <input
              type="radio"
              name="modus"
              checked={modus === "inherit"}
              onChange={() => setModus("inherit")}
              className="text-sitedoc-primary"
            />
            Arv fra overordnet mappe
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
            <input
              type="radio"
              name="modus"
              checked={modus === "custom"}
              onChange={() => setModus("custom")}
              className="text-sitedoc-primary"
            />
            Egendefinert tilgang
          </label>
        </div>
      </div>

      {/* Tilgangsliste (kun synlig for custom) */}
      {modus === "custom" && (
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">Tilgangsliste</p>

          {oppforinger.length === 0 ? (
            <p className="mb-3 text-sm text-gray-400">
              Ingen har tilgang ennå. Legg til entrepriser, grupper eller brukere.
            </p>
          ) : (
            <div className="mb-3 flex flex-col gap-1.5">
              {oppforinger.map((o, i) => (
                <div
                  key={`${o.accessType}-${o.enterpriseId ?? o.groupId ?? o.userId}`}
                  className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                >
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeFarge[o.accessType]}`}
                  >
                    {typeIkon[o.accessType]}
                    {typeLabel[o.accessType]}
                  </span>
                  <span className="flex-1 truncate text-sm text-gray-800">
                    {o.navn}
                  </span>
                  <button
                    onClick={() => fjern(i)}
                    className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Legg til ny oppføring */}
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-3">
            <p className="mb-2 text-xs font-medium text-gray-500">
              Legg til tilgang
            </p>
            <div className="flex items-end gap-2">
              <div className="w-36">
                <Select
                  label="Type"
                  value={nyType}
                  onChange={(e) => {
                    setNyType(e.target.value as "enterprise" | "group" | "user");
                    setNyId("");
                  }}
                  options={[
                    { value: "enterprise", label: "Entreprise" },
                    { value: "group", label: "Gruppe" },
                    { value: "user", label: "Bruker" },
                  ]}
                />
              </div>
              <div className="flex-1">
                <Select
                  label="Velg"
                  value={nyId}
                  onChange={(e) => setNyId(e.target.value)}
                  options={[
                    { value: "", label: "Velg..." },
                    ...tilgjengeligeAlternativer,
                  ]}
                />
              </div>
              <Button size="sm" onClick={leggTil} disabled={!nyId}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Legg til
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Handlinger */}
      <div className="flex gap-3 pt-2">
        <Button onClick={lagre} loading={settTilgangMutation.isPending}>
          Lagre
        </Button>
        <Button variant="secondary" onClick={onLukk}>
          Avbryt
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mappe-tre komponent (rekursiv)                                     */
/* ------------------------------------------------------------------ */

interface MappeTreData {
  id: string;
  name: string;
  accessMode: string;
  children: MappeTreData[];
  _count?: { documents: number };
}

function MappeTreRad({
  mappe,
  dybde,
  onLeggTilUndermappe,
  onGiNyttNavn,
  onSlett,
  onRedigerTilgang,
}: {
  mappe: MappeTreData;
  dybde: number;
  onLeggTilUndermappe: (parentId: string) => void;
  onGiNyttNavn: (id: string, navn: string) => void;
  onSlett: (id: string) => void;
  onRedigerTilgang: (id: string, navn: string) => void;
}) {
  const [ekspandert, setEkspandert] = useState(dybde < 2);
  const harBarn = mappe.children.length > 0;
  const antallDokumenter = mappe._count?.documents ?? 0;
  const harEgenTilgang = mappe.accessMode === "custom";

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
        {harEgenTilgang && (
          <Shield className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
        )}
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
                label: "Rediger tilgang",
                ikon: <Shield className="h-4 w-4 text-blue-400" />,
                onClick: () => onRedigerTilgang(mappe.id, mappe.name),
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
            onRedigerTilgang={onRedigerTilgang}
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
  const [tilgangMappe, setTilgangMappe] = useState<{ id: string; navn: string } | null>(null);

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

  function handleRedigerTilgang(id: string, navn: string) {
    setTilgangMappe({ id, navn });
  }

  // Bygg tre fra flat liste
  function byggTre(
    flat: Array<{
      id: string;
      name: string;
      parentId: string | null;
      accessMode: string;
      _count?: { documents: number };
    }>,
  ): MappeTreData[] {
    const map = new Map<string, MappeTreData>();
    const roots: MappeTreData[] = [];

    for (const m of flat) {
      map.set(m.id, { id: m.id, name: m.name, accessMode: m.accessMode, children: [], _count: m._count });
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

  const mappeTre = mapper ? byggTre(mapper as Array<{ id: string; name: string; parentId: string | null; accessMode: string; _count?: { documents: number } }>) : [];

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
                onRedigerTilgang={handleRedigerTilgang}
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

      {/* Tilgangsmodal */}
      <Modal
        open={tilgangMappe !== null}
        onClose={() => setTilgangMappe(null)}
        title={`Rediger tilgang – ${tilgangMappe?.navn ?? ""}`}
      >
        {tilgangMappe && prosjektId && (
          <TilgangModal
            mappeId={tilgangMappe.id}
            mappeNavn={tilgangMappe.navn}
            prosjektId={prosjektId}
            onLukk={() => setTilgangMappe(null)}
          />
        )}
      </Modal>
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
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
  Import,
  Info,
  FileArchive,
  AlignLeft,
  Loader2,
  Upload,
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
  _count?: { ftdDocuments: number };
  kontraktId?: string | null;
  kontraktNavn?: string | null;
}

function MappeTreRad({
  mappe,
  dybde,
  onLeggTilUndermappe,
  onGiNyttNavn,
  onSlett,
  onRedigerTilgang,
  onKobleTilKontrakt,
}: {
  mappe: MappeTreData;
  dybde: number;
  onLeggTilUndermappe: (parentId: string) => void;
  onGiNyttNavn: (id: string, navn: string) => void;
  onSlett: (id: string) => void;
  onRedigerTilgang: (id: string, navn: string) => void;
  onKobleTilKontrakt: (id: string, navn: string, kontraktId: string | null) => void;
}) {
  const { t } = useTranslation();
  const [ekspandert, setEkspandert] = useState(dybde < 2);
  const harBarn = mappe.children.length > 0;
  const antallDokumenter = mappe._count?.ftdDocuments ?? 0;
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

        <FolderOpen className={`h-4 w-4 flex-shrink-0 ${mappe.kontraktId ? "text-blue-500" : "text-amber-500"}`} />
        <span className="flex-1 truncate text-sm text-gray-800">
          {mappe.name}
          {mappe.kontraktNavn && (
            <span className="ml-1.5 text-[10px] text-blue-400">{mappe.kontraktNavn}</span>
          )}
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
                label: t("mappeoppsett.nyUndermappe"),
                ikon: <FolderPlus className="h-4 w-4 text-gray-400" />,
                onClick: () => onLeggTilUndermappe(mappe.id),
              },
              {
                label: t("mappeoppsett.redigerTilgang"),
                ikon: <Shield className="h-4 w-4 text-blue-400" />,
                onClick: () => onRedigerTilgang(mappe.id, mappe.name),
              },
              {
                label: mappe.kontraktId ? "Fjern kontrakt-kobling" : t("mappeoppsett.kobleTilKontrakt"),
                ikon: <FileArchive className={`h-4 w-4 ${mappe.kontraktId ? "text-amber-400" : "text-blue-400"}`} />,
                onClick: () => mappe.kontraktId
                  ? onKobleTilKontrakt(mappe.id, mappe.name, null)
                  : onKobleTilKontrakt(mappe.id, mappe.name, mappe.kontraktId ?? null),
              },
              {
                label: t("mappeoppsett.giNyttNavn"),
                ikon: <Pencil className="h-4 w-4 text-gray-400" />,
                onClick: () => onGiNyttNavn(mappe.id, mappe.name),
              },
              {
                label: t("mappeoppsett.slettMappe"),
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
            onKobleTilKontrakt={onKobleTilKontrakt}
          />
        ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Import-modal                                                       */
/* ------------------------------------------------------------------ */

type ImportModus = "tekstliste" | "zip";

function ImportMapperModal({
  prosjektId,
  onLukk,
  onFerdig,
}: {
  prosjektId: string;
  onLukk: () => void;
  onFerdig: () => void;
}) {
  const [modus, setModus] = useState<ImportModus>("tekstliste");
  const [tekstInput, setTekstInput] = useState("");
  const [zipFil, setZipFil] = useState<File | null>(null);
  const [lasterOpp, setLasterOpp] = useState(false);
  const [resultat, setResultat] = useState<string | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  const [visVeileder, setVisVeileder] = useState(false);

  const opprettMappe = trpc.mappe.opprett.useMutation();
  const lastOppDokument = trpc.mappe.lastOppDokument.useMutation();

  async function importerTekstliste() {
    const linjer = tekstInput
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (linjer.length === 0) {
      setFeil("Ingen mapper å importere. Skriv inn minst én mappesti.");
      return;
    }

    setLasterOpp(true);
    setFeil(null);
    let opprettet = 0;

    // Opprett mapper rekursivt
    const opprettedeMapper = new Map<string, string>(); // sti → id

    for (const linje of linjer) {
      const deler = linje.split("/").map((d) => d.trim()).filter((d) => d.length > 0);
      let parentId: string | undefined = undefined;
      let sti = "";

      for (const del of deler) {
        sti = sti ? `${sti}/${del}` : del;

        if (opprettedeMapper.has(sti)) {
          parentId = opprettedeMapper.get(sti);
          continue;
        }

        try {
          const mappe = await opprettMappe.mutateAsync({
            projectId: prosjektId,
            name: del,
            parentId,
          });
          opprettedeMapper.set(sti, mappe.id);
          parentId = mappe.id;
          opprettet++;
        } catch {
          // Kan allerede eksistere — ignorer
          parentId = undefined;
        }
      }
    }

    setLasterOpp(false);
    setResultat(`${opprettet} mapper opprettet.`);
    onFerdig();
  }

  async function importerZip() {
    if (!zipFil) {
      setFeil("Velg en ZIP-fil.");
      return;
    }

    setLasterOpp(true);
    setFeil(null);

    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(zipFil);

      // Finn alle mapper og filer
      const opprettedeMapper = new Map<string, string>();
      let opprettetMapper = 0;
      let opprettetFiler = 0;

      // Sorter entries slik at mapper kommer først
      const entries = Object.entries(zip.files).sort(([a], [b]) => {
        const aDeler = a.split("/").length;
        const bDeler = b.split("/").length;
        return aDeler - bDeler;
      });

      for (const [sti, entry] of entries) {
        // Fjern leading __MACOSX og lignende
        if (sti.startsWith("__MACOSX") || sti.startsWith(".")) continue;

        const deler = sti.split("/").filter((d) => d.length > 0);
        if (deler.length === 0) continue;

        if (entry.dir) {
          // Opprett mappestruktur
          let parentId: string | undefined = undefined;
          let mappeSti = "";

          for (const del of deler) {
            mappeSti = mappeSti ? `${mappeSti}/${del}` : del;

            if (opprettedeMapper.has(mappeSti)) {
              parentId = opprettedeMapper.get(mappeSti);
              continue;
            }

            try {
              const mappe = await opprettMappe.mutateAsync({
                projectId: prosjektId,
                name: del,
                parentId,
              });
              opprettedeMapper.set(mappeSti, mappe.id);
              parentId = mappe.id;
              opprettetMapper++;
            } catch {
              parentId = undefined;
            }
          }
        } else {
          // Fil — sikre at forelder-mappene finnes
          const filnavn = deler[deler.length - 1];
          const mappeDeler = deler.slice(0, -1);
          let parentId: string | undefined = undefined;
          let mappeSti = "";

          for (const del of mappeDeler) {
            mappeSti = mappeSti ? `${mappeSti}/${del}` : del;

            if (opprettedeMapper.has(mappeSti)) {
              parentId = opprettedeMapper.get(mappeSti);
              continue;
            }

            try {
              const mappe = await opprettMappe.mutateAsync({
                projectId: prosjektId,
                name: del,
                parentId,
              });
              opprettedeMapper.set(mappeSti, mappe.id);
              parentId = mappe.id;
              opprettetMapper++;
            } catch {
              parentId = undefined;
            }
          }

          // Last opp filen
          if (parentId && filnavn) {
            try {
              const blob = await entry.async("blob");
              const file = new window.File([blob], filnavn);
              const formData = new FormData();
              formData.append("file", file);
              const res = await fetch("/api/upload", { method: "POST", body: formData });

              if (res.ok) {
                const { fileUrl, fileType } = await res.json();
                await lastOppDokument.mutateAsync({
                  folderId: parentId!,
                  name: filnavn!,
                  fileUrl,
                  fileType: fileType ?? file.type,
                  fileSize: file.size,
                });
                opprettetFiler++;
              }
            } catch {
              // Ignorér individuelle filfeil
            }
          }
        }
      }

      setResultat(`${opprettetMapper} mapper og ${opprettetFiler} filer importert.`);
      onFerdig();
    } catch (err) {
      setFeil(err instanceof Error ? err.message : "Kunne ikke lese ZIP-filen.");
    }

    setLasterOpp(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Modus-velger */}
      <div className="flex gap-2">
        <button
          onClick={() => setModus("tekstliste")}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
            modus === "tekstliste"
              ? "border-sitedoc-primary bg-blue-50 text-sitedoc-primary"
              : "border-gray-200 text-gray-600 hover:border-gray-300"
          }`}
        >
          <AlignLeft className="h-4 w-4" />
          Tekstliste
        </button>
        <button
          onClick={() => setModus("zip")}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
            modus === "zip"
              ? "border-sitedoc-primary bg-blue-50 text-sitedoc-primary"
              : "border-gray-200 text-gray-600 hover:border-gray-300"
          }`}
        >
          <FileArchive className="h-4 w-4" />
          ZIP-fil
        </button>

        {/* Veileder */}
        <div className="relative ml-auto">
          <button
            onClick={() => setVisVeileder(!visVeileder)}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Hjelp"
          >
            <Info className="h-4 w-4" />
          </button>
          {visVeileder && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setVisVeileder(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
                <h4 className="mb-2 text-sm font-semibold text-gray-800">Slik importerer du mapper</h4>

                <div className="mb-3">
                  <p className="mb-1 text-xs font-medium text-gray-600">Tekstliste</p>
                  <p className="text-xs text-gray-500">
                    Skriv én mappesti per linje. Bruk <code className="rounded bg-gray-100 px-1">/</code> for å lage undermapper.
                  </p>
                  <div className="mt-1 rounded bg-gray-50 p-2 font-mono text-[11px] text-gray-600">
                    Røstbakken/Økonomi/A-Nota<br />
                    Røstbakken/Økonomi/Budsjett<br />
                    Røstbakken/Tegninger<br />
                    Felles/HMS
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-xs font-medium text-gray-600">ZIP-fil</p>
                  <p className="text-xs text-gray-500">
                    Pakk mappestrukturen i en ZIP. Mapper opprettes automatisk, og filer lastes opp til riktig mappe.
                  </p>
                  <div className="mt-1 rounded bg-gray-50 p-2 font-mono text-[11px] text-gray-600">
                    prosjekt.zip<br />
                    ├── Røstbakken/<br />
                    │   ├── Økonomi/<br />
                    │   │   └── budsjett.xlsx<br />
                    │   └── Tegninger/<br />
                    └── Felles/
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Innhold basert på modus */}
      {modus === "tekstliste" ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Lim inn mappestier (én per linje)
          </label>
          <textarea
            className="w-full rounded border border-gray-300 p-3 font-mono text-sm leading-relaxed"
            rows={8}
            placeholder={"Røstbakken/Økonomi/A-Nota\nRøstbakken/Økonomi/Budsjett\nRøstbakken/Tegninger\nFelles/HMS"}
            value={tekstInput}
            onChange={(e) => setTekstInput(e.target.value)}
          />
          <div className="mt-1 text-xs text-gray-400">
            {tekstInput.split("\n").filter((l) => l.trim()).length} mapper
          </div>
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Velg ZIP-fil med mappestruktur
          </label>
          <div
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
              zipFil ? "border-green-300 bg-green-50" : "border-gray-300 hover:border-gray-400"
            }`}
          >
            {zipFil ? (
              <div className="flex items-center gap-3">
                <FileArchive className="h-6 w-6 text-green-600" />
                <div>
                  <div className="text-sm font-medium">{zipFil.name}</div>
                  <div className="text-xs text-gray-500">
                    {(zipFil.size / 1024).toFixed(0)} KB
                  </div>
                </div>
                <button
                  onClick={() => setZipFil(null)}
                  className="ml-2 rounded p-1 text-gray-400 hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="mb-1 h-6 w-6 text-gray-400" />
                <label className="cursor-pointer text-sm text-sitedoc-primary hover:underline">
                  Velg ZIP-fil
                  <input
                    type="file"
                    className="hidden"
                    accept=".zip"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setZipFil(f);
                    }}
                  />
                </label>
              </>
            )}
          </div>
        </div>
      )}

      {/* Feil / resultat */}
      {feil && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {feil}
        </div>
      )}
      {resultat && (
        <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {resultat}
        </div>
      )}

      {/* Handlinger */}
      <div className="flex gap-3 pt-2">
        <Button
          onClick={modus === "tekstliste" ? importerTekstliste : importerZip}
          disabled={lasterOpp || (modus === "tekstliste" ? !tekstInput.trim() : !zipFil)}
          loading={lasterOpp}
        >
          {lasterOpp ? "Importerer..." : "Importer"}
        </Button>
        <Button variant="secondary" onClick={onLukk}>
          Lukk
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hovedside                                                          */
/* ------------------------------------------------------------------ */

export default function BoxSide() {
  const { t } = useTranslation();
  const { prosjektId } = useProsjekt();
  const utils = trpc.useUtils();

  const [visNyMappeModal, setVisNyMappeModal] = useState(false);
  const [nyMappeNavn, setNyMappeNavn] = useState("");
  const [nyMappeParentId, setNyMappeParentId] = useState<string | null>(null);
  const [giNyttNavnId, setGiNyttNavnId] = useState<string | null>(null);
  const [giNyttNavnVerdi, setGiNyttNavnVerdi] = useState("");
  const [slettMappeId, setSlettMappeId] = useState<string | null>(null);
  const [tilgangMappe, setTilgangMappe] = useState<{ id: string; navn: string } | null>(null);
  const [visImportModal, setVisImportModal] = useState(false);

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

  const [kontraktModal, setKontraktModal] = useState<{ id: string; navn: string } | null>(null);
  const [valgtKontraktId, setValgtKontraktId] = useState("");

  const { data: kontrakter } = trpc.kontrakt.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const settKontraktMut = trpc.mappe.settKontrakt.useMutation({
    onSuccess: () => {
      utils.mappe.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setKontraktModal(null);
    },
  });

  function handleKobleTilKontrakt(id: string, navn: string, eksisterende: string | null) {
    if (eksisterende) {
      // Fjern kobling direkte
      settKontraktMut.mutate({ folderId: id, kontraktId: null });
    } else {
      setKontraktModal({ id, navn });
      setValgtKontraktId("");
    }
  }

  // Bygg tre fra flat liste
  function byggTre(
    flat: Array<{
      id: string;
      name: string;
      parentId: string | null;
      accessMode: string;
      _count?: { ftdDocuments: number };
      kontraktId?: string | null;
      kontraktNavn?: string | null;
    }>,
  ): MappeTreData[] {
    const map = new Map<string, MappeTreData>();
    const roots: MappeTreData[] = [];

    for (const m of flat) {
      map.set(m.id, { id: m.id, name: m.name, accessMode: m.accessMode, children: [], _count: m._count, kontraktId: m.kontraktId, kontraktNavn: m.kontraktNavn });
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

  const mappeTre = mapper ? byggTre((mapper as Array<{ id: string; name: string; parentId: string | null; accessMode: string; _count?: { ftdDocuments: number }; kontraktId?: string | null; kontrakt?: { id: string; navn: string } | null }>).map(m => ({
    ...m,
    kontraktNavn: m.kontrakt?.navn ?? null,
  }))) : [];

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-gray-900">{t("mappeoppsett.tittel")}</h2>

      {/* Mappestruktur */}
      <div>
        <div className="mb-3 flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-700">
            {t("mappeoppsett.mappestruktur")}
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
            {t("mappeoppsett.nyMappe")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setVisImportModal(true)}
          >
            <Import className="mr-1 h-3.5 w-3.5" />
            {t("handling.importer")}
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
                onKobleTilKontrakt={handleKobleTilKontrakt}
              />
            ))}
          </div>
        )}
      </div>

      {/* Ny mappe modal */}
      <Modal
        open={visNyMappeModal}
        onClose={() => setVisNyMappeModal(false)}
        title={nyMappeParentId ? t("mappeoppsett.nyUndermappe") : t("mappeoppsett.nyMappe")}
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
        title={t("mappeoppsett.giNyttNavn")}
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
        title={t("mappeoppsett.slettMappe")}
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
        title={`${t("mappeoppsett.redigerTilgang")} – ${tilgangMappe?.navn ?? ""}`}
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

      {/* Import-modal */}
      <Modal
        open={visImportModal}
        onClose={() => setVisImportModal(false)}
        title="Importer mappestruktur"
      >
        {prosjektId && (
          <ImportMapperModal
            prosjektId={prosjektId}
            onLukk={() => setVisImportModal(false)}
            onFerdig={() => {
              utils.mappe.hentForProsjekt.invalidate({ projectId: prosjektId! });
            }}
          />
        )}
      </Modal>

      {/* Koble til kontrakt modal */}
      <Modal
        open={!!kontraktModal}
        onClose={() => setKontraktModal(null)}
        title={`${t("mappeoppsett.kobleTilKontrakt")} – ${kontraktModal?.navn ?? ""}`}
      >
        <div className="space-y-4 p-4">
          <p className="text-sm text-gray-600">
            Velg kontrakt for mappen. Dokumenter i mappen blir tilgjengelig som dokumentasjon i økonomi-modulen.
          </p>
          <select
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
            value={valgtKontraktId}
            onChange={(e) => setValgtKontraktId(e.target.value)}
          >
            <option value="">Velg kontrakt...</option>
            {kontrakter?.map((k) => (
              <option key={k.id} value={k.id}>{k.navn}</option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setKontraktModal(null)}>
              Avbryt
            </Button>
            <Button
              disabled={!valgtKontraktId}
              onClick={() => {
                if (kontraktModal && valgtKontraktId) {
                  settKontraktMut.mutate({ folderId: kontraktModal.id, kontraktId: valgtKontraktId });
                }
              }}
            >
              Koble
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

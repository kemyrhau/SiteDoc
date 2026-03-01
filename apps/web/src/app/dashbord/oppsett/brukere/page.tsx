"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { Button, Input, Modal, Spinner, SearchInput, Card } from "@siteflow/ui";
import {
  Plus,
  Search,
  Filter,
  LayoutGrid,
  LayoutList,
  Users,
  Shield,
  Key,
  Settings,
  Eye,
  AlertTriangle,
  Building2,
  UserPlus,
  X,
  Pencil,
  Trash2,
  MoreHorizontal,
  Lock,
  Info,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Typer                                                              */
/* ------------------------------------------------------------------ */

interface BrukerGruppeMedlem {
  id: string;
  navn: string;
  epost?: string;
  firma?: string;
  rolle?: string;
}

interface BrukerGruppe {
  id: string;
  navn: string;
  kategori: "generelt" | "field" | "brukergrupper";
  medlemmer: BrukerGruppeMedlem[];
  ikon?: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Statiske grupper (erstattes med tRPC-data senere)                  */
/* ------------------------------------------------------------------ */

const standardGrupper: BrukerGruppe[] = [
  // Generelt
  {
    id: "prosjektadmin",
    navn: "Prosjektadministratorer",
    kategori: "generelt",
    medlemmer: [],
    ikon: <Shield className="h-4 w-4" />,
  },
  // Field
  {
    id: "field-admin",
    navn: "Field-administratorer",
    kategori: "field",
    medlemmer: [],
    ikon: <Key className="h-4 w-4" />,
  },
  {
    id: "oppgave-sjekkliste-koord",
    navn: "Oppgave- og sjekklistekoordinatorer",
    kategori: "field",
    medlemmer: [],
    ikon: <Settings className="h-4 w-4" />,
  },
  {
    id: "field-observatorer",
    navn: "Field-observatorer",
    kategori: "field",
    medlemmer: [],
    ikon: <Eye className="h-4 w-4" />,
  },
  {
    id: "hms-ledere",
    navn: "HMS-ledere",
    kategori: "field",
    medlemmer: [],
    ikon: <AlertTriangle className="h-4 w-4" />,
  },
];

/* ------------------------------------------------------------------ */
/*  RedigerGruppeModal                                                 */
/* ------------------------------------------------------------------ */

function RedigerGruppeModal({
  open,
  onClose,
  gruppe,
  prosjektId,
}: {
  open: boolean;
  onClose: () => void;
  gruppe: BrukerGruppe;
  prosjektId: string;
}) {
  const [sok, setSok] = useState("");
  const [valgtMedlemId, setValgtMedlemId] = useState<string | null>(null);
  const [visLeggTil, setVisLeggTil] = useState(false);
  const [nyEpost, setNyEpost] = useState("");
  const [leggTilSteg, setLeggTilSteg] = useState<1 | 2>(1);
  const [nyFornavn, setNyFornavn] = useState("");
  const [nyEtternavn, setNyEtternavn] = useState("");
  const [nyTelefon, setNyTelefon] = useState("");
  const [leggerTil, setLeggerTil] = useState(false);
  const [feilmelding, setFeilmelding] = useState("");
  const [redigererNavn, setRedigererNavn] = useState(false);
  const [nyttGruppeNavn, setNyttGruppeNavn] = useState(gruppe.navn);

  const utils = trpc.useUtils();
  const leggTilMedlem = trpc.medlem.leggTil.useMutation({
    onSuccess: () => {
      setNyEpost("");
      setNyFornavn("");
      setNyEtternavn("");
      setNyTelefon("");
      setLeggTilSteg(1);
      setVisLeggTil(false);
      setFeilmelding("");
      // Oppdater data
      utils.prosjekt.hentMedId.invalidate({ id: prosjektId });
      utils.entreprise.hentForProsjekt.invalidate({ projectId: prosjektId });
      utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
    onError: (error) => {
      setFeilmelding(error.message);
    },
    onSettled: () => {
      setLeggerTil(false);
    },
  });

  const fjernMedlem = trpc.medlem.fjern.useMutation({
    onSuccess: () => {
      setValgtMedlemId(null);
      utils.prosjekt.hentMedId.invalidate({ id: prosjektId });
      utils.entreprise.hentForProsjekt.invalidate({ projectId: prosjektId });
      utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  // Filtrer medlemmer basert på søk
  const filtrerteMedlemmer = sok
    ? gruppe.medlemmer.filter(
        (m) =>
          m.navn.toLowerCase().includes(sok.toLowerCase()) ||
          m.firma?.toLowerCase().includes(sok.toLowerCase()) ||
          m.epost?.toLowerCase().includes(sok.toLowerCase()),
      )
    : gruppe.medlemmer;

  function handleEpostNeste(e: React.FormEvent) {
    e.preventDefault();
    if (!nyEpost.trim()) return;
    // Enkel e-postvalidering
    const epostRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!epostRegex.test(nyEpost.trim())) {
      setFeilmelding("Ugyldig e-postadresse");
      return;
    }
    setFeilmelding("");
    setLeggTilSteg(2);
  }

  function handleLeggTil(e: React.FormEvent) {
    e.preventDefault();
    if (!nyFornavn.trim() || !nyEtternavn.trim()) {
      setFeilmelding("Fornavn og etternavn er påkrevd");
      return;
    }
    setLeggerTil(true);
    setFeilmelding("");

    // Bruk entreprise-ID for brukergrupper (entrepriser)
    const enterpriseId = gruppe.id.startsWith("ent-")
      ? gruppe.id.replace("ent-", "")
      : undefined;

    leggTilMedlem.mutate({
      projectId: prosjektId,
      email: nyEpost.trim(),
      firstName: nyFornavn.trim(),
      lastName: nyEtternavn.trim(),
      phone: nyTelefon.trim() || undefined,
      role: gruppe.kategori === "generelt" ? "admin" : "member",
      enterpriseId,
    });
  }

  function handleFjern() {
    if (!valgtMedlemId) return;
    fjernMedlem.mutate({ id: valgtMedlemId });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Rediger brukergrupper"
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-4">
        {/* Gruppenavn (dobbeltklikk for å redigere) */}
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5">
          {redigererNavn ? (
            <input
              value={nyttGruppeNavn}
              onChange={(e) => setNyttGruppeNavn(e.target.value)}
              onBlur={() => setRedigererNavn(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setRedigererNavn(false);
                if (e.key === "Escape") {
                  setNyttGruppeNavn(gruppe.navn);
                  setRedigererNavn(false);
                }
              }}
              autoFocus
              className="flex-1 border-b border-siteflow-primary bg-transparent text-sm font-medium outline-none"
            />
          ) : (
            <span
              onDoubleClick={() => {
                setRedigererNavn(true);
                setNyttGruppeNavn(nyttGruppeNavn || gruppe.navn);
              }}
              className="flex-1 cursor-text text-sm font-medium text-gray-900"
            >
              {nyttGruppeNavn || gruppe.navn}
            </span>
          )}
          <Info className="h-4 w-4 text-gray-400" />
        </div>

        {/* Verktøylinje */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setVisLeggTil(true);
                setFeilmelding("");
              }}
              className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            >
              <Plus className="h-4 w-4" />
              Tilføy
            </button>
            <button
              className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm text-gray-400"
              disabled
            >
              <Pencil className="h-4 w-4" />
              Rediger
            </button>
            <button
              onClick={handleFjern}
              disabled={!valgtMedlemId || fjernMedlem.isPending}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm ${
                valgtMedlemId
                  ? "text-red-600 hover:bg-red-50"
                  : "text-gray-400"
              }`}
            >
              <Trash2 className="h-4 w-4" />
              Fjern
            </button>
            <button
              className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm text-gray-400"
              disabled
            >
              <MoreHorizontal className="h-4 w-4" />
              Mer
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Søk"
              value={sok}
              onChange={(e) => setSok(e.target.value)}
              className="rounded border border-gray-200 py-1.5 pl-8 pr-3 text-sm focus:border-siteflow-primary focus:outline-none focus:ring-1 focus:ring-siteflow-primary"
            />
          </div>
        </div>

        {/* Medlemstabell */}
        <div className="min-h-[200px] overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="pb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                  Navn
                </th>
                <th className="pb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                  Firma
                </th>
              </tr>
            </thead>
            <tbody>
              {filtrerteMedlemmer.map((medlem) => (
                <tr
                  key={medlem.id}
                  onClick={() =>
                    setValgtMedlemId(
                      valgtMedlemId === medlem.id ? null : medlem.id,
                    )
                  }
                  className={`cursor-pointer border-b border-gray-100 transition-colors ${
                    valgtMedlemId === medlem.id
                      ? "bg-blue-50"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <td className="py-2.5">
                    <div className="flex items-center gap-2.5">
                      {/* Avatar-initialer */}
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-600 text-xs font-medium text-white">
                        {medlem.navn
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                      <span className="text-sm text-gray-900">
                        {medlem.navn}
                      </span>
                      {medlem.rolle && (
                        <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">
                          {medlem.rolle}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 text-sm text-gray-600">
                    {medlem.firma ?? "—"}
                  </td>
                </tr>
              ))}
              {filtrerteMedlemmer.length === 0 && !visLeggTil && (
                <tr>
                  <td
                    colSpan={2}
                    className="py-8 text-center text-sm text-gray-400"
                  >
                    Ingen medlemmer i denne gruppen
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Inline legg til — flersteg */}
          {visLeggTil && (
            <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-3">
              {/* Steg 1: E-post */}
              <form
                onSubmit={leggTilSteg === 1 ? handleEpostNeste : handleLeggTil}
                className="flex flex-col gap-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    placeholder="E-postadresse..."
                    value={nyEpost}
                    onChange={(e) => {
                      setNyEpost(e.target.value);
                      setFeilmelding("");
                    }}
                    disabled={leggTilSteg === 2}
                    autoFocus={leggTilSteg === 1}
                    className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-siteflow-primary focus:outline-none focus:ring-1 focus:ring-siteflow-primary disabled:bg-gray-100 disabled:text-gray-500"
                  />
                  {leggTilSteg === 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        setLeggTilSteg(1);
                        setNyFornavn("");
                        setNyEtternavn("");
                        setNyTelefon("");
                      }}
                      className="rounded p-1 text-gray-400 hover:text-gray-600"
                      title="Endre e-post"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setVisLeggTil(false);
                      setNyEpost("");
                      setNyFornavn("");
                      setNyEtternavn("");
                      setNyTelefon("");
                      setLeggTilSteg(1);
                      setFeilmelding("");
                    }}
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Steg 2: Navn og telefon */}
                {leggTilSteg === 2 && (
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Fornavn *"
                        value={nyFornavn}
                        onChange={(e) => {
                          setNyFornavn(e.target.value);
                          setFeilmelding("");
                        }}
                        autoFocus
                        className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-siteflow-primary focus:outline-none focus:ring-1 focus:ring-siteflow-primary"
                      />
                      <input
                        type="text"
                        placeholder="Etternavn *"
                        value={nyEtternavn}
                        onChange={(e) => {
                          setNyEtternavn(e.target.value);
                          setFeilmelding("");
                        }}
                        className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-siteflow-primary focus:outline-none focus:ring-1 focus:ring-siteflow-primary"
                      />
                    </div>
                    <input
                      type="tel"
                      placeholder="Telefonnummer (valgfritt)"
                      value={nyTelefon}
                      onChange={(e) => setNyTelefon(e.target.value)}
                      className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-siteflow-primary focus:outline-none focus:ring-1 focus:ring-siteflow-primary"
                    />
                  </div>
                )}

                {/* Handlingsknapper */}
                <div className="flex items-center gap-2">
                  {leggTilSteg === 1 ? (
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!nyEpost.trim()}
                    >
                      Neste
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      size="sm"
                      disabled={leggerTil || !nyFornavn.trim() || !nyEtternavn.trim()}
                    >
                      {leggerTil ? "Legger til..." : "Legg til"}
                    </Button>
                  )}
                </div>
              </form>
            </div>
          )}
          {feilmelding && (
            <p className="mt-1 text-sm text-red-600">{feilmelding}</p>
          )}
        </div>

        {/* Rettigheter-seksjon */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h4 className="mb-3 text-sm font-semibold text-gray-900">
            Rettigheter
          </h4>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
            Posisjon
          </p>
          <div className="flex items-center justify-between rounded bg-white px-3 py-2.5 border border-gray-200">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-700">
                Vis og rediger bygninger og plasseringer
              </span>
            </div>
            <Lock className="h-4 w-4 text-gray-400" />
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  GruppeKort-komponent                                               */
/* ------------------------------------------------------------------ */

const MAKS_SYNLIGE = 4;

function GruppeKort({
  gruppe,
  onLeggTilMedlem,
  onDoubleClick,
}: {
  gruppe: BrukerGruppe;
  onLeggTilMedlem?: (gruppeId: string) => void;
  onDoubleClick?: () => void;
}) {
  const [visAlle, setVisAlle] = useState(false);
  const harMedlemmer = gruppe.medlemmer.length > 0;
  const synlige = visAlle
    ? gruppe.medlemmer
    : gruppe.medlemmer.slice(0, MAKS_SYNLIGE);
  const skjulte = gruppe.medlemmer.length - MAKS_SYNLIGE;

  return (
    <div
      onDoubleClick={onDoubleClick}
      className="group flex min-h-[160px] cursor-pointer flex-col rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-md"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h4 className="truncate text-sm font-semibold text-gray-900">
          {gruppe.navn}
        </h4>
        {gruppe.kategori === "brukergrupper" && (
          <div className="flex gap-1 text-gray-400">
            <Key className="h-3.5 w-3.5" />
            <Users className="h-3.5 w-3.5" />
          </div>
        )}
      </div>

      {/* Innhold */}
      <div className="flex flex-1 flex-col px-4 py-3">
        {harMedlemmer ? (
          <div className="flex flex-col gap-1.5">
            {synlige.map((medlem) => (
              <div key={medlem.id} className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded px-2 py-0.5 text-sm ${
                    medlem.rolle
                      ? "bg-gray-700 text-white"
                      : "text-gray-700"
                  }`}
                >
                  {medlem.navn}
                </span>
                {medlem.rolle && (
                  <span className="text-xs text-gray-400">{medlem.rolle}</span>
                )}
              </div>
            ))}
            {!visAlle && skjulte > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setVisAlle(true);
                }}
                className="mt-1 self-start text-xs text-gray-400 hover:text-gray-600"
              >
                + {skjulte} mer
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <span className="text-sm text-gray-300">Tom gruppe</span>
          </div>
        )}
      </div>

      {/* Hover-handling */}
      {onLeggTilMedlem && (
        <div className="border-t border-gray-100 px-4 py-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLeggTilMedlem(gruppe.id);
            }}
            className="flex items-center gap-1.5 text-xs text-siteflow-primary hover:underline"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Legg til medlem
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Seksjon-komponent                                                  */
/* ------------------------------------------------------------------ */

function GruppeSeksjon({
  tittel,
  grupper,
  onLeggTilMedlem,
  onDoubleClickGruppe,
}: {
  tittel: string;
  grupper: BrukerGruppe[];
  onLeggTilMedlem?: (gruppeId: string) => void;
  onDoubleClickGruppe?: (gruppe: BrukerGruppe) => void;
}) {
  if (grupper.length === 0) return null;
  return (
    <div className="mb-8">
      <h3 className="mb-3 text-lg font-bold text-gray-900">{tittel}</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {grupper.map((gruppe) => (
          <GruppeKort
            key={gruppe.id}
            gruppe={gruppe}
            onLeggTilMedlem={onLeggTilMedlem}
            onDoubleClick={() => onDoubleClickGruppe?.(gruppe)}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hovudside                                                          */
/* ------------------------------------------------------------------ */

export default function BrukereSide() {
  const { prosjektId } = useProsjekt();
  const [sok, setSok] = useState("");
  const [visNyGruppeModal, setVisNyGruppeModal] = useState(false);
  const [nyGruppeNavn, setNyGruppeNavn] = useState("");
  const [nyGruppeKategori, setNyGruppeKategori] = useState<
    "generelt" | "field" | "brukergrupper"
  >("brukergrupper");
  const [visningsModus, setVisningsModus] = useState<"grid" | "liste">("grid");
  const [redigerGruppe, setRedigerGruppe] = useState<BrukerGruppe | null>(null);

  // Hent prosjektmedlemmer og entrepriser for å populere grupper
  const { data: prosjekt } = trpc.prosjekt.hentMedId.useQuery(
    { id: prosjektId! },
    { enabled: !!prosjektId },
  );

  const { data: entrepriser } = trpc.entreprise.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  // Bygg grupper fra data
  const adminGruppe = standardGrupper[0]!;
  const grupper: BrukerGruppe[] = [
    // Generelt — populer prosjektadmin med prosjekteier
    {
      id: adminGruppe.id,
      navn: adminGruppe.navn,
      kategori: adminGruppe.kategori,
      ikon: adminGruppe.ikon,
      medlemmer: prosjekt?.members
        ?.filter((m) => m.role === "admin" || m.role === "owner")
        .map((m) => ({
          id: m.id,
          navn: m.user.name ?? m.user.email ?? "Ukjent",
          epost: m.user.email ?? undefined,
          rolle: m.role === "owner" ? "Kontaktperson" : undefined,
        })) ?? [],
    },
    // Field-grupper (foreløpig tomme — fylles ut når rollesystemet er på plass)
    ...standardGrupper.slice(1),
    // Brukergrupper fra entrepriser
    ...(entrepriser?.map((ent) => ({
      id: `ent-${ent.id}`,
      navn: ent.name,
      kategori: "brukergrupper" as const,
      medlemmer: ent.members.map((m: { id: string; user?: { name?: string | null; email?: string | null } }) => ({
        id: m.id,
        navn: m.user?.name ?? m.user?.email ?? "Ukjent",
        epost: m.user?.email ?? undefined,
        firma: ent.name,
      })),
      ikon: <Building2 className="h-4 w-4" />,
    })) ?? []),
  ];

  // Filtrering
  const filtrert = sok
    ? grupper.filter(
        (g) =>
          g.navn.toLowerCase().includes(sok.toLowerCase()) ||
          g.medlemmer.some((m) =>
            m.navn.toLowerCase().includes(sok.toLowerCase()),
          ),
      )
    : grupper;

  const generelt = filtrert.filter((g) => g.kategori === "generelt");
  const field = filtrert.filter((g) => g.kategori === "field");
  const brukergrupper = filtrert.filter((g) => g.kategori === "brukergrupper");

  function handleLeggTilMedlem(gruppeId: string) {
    const gruppe = grupper.find((g) => g.id === gruppeId);
    if (gruppe) setRedigerGruppe(gruppe);
  }

  return (
    <div>
      {/* Verktøylinje */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => setVisNyGruppeModal(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Legg til gruppe
          </Button>
          <Button variant="ghost" size="sm">
            <Users className="mr-1.5 h-4 w-4" />
            Kontakter
          </Button>
        </div>
      </div>

      {/* Tittel + søk */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Brukere</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVisningsModus("liste")}
            className={`rounded p-1.5 ${
              visningsModus === "liste"
                ? "bg-gray-200 text-gray-700"
                : "text-gray-400 hover:text-gray-600"
            }`}
            aria-label="Listevisning"
          >
            <LayoutList className="h-5 w-5" />
          </button>
          <button
            onClick={() => setVisningsModus("grid")}
            className={`rounded p-1.5 ${
              visningsModus === "grid"
                ? "bg-gray-200 text-gray-700"
                : "text-gray-400 hover:text-gray-600"
            }`}
            aria-label="Rutenettvisning"
          >
            <LayoutGrid className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Søk og filter */}
      <div className="mb-6 flex items-center gap-3">
        <SearchInput
          verdi={sok}
          onChange={setSok}
          placeholder="Søk"
          className="w-64"
        />
        <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <Plus className="h-3.5 w-3.5" />
          Tilføy filter
        </button>
      </div>

      {/* Gruppevisning */}
      <GruppeSeksjon
        tittel="Generelt"
        grupper={generelt}
        onLeggTilMedlem={handleLeggTilMedlem}
        onDoubleClickGruppe={setRedigerGruppe}
      />
      <GruppeSeksjon
        tittel="Field"
        grupper={field}
        onLeggTilMedlem={handleLeggTilMedlem}
        onDoubleClickGruppe={setRedigerGruppe}
      />
      <GruppeSeksjon
        tittel="Brukergrupper"
        grupper={brukergrupper}
        onLeggTilMedlem={handleLeggTilMedlem}
        onDoubleClickGruppe={setRedigerGruppe}
      />

      {filtrert.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-400">
          Ingen grupper matcher søket
        </div>
      )}

      {/* Rediger gruppe modal */}
      {redigerGruppe && prosjektId && (
        <RedigerGruppeModal
          open={!!redigerGruppe}
          onClose={() => setRedigerGruppe(null)}
          gruppe={redigerGruppe}
          prosjektId={prosjektId}
        />
      )}

      {/* Ny gruppe modal */}
      <Modal
        open={visNyGruppeModal}
        onClose={() => setVisNyGruppeModal(false)}
        title="Legg til gruppe"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // Fremtidig: lagre gruppe via tRPC
            setVisNyGruppeModal(false);
            setNyGruppeNavn("");
          }}
          className="flex flex-col gap-4"
        >
          <Input
            label="Gruppenavn"
            placeholder="F.eks. HMS-ledere"
            value={nyGruppeNavn}
            onChange={(e) => setNyGruppeNavn(e.target.value)}
            required
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Kategori
            </label>
            <select
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-siteflow-primary focus:outline-none focus:ring-1 focus:ring-siteflow-primary"
              value={nyGruppeKategori}
              onChange={(e) =>
                setNyGruppeKategori(
                  e.target.value as "generelt" | "field" | "brukergrupper",
                )
              }
            >
              <option value="generelt">Generelt</option>
              <option value="field">Field</option>
              <option value="brukergrupper">Brukergrupper</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit">Opprett</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setVisNyGruppeModal(false)}
            >
              Avbryt
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

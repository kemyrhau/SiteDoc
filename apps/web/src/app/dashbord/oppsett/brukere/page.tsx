"use client";

import { useState, useEffect } from "react";
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
  Mail,
  RefreshCw,
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
  ventendeInvitasjon?: { id: string };
}

interface BrukerGruppe {
  id: string;
  navn: string;
  kategori: "generelt" | "field" | "brukergrupper";
  medlemmer: BrukerGruppeMedlem[];
  ikon?: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/*  DB-gruppetype (for å unngå TS2589 med tRPC-inferens)              */
/* ------------------------------------------------------------------ */

interface DbGruppe {
  id: string;
  name: string;
  slug: string;
  category: string;
  members: {
    id: string;
    projectMember: {
      user: { name: string | null; email: string };
      enterprise: { name: string } | null;
    };
  }[];
}

/* ------------------------------------------------------------------ */
/*  Ikon-mapping for DB-grupper (slug → ikon)                         */
/* ------------------------------------------------------------------ */

const SLUG_IKON: Record<string, React.ReactNode> = {
  "field-admin": <Key className="h-4 w-4" />,
  "oppgave-sjekkliste-koord": <Settings className="h-4 w-4" />,
  "field-observatorer": <Eye className="h-4 w-4" />,
  "hms-ledere": <AlertTriangle className="h-4 w-4" />,
};

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

  // Er dette en DB-gruppe (UUID)?
  const erDbGruppe =
    !gruppe.id.startsWith("ent-") && gruppe.id !== "prosjektadmin";

  const utils = trpc.useUtils();

  const leggTilMedlem = trpc.medlem.leggTil.useMutation({
    onSuccess: () => {
      resetLeggTilSkjema();
      utils.prosjekt.hentMedId.invalidate({ id: prosjektId });
      utils.entreprise.hentForProsjekt.invalidate({ projectId: prosjektId });
      utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
      utils.invitasjon.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
    onError: (error) => {
      setFeilmelding(error.message);
    },
    onSettled: () => {
      setLeggerTil(false);
    },
  });

  const leggTilGruppeMedlem = trpc.gruppe.leggTilMedlem.useMutation({
    onSuccess: () => {
      resetLeggTilSkjema();
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
      utils.invitasjon.hentForProsjekt.invalidate({ projectId: prosjektId });
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

  const fjernGruppeMedlem = trpc.gruppe.fjernMedlem.useMutation({
    onSuccess: () => {
      setValgtMedlemId(null);
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  const oppdaterGruppe = trpc.gruppe.oppdater.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  const trekkTilbake = trpc.invitasjon.trekkTilbake.useMutation({
    onSuccess: () => {
      utils.invitasjon.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  const sendPaNytt = trpc.invitasjon.sendPaNytt.useMutation({
    onSuccess: () => {
      utils.invitasjon.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  function resetLeggTilSkjema() {
    setNyEpost("");
    setNyFornavn("");
    setNyEtternavn("");
    setNyTelefon("");
    setLeggTilSteg(1);
    setVisLeggTil(false);
    setFeilmelding("");
  }

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

    if (gruppe.id.startsWith("ent-")) {
      // Entreprise-gruppe
      leggTilMedlem.mutate({
        projectId: prosjektId,
        email: nyEpost.trim(),
        firstName: nyFornavn.trim(),
        lastName: nyEtternavn.trim(),
        phone: nyTelefon.trim() || undefined,
        role: "member",
        enterpriseId: gruppe.id.replace("ent-", ""),
      });
    } else if (gruppe.id === "prosjektadmin") {
      // Prosjektadministrator-gruppe
      leggTilMedlem.mutate({
        projectId: prosjektId,
        email: nyEpost.trim(),
        firstName: nyFornavn.trim(),
        lastName: nyEtternavn.trim(),
        phone: nyTelefon.trim() || undefined,
        role: "admin",
      });
    } else {
      // DB-gruppe (UUID)
      leggTilGruppeMedlem.mutate({
        groupId: gruppe.id,
        projectId: prosjektId,
        email: nyEpost.trim(),
        firstName: nyFornavn.trim(),
        lastName: nyEtternavn.trim(),
        phone: nyTelefon.trim() || undefined,
      });
    }
  }

  function handleFjern(medlemId?: string) {
    const id = medlemId ?? valgtMedlemId;
    if (!id) return;
    if (erDbGruppe) {
      fjernGruppeMedlem.mutate({ id });
    } else {
      fjernMedlem.mutate({ id });
    }
  }

  function handleNavnLagre() {
    setRedigererNavn(false);
    if (erDbGruppe && nyttGruppeNavn !== gruppe.navn && nyttGruppeNavn.trim()) {
      oppdaterGruppe.mutate({ id: gruppe.id, name: nyttGruppeNavn.trim() });
    }
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
              onBlur={handleNavnLagre}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNavnLagre();
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
                if (erDbGruppe) {
                  setRedigererNavn(true);
                  setNyttGruppeNavn(nyttGruppeNavn || gruppe.navn);
                }
              }}
              className={`flex-1 text-sm font-medium text-gray-900 ${erDbGruppe ? "cursor-text" : ""}`}
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
              onClick={() => handleFjern()}
              disabled={
                !valgtMedlemId ||
                fjernMedlem.isPending ||
                fjernGruppeMedlem.isPending
              }
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
                  className={`group/row cursor-pointer border-b border-gray-100 transition-colors ${
                    valgtMedlemId === medlem.id
                      ? "bg-blue-50"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <td className="py-2.5">
                    <div className="flex items-center gap-2.5">
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
                      {medlem.ventendeInvitasjon && (
                        <span className="flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                          <Mail className="h-3 w-3" />
                          Invitasjon sendt
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="flex-1">{medlem.firma ?? "—"}</span>
                      {medlem.ventendeInvitasjon && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              sendPaNytt.mutate({ id: medlem.ventendeInvitasjon!.id });
                            }}
                            disabled={sendPaNytt.isPending}
                            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-siteflow-primary hover:bg-blue-50"
                            title="Ettersend invitasjon"
                          >
                            <RefreshCw className={`h-3 w-3 ${sendPaNytt.isPending ? "animate-spin" : ""}`} />
                            Ettersend
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              trekkTilbake.mutate({ id: medlem.ventendeInvitasjon!.id });
                            }}
                            disabled={trekkTilbake.isPending}
                            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50"
                            title="Deaktiver invitasjon"
                          >
                            <X className="h-3 w-3" />
                            Deaktiver
                          </button>
                        </>
                      )}
                      {!medlem.ventendeInvitasjon && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFjern(medlem.id);
                          }}
                          disabled={fjernMedlem.isPending || fjernGruppeMedlem.isPending}
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-red-600 opacity-0 group-hover/row:opacity-100 hover:bg-red-50"
                          title="Fjern medlem"
                        >
                          <Trash2 className="h-3 w-3" />
                          Fjern
                        </button>
                      )}
                    </div>
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
                      resetLeggTilSkjema();
                    }}
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

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
                {medlem.ventendeInvitasjon && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-600">
                    <Mail className="h-3 w-3" />
                    Invitasjon sendt
                  </span>
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

  const utils = trpc.useUtils();

  // Hent prosjektmedlemmer og entrepriser for å populere grupper
  const { data: prosjekt } = trpc.prosjekt.hentMedId.useQuery(
    { id: prosjektId! },
    { enabled: !!prosjektId },
  );

  const { data: entrepriser } = trpc.entreprise.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  // Hent DB-grupper
  const { data: dbGrupper } = trpc.gruppe.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  // Hent ventende invitasjoner
  const { data: invitasjoner } = trpc.invitasjon.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  // Bygg map: "gruppeNøkkel:e-post" → invitasjon
  // Nøkkel-format: groupId, "ent-enterpriseId", eller "prosjektadmin"
  const ventendeInvitasjonerMap = new Map<string, { id: string }>();
  if (invitasjoner) {
    for (const inv of invitasjoner) {
      if (inv.status !== "pending") continue;
      const epost = inv.email.toLowerCase();
      if (inv.group?.id) {
        ventendeInvitasjonerMap.set(`${inv.group.id}:${epost}`, { id: inv.id });
      } else if (inv.enterprise?.id) {
        ventendeInvitasjonerMap.set(`ent-${inv.enterprise.id}:${epost}`, { id: inv.id });
      } else if (inv.role === "admin") {
        ventendeInvitasjonerMap.set(`prosjektadmin:${epost}`, { id: inv.id });
      }
      // Også global fallback for tilfeller der gruppen ikke er spesifisert
      if (!ventendeInvitasjonerMap.has(`global:${epost}`)) {
        ventendeInvitasjonerMap.set(`global:${epost}`, { id: inv.id });
      }
    }
  }

  function finnInvitasjon(gruppeId: string, epost?: string): { id: string } | undefined {
    if (!epost) return undefined;
    const e = epost.toLowerCase();
    return ventendeInvitasjonerMap.get(`${gruppeId}:${e}`) ?? ventendeInvitasjonerMap.get(`global:${e}`);
  }

  // Lazy opprettelse av standardgrupper
  const opprettStandardgrupper = trpc.gruppe.opprettStandardgrupper.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId! });
    },
  });

  useEffect(() => {
    if (prosjektId && dbGrupper && dbGrupper.length === 0 && !opprettStandardgrupper.isPending) {
      opprettStandardgrupper.mutate({ projectId: prosjektId });
    }
  }, [prosjektId, dbGrupper]); // eslint-disable-line react-hooks/exhaustive-deps

  // Opprett ny gruppe
  const opprettGruppe = trpc.gruppe.opprett.useMutation({
    onSuccess: () => {
      setVisNyGruppeModal(false);
      setNyGruppeNavn("");
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId! });
    },
  });

  // Bygg Field-grupper fra DB-data
  const fieldGrupper: BrukerGruppe[] = ((dbGrupper ?? []) as DbGruppe[]).map((g) => ({
    id: g.id,
    navn: g.name,
    kategori: g.category as "generelt" | "field" | "brukergrupper",
    ikon: SLUG_IKON[g.slug] ?? <Users className="h-4 w-4" />,
    medlemmer: g.members.map((m) => ({
      id: m.id,
      navn: m.projectMember.user.name ?? m.projectMember.user.email ?? "Ukjent",
      epost: m.projectMember.user.email ?? undefined,
      firma: m.projectMember.enterprise?.name ?? undefined,
      ventendeInvitasjon: finnInvitasjon(g.id, m.projectMember.user.email),
    })),
  }));

  // Bygg grupper fra data
  const grupper: BrukerGruppe[] = [
    // Generelt — prosjektadministratorer fra ProjectMember.role
    {
      id: "prosjektadmin",
      navn: "Prosjektadministratorer",
      kategori: "generelt",
      ikon: <Shield className="h-4 w-4" />,
      medlemmer: prosjekt?.members
        ?.filter((m) => m.role === "admin" || m.role === "owner")
        .map((m) => ({
          id: m.id,
          navn: m.user.name ?? m.user.email ?? "Ukjent",
          epost: m.user.email ?? undefined,
          rolle: m.role === "owner" ? "Kontaktperson" : undefined,
          ventendeInvitasjon: finnInvitasjon("prosjektadmin", m.user.email),
        })) ?? [],
    },
    // Field-grupper fra DB
    ...fieldGrupper,
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
        ventendeInvitasjon: finnInvitasjon(`ent-${ent.id}`, m.user?.email ?? undefined),
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

  function handleOpprettGruppe(e: React.FormEvent) {
    e.preventDefault();
    if (!prosjektId || !nyGruppeNavn.trim()) return;
    opprettGruppe.mutate({
      projectId: prosjektId,
      name: nyGruppeNavn.trim(),
      category: nyGruppeKategori,
    });
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
          onSubmit={handleOpprettGruppe}
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
            <Button type="submit" disabled={opprettGruppe.isPending}>
              {opprettGruppe.isPending ? "Oppretter..." : "Opprett"}
            </Button>
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

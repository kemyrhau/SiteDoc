"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { Button, Input, Modal, SearchInput } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Search,
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
  ClipboardCheck,
  ListTodo,
  Map,
  Box,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Typer                                                              */
/* ------------------------------------------------------------------ */

interface BrukerGruppeMedlem {
  id: string;
  projectMemberId?: string;
  navn: string;
  epost?: string;
  telefon?: string;
  firma?: string;
  rolle?: string;
  erAdmin?: boolean;
  ventendeInvitasjon?: { id: string };
}

interface BrukerGruppe {
  id: string;
  navn: string;
  kategori: "generelt" | "field" | "brukergrupper";
  medlemmer: BrukerGruppeMedlem[];
  moduler?: string[];
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
  isDefault?: boolean;
  domains?: unknown;
  groupEnterprises?: {
    id: string;
    enterprise: { id: string; name: string };
  }[];
  members: {
    id: string;
    isAdmin: boolean;
    projectMember: {
      id: string;
      user: { name: string | null; email: string; phone?: string | null };
      enterprises: { enterprise: { name: string } }[];
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
  dbGruppe,
  alleEntrepriser,
}: {
  open: boolean;
  onClose: () => void;
  gruppe: BrukerGruppe;
  prosjektId: string;
  dbGruppe?: DbGruppe | null;
  alleEntrepriser?: { id: string; name: string }[];
}) {
  const [sok, setSok] = useState("");
  const [valgtMedlemId, setValgtMedlemId] = useState<string | null>(null);
  const [visLeggTil, setVisLeggTil] = useState(false);
  const [nyEpost, setNyEpost] = useState("");
  const [leggTilSteg, setLeggTilSteg] = useState<1 | 2>(1);
  const [nyFornavn, setNyFornavn] = useState("");
  const [nyEtternavn, setNyEtternavn] = useState("");
  const [nyTelefon, setNyTelefon] = useState("");
  const [nyMelding, setNyMelding] = useState("");
  const [leggerTil, setLeggerTil] = useState(false);
  const [feilmelding, setFeilmelding] = useState("");
  const [redigererNavn, setRedigererNavn] = useState(false);
  const [nyttGruppeNavn, setNyttGruppeNavn] = useState(gruppe.navn);
  const [redigererMedlem, setRedigererMedlem] = useState(false);
  const { t } = useTranslation();
  const [redigerNavn, setRedigerNavn] = useState("");
  const [redigerEpost, setRedigerEpost] = useState("");
  const [redigerTelefon, setRedigerTelefon] = useState("");
  const [redigerRolle, setRedigerRolle] = useState<"member" | "admin">("member");

  // Er dette en DB-gruppe (UUID)?
  const erDbGruppe =
    !gruppe.id.startsWith("ent-") && gruppe.id !== "prosjektadmin";
  const erEntrepriseGruppe = gruppe.id.startsWith("ent-");

  // Hent alle prosjektmedlemmer for hurtigvalg
  const { data: alleMedlemmer } = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );

  // Filtrer ut medlemmer som allerede er i gruppen
  const eksisterendeMedlemEposter = new Set(
    gruppe.medlemmer.map((m) => m.epost?.toLowerCase()).filter(Boolean),
  );
  const tilgjengeligeMedlemmer = (alleMedlemmer as Array<{
    id: string;
    user: { name: string | null; email: string };
  }> | undefined)?.filter(
    (m) => !eksisterendeMedlemEposter.has(m.user.email.toLowerCase()),
  ) ?? [];

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

  const fjernFraEntreprise = trpc.medlem.fjernFraEntreprise.useMutation({
    onSuccess: () => {
      setValgtMedlemId(null);
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

  const oppdaterDomener = trpc.gruppe.oppdaterDomener.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  const oppdaterEntrepriser = trpc.gruppe.oppdaterEntrepriser.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  const oppdaterModuler = trpc.gruppe.oppdaterModuler.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  const oppdaterBygninger = trpc.gruppe.oppdaterBygninger.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });
  const settGruppeAdmin = trpc.gruppe.settGruppeAdmin.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  // Hent bygninger for bygningsvelger
  const { data: _alleBygninger } = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );
  const alleBygninger = (_alleBygninger ?? []) as Array<{ id: string; name: string }>;

  const oppdaterMedlem = trpc.medlem.oppdater.useMutation({
    onSuccess: () => {
      setRedigererMedlem(false);
      setValgtMedlemId(null);
      setFeilmelding("");
      utils.prosjekt.hentMedId.invalidate({ id: prosjektId });
      utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
      utils.entreprise.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
    onError: (error) => {
      setFeilmelding(error.message);
    },
  });

  const trekkTilbake = trpc.invitasjon.trekkTilbake.useMutation({
    onSuccess: () => {
      utils.invitasjon.hentForProsjekt.invalidate({ projectId: prosjektId });
    },
  });

  const [bekreftSlett, setBekreftSlett] = useState(false);

  const slettGruppe = trpc.gruppe.slett.useMutation({
    onSuccess: () => {
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId });
      onClose();
    },
  });

  const [ettersendId, setEttersendId] = useState<string | null>(null);
  const [ettersendMelding, setEttersendMelding] = useState("");

  const sendPaNytt = trpc.invitasjon.sendPaNytt.useMutation({
    onSuccess: () => {
      utils.invitasjon.hentForProsjekt.invalidate({ projectId: prosjektId });
      setEttersendId(null);
      setEttersendMelding("");
    },
  });

  function resetLeggTilSkjema() {
    setNyEpost("");
    setNyFornavn("");
    setNyEtternavn("");
    setNyTelefon("");
    setNyMelding("");
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
      setFeilmelding(t("feil.ugyldigEpost"));
      return;
    }
    setFeilmelding("");
    setLeggTilSteg(2);
  }

  function handleLeggTil(e: React.FormEvent) {
    e.preventDefault();
    if (!nyFornavn.trim() || !nyEtternavn.trim()) {
      setFeilmelding(t("feil.navnPaakrevd"));
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
        enterpriseIds: [gruppe.id.replace("ent-", "")],
        melding: nyMelding.trim() || undefined,
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
        melding: nyMelding.trim() || undefined,
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
        melding: nyMelding.trim() || undefined,
      });
    }
  }

  function handleFjern(medlemId?: string) {
    const id = medlemId ?? valgtMedlemId;
    if (!id) return;
    if (erDbGruppe) {
      // DB-gruppe: fjern kun gruppemedlemskap (ProjectGroupMember)
      fjernGruppeMedlem.mutate({ id, projectId: prosjektId });
    } else if (erEntrepriseGruppe) {
      // Entreprise-gruppe: fjern kun entreprisetilknytning, IKKE prosjektmedlemskap
      fjernFraEntreprise.mutate({
        projectMemberId: id,
        enterpriseId: gruppe.id.replace("ent-", ""),
        projectId: prosjektId,
      });
    } else {
      // Prosjektadmin: fjern fra prosjektet
      fjernMedlem.mutate({ id, projectId: prosjektId });
    }
  }

  function handleNavnLagre() {
    setRedigererNavn(false);
    if (erDbGruppe && nyttGruppeNavn !== gruppe.navn && nyttGruppeNavn.trim()) {
      oppdaterGruppe.mutate({ id: gruppe.id, name: nyttGruppeNavn.trim(), projectId: prosjektId });
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("brukere.redigerBrukergrupper")}
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
              className="flex-1 border-b border-sitedoc-primary bg-transparent text-sm font-medium outline-none"
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
              {t("handling.leggTil")}
            </button>
            <button
              onClick={() => {
                if (valgtMedlemId) {
                  const medlem = gruppe.medlemmer.find((m) => m.id === valgtMedlemId);
                  if (medlem) {
                    setRedigerNavn(medlem.navn);
                    setRedigerEpost(medlem.epost ?? "");
                    setRedigerTelefon(medlem.telefon ?? "");
                    setRedigerRolle(
                      medlem.rolle === t("label.kontakt") || gruppe.id === "prosjektadmin"
                        ? "admin"
                        : "member",
                    );
                    setFeilmelding("");
                    setRedigererMedlem(true);
                  }
                }
              }}
              disabled={!valgtMedlemId}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm ${
                valgtMedlemId
                  ? "text-gray-600 hover:bg-gray-100"
                  : "text-gray-400"
              }`}
            >
              <Pencil className="h-4 w-4" />
              {t("handling.rediger")}
            </button>
            <button
              onClick={() => handleFjern()}
              disabled={
                !valgtMedlemId ||
                fjernMedlem.isPending ||
                fjernGruppeMedlem.isPending ||
                fjernFraEntreprise.isPending
              }
              className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm ${
                valgtMedlemId
                  ? "text-red-600 hover:bg-red-50"
                  : "text-gray-400"
              }`}
            >
              <Trash2 className="h-4 w-4" />
              {t("handling.fjern")}
            </button>
            <button
              className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm text-gray-400"
              disabled
            >
              <MoreHorizontal className="h-4 w-4" />
              {t("handling.mer")}
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t("brukere.sokPlaceholder")}
              value={sok}
              onChange={(e) => setSok(e.target.value)}
              className="rounded border border-gray-200 py-1.5 pl-8 pr-3 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
            />
          </div>
        </div>

        {/* Medlemstabell */}
        <div className="min-h-[200px] overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="pb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                  {t("tabell.navn")}
                </th>
                <th className="pb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                  {t("tabell.firma")}
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
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900">
                          {medlem.navn}
                        </span>
                        {medlem.epost && (
                          <span className="text-xs text-gray-400">{medlem.epost}</span>
                        )}
                      </div>
                      {medlem.rolle && (
                        <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">
                          {medlem.rolle}
                        </span>
                      )}
                      {erDbGruppe && medlem.erAdmin && (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                          {t("brukere.gruppeadmin")}
                        </span>
                      )}
                      {medlem.ventendeInvitasjon && (
                        <span className="flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                          <Mail className="h-3 w-3" />
                          {t("brukere.invitasjonSendt")}
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
                              setEttersendId(medlem.ventendeInvitasjon!.id);
                              setEttersendMelding("");
                            }}
                            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-sitedoc-primary hover:bg-blue-50"
                            title={t("brukere.ettersendInvitasjon")}
                          >
                            <RefreshCw className="h-3 w-3" />
                            {t("brukere.ettersend")}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              trekkTilbake.mutate({ id: medlem.ventendeInvitasjon!.id });
                            }}
                            disabled={trekkTilbake.isPending}
                            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50"
                            title={t("brukere.deaktiverInvitasjon")}
                          >
                            <X className="h-3 w-3" />
                            {t("brukere.deaktiver")}
                          </button>
                        </>
                      )}
                      {!medlem.ventendeInvitasjon && erDbGruppe && medlem.projectMemberId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            settGruppeAdmin.mutate({
                              groupId: gruppe.id,
                              projectId: prosjektId,
                              projectMemberId: medlem.projectMemberId!,
                              isAdmin: !medlem.erAdmin,
                            });
                          }}
                          disabled={settGruppeAdmin.isPending}
                          className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs opacity-0 group-hover/row:opacity-100 ${
                            medlem.erAdmin ? "text-blue-600 hover:bg-blue-50" : "text-gray-500 hover:bg-gray-100"
                          }`}
                          title={medlem.erAdmin ? t("brukere.fjernAdmin") : t("brukere.gjorTilAdmin")}
                        >
                          <Shield className="h-3 w-3" />
                          {medlem.erAdmin ? t("brukere.fjernAdmin") : t("brukere.gruppeadmin")}
                        </button>
                      )}
                      {!medlem.ventendeInvitasjon && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFjern(medlem.id);
                          }}
                          disabled={fjernMedlem.isPending || fjernGruppeMedlem.isPending || fjernFraEntreprise.isPending}
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-red-600 opacity-0 group-hover/row:opacity-100 hover:bg-red-50"
                          title={t("brukere.fjernMedlem")}
                        >
                          <Trash2 className="h-3 w-3" />
                          {t("handling.fjern")}
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
                    {t("brukere.ingenMedlemmer")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Inline rediger medlem */}
          {redigererMedlem && valgtMedlemId && (() => {
            const valgtMedlem = gruppe.medlemmer.find((m) => m.id === valgtMedlemId);
            if (!valgtMedlem) return null;
            const pmId = valgtMedlem.projectMemberId ?? valgtMedlem.id;
            return (
              <div className="mt-2 rounded border border-blue-200 bg-blue-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    Rediger {valgtMedlem.navn}
                  </span>
                  <button
                    onClick={() => { setRedigererMedlem(false); setFeilmelding(""); }}
                    className="rounded p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">{t("tabell.navn")}</label>
                    <input
                      type="text"
                      value={redigerNavn}
                      onChange={(e) => setRedigerNavn(e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">{t("label.epost")}</label>
                    <input
                      type="email"
                      value={redigerEpost}
                      onChange={(e) => setRedigerEpost(e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">{t("label.telefon")}</label>
                    <input
                      type="tel"
                      value={redigerTelefon}
                      onChange={(e) => setRedigerTelefon(e.target.value)}
                      placeholder={t("label.valgfritt")}
                      className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">{t("label.rolle")}</label>
                    <select
                      value={redigerRolle}
                      onChange={(e) => setRedigerRolle(e.target.value as "member" | "admin")}
                      className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
                    >
                      <option value="member">{t("brukere.medlem")}</option>
                      <option value="admin">{t("brukere.administrator")}</option>
                    </select>
                  </div>
                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      onClick={() => {
                        oppdaterMedlem.mutate({
                          id: pmId,
                          projectId: prosjektId,
                          name: redigerNavn.trim() || undefined,
                          email: redigerEpost.trim() || undefined,
                          phone: redigerTelefon.trim(),
                          role: redigerRolle,
                        });
                      }}
                      disabled={oppdaterMedlem.isPending || !redigerNavn.trim()}
                    >
                      {oppdaterMedlem.isPending ? t("handling.lagrer") : t("handling.lagre")}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Inline legg til — samlet visning av gruppemedlemmer og tilgjengelige */}
          {visLeggTil && (
            <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500">{t("brukere.prosjektmedlemmer")}</p>
                <button
                  type="button"
                  onClick={() => resetLeggTilSkjema()}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Samlet medlemsliste: allerede i gruppen + tilgjengelige */}
              {(gruppe.medlemmer.length > 0 || tilgjengeligeMedlemmer.length > 0) && (
                <div className="mb-3 max-h-52 space-y-0.5 overflow-y-auto rounded border border-gray-200 bg-white p-1.5">
                  {/* Eksisterende gruppemedlemmer (med hake) */}
                  {gruppe.medlemmer.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-400"
                    >
                      <div className="flex h-5 w-5 items-center justify-center rounded bg-green-100">
                        <svg className="h-3 w-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="font-medium text-gray-500">{m.navn}</span>
                      {m.epost && <span className="text-xs text-gray-300">{m.epost}</span>}
                      <span className="ml-auto text-xs text-green-600">I gruppen</span>
                    </div>
                  ))}

                  {/* Tilgjengelige prosjektmedlemmer (klikkbare for å legge til) */}
                  {tilgjengeligeMedlemmer.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      disabled={leggerTil}
                      onClick={() => {
                        setFeilmelding("");
                        setLeggerTil(true);
                        if (erDbGruppe) {
                          leggTilGruppeMedlem.mutate({
                            groupId: gruppe.id,
                            projectId: prosjektId,
                            email: m.user.email,
                            firstName: m.user.name?.split(" ")[0] ?? "",
                            lastName: m.user.name?.split(" ").slice(1).join(" ") ?? "",
                          });
                        } else if (gruppe.id.startsWith("ent-")) {
                          leggTilMedlem.mutate({
                            projectId: prosjektId,
                            email: m.user.email,
                            firstName: m.user.name?.split(" ")[0] ?? "",
                            lastName: m.user.name?.split(" ").slice(1).join(" ") ?? "",
                            role: "member",
                            enterpriseIds: [gruppe.id.replace("ent-", "")],
                          });
                        } else if (gruppe.id === "prosjektadmin") {
                          leggTilMedlem.mutate({
                            projectId: prosjektId,
                            email: m.user.email,
                            firstName: m.user.name?.split(" ")[0] ?? "",
                            lastName: m.user.name?.split(" ").slice(1).join(" ") ?? "",
                            role: "admin",
                          });
                        }
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-blue-50 disabled:opacity-50"
                    >
                      <div className="flex h-5 w-5 items-center justify-center rounded border border-gray-300 bg-white">
                        <Plus className="h-3 w-3 text-gray-400" />
                      </div>
                      <span className="font-medium text-gray-900">{m.user.name ?? m.user.email}</span>
                      <span className="text-xs text-gray-400">{m.user.email}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Ny bruker via e-post */}
              <p className="mb-1.5 text-xs font-medium text-gray-500">
                Inviter ny bruker
              </p>
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
                    className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary disabled:bg-gray-100 disabled:text-gray-500"
                  />
                  {leggTilSteg === 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        setLeggTilSteg(1);
                        setNyFornavn("");
                        setNyEtternavn("");
                        setNyTelefon("");
                        setNyMelding("");
                      }}
                      className="rounded p-1 text-gray-400 hover:text-gray-600"
                      title={t("brukere.endreEpost")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
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
                        className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
                      />
                      <input
                        type="text"
                        placeholder="Etternavn *"
                        value={nyEtternavn}
                        onChange={(e) => {
                          setNyEtternavn(e.target.value);
                          setFeilmelding("");
                        }}
                        className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
                      />
                    </div>
                    <input
                      type="tel"
                      placeholder="Telefonnummer (valgfritt)"
                      value={nyTelefon}
                      onChange={(e) => setNyTelefon(e.target.value)}
                      className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
                    />
                    <textarea
                      placeholder="Personlig melding (valgfritt)"
                      value={nyMelding}
                      onChange={(e) => setNyMelding(e.target.value)}
                      rows={2}
                      maxLength={500}
                      className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
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
                      {leggerTil ? t("handling.laster") : t("handling.leggTil")}
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

        {/* Moduler — feltarbeid-admin kan slå av/på */}
        {erDbGruppe && dbGruppe && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h4 className="mb-3 text-sm font-semibold text-gray-900">{t("brukere.moduler")}</h4>
            <p className="mb-2 text-xs text-gray-500">{t("brukere.modulerBeskrivelse")}</p>
            <div className="flex flex-col gap-2">
              {([
                { id: "sjekklister", labelKey: "brukere.sjekklister", ikon: <ClipboardCheck className="h-4 w-4" /> },
                { id: "oppgaver", labelKey: "brukere.oppgaver", ikon: <ListTodo className="h-4 w-4" /> },
                { id: "tegninger", labelKey: "brukere.tegninger", ikon: <Map className="h-4 w-4" /> },
                { id: "3d", labelKey: "brukere.3dModeller", ikon: <Box className="h-4 w-4" /> },
              ] as const).map((modul) => {
                const aktiveModuler = ((dbGruppe as unknown as { modules?: string[] }).modules ?? ["sjekklister", "oppgaver", "tegninger", "3d"]);
                const erAktiv = aktiveModuler.includes(modul.id);
                return (
                  <label key={modul.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={erAktiv}
                      onChange={() => {
                        const nyeModuler = erAktiv
                          ? aktiveModuler.filter((m: string) => m !== modul.id)
                          : [...aktiveModuler, modul.id];
                        oppdaterModuler.mutate({
                          groupId: dbGruppe.id,
                          projectId: prosjektId,
                          modules: nyeModuler as ("sjekklister" | "oppgaver" | "tegninger" | "3d")[],
                        });
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary focus:ring-sitedoc-primary"
                    />
                    <span className="flex items-center gap-1.5 text-sm text-gray-700">
                      {modul.ikon} {t(modul.labelKey)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Bygninger — velg hvilke bygninger gruppen ser */}
        {erDbGruppe && dbGruppe && alleBygninger && alleBygninger.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h4 className="mb-3 text-sm font-semibold text-gray-900">{t("brukere.bygninger")}</h4>
            <p className="mb-2 text-xs text-gray-500">{t("brukere.bygningerBeskrivelse")}</p>
            <div className="flex flex-col gap-2">
              {alleBygninger.map((b) => {
                const bygningIder = ((dbGruppe as unknown as { buildingIds?: string[] | null }).buildingIds) ?? null;
                const alleValgt = bygningIder === null;
                const erValgt = alleValgt || (bygningIder?.includes(b.id) ?? false);
                return (
                  <label key={b.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={erValgt}
                      onChange={() => {
                        let nye: string[] | null;
                        if (alleValgt) {
                          // Gå fra alle → kun denne fjernes
                          nye = alleBygninger.filter((x) => x.id !== b.id).map((x) => x.id);
                        } else {
                          if (erValgt) {
                            nye = bygningIder!.filter((id: string) => id !== b.id);
                            if (nye.length === 0) nye = null; // Ingen = alle
                          } else {
                            nye = [...(bygningIder ?? []), b.id];
                            if (nye.length === alleBygninger.length) nye = null; // Alle = null
                          }
                        }
                        oppdaterBygninger.mutate({
                          groupId: dbGruppe.id,
                          projectId: prosjektId,
                          buildingIds: nye,
                        });
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary focus:ring-sitedoc-primary"
                    />
                    <span className="text-sm text-gray-700">{b.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Slett gruppe */}
        {erDbGruppe && !dbGruppe?.isDefault && (
          <div className="border-t border-gray-200 pt-4">
            {bekreftSlett ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  Er du sikker? Alle medlemmer fjernes fra gruppen.
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setBekreftSlett(false)}
                >
                  Avbryt
                </Button>
                <Button
                  size="sm"
                  className="bg-red-600 text-white hover:bg-red-700"
                  disabled={slettGruppe.isPending}
                  onClick={() => slettGruppe.mutate({ id: gruppe.id, projectId: prosjektId })}
                >
                  {slettGruppe.isPending ? t("handling.sletter") : t("brukere.bekreftSletting")}
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setBekreftSlett(true)}
                className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Slett gruppe
              </button>
            )}
          </div>
        )}
      </div>

      {/* Ettersend-modal med personlig melding */}
      <Modal
        open={ettersendId !== null}
        onClose={() => { setEttersendId(null); setEttersendMelding(""); }}
        title={t("brukere.ettersendInvitasjon")}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            {t("brukere.ettersendBeskrivelse")}
          </p>
          <textarea
            placeholder={t("brukere.personligMelding")}
            value={ettersendMelding}
            onChange={(e) => setEttersendMelding(e.target.value)}
            rows={3}
            maxLength={500}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setEttersendId(null); setEttersendMelding(""); }}
            >
              {t("handling.avbryt")}
            </Button>
            <Button
              size="sm"
              disabled={sendPaNytt.isPending}
              onClick={() => {
                if (!ettersendId) return;
                sendPaNytt.mutate({
                  id: ettersendId,
                  melding: ettersendMelding.trim() || undefined,
                });
              }}
            >
              {sendPaNytt.isPending ? t("handling.sender") : t("brukere.sendInvitasjon")}
            </Button>
          </div>
        </div>
      </Modal>
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
  const { t } = useTranslation();
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
      {/* Header med modulikoner */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h4 className="truncate text-sm font-semibold text-gray-900">
          {gruppe.navn}
        </h4>
        <div className="flex gap-1.5">
          {(gruppe.moduler ?? ["sjekklister", "oppgaver", "tegninger", "3d"]).map((modul) => {
            const info: Record<string, { ikon: JSX.Element; tekst: string }> = {
              sjekklister: { ikon: <ClipboardCheck className="h-3.5 w-3.5" />, tekst: t("brukere.sjekklister") },
              oppgaver: { ikon: <ListTodo className="h-3.5 w-3.5" />, tekst: t("brukere.oppgaver") },
              tegninger: { ikon: <Map className="h-3.5 w-3.5" />, tekst: t("brukere.tegninger") },
              "3d": { ikon: <Box className="h-3.5 w-3.5" />, tekst: t("brukere.3dModeller") },
            };
            const m = info[modul];
            if (!m) return null;
            return (
              <div key={modul} title={m.tekst} className="relative cursor-help text-sitedoc-primary group/tip">
                {m.ikon}
                <div className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-2 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover/tip:opacity-100">
                  {m.tekst}
                </div>
              </div>
            );
          })}
        </div>
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
                {medlem.epost && (
                  <span className="text-xs text-gray-400">{medlem.epost}</span>
                )}
                {medlem.rolle && (
                  <span className="text-xs text-gray-400">{medlem.rolle}</span>
                )}
                {medlem.ventendeInvitasjon && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-600">
                    <Mail className="h-3 w-3" />
                    {t("brukere.invitasjonSendt")}
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
                + {skjulte} {t("handling.mer")}
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <span className="text-sm text-gray-300">{t("brukere.tomGruppe")}</span>
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
            className="flex items-center gap-1.5 text-xs text-sitedoc-primary hover:underline"
          >
            <UserPlus className="h-3.5 w-3.5" />
            {t("brukere.leggTilMedlem")}
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
  onOpprett,
}: {
  tittel: string;
  grupper: BrukerGruppe[];
  onLeggTilMedlem?: (gruppeId: string) => void;
  onDoubleClickGruppe?: (gruppe: BrukerGruppe) => void;
  onOpprett?: () => void;
}) {
  const { t } = useTranslation();
  if (grupper.length === 0 && !onOpprett) return null;
  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">{tittel}</h3>
        {onOpprett && (
          <button
            onClick={onOpprett}
            className="flex items-center gap-1 rounded-lg bg-sitedoc-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800"
          >
            {t("brukere.nyGruppe")}
          </button>
        )}
      </div>
      {grupper.length > 0 ? (
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
      ) : (
        <p className="text-sm text-gray-400">{t("brukere.ingenGrupper")}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hovudside                                                          */
/* ------------------------------------------------------------------ */

export default function BrukereSide() {
  const { prosjektId } = useProsjekt();
  const { t } = useTranslation();
  const [sok, setSok] = useState("");
  const [visNyGruppeModal, setVisNyGruppeModal] = useState(false);
  const [nyGruppeNavn, setNyGruppeNavn] = useState("");
  const [nyGruppeKategori, setNyGruppeKategori] = useState<
    "generelt" | "field" | "brukergrupper"
  >("brukergrupper");
  const [visningsModus, setVisningsModus] = useState<"grid" | "liste">("grid");
  const [redigerGruppeId, setRedigerGruppeId] = useState<string | null>(null);

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
  const ventendeInvitasjonerMap: Record<string, { id: string }> = {};
  if (invitasjoner) {
    for (const inv of invitasjoner) {
      if (inv.status !== "pending") continue;
      const epost = inv.email.toLowerCase();
      if (inv.group?.id) {
        ventendeInvitasjonerMap[`${inv.group.id}:${epost}`] = { id: inv.id };
      } else if (inv.enterprise?.id) {
        ventendeInvitasjonerMap[`ent-${inv.enterprise.id}:${epost}`] = { id: inv.id };
      } else if (inv.role === "admin") {
        ventendeInvitasjonerMap[`prosjektadmin:${epost}`] = { id: inv.id };
      }
      if (!ventendeInvitasjonerMap[`global:${epost}`]) {
        ventendeInvitasjonerMap[`global:${epost}`] = { id: inv.id };
      }
    }
  }

  function finnInvitasjon(gruppeId: string, epost?: string): { id: string } | undefined {
    if (!epost) return undefined;
    const e = epost.toLowerCase();
    return ventendeInvitasjonerMap[`${gruppeId}:${e}`] ?? ventendeInvitasjonerMap[`global:${e}`];
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
  }, [prosjektId, dbGrupper]); // eslint-disable-line

  // Opprett ny gruppe
  const opprettGruppe = trpc.gruppe.opprett.useMutation({
    onSuccess: () => {
      setVisNyGruppeModal(false);
      setNyGruppeNavn("");
      utils.gruppe.hentForProsjekt.invalidate({ projectId: prosjektId! });
    },
  });

  // Bygg Field-grupper fra DB-data
  // Ekskluder prosjektadmin-grupper (vises allerede som virtuell gruppe under Generelt)
  // Mapping fra slug til i18n-nøkkel for systemgrupper
  const SLUG_I18N: Record<string, string> = {
    "prosjekt-admin": "brukere.gruppe.prosjektAdmin",
    "field-admin": "brukere.gruppe.fieldAdmin",
    "oppgave-sjekkliste-koord": "brukere.gruppe.oppgaveSjekklisteKoord",
    "field-observatorer": "brukere.gruppe.fieldObservatorer",
    "hms-ledere": "brukere.gruppe.hmsLedere",
    "brukergruppe": "brukere.gruppe.brukergruppe",
  };

  const fieldGrupper: BrukerGruppe[] = ((dbGrupper ?? []) as DbGruppe[]).filter((g) => g.slug !== "prosjekt-admin").map((g) => ({
    id: g.id,
    navn: SLUG_I18N[g.slug] ? t(SLUG_I18N[g.slug] as string) : g.name,
    kategori: g.category as "generelt" | "field" | "brukergrupper",
    moduler: (g as unknown as { modules?: string[] }).modules ?? ["sjekklister", "oppgaver", "tegninger", "3d"],
    ikon: SLUG_IKON[g.slug] ?? <Users className="h-4 w-4" />,
    medlemmer: g.members.map((m) => ({
      id: m.id,
      projectMemberId: m.projectMember.id,
      navn: m.projectMember.user.name ?? m.projectMember.user.email ?? t("brukere.ukjent"),
      epost: m.projectMember.user.email ?? undefined,
      telefon: m.projectMember.user.phone ?? undefined,
      firma: m.projectMember.enterprises?.[0]?.enterprise?.name ?? undefined,
      ventendeInvitasjon: finnInvitasjon(g.id, m.projectMember.user.email),
      erAdmin: m.isAdmin,
    })),
  }));

  // Bygg grupper fra data
  const grupper: BrukerGruppe[] = [
    // Generelt — prosjektadministratorer fra ProjectMember.role
    {
      id: "prosjektadmin",
      navn: t("brukere.prosjektadministratorer"),
      kategori: "generelt",
      ikon: <Shield className="h-4 w-4" />,
      medlemmer: prosjekt?.members
        ?.filter((m) => m.role === "admin" || m.role === "owner")
        .map((m) => ({
          id: m.id,
          navn: m.user.name ?? m.user.email ?? t("brukere.ukjent"),
          epost: m.user.email ?? undefined,
          telefon: (m.user as { phone?: string | null }).phone ?? undefined,
          rolle: m.role === "owner" ? t("label.kontakt") : undefined,
          ventendeInvitasjon: finnInvitasjon("prosjektadmin", m.user.email),
        })) ?? [],
    },
    // Field-grupper og brukergrupper fra DB
    ...fieldGrupper,
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

  // Utled redigerGruppe fra live data (ikke snapshot)
  const redigerGruppe = redigerGruppeId
    ? grupper.find((g) => g.id === redigerGruppeId) ?? null
    : null;

  function handleLeggTilMedlem(gruppeId: string) {
    setRedigerGruppeId(gruppeId);
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
            {t("brukere.leggTilGruppe")}
          </Button>
          <Button variant="ghost" size="sm">
            <Users className="mr-1.5 h-4 w-4" />
            {t("brukere.kontakter")}
          </Button>
        </div>
      </div>

      {/* Tittel + søk */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">{t("brukere.tittel")}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVisningsModus("liste")}
            className={`rounded p-1.5 ${
              visningsModus === "liste"
                ? "bg-gray-200 text-gray-700"
                : "text-gray-400 hover:text-gray-600"
            }`}
            aria-label={t("brukere.listevisning")}
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
            aria-label={t("brukere.rutenettvisning")}
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
          placeholder={t("brukere.sokPlaceholder")}
          className="w-64"
        />
        <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <Plus className="h-3.5 w-3.5" />
          {t("brukere.tilfoeyFilter")}
        </button>
      </div>

      {/* Gruppevisning */}
      <GruppeSeksjon
        tittel={t("brukere.generelt")}
        grupper={generelt}
        onLeggTilMedlem={handleLeggTilMedlem}
        onDoubleClickGruppe={(g) => setRedigerGruppeId(g.id)}
      />
      <GruppeSeksjon
        tittel={t("brukere.feltarbeid")}
        grupper={field}
        onLeggTilMedlem={handleLeggTilMedlem}
        onDoubleClickGruppe={(g) => setRedigerGruppeId(g.id)}
      />
      <GruppeSeksjon
        tittel={t("brukere.brukergrupper")}
        grupper={brukergrupper}
        onLeggTilMedlem={handleLeggTilMedlem}
        onDoubleClickGruppe={(g) => setRedigerGruppeId(g.id)}
        onOpprett={() => {
          setNyGruppeKategori("brukergrupper");
          setVisNyGruppeModal(true);
        }}
      />

      {filtrert.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-400">
          {t("brukere.ingenGrupperMatcher")}
        </div>
      )}

      {/* Rediger gruppe modal */}
      {redigerGruppe && prosjektId && (
        <RedigerGruppeModal
          open={!!redigerGruppe}
          onClose={() => setRedigerGruppeId(null)}
          gruppe={redigerGruppe}
          prosjektId={prosjektId}
          dbGruppe={(dbGrupper as DbGruppe[] | undefined)?.find((g) => g.id === redigerGruppe.id)}
          alleEntrepriser={(entrepriser as { id: string; name: string }[] | undefined) ?? []}
        />
      )}

      {/* Ny gruppe modal */}
      <Modal
        open={visNyGruppeModal}
        onClose={() => setVisNyGruppeModal(false)}
        title={t("brukere.leggTilGruppe")}
      >
        <form
          onSubmit={handleOpprettGruppe}
          className="flex flex-col gap-4"
        >
          <Input
            label={t("brukere.gruppenavn")}
            placeholder="F.eks. HMS-ledere"
            value={nyGruppeNavn}
            onChange={(e) => setNyGruppeNavn(e.target.value)}
            required
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t("brukere.kategori")}
            </label>
            <select
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
              value={nyGruppeKategori}
              onChange={(e) =>
                setNyGruppeKategori(
                  e.target.value as "generelt" | "field" | "brukergrupper",
                )
              }
            >
              <option value="generelt">{t("brukere.generelt")}</option>
              <option value="field">{t("brukere.feltarbeid")}</option>
              <option value="brukergrupper">{t("brukere.brukergrupper")}</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={opprettGruppe.isPending}>
              {opprettGruppe.isPending ? t("handling.oppretter") : t("handling.opprett")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setVisNyGruppeModal(false)}
            >
              {t("handling.avbryt")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

"use client";

import { trpc } from "@/lib/trpc";
import { Spinner, EmptyState } from "@sitedoc/ui";
import { Shield, ShieldAlert, User, Pencil, Plus, X, Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFirma } from "@/kontekst/firma-kontekst";

const ANSATT_ROLLER = ["ansatt", "bas", "prosjektleder", "daglig_leder"] as const;
type AnsattRolle = (typeof ANSATT_ROLLER)[number];

function tilAnsattRolle(verdi: string): AnsattRolle {
  return (ANSATT_ROLLER as readonly string[]).includes(verdi)
    ? (verdi as AnsattRolle)
    : "ansatt";
}

type BrukerRad = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: string;
  createdAt: string | Date;
  memberId: string;
  ansattnummer: string | null;
  avdelingId: string | null;
  ansattRolle: string;
  firmaRoller: string[];
};

export default function FirmaBrukere() {
  const { t } = useTranslation();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;

  const { data: brukere, isLoading } =
    trpc.organisasjon.hentBrukere.useQuery(
      { organizationId: orgId! },
      { enabled: !!orgId },
    );
  const utils = trpc.useUtils();

  const [inviterÅpen, setInviterÅpen] = useState(false);
  const [redigerBruker, setRedigerBruker] = useState<BrukerRad | null>(null);
  const [nyNavPilotÅpen, setNyNavPilotÅpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">
          {t("firma.ansatte.tittel")}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNyNavPilotÅpen(true)}
            disabled={!orgId || !brukere || brukere.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            title={t("firma.ansatte.nyNavPilot.knapp")}
          >
            <Sparkles className="h-4 w-4" />
            {t("firma.ansatte.nyNavPilot.knapp")}
          </button>
          <button
            onClick={() => setInviterÅpen(true)}
            disabled={!orgId}
            className="inline-flex items-center gap-1.5 rounded-md bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-sitedoc-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {t("firma.ansatte.inviter.knapp")}
          </button>
        </div>
      </div>

      {!brukere || brukere.length === 0 ? (
        <EmptyState
          title={t("firma.ansatte.tittel")}
          description={t("firma.ansatte.tomBeskrivelse")}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  {t("firma.ansatte.kolonne.navn")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  {t("firma.ansatte.kolonne.epost")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  {t("firma.ansatte.kolonne.telefon")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  {t("firma.ansatte.kolonne.stilling")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  {t("firma.ansatte.kolonne.tilgang")}
                </th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {brukere.map((b) => {
                const erSystemadmin = b.role === "sitedoc_admin";
                const erFirmaAdmin = b.firmaRoller.includes("firma_admin");
                const erHmsAnsvarlig = b.firmaRoller.includes("hms_ansvarlig");
                return (
                  <tr
                    key={b.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100">
                          <User className="h-3.5 w-3.5 text-gray-500" />
                        </div>
                        <span className="font-medium text-gray-900">
                          {b.name ?? t("firma.ansatte.utenNavn")}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{b.email}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {b.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {t(`firma.ansatte.stilling.${tilAnsattRolle(b.ansattRolle)}`)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {erSystemadmin ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                            <Shield className="h-3 w-3" />
                            {t("firma.ansatte.tilgang.systemadmin")}
                          </span>
                        ) : erFirmaAdmin ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                            <Shield className="h-3 w-3" />
                            {t("firma.ansatte.tilgang.firmaAdmin")}
                          </span>
                        ) : !erHmsAnsvarlig ? (
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            {t("firma.ansatte.tilgang.bruker")}
                          </span>
                        ) : null}
                        {erHmsAnsvarlig && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                            <ShieldAlert className="h-3 w-3" />
                            {t("firma.ansatte.tilgang.hmsAnsvarlig")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {!erSystemadmin && (
                        <button
                          onClick={() => setRedigerBruker(b)}
                          aria-label={t("firma.ansatte.rediger.iconLabel")}
                          title={t("firma.ansatte.rediger.iconLabel")}
                          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {inviterÅpen && orgId && (
        <InviterModal
          organizationId={orgId}
          onLukk={() => setInviterÅpen(false)}
          onSuksess={() => {
            utils.organisasjon.hentBrukere.invalidate();
            setInviterÅpen(false);
          }}
        />
      )}

      {redigerBruker && orgId && (
        <RedigerModal
          bruker={redigerBruker}
          organizationId={orgId}
          onLukk={() => setRedigerBruker(null)}
          onSuksess={() => {
            utils.organisasjon.hentBrukere.invalidate();
            setRedigerBruker(null);
          }}
        />
      )}

      {nyNavPilotÅpen && orgId && (
        <NyNavPilotModal
          organizationId={orgId}
          firmanavn={valgtFirma?.name ?? ""}
          antall={brukere?.length ?? 0}
          onLukk={() => setNyNavPilotÅpen(false)}
        />
      )}
    </div>
  );
}

// Pilot-utrulling av ny navigasjon (steg viii/Plan 2). Bulk-setter flagget for
// ALLE ansatte i firmaet via `organisasjon.settNyNavForFirma`. Bekreftelsesdialog
// viser antall som påvirkes. Per-bruker overstyring finnes i API-et
// (`settNyNavForBruker`) som nødventil, men bygges ikke som UI nå.
function NyNavPilotModal({
  organizationId,
  firmanavn,
  antall,
  onLukk,
}: {
  organizationId: string;
  firmanavn: string;
  antall: number;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [resultat, setResultat] = useState<{ paa: boolean; antall: number } | null>(null);
  const sett = trpc.organisasjon.settNyNavForFirma.useMutation({
    onSuccess: (res, variabler) => {
      setResultat({ paa: variabler.paa, antall: res.antall });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <Sparkles className="h-4 w-4 text-sitedoc-primary" />
            {t("firma.ansatte.nyNavPilot.tittel")}
          </h2>
          <button
            onClick={onLukk}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label={t("handling.avbryt")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          {resultat ? (
            <p className="text-sm text-gray-700">
              {t(
                resultat.paa
                  ? "firma.ansatte.nyNavPilot.ferdigPaa"
                  : "firma.ansatte.nyNavPilot.ferdigAv",
                { antall: resultat.antall },
              )}
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              {t("firma.ansatte.nyNavPilot.beskrivelse", { antall, firmanavn })}
            </p>
          )}
          <div className="flex justify-end gap-2">
            {resultat ? (
              <button
                onClick={onLukk}
                className="rounded-md bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-sitedoc-secondary"
              >
                {t("handling.lukk")}
              </button>
            ) : (
              <>
                <button
                  onClick={() => sett.mutate({ organizationId, paa: false })}
                  disabled={sett.isPending}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {t("firma.ansatte.nyNavPilot.skruAv")}
                </button>
                <button
                  onClick={() => sett.mutate({ organizationId, paa: true })}
                  disabled={sett.isPending}
                  className="rounded-md bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-sitedoc-secondary disabled:opacity-50"
                >
                  {t("firma.ansatte.nyNavPilot.skruPaa")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InviterModal({
  organizationId,
  onLukk,
  onSuksess,
}: {
  organizationId: string;
  onLukk: () => void;
  onSuksess: () => void;
}) {
  const { t } = useTranslation();
  const [navn, setNavn] = useState("");
  const [email, setEmail] = useState("");
  const [telefon, setTelefon] = useState("");
  const [ansattnummer, setAnsattnummer] = useState("");
  const [ansattRolle, setAnsattRolle] = useState<AnsattRolle>("ansatt");
  const [erFirmaAdmin, setErFirmaAdmin] = useState(false);
  const [erHmsAnsvarlig, setErHmsAnsvarlig] = useState(false);

  const inviter = trpc.organisasjon.inviterBruker.useMutation({
    onSuccess: () => onSuksess(),
  });

  const kanLagre = navn.trim().length > 0 && email.trim().length > 0 && !inviter.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!kanLagre) return;
    inviter.mutate({
      organizationId,
      navn: navn.trim(),
      email: email.trim(),
      telefon: telefon.trim() || undefined,
      ansattnummer: ansattnummer.trim() || undefined,
      ansattRolle,
      erFirmaAdmin,
      erHmsAnsvarlig,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="text-base font-semibold text-gray-900">
            {t("firma.ansatte.inviter.tittel")}
          </h2>
          <button
            onClick={onLukk}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label={t("handling.avbryt")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <p className="text-sm text-gray-500">
            {t("firma.ansatte.inviter.beskrivelse")}
          </p>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("firma.ansatte.inviter.navn")}
            </label>
            <input
              type="text"
              value={navn}
              onChange={(e) => setNavn(e.target.value)}
              required
              autoFocus
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-secondary focus:outline-none focus:ring-1 focus:ring-sitedoc-secondary"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("firma.ansatte.inviter.epost")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-secondary focus:outline-none focus:ring-1 focus:ring-sitedoc-secondary"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("firma.ansatte.inviter.telefon")}
            </label>
            <input
              type="tel"
              value={telefon}
              onChange={(e) => setTelefon(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-secondary focus:outline-none focus:ring-1 focus:ring-sitedoc-secondary"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("firma.ansatte.ansattnummer")}
            </label>
            <input
              type="text"
              value={ansattnummer}
              onChange={(e) => setAnsattnummer(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-secondary focus:outline-none focus:ring-1 focus:ring-sitedoc-secondary"
            />
            <p className="mt-1 text-xs text-gray-500">
              {t("firma.ansatte.ansattnummerHjelp")}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("firma.ansatte.stillingLabel")}
            </label>
            <select
              value={ansattRolle}
              onChange={(e) => setAnsattRolle(e.target.value as AnsattRolle)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-secondary focus:outline-none focus:ring-1 focus:ring-sitedoc-secondary"
            >
              {ANSATT_ROLLER.map((r) => (
                <option key={r} value={r}>
                  {t(`firma.ansatte.stilling.${r}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={erFirmaAdmin}
                onChange={(e) => setErFirmaAdmin(e.target.checked)}
              />
              <Shield className="h-3.5 w-3.5 text-purple-500" />
              {t("firma.ansatte.firmaAdminLabel")}
            </label>
            <p className="ml-6 mt-1 text-xs text-gray-500">
              {t("firma.ansatte.firmaAdminHjelp")}
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={erHmsAnsvarlig}
                onChange={(e) => setErHmsAnsvarlig(e.target.checked)}
              />
              <ShieldAlert className="h-3.5 w-3.5 text-green-600" />
              {t("firma.ansatte.hmsAnsvarligLabel")}
            </label>
            <p className="ml-6 mt-1 text-xs text-gray-500">
              {t("firma.ansatte.hmsAnsvarligHjelp")}
            </p>
          </div>

          {inviter.isError && (
            <p className="text-sm text-red-500">{inviter.error.message}</p>
          )}

          <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
            <button
              type="button"
              onClick={onLukk}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t("handling.avbryt")}
            </button>
            <button
              type="submit"
              disabled={!kanLagre}
              className="rounded-md bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-sitedoc-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {inviter.isPending
                ? t("firma.ansatte.inviter.lagrer")
                : t("firma.ansatte.inviter.lagre")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RedigerModal({
  bruker,
  organizationId,
  onLukk,
  onSuksess,
}: {
  bruker: BrukerRad;
  organizationId: string;
  onLukk: () => void;
  onSuksess: () => void;
}) {
  const { t } = useTranslation();
  const [navn, setNavn] = useState(bruker.name ?? "");
  const [email, setEmail] = useState(bruker.email);
  const [telefon, setTelefon] = useState(bruker.phone ?? "");
  const [ansattnummer, setAnsattnummer] = useState(bruker.ansattnummer ?? "");
  const [ansattRolle, setAnsattRolle] = useState<AnsattRolle>(
    tilAnsattRolle(bruker.ansattRolle),
  );
  const [erFirmaAdmin, setErFirmaAdmin] = useState(
    bruker.firmaRoller.includes("firma_admin"),
  );
  const [erHmsAnsvarlig, setErHmsAnsvarlig] = useState(
    bruker.firmaRoller.includes("hms_ansvarlig"),
  );
  const [feilmelding, setFeilmelding] = useState<string | null>(null);
  const [lagrer, setLagrer] = useState(false);

  const opprinneligErFirmaAdmin = bruker.firmaRoller.includes("firma_admin");
  const opprinneligErHmsAnsvarlig = bruker.firmaRoller.includes("hms_ansvarlig");

  const oppdater = trpc.organisasjon.oppdaterBruker.useMutation();
  const settFirmaAdmin = trpc.organisasjon.settFirmaAdmin.useMutation();
  const settFirmaHmsAnsvarlig = trpc.organisasjon.settFirmaHmsAnsvarlig.useMutation();

  const kanLagre =
    navn.trim().length > 0 && email.trim().length > 0 && !lagrer;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!kanLagre) return;
    setFeilmelding(null);
    setLagrer(true);
    try {
      const trimmetTelefon = telefon.trim();
      await oppdater.mutateAsync({
        userId: bruker.id,
        organizationId,
        navn: navn.trim(),
        email: email.trim(),
        telefon: trimmetTelefon === "" ? null : trimmetTelefon,
        ansattnummer: ansattnummer.trim(),
        ansattRolle,
      });
      if (erFirmaAdmin !== opprinneligErFirmaAdmin) {
        await settFirmaAdmin.mutateAsync({
          userId: bruker.id,
          organizationId,
          erAdmin: erFirmaAdmin,
        });
      }
      if (erHmsAnsvarlig !== opprinneligErHmsAnsvarlig) {
        await settFirmaHmsAnsvarlig.mutateAsync({
          userId: bruker.id,
          organizationId,
          harTilgang: erHmsAnsvarlig,
        });
      }
      onSuksess();
    } catch (err) {
      setFeilmelding(err instanceof Error ? err.message : String(err));
    } finally {
      setLagrer(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="text-base font-semibold text-gray-900">
            {t("firma.ansatte.rediger.tittel")}
          </h2>
          <button
            onClick={onLukk}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label={t("handling.avbryt")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("firma.ansatte.inviter.navn")}
            </label>
            <input
              type="text"
              value={navn}
              onChange={(e) => setNavn(e.target.value)}
              required
              autoFocus
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-secondary focus:outline-none focus:ring-1 focus:ring-sitedoc-secondary"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("firma.ansatte.inviter.epost")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-secondary focus:outline-none focus:ring-1 focus:ring-sitedoc-secondary"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("firma.ansatte.inviter.telefon")}
            </label>
            <input
              type="tel"
              value={telefon}
              onChange={(e) => setTelefon(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-secondary focus:outline-none focus:ring-1 focus:ring-sitedoc-secondary"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("firma.ansatte.ansattnummer")}
            </label>
            <input
              type="text"
              value={ansattnummer}
              onChange={(e) => setAnsattnummer(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-secondary focus:outline-none focus:ring-1 focus:ring-sitedoc-secondary"
            />
            <p className="mt-1 text-xs text-gray-500">
              {t("firma.ansatte.ansattnummerHjelp")}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("firma.ansatte.stillingLabel")}
            </label>
            <select
              value={ansattRolle}
              onChange={(e) => setAnsattRolle(e.target.value as AnsattRolle)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-secondary focus:outline-none focus:ring-1 focus:ring-sitedoc-secondary"
            >
              {ANSATT_ROLLER.map((r) => (
                <option key={r} value={r}>
                  {t(`firma.ansatte.stilling.${r}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={erFirmaAdmin}
                onChange={(e) => setErFirmaAdmin(e.target.checked)}
              />
              <Shield className="h-3.5 w-3.5 text-purple-500" />
              {t("firma.ansatte.firmaAdminLabel")}
            </label>
            <p className="ml-6 mt-1 text-xs text-gray-500">
              {t("firma.ansatte.firmaAdminHjelp")}
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={erHmsAnsvarlig}
                onChange={(e) => setErHmsAnsvarlig(e.target.checked)}
              />
              <ShieldAlert className="h-3.5 w-3.5 text-green-600" />
              {t("firma.ansatte.hmsAnsvarligLabel")}
            </label>
            <p className="ml-6 mt-1 text-xs text-gray-500">
              {t("firma.ansatte.hmsAnsvarligHjelp")}
            </p>
          </div>

          {feilmelding && (
            <p className="text-sm text-red-500">{feilmelding}</p>
          )}

          <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
            <button
              type="button"
              onClick={onLukk}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t("handling.avbryt")}
            </button>
            <button
              type="submit"
              disabled={!kanLagre}
              className="rounded-md bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-sitedoc-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {lagrer
                ? t("handling.lagrer")
                : t("handling.lagre")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

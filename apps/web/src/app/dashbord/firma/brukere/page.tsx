"use client";

import { trpc } from "@/lib/trpc";
import { Spinner, EmptyState } from "@sitedoc/ui";
import { Shield, User, ChevronDown, Pencil, Plus, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useFirma } from "@/kontekst/firma-kontekst";

type BrukerRad = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: string;
  ansattnummer: string | null;
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

  const endreRolle = trpc.organisasjon.endreRolle.useMutation({
    onSuccess: () => {
      utils.organisasjon.hentBrukere.invalidate();
    },
  });

  const [åpenMeny, setÅpenMeny] = useState<string | null>(null);
  const [inviterÅpen, setInviterÅpen] = useState(false);
  const [redigerBruker, setRedigerBruker] = useState<BrukerRad | null>(null);
  const menyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKlikk(e: MouseEvent) {
      if (menyRef.current && !menyRef.current.contains(e.target as Node)) {
        setÅpenMeny(null);
      }
    }
    document.addEventListener("click", handleKlikk);
    return () => document.removeEventListener("click", handleKlikk);
  }, []);

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
          {t("firma.brukere.tittel")}
        </h1>
        <button
          onClick={() => setInviterÅpen(true)}
          disabled={!orgId}
          className="inline-flex items-center gap-1.5 rounded-md bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-sitedoc-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {t("firma.brukere.inviter.knapp")}
        </button>
      </div>

      {!brukere || brukere.length === 0 ? (
        <EmptyState
          title={t("firma.brukere.tittel")}
          description="Organisasjonen har ingen brukere ennå."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Navn
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  E-post
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Telefon
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Rolle
                </th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {brukere.map((b) => (
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
                        {b.name ?? "Uten navn"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{b.email}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {b.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative" ref={åpenMeny === b.id ? menyRef : undefined}>
                      <button
                        onClick={() => setÅpenMeny(åpenMeny === b.id ? null : b.id)}
                        disabled={b.role === "sitedoc_admin"}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {b.role === "company_admin" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-purple-700">
                            <Shield className="h-3 w-3" />
                            Firmaadmin
                          </span>
                        ) : b.role === "sitedoc_admin" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                            <Shield className="h-3 w-3" />
                            Systemadmin
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                            Bruker
                          </span>
                        )}
                        {b.role !== "sitedoc_admin" && (
                          <ChevronDown className="h-3 w-3 text-gray-400" />
                        )}
                      </button>

                      {åpenMeny === b.id && b.role !== "sitedoc_admin" && (
                        <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                          <button
                            onClick={() => {
                              endreRolle.mutate({ userId: b.id, rolle: "company_admin", organizationId: orgId! });
                              setÅpenMeny(null);
                            }}
                            disabled={b.role === "company_admin"}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                          >
                            <Shield className="h-3.5 w-3.5 text-purple-500" />
                            Firmaadmin
                          </button>
                          <button
                            onClick={() => {
                              endreRolle.mutate({ userId: b.id, rolle: "user", organizationId: orgId! });
                              setÅpenMeny(null);
                            }}
                            disabled={b.role === "user"}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                          >
                            <User className="h-3.5 w-3.5 text-gray-400" />
                            Bruker
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {b.role !== "sitedoc_admin" && (
                      <button
                        onClick={() => setRedigerBruker(b)}
                        aria-label={t("firma.brukere.rediger.iconLabel")}
                        title={t("firma.brukere.rediger.iconLabel")}
                        className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {endreRolle.isError && (
        <p className="mt-3 text-sm text-red-500">
          {endreRolle.error.message}
        </p>
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
  const [rolle, setRolle] = useState<"user" | "company_admin">("user");

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
      rolle,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="text-base font-semibold text-gray-900">
            {t("firma.brukere.inviter.tittel")}
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
            {t("firma.brukere.inviter.beskrivelse")}
          </p>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("firma.brukere.inviter.navn")}
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
              {t("firma.brukere.inviter.epost")}
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
              {t("firma.brukere.inviter.telefon")}
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
              {t("firma.brukere.ansattnummer")}
            </label>
            <input
              type="text"
              value={ansattnummer}
              onChange={(e) => setAnsattnummer(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-secondary focus:outline-none focus:ring-1 focus:ring-sitedoc-secondary"
            />
            <p className="mt-1 text-xs text-gray-500">
              {t("firma.brukere.ansattnummerHjelp")}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {t("firma.brukere.inviter.rolle")}
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="rolle"
                  value="user"
                  checked={rolle === "user"}
                  onChange={() => setRolle("user")}
                />
                {t("firma.brukere.inviter.rolle.user")}
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="rolle"
                  value="company_admin"
                  checked={rolle === "company_admin"}
                  onChange={() => setRolle("company_admin")}
                />
                {t("firma.brukere.inviter.rolle.companyAdmin")}
              </label>
            </div>
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
                ? t("firma.brukere.inviter.lagrer")
                : t("firma.brukere.inviter.lagre")}
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
  const [rolle, setRolle] = useState<"user" | "company_admin">(
    bruker.role === "company_admin" ? "company_admin" : "user",
  );

  const oppdater = trpc.organisasjon.oppdaterBruker.useMutation({
    onSuccess: () => onSuksess(),
  });

  const kanLagre =
    navn.trim().length > 0 && email.trim().length > 0 && !oppdater.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!kanLagre) return;
    const trimmetTelefon = telefon.trim();
    oppdater.mutate({
      userId: bruker.id,
      organizationId,
      navn: navn.trim(),
      email: email.trim(),
      telefon: trimmetTelefon === "" ? null : trimmetTelefon,
      ansattnummer: ansattnummer.trim(),
      rolle,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="text-base font-semibold text-gray-900">
            {t("firma.brukere.rediger.tittel")}
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
              {t("firma.brukere.inviter.navn")}
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
              {t("firma.brukere.inviter.epost")}
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
              {t("firma.brukere.inviter.telefon")}
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
              {t("firma.brukere.ansattnummer")}
            </label>
            <input
              type="text"
              value={ansattnummer}
              onChange={(e) => setAnsattnummer(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-secondary focus:outline-none focus:ring-1 focus:ring-sitedoc-secondary"
            />
            <p className="mt-1 text-xs text-gray-500">
              {t("firma.brukere.ansattnummerHjelp")}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {t("firma.brukere.inviter.rolle")}
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="rediger-rolle"
                  value="user"
                  checked={rolle === "user"}
                  onChange={() => setRolle("user")}
                />
                {t("firma.brukere.inviter.rolle.user")}
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="rediger-rolle"
                  value="company_admin"
                  checked={rolle === "company_admin"}
                  onChange={() => setRolle("company_admin")}
                />
                {t("firma.brukere.inviter.rolle.companyAdmin")}
              </label>
            </div>
          </div>

          {oppdater.isError && (
            <p className="text-sm text-red-500">{oppdater.error.message}</p>
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
              {oppdater.isPending
                ? t("handling.lagrer")
                : t("handling.lagre")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

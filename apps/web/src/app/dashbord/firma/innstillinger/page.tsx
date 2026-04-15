"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { Save, HelpCircle, X } from "lucide-react";

export default function FirmaInnstillinger() {
  const { data: org, isLoading } = trpc.organisasjon.hentMin.useQuery();
  const utils = trpc.useUtils();

  const [navn, setNavn] = useState("");
  const [orgNr, setOrgNr] = useState("");
  const [fakturaAdresse, setFakturaAdresse] = useState("");
  const [fakturaEpost, setFakturaEpost] = useState("");
  const [ehf, setEhf] = useState(false);
  const [hjelpÅpen, setHjelpÅpen] = useState(false);

  // Fyll skjema når data lastes
  useEffect(() => {
    if (org) {
      setNavn(org.name);
      setOrgNr(org.organizationNumber ?? "");
      setFakturaAdresse(org.invoiceAddress ?? "");
      setFakturaEpost(org.invoiceEmail ?? "");
      setEhf(org.ehfEnabled);
    }
  }, [org]);

  const oppdater = trpc.organisasjon.oppdater.useMutation({
    onSuccess: () => {
      utils.organisasjon.hentMin.invalidate();
    },
  });

  const harEndringer =
    org != null &&
    (navn !== org.name ||
      orgNr !== (org.organizationNumber ?? "") ||
      fakturaAdresse !== (org.invoiceAddress ?? "") ||
      fakturaEpost !== (org.invoiceEmail ?? "") ||
      ehf !== org.ehfEnabled);

  const navnGyldig = navn.trim().length > 0;
  const epostGyldig =
    fakturaEpost === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fakturaEpost);

  function lagre() {
    if (!navnGyldig || !epostGyldig) return;

    oppdater.mutate({
      name: navn.trim(),
      organizationNumber: orgNr.trim() || null,
      invoiceAddress: fakturaAdresse.trim() || null,
      invoiceEmail: fakturaEpost.trim() || null,
      ehfEnabled: ehf,
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!org) return null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Innstillinger</h1>
        <button
          onClick={() => setHjelpÅpen(true)}
          className="inline-flex items-center justify-center rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          title="Hjelp"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">
          Firmainformasjon
        </h2>

        <div className="space-y-4">
          {/* Firmanavn */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Firmanavn <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={navn}
              onChange={(e) => setNavn(e.target.value)}
              className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 ${
                !navnGyldig && navn !== ""
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              }`}
            />
          </div>

          {/* Org.nr */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Organisasjonsnummer
            </label>
            <input
              type="text"
              value={orgNr}
              onChange={(e) => setOrgNr(e.target.value)}
              placeholder="123 456 789"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Fakturaadresse */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Fakturaadresse
            </label>
            <textarea
              value={fakturaAdresse}
              onChange={(e) => setFakturaAdresse(e.target.value)}
              rows={3}
              placeholder="Gateadresse, postnummer og sted"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Faktura-e-post */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Faktura-e-post
            </label>
            <input
              type="email"
              value={fakturaEpost}
              onChange={(e) => setFakturaEpost(e.target.value)}
              placeholder="faktura@firma.no"
              className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 ${
                !epostGyldig
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              }`}
            />
            {!epostGyldig && (
              <p className="mt-1 text-xs text-red-500">
                Ugyldig e-postadresse
              </p>
            )}
          </div>

          {/* EHF */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEhf(!ehf)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                ehf ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  ehf ? "translate-x-[18px]" : "translate-x-[3px]"
                }`}
              />
            </button>
            <label className="text-sm font-medium text-gray-700">
              EHF-faktura (elektronisk faktura)
            </label>
          </div>
        </div>

        {/* Lagre-knapp */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={lagre}
            disabled={!harEndringer || !navnGyldig || !epostGyldig || oppdater.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-sitedoc-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {oppdater.isPending ? "Lagrer..." : "Lagre endringer"}
          </button>
          {oppdater.isSuccess && (
            <p className="text-sm text-green-600">Endringer lagret</p>
          )}
          {oppdater.isError && (
            <p className="text-sm text-red-500">
              Kunne ikke lagre: {oppdater.error.message}
            </p>
          )}
        </div>
      </div>

      {/* Hjelp-modal */}
      {hjelpÅpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setHjelpÅpen(false)}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Innstillinger — Hjelp
              </h2>
              <button
                onClick={() => setHjelpÅpen(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Hva er dette?
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Her redigerer du firmainformasjonen til organisasjonen din i
                  SiteDoc. Endringer vises for alle brukere i organisasjonen.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Hvem kan redigere?
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Kun firmaadministratorer (org-admin) kan endre disse
                  innstillingene. Vanlige brukere ser organisasjonsnavnet men
                  kan ikke redigere.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Felter
                </h3>
                <ul className="mt-1 space-y-1 text-sm text-gray-600">
                  <li>
                    <strong>Firmanavn</strong> — vises i toppmenyen og i
                    prosjektrapporter
                  </li>
                  <li>
                    <strong>Org.nr</strong> — norsk organisasjonsnummer (9
                    siffer)
                  </li>
                  <li>
                    <strong>Fakturaadresse</strong> — brukes ved fakturering
                  </li>
                  <li>
                    <strong>Faktura-e-post</strong> — e-postadresse for
                    mottak av fakturaer
                  </li>
                  <li>
                    <strong>EHF</strong> — aktiver for elektronisk faktura
                    via Aksesspunkt
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

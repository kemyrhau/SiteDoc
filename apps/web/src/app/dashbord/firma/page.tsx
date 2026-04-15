"use client";

import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { FolderKanban, Users, Building2, Plug, Check, XCircle } from "lucide-react";
import Link from "next/link";

export default function FirmaOversikt() {
  const { data: organisasjon, isLoading: orgLaster } =
    trpc.organisasjon.hentMin.useQuery();
  const { data: prosjekter, isLoading: projLaster } =
    trpc.organisasjon.hentProsjekter.useQuery(undefined, {
      enabled: !!organisasjon,
    });
  const { data: brukere, isLoading: brukLaster } =
    trpc.organisasjon.hentBrukere.useQuery(undefined, {
      enabled: !!organisasjon,
    });
  const { data: integrasjoner } =
    trpc.organisasjon.hentIntegrasjonerStatus.useQuery(undefined, {
      enabled: !!organisasjon,
    });

  if (orgLaster) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!organisasjon) return null;

  const laster = projLaster || brukLaster;

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold text-gray-900">Oversikt</h1>

      {/* Statistikk-kort */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <Link
          href="/dashbord/firma/prosjekter"
          className="rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-blue-200 hover:bg-blue-50/30"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
            <FolderKanban className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">
            {laster ? "..." : (prosjekter?.length ?? 0)}
          </p>
          <p className="text-sm text-gray-500">Prosjekter</p>
        </Link>

        <Link
          href="/dashbord/firma/brukere"
          className="rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-blue-200 hover:bg-blue-50/30"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
            <Users className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">
            {laster ? "..." : (brukere?.length ?? 0)}
          </p>
          <p className="text-sm text-gray-500">Brukere</p>
        </Link>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
            <Building2 className="h-5 w-5 text-purple-600" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">
            {organisasjon.organizationNumber ?? "—"}
          </p>
          <p className="text-sm text-gray-500">Org.nr</p>
        </div>
      </div>

      {/* Firmainfo */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Firmainformasjon</h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-gray-500">Firmanavn</dt>
            <dd className="font-medium text-gray-900">{organisasjon.name}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Org.nr</dt>
            <dd className="font-medium text-gray-900">
              {organisasjon.organizationNumber ?? "Ikke satt"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Fakturaadresse</dt>
            <dd className="font-medium text-gray-900">
              {organisasjon.invoiceAddress ?? "Ikke satt"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Faktura-e-post</dt>
            <dd className="font-medium text-gray-900">
              {organisasjon.invoiceEmail ?? "Ikke satt"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">EHF</dt>
            <dd className="font-medium text-gray-900">
              {organisasjon.ehfEnabled ? "Aktivert" : "Ikke aktivert"}
            </dd>
          </div>
        </dl>
      </div>

      {/* Integrasjoner */}
      {integrasjoner && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <Plug className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-700">Integrasjoner</h2>
          </div>
          {integrasjoner.length === 0 ? (
            <p className="text-sm text-gray-500">
              Ingen integrasjoner konfigurert. Kontakt systemadministrator for oppsett.
            </p>
          ) : (
            <div className="space-y-2">
              {integrasjoner.map((i) => (
                <div
                  key={i.type}
                  className="flex items-center justify-between rounded-md border border-gray-100 px-4 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {i.type}
                    </span>
                    {i.url && (
                      <span className="text-xs text-gray-400 truncate max-w-[200px]">
                        {i.url}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {i.harNøkkel && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                        API-nøkkel konfigurert
                      </span>
                    )}
                    {i.aktiv ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        <Check className="h-3 w-3" />
                        Aktiv
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                        <XCircle className="h-3 w-3" />
                        Inaktiv
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

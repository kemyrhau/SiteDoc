"use client";

import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { FolderKanban, Building2, Users } from "lucide-react";
import Link from "next/link";

export default function AdminOversikt() {
  const { data: prosjekter, isLoading: projLaster } =
    trpc.admin.hentAlleProsjekter.useQuery();
  const { data: organisasjoner, isLoading: orgLaster } =
    trpc.admin.hentAlleOrganisasjoner.useQuery();
  const { data: brukere, isLoading: brukLaster } =
    trpc.admin.hentAlleBrukere.useQuery();

  const laster = projLaster || orgLaster || brukLaster;

  if (laster) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold text-gray-900">Oversikt</h1>

      <div className="mb-8 grid grid-cols-3 gap-4">
        <Link
          href="/dashbord/admin/firmaer"
          className="rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-amber-200 hover:bg-amber-50/30"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
            <Building2 className="h-5 w-5 text-purple-600" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">
            {organisasjoner?.length ?? 0}
          </p>
          <p className="text-sm text-gray-500">Firmaer</p>
        </Link>

        <Link
          href="/dashbord/admin/prosjekter"
          className="rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-amber-200 hover:bg-amber-50/30"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
            <FolderKanban className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">
            {prosjekter?.length ?? 0}
          </p>
          <p className="text-sm text-gray-500">Prosjekter</p>
        </Link>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
            <Users className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">
            {brukere?.length ?? 0}
          </p>
          <p className="text-sm text-gray-500">Brukere</p>
        </div>
      </div>

      {/* Siste prosjekter */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Siste prosjekter</h2>
        {prosjekter && prosjekter.length > 0 ? (
          <div className="space-y-2">
            {prosjekter.slice(0, 5).map((p: { id: string; name: string; projectNumber: string; members: { id: string }[]; dokumentflytParts: { id: string }[]; organizationProjects: { organization: { name: string } }[] }) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-gray-900">{p.name}</span>
                  <span className="ml-2 text-xs text-gray-400">{p.projectNumber}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{p.members.length} medl.</span>
                  <span>{p.dokumentflytParts.length} entr.</span>
                  {p.organizationProjects[0] && (
                    <span className="rounded bg-purple-50 px-1.5 py-0.5 text-purple-600">
                      {p.organizationProjects[0].organization.name}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Ingen prosjekter</p>
        )}
      </div>
    </div>
  );
}

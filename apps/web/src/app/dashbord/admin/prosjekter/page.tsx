"use client";

import { trpc } from "@/lib/trpc";
import { Spinner, EmptyState } from "@sitedoc/ui";
import { FolderKanban } from "lucide-react";
import Link from "next/link";

export default function AdminProsjekter() {
  const { data: prosjekter, isLoading } =
    trpc.admin.hentAlleProsjekter.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!prosjekter || prosjekter.length === 0) {
    return (
      <div>
        <h1 className="mb-4 text-lg font-semibold text-gray-900">Alle prosjekter</h1>
        <EmptyState title="Ingen prosjekter" description="Det finnes ingen prosjekter i systemet." />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-gray-900">Alle prosjekter</h1>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-600">Prosjekt</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Nr</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Firma</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Medl.</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Entr.</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {prosjekter.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashbord/${p.id}`}
                    className="flex items-center gap-2 font-medium text-gray-900 hover:text-blue-600"
                  >
                    <FolderKanban className="h-4 w-4 text-gray-400" />
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{p.projectNumber}</td>
                <td className="px-4 py-3">
                  {p.organizationProjects[0] ? (
                    <span className="rounded bg-purple-50 px-1.5 py-0.5 text-xs text-purple-600">
                      {p.organizationProjects[0].organization.name}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-gray-500">{p.members.length}</td>
                <td className="px-4 py-3 text-center text-gray-500">{p.enterprises.length}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {p.status === "active" ? "Aktiv" : p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

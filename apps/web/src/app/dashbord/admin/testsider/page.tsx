"use client";

import { trpc } from "@/lib/trpc";
import { Spinner, EmptyState } from "@sitedoc/ui";
import { FlaskConical, Clock, AlertTriangle, Trash2 } from "lucide-react";
import Link from "next/link";

export default function AdminTestsider() {
  const { data: alleProsjekter, isLoading } =
    trpc.admin.hentAlleProsjekter.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  // Filtrer til kun testsider (prosjekter uten firma-tilknytning)
  const testsider = (alleProsjekter ?? []).filter(
    (p) => p.projectOrganizations.length === 0,
  );

  function dagerIgjen(opprettet: string | Date) {
    const utloper = new Date(opprettet);
    utloper.setDate(utloper.getDate() + 30);
    return Math.ceil((utloper.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  function dagerTilSletting(opprettet: string | Date) {
    const slettes = new Date(opprettet);
    slettes.setDate(slettes.getDate() + 90);
    return Math.ceil((slettes.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  if (testsider.length === 0) {
    return (
      <div>
        <h1 className="mb-4 text-lg font-semibold text-gray-900">Testsider</h1>
        <EmptyState
          title="Ingen testsider"
          description="Det finnes ingen prøveprosjekter uten firmatilknytning."
        />
      </div>
    );
  }

  const aktive = testsider.filter((p) => p.status === "active");
  const deaktiverte = testsider.filter((p) => p.status === "deactivated");

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <FlaskConical className="h-5 w-5 text-amber-600" />
        <h1 className="text-lg font-semibold text-gray-900">
          Testsider
          <span className="ml-2 text-sm font-normal text-gray-400">
            ({testsider.length})
          </span>
        </h1>
      </div>

      <p className="mb-6 text-sm text-gray-500">
        Prøveprosjekter uten firmatilknytning. Deaktiveres etter 30 dager, slettes etter 90 dager.
      </p>

      {aktive.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-medium text-gray-700">
            Aktive ({aktive.length})
          </h2>
          <div className="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Prosjekt</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Nr</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Opprettet av</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Opprettet</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Sjekk.</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Oppg.</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Gjenstår</th>
                </tr>
              </thead>
              <tbody>
                {aktive.map((p) => {
                  const dager = dagerIgjen(p.createdAt);
                  return (
                    <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashbord/${p.id}`}
                          className="font-medium text-gray-900 hover:text-blue-600"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{p.projectNumber}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {p.members[0]?.user?.name || p.members[0]?.user?.email || "–"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(p.createdAt).toLocaleDateString("nb-NO")}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500">
                        {(p as unknown as { _count: { checklists: number } })._count?.checklists ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500">
                        {(p as unknown as { _count: { tasks: number } })._count?.tasks ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          dager <= 0
                            ? "bg-red-100 text-red-700"
                            : dager <= 7
                              ? "bg-red-100 text-red-700"
                              : dager <= 14
                                ? "bg-amber-100 text-amber-700"
                                : "bg-blue-100 text-blue-700"
                        }`}>
                          <Clock className="h-3 w-3" />
                          {dager <= 0 ? "Utløpt" : `${dager} dager`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {deaktiverte.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-medium text-gray-700">
            Deaktiverte ({deaktiverte.length})
          </h2>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Prosjekt</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Nr</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Opprettet av</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Opprettet</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Slettes om</th>
                </tr>
              </thead>
              <tbody>
                {deaktiverte.map((p) => {
                  const dagerTilSlett = dagerTilSletting(p.createdAt);
                  return (
                    <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashbord/${p.id}`}
                          className="font-medium text-gray-500 hover:text-blue-600"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{p.projectNumber}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {p.members[0]?.user?.name || p.members[0]?.user?.email || "–"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {new Date(p.createdAt).toLocaleDateString("nb-NO")}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          dagerTilSlett <= 14
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-600"
                        }`}>
                          <Trash2 className="h-3 w-3" />
                          {dagerTilSlett <= 0 ? "Venter på opprydding" : `${dagerTilSlett} dager`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

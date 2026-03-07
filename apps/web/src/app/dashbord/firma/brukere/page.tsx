"use client";

import { trpc } from "@/lib/trpc";
import { Spinner, EmptyState } from "@sitedoc/ui";
import { Shield, User } from "lucide-react";

export default function FirmaBrukere() {
  const { data: brukere, isLoading } =
    trpc.organisasjon.hentBrukere.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!brukere || brukere.length === 0) {
    return (
      <div>
        <h1 className="mb-4 text-lg font-semibold text-gray-900">Brukere</h1>
        <EmptyState
          title="Ingen brukere"
          description="Organisasjonen har ingen brukere ennå."
        />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-gray-900">Brukere</h1>

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
                  {b.role === "company_admin" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                      <Shield className="h-3 w-3" />
                      Firmaadmin
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      Bruker
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

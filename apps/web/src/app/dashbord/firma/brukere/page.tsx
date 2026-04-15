"use client";

import { trpc } from "@/lib/trpc";
import { Spinner, EmptyState } from "@sitedoc/ui";
import { Shield, User, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export default function FirmaBrukere() {
  const { data: brukere, isLoading } =
    trpc.organisasjon.hentBrukere.useQuery();
  const utils = trpc.useUtils();

  const endreRolle = trpc.organisasjon.endreRolle.useMutation({
    onSuccess: () => {
      utils.organisasjon.hentBrukere.invalidate();
    },
  });

  const [åpenMeny, setÅpenMeny] = useState<string | null>(null);
  const menyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKlikk(e: MouseEvent) {
      if (menyRef.current && !menyRef.current.contains(e.target as Node)) {
        setÅpenMeny(null);
      }
    }
    document.addEventListener("mousedown", handleKlikk);
    return () => document.removeEventListener("mousedown", handleKlikk);
  }, []);

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
                            endreRolle.mutate({ userId: b.id, rolle: "company_admin" });
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
                            endreRolle.mutate({ userId: b.id, rolle: "user" });
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {endreRolle.isError && (
        <p className="mt-3 text-sm text-red-500">
          {endreRolle.error.message}
        </p>
      )}
    </div>
  );
}

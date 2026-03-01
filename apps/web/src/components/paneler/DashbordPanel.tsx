"use client";

import Link from "next/link";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { SearchInput, Spinner } from "@siteflow/ui";
import { useState } from "react";
import { FolderOpen } from "lucide-react";

export function DashbordPanel() {
  const { prosjekter, isLoading, prosjektId } = useProsjekt();
  const [sok, setSok] = useState("");

  const filtrerte = prosjekter.filter((p) =>
    p.name.toLowerCase().includes(sok.toLowerCase()) ||
    p.projectNumber.toLowerCase().includes(sok.toLowerCase()),
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="sm" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchInput
        verdi={sok}
        onChange={setSok}
        placeholder="Søk prosjekter..."
      />
      <div className="flex flex-col gap-0.5">
        {filtrerte.map((p) => (
          <Link
            key={p.id}
            href={`/dashbord/${p.id}`}
            className={`flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
              prosjektId === p.id
                ? "bg-blue-50 text-blue-700"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <FolderOpen className="h-4 w-4 flex-shrink-0 text-gray-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.name}</p>
              <p className="truncate text-xs text-gray-400">
                {p.projectNumber}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

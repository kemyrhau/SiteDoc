"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { SearchInput, Spinner } from "@siteflow/ui";
import { useState } from "react";
import { FolderOpen, ChevronDown, ChevronRight, File } from "lucide-react";

interface MappeTreData {
  id: string;
  name: string;
  children: MappeTreData[];
  _count?: { documents: number };
}

function MappeRad({
  mappe,
  dybde,
}: {
  mappe: MappeTreData;
  dybde: number;
}) {
  const [ekspandert, setEkspandert] = useState(dybde < 2);
  const harBarn = mappe.children.length > 0;
  const antallDokumenter = mappe._count?.documents ?? 0;

  return (
    <div>
      <div
        className="flex items-center gap-1 rounded-md py-1.5 pr-2 text-sm hover:bg-gray-50"
        style={{ paddingLeft: `${dybde * 16 + 4}px` }}
      >
        <button
          onClick={() => setEkspandert(!ekspandert)}
          className="flex-shrink-0 rounded p-0.5 text-gray-400"
        >
          {harBarn ? (
            ekspandert ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )
          ) : (
            <span className="inline-block h-3 w-3" />
          )}
        </button>
        <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
        <span className="flex-1 truncate text-gray-700">{mappe.name}</span>
        {antallDokumenter > 0 && (
          <span className="text-xs text-gray-400">
            {antallDokumenter} <File className="mb-px inline h-2.5 w-2.5" />
          </span>
        )}
      </div>

      {ekspandert &&
        mappe.children.map((barn) => (
          <MappeRad key={barn.id} mappe={barn} dybde={dybde + 1} />
        ))}
    </div>
  );
}

function byggTre(
  flat: Array<{
    id: string;
    name: string;
    parentId: string | null;
    _count?: { documents: number };
  }>,
): MappeTreData[] {
  const map = new Map<string, MappeTreData>();
  const roots: MappeTreData[] = [];

  for (const m of flat) {
    map.set(m.id, { id: m.id, name: m.name, children: [], _count: m._count });
  }

  for (const m of flat) {
    const node = map.get(m.id)!;
    if (m.parentId) {
      const parent = map.get(m.parentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function MapperPanel() {
  const params = useParams<{ prosjektId: string }>();
  const [sok, setSok] = useState("");

  const { data: mapper, isLoading } = trpc.mappe.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="sm" />
      </div>
    );
  }

  const mappeTre = mapper
    ? byggTre(
        mapper as Array<{
          id: string;
          name: string;
          parentId: string | null;
          _count?: { documents: number };
        }>,
      )
    : [];

  function filtrerTre(noder: MappeTreData[], sokeord: string): MappeTreData[] {
    if (!sokeord) return noder;
    const lavt = sokeord.toLowerCase();
    return noder
      .map((node) => {
        const filtrerteBarn = filtrerTre(node.children, sokeord);
        if (node.name.toLowerCase().includes(lavt) || filtrerteBarn.length > 0) {
          return { ...node, children: filtrerteBarn };
        }
        return null;
      })
      .filter(Boolean) as MappeTreData[];
  }

  const filtrerte = filtrerTre(mappeTre, sok);

  return (
    <div className="flex flex-col gap-3">
      <SearchInput
        verdi={sok}
        onChange={setSok}
        placeholder="Søk mapper..."
      />
      <div className="flex flex-col">
        {filtrerte.length === 0 ? (
          <p className="px-2 py-2 text-sm text-gray-400">
            Ingen mapper funnet
          </p>
        ) : (
          filtrerte.map((mappe) => (
            <MappeRad key={mappe.id} mappe={mappe} dybde={0} />
          ))
        )}
      </div>
    </div>
  );
}

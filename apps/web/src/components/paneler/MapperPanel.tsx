"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { SearchInput, Spinner } from "@sitedoc/ui";
import { useMemo, useState } from "react";
import { FolderOpen, ChevronDown, ChevronRight, File, Lock } from "lucide-react";
import { beregnSynligeMapper } from "@sitedoc/shared/utils";
import type { MappeTilgangInput, BrukerTilgangInfo } from "@sitedoc/shared/utils";

interface MappeTreData {
  id: string;
  name: string;
  children: MappeTreData[];
  _count?: { ftdDocuments: number };
  kontraktId?: string | null;
  kunSti?: boolean;
}

function MappeRad({
  mappe,
  dybde,
  valgtId,
  onVelg,
}: {
  mappe: MappeTreData;
  dybde: number;
  valgtId: string | null;
  onVelg: (id: string) => void;
}) {
  const [ekspandert, setEkspandert] = useState(dybde < 2);
  const harBarn = mappe.children.length > 0;
  const antallDokumenter = mappe._count?.ftdDocuments ?? 0;
  const erValgt = mappe.id === valgtId;
  const erKunSti = mappe.kunSti === true;

  return (
    <div>
      <div
        onClick={() => onVelg(mappe.id)}
        className={`flex cursor-pointer items-center gap-1 rounded-md py-1.5 pr-2 text-sm ${
          erValgt
            ? "bg-sitedoc-primary/10 text-sitedoc-primary"
            : erKunSti
              ? "text-gray-400 hover:bg-gray-50"
              : "hover:bg-gray-50"
        }`}
        style={{ paddingLeft: `${dybde * 16 + 4}px` }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEkspandert(!ekspandert);
          }}
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
        {erKunSti ? (
          <Lock className="h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
        ) : (
          <FolderOpen className={`h-3.5 w-3.5 flex-shrink-0 ${erValgt ? "text-sitedoc-primary" : mappe.kontraktId ? "text-blue-500" : "text-amber-500"}`} />
        )}
        <span className={`flex-1 truncate ${erValgt ? "font-medium" : erKunSti ? "text-gray-400" : "text-gray-700"}`}>
          {mappe.name}
        </span>
        {!erKunSti && antallDokumenter > 0 && (
          <span className="text-xs text-gray-400">
            {antallDokumenter} <File className="mb-px inline h-2.5 w-2.5" />
          </span>
        )}
      </div>

      {ekspandert &&
        mappe.children.map((barn) => (
          <MappeRad key={barn.id} mappe={barn} dybde={dybde + 1} valgtId={valgtId} onVelg={onVelg} />
        ))}
    </div>
  );
}

function byggTre(
  flat: Array<{
    id: string;
    name: string;
    parentId: string | null;
    _count?: { ftdDocuments: number };
    kontraktId?: string | null;
    kunSti?: boolean;
  }>,
): MappeTreData[] {
  const map = new Map<string, MappeTreData>();
  const roots: MappeTreData[] = [];

  for (const m of flat) {
    map.set(m.id, { id: m.id, name: m.name, children: [], _count: m._count, kontraktId: m.kontraktId, kunSti: m.kunSti });
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [sok, setSok] = useState("");

  const valgtMappeId = searchParams.get("mappe");

  const { data: mapper, isLoading } = trpc.mappe.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );

  // Hent brukerens entrepriser og grupper for tilgangsfiltrering
  const { data: medlemmer } = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );

  const { data: grupper } = trpc.gruppe.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );

  // Beregn synlige mapper
  const { filtrertMapper, kunStiIder } = useMemo(() => {
    if (!mapper || !session?.user) {
      return { filtrertMapper: mapper ?? [], kunStiIder: new Set<string>() };
    }

    // Finn brukerens prosjektmedlemskap
    const brukerMedlem = medlemmer?.find(
      (m) => m.user.email === session.user?.email,
    );

    if (!brukerMedlem) {
      return { filtrertMapper: mapper, kunStiIder: new Set<string>() };
    }

    const erAdmin = brukerMedlem.role === "admin";

    // Finn brukerens entreprise-IDer
    const entrepriseIder = brukerMedlem.dokumentflytKoblinger.map(
      (me) => me.dokumentflytPart.id,
    );

    // Finn brukerens gruppe-IDer
    const alleGrupper = grupper ?? [];
    const gruppeIder = alleGrupper
      .filter((g: { id: string; members: Array<{ projectMember: { user: { id: string } } }> }) =>
        g.members.some(
          (m: { projectMember: { user: { id: string } } }) => m.projectMember.user.id === brukerMedlem.user.id,
        ),
      )
      .map((g: { id: string }) => g.id);

    const brukerInfo: BrukerTilgangInfo = {
      userId: brukerMedlem.user.id,
      erAdmin,
      entrepriseIder,
      gruppeIder,
    };

    const mapperInput: MappeTilgangInput[] = mapper.map((m) => ({
      id: m.id,
      parentId: m.parentId,
      accessMode: m.accessMode,
      accessEntries: m.accessEntries.map((e) => ({
        accessType: e.accessType,
        enterpriseId: e.dokumentflytPart?.id ?? null,
        groupId: e.group?.id ?? null,
        userId: e.user?.id ?? null,
      })),
    }));

    const resultat = beregnSynligeMapper(mapperInput, brukerInfo);

    const filtrert = mapper.filter((m) => resultat.synlige.has(m.id));
    return { filtrertMapper: filtrert, kunStiIder: resultat.kunSti };
  }, [mapper, session, medlemmer, grupper]);

  function velgMappe(mappeId: string) {
    router.push(`/dashbord/${params.prosjektId}/mapper?mappe=${mappeId}`);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="sm" />
      </div>
    );
  }

  const mappeTre = byggTre(
    filtrertMapper.map((m) => ({
      id: m.id,
      name: m.name,
      parentId: m.parentId,
      _count: m._count,
      kontraktId: m.kontraktId,
      kunSti: kunStiIder.has(m.id),
    })),
  );

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
            <MappeRad key={mappe.id} mappe={mappe} dybde={0} valgtId={valgtMappeId} onVelg={velgMappe} />
          ))
        )}
      </div>
    </div>
  );
}

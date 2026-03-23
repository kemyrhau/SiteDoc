"use client";

import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardCheck,
  ListTodo,
  FileText,
  Map,
  Box,
  Image,
  Building2,
  FolderOpen,
  Settings,
  Columns2,
} from "lucide-react";
import { SidebarIkon } from "@sitedoc/ui";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { useAktivSeksjon } from "@/hooks/useAktivSeksjon";
import { trpc } from "@/lib/trpc";
import type { Seksjon } from "@/kontekst/navigasjon-kontekst";
import type { Permission } from "@sitedoc/shared";

interface SidebarElement {
  id: Seksjon;
  label: string;
  ikon: JSX.Element;
  kreverProsjekt: boolean;
  tillatelse?: Permission;
}

const hovedelementer: SidebarElement[] = [
  {
    id: "dashbord",
    label: "Dashbord",
    ikon: <LayoutDashboard className="h-5 w-5" />,
    kreverProsjekt: false,
  },
  {
    id: "sjekklister",
    label: "Sjekklister",
    ikon: <ClipboardCheck className="h-5 w-5" />,
    kreverProsjekt: true,
  },
  {
    id: "oppgaver",
    label: "Oppgaver",
    ikon: <ListTodo className="h-5 w-5" />,
    kreverProsjekt: true,
  },
  {
    id: "maler",
    label: "Maler",
    ikon: <FileText className="h-5 w-5" />,
    kreverProsjekt: true,
    tillatelse: "manage_field",
  },
  {
    id: "tegninger",
    label: "Tegninger",
    ikon: <Map className="h-5 w-5" />,
    kreverProsjekt: true,
  },
  {
    id: "3d-visning",
    label: "3D",
    ikon: <Box className="h-5 w-5" />,
    kreverProsjekt: true,
  },
  {
    id: "tegning-3d",
    label: "Tegning+3D",
    ikon: <Columns2 className="h-5 w-5" />,
    kreverProsjekt: true,
  },
  {
    id: "bilder",
    label: "Bilder",
    ikon: <Image className="h-5 w-5" />,
    kreverProsjekt: true,
  },
  {
    id: "entrepriser",
    label: "Entrepriser",
    ikon: <Building2 className="h-5 w-5" />,
    kreverProsjekt: true,
  },
  {
    id: "mapper",
    label: "Mapper",
    ikon: <FolderOpen className="h-5 w-5" />,
    kreverProsjekt: true,
  },
];

const bunnelementer: SidebarElement[] = [
  {
    id: "oppsett",
    label: "Oppsett",
    ikon: <Settings className="h-5 w-5" />,
    kreverProsjekt: false,
  },
];

export function HovedSidebar() {
  const router = useRouter();
  const { prosjektId } = useProsjekt();
  const aktivSeksjon = useAktivSeksjon();

  const { data: tillatelser } = trpc.gruppe.hentMineTillatelser.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const filtrertHovedelementer = hovedelementer.filter((element) => {
    if (!element.tillatelse) return true;
    if (!tillatelser) return false;
    return tillatelser.includes(element.tillatelse);
  });

  function naviger(element: SidebarElement) {
    if (element.id === "dashbord") {
      router.push(prosjektId ? `/dashbord/${prosjektId}` : "/dashbord");
    } else if (element.id === "oppsett") {
      router.push("/dashbord/oppsett");
    } else if (prosjektId) {
      router.push(`/dashbord/${prosjektId}/${element.id}`);
    }
  }

  return (
    <aside className="hidden w-[60px] flex-col items-center bg-sitedoc-primary py-3 md:flex">
      {/* Hovedelementer */}
      <nav className="flex flex-1 flex-col items-center gap-1">
        {filtrertHovedelementer.map((element) => {
          const deaktivert = element.kreverProsjekt && !prosjektId;
          return (
            <div
              key={element.id}
              className={deaktivert ? "opacity-40" : ""}
            >
              <SidebarIkon
                ikon={element.ikon}
                label={element.label}
                aktiv={aktivSeksjon === element.id}
                onClick={deaktivert ? undefined : () => naviger(element)}
              />
            </div>
          );
        })}
      </nav>

      {/* Bunnelementer */}
      <div className="flex flex-col items-center gap-1 border-t border-white/10 pt-3">
        {bunnelementer.map((element) => {
          const deaktivert = element.kreverProsjekt && !prosjektId;
          return (
            <div
              key={element.id}
              className={deaktivert ? "opacity-40" : ""}
            >
              <SidebarIkon
                ikon={element.ikon}
                label={element.label}
                aktiv={aktivSeksjon === element.id}
                onClick={deaktivert ? undefined : () => naviger(element)}
              />
            </div>
          );
        })}
      </div>
    </aside>
  );
}

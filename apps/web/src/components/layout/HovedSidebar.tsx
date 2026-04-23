"use client";

import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardCheck,
  ClipboardList,
  ListTodo,
  FileText,
  Map,
  Box,
  Image,
  FolderOpen,
  Settings,
  Columns2,
  BarChart3,
  FileSearch,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { SidebarIkon } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { useByggeplass } from "@/kontekst/byggeplass-kontekst";
import { useAktivSeksjon } from "@/hooks/useAktivSeksjon";
import { trpc } from "@/lib/trpc";
import type { Seksjon } from "@/kontekst/navigasjon-kontekst";
import type { Permission } from "@sitedoc/shared";

interface SidebarElement {
  id: Seksjon;
  labelKey: string;
  ikon: JSX.Element;
  kreverProsjekt: boolean;
  tillatelse?: Permission;
  kreverIfc?: boolean;
  kreverModul?: string;
  kreverGruppemodul?: string;
}

const hovedelementer: SidebarElement[] = [
  {
    id: "dashbord",
    labelKey: "nav.dashbord",
    ikon: <LayoutDashboard className="h-5 w-5" />,
    kreverProsjekt: false,
  },
  {
    id: "sjekklister",
    labelKey: "nav.sjekklister",
    ikon: <ClipboardCheck className="h-5 w-5" />,
    kreverProsjekt: true,
    kreverGruppemodul: "sjekklister",
  },
  {
    id: "oppgaver",
    labelKey: "nav.oppgaver",
    ikon: <ListTodo className="h-5 w-5" />,
    kreverProsjekt: true,
    kreverGruppemodul: "oppgaver",
  },
  // Maler er tilgjengelig via Innstillinger → Oppgavemaler / Sjekklistemaler
  {
    id: "tegninger",
    labelKey: "nav.tegninger",
    ikon: <Map className="h-5 w-5" />,
    kreverProsjekt: true,
    kreverGruppemodul: "tegninger",
  },
  {
    id: "3d-visning",
    labelKey: "nav.3d",
    ikon: <Box className="h-5 w-5" />,
    kreverProsjekt: true,
    kreverIfc: true,
    kreverGruppemodul: "3d",
  },
  {
    id: "tegning-3d",
    labelKey: "nav.tegning3d",
    ikon: <Columns2 className="h-5 w-5" />,
    kreverProsjekt: true,
    kreverIfc: true,
  },
  {
    id: "bilder",
    labelKey: "nav.bilder",
    ikon: <Image className="h-5 w-5" />,
    kreverProsjekt: true,
  },
  {
    id: "mapper",
    labelKey: "nav.mapper",
    ikon: <FolderOpen className="h-5 w-5" />,
    kreverProsjekt: true,
  },
  {
    id: "kontrollplan",
    labelKey: "nav.kontrollplan",
    ikon: <ClipboardList className="h-5 w-5" />,
    kreverProsjekt: true,
    kreverModul: "kontrollplan",
  },
  {
    id: "okonomi",
    labelKey: "nav.okonomi",
    ikon: <BarChart3 className="h-5 w-5" />,
    kreverProsjekt: true,
    kreverModul: "okonomi",
  },
  {
    id: "sok",
    labelKey: "nav.sok",
    ikon: <FileSearch className="h-5 w-5" />,
    kreverProsjekt: true,
  },
  {
    id: "psi",
    labelKey: "nav.psi",
    ikon: <ShieldCheck className="h-5 w-5" />,
    kreverProsjekt: true,
    kreverModul: "psi",
  },
  {
    id: "timer",
    labelKey: "nav.timer",
    ikon: <Clock className="h-5 w-5" />,
    kreverProsjekt: true,
  },
];

const bunnelementer: SidebarElement[] = [
  {
    id: "oppsett",
    labelKey: "nav.oppsett",
    ikon: <Settings className="h-5 w-5" />,
    kreverProsjekt: false,
  },
];

export function HovedSidebar() {
  const router = useRouter();
  const { prosjektId } = useProsjekt();
  const aktivSeksjon = useAktivSeksjon();
  const { aktivByggeplass } = useByggeplass();
  const { t } = useTranslation();

  const { data: tillatelser } = trpc.gruppe.hentMineTillatelser.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const { data: aktiveModuler } = trpc.modul.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const { data: minFlytInfo } = trpc.gruppe.hentMinFlytInfo.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  // Hent bygninger med tegninger for å sjekke IFC-tilgjengelighet
  const { data: _bygninger } = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );
  const harIfc = (() => {
    if (!aktivByggeplass || !_bygninger) return false;
    const bygning = (_bygninger as Array<{ id: string; drawings: Array<{ fileType: string | null }> }>)
      .find((b) => b.id === aktivByggeplass.id);
    return bygning?.drawings?.some((d) => d.fileType?.toLowerCase() === "ifc") ?? false;
  })();

  const mineModuler = (minFlytInfo as { moduler?: string[] } | undefined)?.moduler;
  const erAdmin = (minFlytInfo as { erAdmin?: boolean } | undefined)?.erAdmin ?? false;

  const filtrertHovedelementer = hovedelementer.filter((element) => {
    if (element.tillatelse && (!tillatelser || !tillatelser.includes(element.tillatelse))) return false;
    if (element.kreverIfc && !harIfc) return false;
    if (element.kreverModul && (!aktiveModuler || !aktiveModuler.some(
      (m) => m.moduleSlug === element.kreverModul && m.active,
    ))) return false;
    // Gruppemodulsjekk — admin/registrator ser alt
    if (element.kreverGruppemodul && !erAdmin && mineModuler && !mineModuler.includes(element.kreverGruppemodul)) return false;
    return true;
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
                label={t(element.labelKey)}
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
                label={t(element.labelKey)}
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

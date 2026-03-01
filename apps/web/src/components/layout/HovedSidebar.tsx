"use client";

import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardCheck,
  ListTodo,
  FileText,
  Map,
  Building2,
  Settings,
  HelpCircle,
} from "lucide-react";
import { SidebarIkon } from "@siteflow/ui";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { useAktivSeksjon } from "@/hooks/useAktivSeksjon";
import type { Seksjon } from "@/kontekst/navigasjon-kontekst";

interface SidebarElement {
  id: Seksjon;
  label: string;
  ikon: React.ReactNode;
  kreverProsjekt: boolean;
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
  },
  {
    id: "tegninger",
    label: "Tegninger",
    ikon: <Map className="h-5 w-5" />,
    kreverProsjekt: true,
  },
  {
    id: "entrepriser",
    label: "Entrepriser",
    ikon: <Building2 className="h-5 w-5" />,
    kreverProsjekt: true,
  },
];

const bunnelementer: SidebarElement[] = [
  {
    id: "oppsett",
    label: "Oppsett",
    ikon: <Settings className="h-5 w-5" />,
    kreverProsjekt: true,
  },
];

export function HovedSidebar() {
  const router = useRouter();
  const { prosjektId } = useProsjekt();
  const aktivSeksjon = useAktivSeksjon();

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
    <aside className="flex w-[60px] flex-col items-center bg-siteflow-primary py-3">
      {/* Hovedelementer */}
      <nav className="flex flex-1 flex-col items-center gap-1">
        {hovedelementer.map((element) => {
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
        <SidebarIkon
          ikon={<HelpCircle className="h-5 w-5" />}
          label="Hjelp"
          onClick={() => {/* Fremtidig hjelp-dialog */}}
        />
      </div>
    </aside>
  );
}

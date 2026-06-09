"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderKanban, Users, CreditCard, Settings, Building2, Award, Clock, BarChart3, Boxes, Package, Database, ArrowLeft, Calendar, ShieldAlert, MapPin } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { useFirma } from "@/kontekst/firma-kontekst";

interface NavElement {
  label: string;
  href: string;
  ikon: JSX.Element;
  kreverFirmaModul?: "timer" | "varelager";
  kreverSitedocAdmin?: boolean;
  kreverHmsTilgang?: boolean;
}

const navigasjon: NavElement[] = [
  {
    label: "Oversikt",
    href: "/dashbord/firma",
    ikon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    label: "Prosjekter",
    href: "/dashbord/firma/prosjekter",
    ikon: <FolderKanban className="h-4 w-4" />,
  },
  {
    label: "Ansatte",
    href: "/dashbord/firma/ansatte",
    ikon: <Users className="h-4 w-4" />,
  },
  {
    label: "Avdelinger",
    href: "/dashbord/firma/avdelinger",
    ikon: <Building2 className="h-4 w-4" />,
  },
  {
    label: "Oppmøtesteder",
    href: "/dashbord/firma/oppmotesteder",
    ikon: <MapPin className="h-4 w-4" />,
  },
  {
    label: "Kompetanse",
    href: "/dashbord/firma/kompetanse",
    ikon: <Award className="h-4 w-4" />,
  },
  {
    label: "HMS",
    href: "/dashbord/firma/hms",
    ikon: <ShieldAlert className="h-4 w-4" />,
    kreverHmsTilgang: true,
  },
  {
    label: "Moduler",
    href: "/dashbord/firma/moduler",
    ikon: <Boxes className="h-4 w-4" />,
  },
  {
    label: "Timer",
    href: "/dashbord/firma/timer",
    ikon: <Clock className="h-4 w-4" />,
    kreverFirmaModul: "timer",
  },
  {
    label: "Timer-rapport",
    href: "/dashbord/firma/timer/rapport",
    ikon: <BarChart3 className="h-4 w-4" />,
    kreverFirmaModul: "timer",
  },
  {
    label: "Kalender",
    href: "/dashbord/firma/kalender",
    ikon: <Calendar className="h-4 w-4" />,
  },
  {
    label: "Varelager",
    href: "/dashbord/firma/varelager",
    ikon: <Package className="h-4 w-4" />,
    kreverFirmaModul: "varelager",
  },
  {
    label: "Fakturering",
    href: "/dashbord/firma/fakturering",
    ikon: <CreditCard className="h-4 w-4" />,
    kreverSitedocAdmin: true,
  },
  {
    label: "Innstillinger",
    href: "/dashbord/firma/innstillinger",
    ikon: <Settings className="h-4 w-4" />,
  },
  {
    label: "Integrasjoner",
    href: "/dashbord/firma/innstillinger/integrasjoner",
    ikon: <Database className="h-4 w-4" />,
  },
];

export default function FirmaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { valgtFirma, erSitedocAdmin, isLoading } = useFirma();
  const harTimerModul = valgtFirma?.aktiveFirmamoduler.includes("timer") ?? false;
  const harVarelagerModul = valgtFirma?.aktiveFirmamoduler.includes("varelager") ?? false;
  const hmsTilgangQuery = trpc.organisasjon.harHmsTilgang.useQuery(
    { organizationId: valgtFirma?.id ?? "" },
    { enabled: !!valgtFirma?.id },
  );
  const harHmsTilgang = hmsTilgangQuery.data ?? false;

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!valgtFirma) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-500">
          {erSitedocAdmin
            ? "Velg firma fra topbar for å administrere det."
            : "Du har ikke tilgang til firmaadministrasjon."}
        </p>
      </div>
    );
  }

  function erAktiv(href: string) {
    if (href === "/dashbord/firma") return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Firma-sidebar */}
      <aside className="flex w-[280px] flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-3 py-3">
          <Link
            href="/dashbord"
            className="mb-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Tilbake til dashbord
          </Link>
          <h2 className="px-2 text-lg font-semibold text-gray-900">
            {valgtFirma.name}
          </h2>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {navigasjon
            .filter((element) => {
              if (element.kreverFirmaModul === "timer" && !harTimerModul) return false;
              if (element.kreverFirmaModul === "varelager" && !harVarelagerModul) return false;
              if (element.kreverSitedocAdmin && !erSitedocAdmin) return false;
              if (element.kreverHmsTilgang && !harHmsTilgang) return false;
              return true;
            })
            .map((element) => (
              <Link
                key={element.href}
                href={element.href}
                className={`mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  erAktiv(element.href)
                    ? "bg-sitedoc-primary/10 text-sitedoc-primary"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {element.ikon}
                {element.label}
              </Link>
            ))}
        </nav>
      </aside>

      {/* Hovedinnhold */}
      <main className="flex-1 overflow-auto bg-gray-50 p-6">
        {children}
      </main>
    </div>
  );
}

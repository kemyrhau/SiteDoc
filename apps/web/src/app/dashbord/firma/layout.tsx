"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderKanban, Users, CreditCard } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";

const navigasjon = [
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
    label: "Brukere",
    href: "/dashbord/firma/brukere",
    ikon: <Users className="h-4 w-4" />,
  },
  {
    label: "Fakturering",
    href: "/dashbord/firma/fakturering",
    ikon: <CreditCard className="h-4 w-4" />,
  },
];

export default function FirmaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: organisasjon, isLoading } = trpc.organisasjon.hentMin.useQuery();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!organisasjon) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-500">
          Du har ikke tilgang til firmaadministrasjon.
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
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {organisasjon.name}
          </h2>
          {organisasjon.organizationNumber && (
            <p className="text-xs text-gray-500">
              Org.nr: {organisasjon.organizationNumber}
            </p>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {navigasjon.map((element) => (
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
